import type { AxiosAdapter } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import axiosInstance, { AUTH_EXPIRED_EVENT } from './axios';

describe('axios auth refresh handling', () => {
  const originalAdapter = axiosInstance.defaults.adapter;

  afterEach(() => {
    axiosInstance.defaults.adapter = originalAdapter;
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
});
