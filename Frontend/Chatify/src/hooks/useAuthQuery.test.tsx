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
import type { ActiveSession } from '../types/auth';
import { SESSION_BROADCAST_STORAGE_KEY } from './useSessionBroadcast';
import {
  activeSessionsQueryKey,
  useActiveSessions,
  useLogout,
  useRevokeAllSessions,
  useRevokeSession,
  useSetUsername,
} from './useAuthQuery';

vi.mock('../api/authApi', () => ({
  authApi: {
    logout: vi.fn(),
    getActiveSessions: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllSessions: vi.fn(),
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

const activeSessions: ActiveSession[] = [
  {
    id: 'session-current',
    current: true,
    deviceLabel: 'Chrome on Windows',
    rememberMe: true,
    createdAt: '2026-06-19T08:00:00.000Z',
    lastUsedAt: '2026-06-20T09:15:00.000Z',
    expiresAt: '2026-06-27T09:15:00.000Z',
  },
  {
    id: 'session-remote',
    current: false,
    deviceLabel: 'Safari on iOS',
    rememberMe: false,
    createdAt: '2026-06-18T08:00:00.000Z',
    lastUsedAt: '2026-06-19T12:30:00.000Z',
    expiresAt: '2026-06-20T12:30:00.000Z',
  },
];

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

describe('session management hooks', () => {
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
      user: makeUser(),
      isAuthenticated: true,
      isLoading: false,
    });
    usePresenceStore.setState({
      onlineUsers: new Map([['user-2', { userId: 'user-2', isOnline: true }]]),
      typingUsers: new Map(),
    });
    vi.mocked(authApi.getActiveSessions).mockResolvedValue({
      data: {
        status: 'success',
        data: {
          sessions: activeSessions,
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as AxiosResponse);
    vi.mocked(authApi.revokeSession).mockResolvedValue({
      data: {
        status: 'success',
        data: {
          session: activeSessions[1],
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as AxiosResponse);
    vi.mocked(authApi.revokeAllSessions).mockResolvedValue({
      data: {
        status: 'success',
        data: {
          revokedCount: 2,
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
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads active sessions through the session inventory endpoint', async () => {
    const { result } = renderHook(() => useActiveSessions(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(authApi.getActiveSessions).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(activeSessions);
    expect(result.current.data?.[0]).not.toHaveProperty('userAgentHash');
    expect(result.current.data?.[0]).not.toHaveProperty('ipHash');
  });

  it('revokes one session and refreshes the active session list', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRevokeSession(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('session-remote');
    });

    expect(authApi.revokeSession).toHaveBeenCalledWith('session-remote');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: activeSessionsQueryKey });
  });

  it('clears local private state and broadcasts a remote logout after revoke-all succeeds', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    queryClient.setQueryData(['messages', 'chat-1'], { messages: [{ text: 'PRIVATE_CHAT_MARKER' }] });
    const { result } = renderHook(() => useRevokeAllSessions(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(authApi.revokeAllSessions).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(usePresenceStore.getState().onlineUsers.size).toBe(0);
    expect(queryClient.getQueryData(['messages', 'chat-1'])).toBeUndefined();
    expect(setItemSpy).toHaveBeenCalledWith(
      SESSION_BROADCAST_STORAGE_KEY,
      expect.stringContaining('"reason":"remote"')
    );
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
