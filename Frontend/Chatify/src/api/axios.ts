import axios from "axios";
import { requestQueue, authQueue } from "../utils/requestQueue";
import { resolveApiBaseUrl } from "./apiOrigin";
import type { AxiosRequestConfig } from "axios";
import { broadcastSessionEvent } from "../hooks/useSessionBroadcast";

export const AUTH_EXPIRED_EVENT = 'chatify:auth-expired';

export const dispatchAuthExpired = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    broadcastSessionEvent('auth-expired', 'refresh_failed');
  }
};

const axiosInstance = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true,
});

type ChatifyAxiosConfig = AxiosRequestConfig & {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
};

const unsafeMethods = new Set(['post', 'put', 'patch', 'delete']);
let refreshPromise: Promise<void> | null = null;

const readCookie = (name: string) => {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(name.length + 1));
};

const shouldAttachCsrf = (config: AxiosRequestConfig) => (
  unsafeMethods.has((config.method ?? 'get').toLowerCase()) &&
  !config.url?.includes('/api/csrf-token')
);

const shouldAttemptRefresh = (config: ChatifyAxiosConfig) => {
  if (config._skipAuthRefresh || config._retry) {
    return false;
  }

  const url = config.url ?? '';
  if (url.includes('/api/auth/refresh-token')) {
    return false;
  }

  return ![
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/forgot-password',
    '/api/auth/verify-reset-code',
    '/api/auth/reset-password',
  ].some((authUrl) => url.includes(authUrl));
};

export const refreshAuthSession = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      if (!readCookie('XSRF-TOKEN')) {
        await axiosInstance.get('/api/csrf-token', { _skipAuthRefresh: true } as ChatifyAxiosConfig);
      }

      await axiosInstance.post(
        '/api/auth/refresh-token',
        undefined,
        { _skipAuthRefresh: true } as ChatifyAxiosConfig
      );
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

axiosInstance.interceptors.request.use((config) => {
  if (shouldAttachCsrf(config)) {
    const csrfToken = readCookie('XSRF-TOKEN');

    if (csrfToken) {
      config.headers = config.headers ?? {};
      if ('set' in config.headers && typeof config.headers.set === 'function') {
        config.headers.set('X-CSRF-Token', csrfToken);
      } else {
        (config.headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
      }
    }
  }

  return config;
});

/**
 * Make a queued request (prevents server overload)
 * @param requestFn - Function that returns an axios promise
 * @param priority - Higher = processed first (default 0)
 */
export const queuedRequest = async <T>(
  requestFn: () => Promise<T>,
  priority = 0
): Promise<T> => {
  return requestQueue.add(requestFn, priority);
};

/**
 * High priority request for auth operations
 */
export const authRequest = async <T>(
  requestFn: () => Promise<T>
): Promise<T> => {
  return authQueue.add(requestFn, 10);
};

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalConfig = (error?.config || {}) as ChatifyAxiosConfig;
    
    // Rate limited - pause queue and retry after delay
    if (status === 429) {
      console.warn('⚠️ Rate limited. Pausing queue...');
      requestQueue.pause();
      
      const retryAfter = parseInt(error.response?.headers['retry-after'] || '5', 10);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      
      requestQueue.resume();
      return axiosInstance(originalConfig);
    }
    
    // Unauthenticated - refresh token and retry once
    if (status === 401 && shouldAttemptRefresh(originalConfig)) {
      try {
        originalConfig._retry = true;
        await refreshAuthSession();
        return axiosInstance(originalConfig);
      } catch {
        dispatchAuthExpired();
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
