import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messageApi } from '../api/messageApi';
import { userApi } from '../api/userApi';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import { makeMessage, makeUser } from '../test/chatFixtures';
import {
  messageSearchQueryKey,
  messagesQueryKey,
  pinnedMessagesQueryKey,
  sharedAssetsQueryKey,
  useMessageSearch,
  useOnlinePresence,
  usePinnedMessages,
  useSharedAssets,
} from './useChatQueries';

vi.mock('../api/messageApi', () => ({
  messageApi: {
    searchMessages: vi.fn(),
    getSharedAssets: vi.fn(),
    getPinnedMessages: vi.fn(),
  },
}));

vi.mock('../api/userApi', () => ({
  userApi: {
    getOnlineUsers: vi.fn(),
  },
}));

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useMessageSearch', () => {
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
      onlineUsers: new Map(),
      typingUsers: new Map(),
    });
    vi.mocked(messageApi.searchMessages).mockResolvedValue({
      data: {
        status: 'messages searched successfully',
        data: {
          messages: [makeMessage({ _id: 'message-search', text: 'Search hit' })],
          query: 'search',
          limit: 25,
        },
      },
    } as Awaited<ReturnType<typeof messageApi.searchMessages>>);
    vi.mocked(messageApi.getSharedAssets).mockResolvedValue({
      data: {
        status: 'shared assets fetched successfully',
        data: {
          assets: [
            {
              _id: 'attachment-1',
              attachmentId: 'attachment-1',
              messageId: 'message-1',
              chatId: 'chat-1',
              uploader: 'user-1',
              displayName: 'diagram.png',
              mimeType: 'image/png',
              size: 1024,
              kind: 'media',
              status: 'active',
              createdAt: '2026-06-08T10:00:00.000Z',
            },
          ],
          kind: 'media',
          cursor: { hasMore: false, nextCursor: null, limit: 12 },
        },
      },
    } as unknown as Awaited<ReturnType<typeof messageApi.getSharedAssets>>);
    vi.mocked(messageApi.getPinnedMessages).mockResolvedValue({
      data: {
        status: 'pinned messages fetched successfully',
        data: {
          pinnedMessages: [
            {
              messageId: 'message-1',
              chatId: 'chat-1',
              sender: 'user-1',
              text: 'Pinned retry note',
              attachments: [],
              pinned: true,
              pinnedBy: 'user-1',
              pinnedAt: '2026-06-08T10:05:00.000Z',
              createdAt: '2026-06-08T10:00:00.000Z',
              updatedAt: '2026-06-08T10:05:00.000Z',
            },
          ],
          limit: 20,
        },
      },
    } as unknown as Awaited<ReturnType<typeof messageApi.getPinnedMessages>>);
    vi.mocked(userApi.getOnlineUsers).mockResolvedValue({
      data: {
        status: 'success',
        data: {
          onlineUsers: [],
          allContacts: [
            {
              _id: 'user-2',
              firstName: 'Online',
              lastName: 'Contact',
              isOnline: true,
              isCallReachable: true,
            },
            {
              _id: 'user-3',
              firstName: 'Away',
              lastName: 'Contact',
              isOnline: false,
              isCallReachable: false,
              lastSeen: '2026-06-14T01:00:00.000Z',
            },
          ],
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as unknown as Awaited<ReturnType<typeof userApi.getOnlineUsers>>);
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('suppresses searches below two trimmed characters', () => {
    const { result } = renderHook(() => useMessageSearch('chat-1', ' a '), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isBelowMinimum).toBe(true);
    expect(result.current.normalizedQuery).toBe('');
    expect(messageApi.searchMessages).not.toHaveBeenCalled();
  });

  it('debounces server search and keeps results out of the durable messages cache', async () => {
    const { result } = renderHook(() => useMessageSearch('chat-1', ' search '), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isSearching).toBe(true);
    expect(messageApi.searchMessages).not.toHaveBeenCalled();

    await new Promise((resolve) => {
      window.setTimeout(resolve, 250);
    });
    expect(result.current.isSearching).toBe(true);
    expect(messageApi.searchMessages).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(messageApi.searchMessages).toHaveBeenCalledWith('chat-1', {
        q: 'search',
        limit: 25,
      });
    });

    await waitFor(() => {
      expect(result.current.data?.[0]?.text).toBe('Search hit');
    });
    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });

    expect(queryClient.getQueryData(messageSearchQueryKey('chat-1', 'search'))).toEqual([
      expect.objectContaining({ _id: 'message-search' }),
    ]);
    expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toBeUndefined();
  });

  it('scopes shared asset and pinned-message queries by chat id and kind', async () => {
    const sharedAssets = renderHook(() => useSharedAssets('chat-1', 'media'), {
      wrapper: createWrapper(queryClient),
    });
    const pinnedMessages = renderHook(() => usePinnedMessages('chat-1'), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(sharedAssets.result.current.data?.[0]?.displayName).toBe('diagram.png');
    });
    await waitFor(() => {
      expect(pinnedMessages.result.current.data?.[0]?.text).toBe('Pinned retry note');
    });

    expect(messageApi.getSharedAssets).toHaveBeenCalledWith('chat-1', { kind: 'media', limit: 12 });
    expect(messageApi.getPinnedMessages).toHaveBeenCalledWith('chat-1');
    expect(queryClient.getQueryData(sharedAssetsQueryKey('chat-1', 'media'))).toEqual([
      expect.objectContaining({ attachmentId: 'attachment-1' }),
    ]);
    expect(queryClient.getQueryData(pinnedMessagesQueryKey('chat-1'))).toEqual([
      expect.objectContaining({ messageId: 'message-1' }),
    ]);
  });

  it('hydrates the presence store from the HTTP presence fallback', async () => {
    const { result } = renderHook(() => useOnlinePresence(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(2);
    });

    expect(userApi.getOnlineUsers).toHaveBeenCalledTimes(1);
    expect(usePresenceStore.getState().onlineUsers.get('user-2')).toMatchObject({
      userName: 'Online Contact',
      isOnline: true,
      isCallReachable: true,
    });
    expect(usePresenceStore.getState().onlineUsers.get('user-3')).toMatchObject({
      isOnline: false,
      isCallReachable: false,
      lastSeen: '2026-06-14T01:00:00.000Z',
    });
  });

  it('does not overwrite realtime presence state when fallback store sync is disabled', async () => {
    vi.mocked(userApi.getOnlineUsers).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          onlineUsers: [],
          allContacts: [
            {
              _id: 'user-2',
              firstName: 'Online',
              lastName: 'Contact',
              isOnline: false,
              isCallReachable: false,
              lastSeen: '2026-06-14T01:00:00.000Z',
            },
          ],
        },
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    } as unknown as Awaited<ReturnType<typeof userApi.getOnlineUsers>>);

    usePresenceStore.getState().setUserOnline('user-2', {
      userId: 'user-2',
      userName: 'Realtime Contact',
      isOnline: true,
      isCallReachable: true,
    });

    const { result } = renderHook(() => useOnlinePresence({ syncToStore: false }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.data?.[0]).toMatchObject({
        userId: 'user-2',
        isOnline: false,
        isCallReachable: false,
      });
    });

    expect(usePresenceStore.getState().onlineUsers.get('user-2')).toMatchObject({
      userName: 'Realtime Contact',
      isOnline: true,
      isCallReachable: true,
    });
  });
});
