import type { PropsWithChildren } from 'react';
import type { AxiosResponse } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/authApi';
import { userApi } from '../api/userApi';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import { makeUser } from '../test/chatFixtures';
import { SESSION_BROADCAST_STORAGE_KEY } from './useSessionBroadcast';
import { useLogout, useSetUsername } from './useAuthQuery';

vi.mock('../api/authApi', () => ({
  authApi: {
    logout: vi.fn(),
  },
}));

vi.mock('../api/userApi', () => ({
  userApi: {
    setUsername: vi.fn(),
  },
}));

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const logoutResponse = {
  data: { status: 'success' },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
} as AxiosResponse;

describe('useLogout', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.mocked(authApi.logout).mockResolvedValue(logoutResponse);
    useAuthStore.setState({
      user: makeUser(),
      isAuthenticated: true,
      isLoading: false,
    });
    usePresenceStore.setState({
      onlineUsers: new Map([['user-2', { userId: 'user-2', isOnline: true }]]),
      typingUsers: new Map(),
    });
    queryClient.setQueryData(['messages', 'chat-1'], { messages: [{ text: 'PRIVATE_CHAT_MARKER' }] });
  });

  afterEach(() => {
    queryClient.clear();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('clears auth, presence, and private query state after logout succeeds', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(usePresenceStore.getState().onlineUsers.size).toBe(0);
    expect(queryClient.getQueryData(['messages', 'chat-1'])).toBeUndefined();
    expect(setItemSpy).toHaveBeenCalledWith(
      SESSION_BROADCAST_STORAGE_KEY,
      expect.stringContaining('"type":"logout"')
    );
  });

  it('still clears local private state when the logout request fails', async () => {
    vi.mocked(authApi.logout).mockRejectedValueOnce(new Error('logout failed'));
    const { result } = renderHook(() => useLogout(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
    expect(usePresenceStore.getState().onlineUsers.size).toBe(0);
    expect(queryClient.getQueryData(['messages', 'chat-1'])).toBeUndefined();
  });
});

describe('useSetUsername', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    useAuthStore.setState({
      user: makeUser({ username: undefined }),
      isAuthenticated: true,
      isLoading: false,
    });
    vi.mocked(userApi.setUsername).mockResolvedValue({
      data: {
        status: 'success',
        data: {
          user: makeUser({ username: 'ada.lovelace' }),
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as AxiosResponse);
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it('updates auth state and auth query data after username setup succeeds', async () => {
    const { result } = renderHook(() => useSetUsername(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('ada.lovelace');
    });

    expect(userApi.setUsername).toHaveBeenCalledWith({ username: 'ada.lovelace' });
    expect(useAuthStore.getState().user?.username).toBe('ada.lovelace');
    expect(queryClient.getQueryData(['auth'])).toMatchObject({
      username: 'ada.lovelace',
    });
  });
});
