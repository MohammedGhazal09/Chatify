import type { AxiosAdapter } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import axiosInstance, { AUTH_EXPIRED_EVENT } from './axios';

describe('axios auth refresh handling', () => {
  const originalAdapter = axiosInstance.defaults.adapter;

  afterEach(() => {
    axiosInstance.defaults.adapter = originalAdapter;
    document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    vi.clearAllMocks();
  });

  it('dispatches auth-expired when refresh recovery fails', async () => {
    const authExpiredListener = vi.fn();
    const adapter: AxiosAdapter = vi.fn(async (config) => {
      if (config.url === '/api/protected') {
        return Promise.reject({
          config,
          response: {
            status: 401,
            config,
            data: {},
            headers: {},
          },
        });
      }

      if (config.url === '/api/auth/refresh-token') {
        return Promise.reject({
          config,
          response: {
            status: 401,
            config,
            data: {},
            headers: {},
          },
        });
      }

      return {
        config,
        data: {},
        headers: {},
        status: 200,
        statusText: 'OK',
      };
    });

    axiosInstance.defaults.adapter = adapter;
    window.addEventListener(AUTH_EXPIRED_EVENT, authExpiredListener);

    await expect(axiosInstance.get('/api/protected')).rejects.toBeTruthy();

    expect(authExpiredListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, authExpiredListener);
  });

  it('shares one refresh request across concurrent 401 recoveries', async () => {
    let refreshCalls = 0;
    const adapter: AxiosAdapter = vi.fn(async (config) => {
      if (config.url === '/api/csrf-token') {
        return {
          config,
          data: {},
          headers: {},
          status: 204,
          statusText: 'No Content',
        };
      }

      if (config.url === '/api/auth/refresh-token') {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          config,
          data: {},
          headers: {},
          status: 200,
          statusText: 'OK',
        };
      }

      if (config.url?.startsWith('/api/protected')) {
        if ((config as { _retry?: boolean })._retry) {
          return {
            config,
            data: { ok: true },
            headers: {},
            status: 200,
            statusText: 'OK',
          };
        }

        return Promise.reject({
          config,
          response: {
            status: 401,
            config,
            data: {},
            headers: {},
          },
        });
      }

      throw new Error(`Unexpected request ${config.url}`);
    });

    axiosInstance.defaults.adapter = adapter;

    await expect(Promise.all([
      axiosInstance.get('/api/protected-a'),
      axiosInstance.get('/api/protected-b'),
    ])).resolves.toHaveLength(2);

    expect(refreshCalls).toBe(1);
  });

  it('attaches the CSRF token to multipart profile image updates', async () => {
    document.cookie = 'XSRF-TOKEN=profile-csrf-token; path=/';
    const adapter: AxiosAdapter = vi.fn(async (config) => ({
      config,
      data: {},
      headers: {},
      status: 200,
      statusText: 'OK',
    }));

    axiosInstance.defaults.adapter = adapter;

    const formData = new FormData();
    formData.append('profileImage', new File(['image'], 'avatar.png', { type: 'image/png' }));

    await axiosInstance.patch('/api/user/profile-image', formData);

    const config = vi.mocked(adapter).mock.calls[0]?.[0];
    const headers = config?.headers as { get?: (name: string) => string | null; [key: string]: unknown } | undefined;
    const csrfHeader = headers?.get?.('X-CSRF-Token') ?? headers?.['X-CSRF-Token'];

    expect(csrfHeader).toBe('profile-csrf-token');
  });
});
