import axios from "axios";
import { requestQueue, authQueue } from "../utils/requestQueue";

export const AUTH_EXPIRED_EVENT = 'chatify:auth-expired';

export const dispatchAuthExpired = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
};

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
  withCredentials: true,
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
    const originalConfig = error?.config || {};
    
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
    if (status === 401 && !originalConfig._retry && !originalConfig.url?.includes('/refresh-token')) {
      try {
        originalConfig._retry = true;
        await axiosInstance.post('/api/auth/refresh-token');
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
