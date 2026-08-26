import type { PropsWithChildren } from 'react';
import type { AxiosResponse } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi } from '../api/authApi';
import { userApi } from '../api/userApi';
import { useAuthStore } from '../store/authstore';
import { makeUser } from '../test/chatFixtures';
import { revokeChatifyPushNotifications } from '../utils/pushNotifications';
import { useAuthInit, useLogout, useRevokeAllSessions } from './useAuthQuery';

vi.mock('../api/authApi', () => ({
  authApi: {
    fetchCSRFToken: vi.fn(),
    checkAuth: vi.fn(),
    getLoggedUser: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    revokeAllSessions: vi.fn(),
  },
}));

vi.mock('../api/userApi', () => ({
  userApi: {
    removePushSubscription: vi.fn(),
  },
}));

vi.mock('../utils/pushNotifications', () => ({
  revokeChatifyPushNotifications: vi.fn(),
}));

const createWrapper = (queryClient: QueryClient) => (
  ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
);

const axiosResponse = <T,>(data: T) => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
}) as AxiosResponse<T>;

const PUSH_ENDPOINT = 'https://push.example.test/subscriptions/session-browser';

describe('Phase 17 authentication and PWA cleanup', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    window.history.pushState(null, '', '/login');
    useAuthStore.setState({
      user: makeUser(),
      isAuthenticated: true,
      isLoading: false,
    });
    vi.mocked(authApi.fetchCSRFToken).mockResolvedValue(axiosResponse({}));
    vi.mocked(authApi.checkAuth).mockResolvedValue(axiosResponse({ token: false }));
    vi.mocked(authApi.logout).mockResolvedValue(axiosResponse({ status: 'success' }));
    vi.mocked(authApi.revokeAllSessions).mockResolvedValue(axiosResponse({
      status: 'success',
      data: { revokedCount: 2 },
    }));
    vi.mocked(userApi.removePushSubscription).mockResolvedValue(axiosResponse({
      status: 'success',
      data: {
        preferences: {
          pushEnabled: false,
          emailNotificationsEnabled: false,
          messagePreviewMode: 'none',
          emailUnsubscribed: false,
          pushSubscriptionCount: 0,
          mutedChatIds: [],
        },
      },
    }));
    vi.mocked(revokeChatifyPushNotifications).mockImplementation(async (removeFromServer) => {
      if (removeFromServer) {
        await removeFromServer(PUSH_ENDPOINT);
      }

      return {
        endpoint: PUSH_ENDPOINT,
        browserUnsubscribed: true,
        serverRemoved: Boolean(removeFromServer),
      };
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('removes a stale browser subscription when an anonymous login surface initializes', async () => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });

    renderHook(() => useAuthInit(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    expect(revokeChatifyPushNotifications).toHaveBeenCalledWith();
    expect(userApi.removePushSubscription).not.toHaveBeenCalled();
  });

  it('removes the server mapping and browser subscription before explicit logout', async () => {
    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(revokeChatifyPushNotifications).toHaveBeenCalledTimes(1);
    expect(userApi.removePushSubscription).toHaveBeenCalledWith(PUSH_ENDPOINT);
    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(userApi.removePushSubscription).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(authApi.logout).mock.invocationCallOrder[0]);
  });

  it('removes the current browser push state before revoking all sessions', async () => {
    const { result } = renderHook(() => useRevokeAllSessions(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(userApi.removePushSubscription).toHaveBeenCalledWith(PUSH_ENDPOINT);
    expect(authApi.revokeAllSessions).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(userApi.removePushSubscription).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(authApi.revokeAllSessions).mock.invocationCallOrder[0]);
  });
});
