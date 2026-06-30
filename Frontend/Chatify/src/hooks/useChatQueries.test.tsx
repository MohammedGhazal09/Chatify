import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { AxiosProgressEvent } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatApi } from '../api/chatApi';
import { messageApi } from '../api/messageApi';
import { userApi } from '../api/userApi';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import { makeChat, makeMessage, makeSavedMessage, makeUser } from '../test/chatFixtures';
import type { Message } from '../types/chat';
import { ensureConversationSecret, hasConversationSecret } from '../utils/encryptedMessages';
import {
  chatsQueryKey,
  contactRequestsQueryKey,
  messageSearchQueryKey,
  messagesQueryKey,
  pinnedMessagesQueryKey,
  savedMessagesQueryKey,
  sharedAssetsQueryKey,
  sortChatsForRequester,
  useAcceptContactRequest,
  useCancelContactRequest,
  useCreateChat,
  useContactRequests,
  useDeclineContactRequest,
  useMessageContext,
  useMessageSearch,
  useOnlinePresence,
  usePinnedMessages,
  useSaveMessage,
  useSavedMessages,
  useSendMessage,
  useSharedAssets,
  useUnsaveMessage,
  useUpdateChatOrganization,
} from './useChatQueries';

vi.mock('../api/chatApi', () => ({
  chatApi: {
    createChat: vi.fn(),
    createGroupChat: vi.fn(),
    getContactRequests: vi.fn(),
    createContactRequest: vi.fn(),
    acceptContactRequest: vi.fn(),
    declineContactRequest: vi.fn(),
    cancelContactRequest: vi.fn(),
    updateChatOrganization: vi.fn(),
  },
}));

vi.mock('../api/messageApi', () => ({
  messageApi: {
    createMessage: vi.fn(),
    searchMessages: vi.fn(),
    getMessageContext: vi.fn(),
    getSharedAssets: vi.fn(),
    getPinnedMessages: vi.fn(),
    listSavedMessages: vi.fn(),
    saveMessage: vi.fn(),
    unsaveMessage: vi.fn(),
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
    window.localStorage.clear();
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
    vi.mocked(messageApi.getMessageContext).mockResolvedValue({
      data: {
        status: 'message context fetched successfully',
        data: {
          targetMessageId: 'message-context',
          messages: [
            makeMessage({ _id: 'message-context-before', text: 'Before context', createdAt: '2026-06-08T09:59:00.000Z' }),
            makeMessage({ _id: 'message-context', text: 'Context target', createdAt: '2026-06-08T10:00:00.000Z' }),
          ],
          cursor: {
            nextCursor: 'cursor-context',
            hasMore: true,
            limit: 25,
          },
          context: {
            hasMoreBefore: true,
            hasMoreAfter: false,
            limit: 25,
          },
        },
      },
    } as Awaited<ReturnType<typeof messageApi.getMessageContext>>);
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
    vi.mocked(messageApi.listSavedMessages).mockResolvedValue({
      data: {
        status: 'saved messages fetched successfully',
        data: {
          savedMessages: [
            makeSavedMessage({
              messageId: 'message-saved',
              message: makeMessage({
                _id: 'message-saved',
                text: 'Saved retry note',
                savedByRequester: true,
                savedAt: '2026-06-08T10:05:00.000Z',
              }),
            }),
          ],
          limit: 50,
        },
      },
    } as unknown as Awaited<ReturnType<typeof messageApi.listSavedMessages>>);
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
        senderId: null,
        type: 'all',
        from: null,
        to: null,
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

  it('searches with filters even when the text query is empty', async () => {
    const { result } = renderHook(() => useMessageSearch('chat-1', '', {
      senderId: 'user-2',
      type: 'voice',
      from: '2026-06-01',
      to: '2026-06-20',
    }), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isBelowMinimum).toBe(false);

    await waitFor(() => {
      expect(messageApi.searchMessages).toHaveBeenCalledWith('chat-1', {
        q: '',
        limit: 25,
        senderId: 'user-2',
        type: 'voice',
        from: '2026-06-01',
        to: '2026-06-20',
      });
    });
    await waitFor(() => {
      expect(result.current.messages[0]?._id).toBe('message-search');
    });
  });

  it('merges message context windows into the durable cache for unloaded search jumps', async () => {
    const { result } = renderHook(() => useMessageContext(), {
      wrapper: createWrapper(queryClient),
    });

    queryClient.setQueryData(messagesQueryKey('chat-1'), {
      messages: [
        makeMessage({ _id: 'message-existing', text: 'Existing newer', createdAt: '2026-06-08T10:05:00.000Z' }),
      ],
      cursor: { nextCursor: null, hasMore: false, limit: 50 },
    });

    await act(async () => {
      await result.current.mutateAsync({
        chatId: 'chat-1',
        messageId: 'message-context',
        limit: 25,
      });
    });

    expect(messageApi.getMessageContext).toHaveBeenCalledWith('chat-1', 'message-context', { limit: 25 });
    expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toMatchObject({
      messages: [
        expect.objectContaining({ _id: 'message-context-before' }),
        expect.objectContaining({ _id: 'message-context' }),
        expect.objectContaining({ _id: 'message-existing' }),
      ],
      cursor: {
        nextCursor: 'cursor-context',
        hasMore: true,
        limit: 25,
      },
    });
  });

  it('scopes shared asset, pinned-message, and saved-message queries', async () => {
    const sharedAssets = renderHook(() => useSharedAssets('chat-1', 'media'), {
      wrapper: createWrapper(queryClient),
    });
    const pinnedMessages = renderHook(() => usePinnedMessages('chat-1'), {
      wrapper: createWrapper(queryClient),
    });
    const savedMessages = renderHook(() => useSavedMessages(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(sharedAssets.result.current.data?.[0]?.displayName).toBe('diagram.png');
    });
    await waitFor(() => {
      expect(pinnedMessages.result.current.data?.[0]?.text).toBe('Pinned retry note');
    });
    await waitFor(() => {
      expect(savedMessages.result.current.data?.[0]?.message.text).toBe('Saved retry note');
    });

    expect(messageApi.getSharedAssets).toHaveBeenCalledWith('chat-1', { kind: 'media', limit: 12 });
    expect(messageApi.getPinnedMessages).toHaveBeenCalledWith('chat-1');
    expect(messageApi.listSavedMessages).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(sharedAssetsQueryKey('chat-1', 'media'))).toEqual([
      expect.objectContaining({ attachmentId: 'attachment-1' }),
    ]);
    expect(queryClient.getQueryData(pinnedMessagesQueryKey('chat-1'))).toEqual([
      expect.objectContaining({ messageId: 'message-1' }),
    ]);
    expect(queryClient.getQueryData(savedMessagesQueryKey)).toEqual([
      expect.objectContaining({ messageId: 'message-saved' }),
    ]);
  });

  it('patches cached message save state without creating unopened timelines', async () => {
    queryClient.setQueryData(messagesQueryKey('chat-1'), {
      messages: [makeMessage({ _id: 'message-save', chatId: 'chat-1', savedByRequester: false })],
    });
    queryClient.setQueryData(savedMessagesQueryKey, [
      makeSavedMessage({
        messageId: 'message-save',
        chatId: 'chat-1',
        message: makeMessage({ _id: 'message-save', chatId: 'chat-1', savedByRequester: true }),
      }),
      makeSavedMessage({
        _id: 'saved-other',
        messageId: 'message-other',
        chatId: 'chat-other',
        message: makeMessage({ _id: 'message-other', chatId: 'chat-other', savedByRequester: true }),
      }),
    ]);
    vi.mocked(messageApi.saveMessage).mockResolvedValue({
      data: {
        status: 'message saved successfully',
        data: {
          message: makeMessage({
            _id: 'message-save',
            chatId: 'chat-1',
            text: 'Saved cache state',
            savedByRequester: true,
            savedAt: '2026-06-08T10:06:00.000Z',
          }),
          savedMessage: makeSavedMessage({ messageId: 'message-save', chatId: 'chat-1' }),
          savedByRequester: true,
        },
      },
    } as unknown as Awaited<ReturnType<typeof messageApi.saveMessage>>);
    vi.mocked(messageApi.unsaveMessage).mockResolvedValue({
      data: {
        status: 'message unsaved successfully',
        data: {
          message: makeMessage({
            _id: 'message-other',
            chatId: 'chat-other',
            text: 'Unopened chat message',
            savedByRequester: false,
            savedAt: null,
          }),
          savedMessage: null,
          savedByRequester: false,
        },
      },
    } as unknown as Awaited<ReturnType<typeof messageApi.unsaveMessage>>);

    const saveMutation = renderHook(() => useSaveMessage(), {
      wrapper: createWrapper(queryClient),
    });
    const unsaveMutation = renderHook(() => useUnsaveMessage(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await saveMutation.result.current.mutateAsync({ messageId: 'message-save', chatId: 'chat-1' });
      await unsaveMutation.result.current.mutateAsync({ messageId: 'message-other', chatId: 'chat-other' });
    });

    expect(messageApi.saveMessage).toHaveBeenCalledWith('message-save');
    expect(messageApi.unsaveMessage).toHaveBeenCalledWith('message-other');
    expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toMatchObject({
      messages: [expect.objectContaining({ _id: 'message-save', savedByRequester: true })],
    });
    expect(queryClient.getQueryData(messagesQueryKey('chat-other'))).toBeUndefined();
    expect(queryClient.getQueryData(savedMessagesQueryKey)).toEqual([
      expect.objectContaining({ messageId: 'message-save' }),
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

  it('sorts pinned conversations before newer unpinned conversations', () => {
    const pinned = makeChat({
      _id: 'chat-pinned',
      updatedAt: '2026-06-08T08:00:00.000Z',
      organizationState: {
        muted: false,
        archived: false,
        pinned: true,
        favorite: false,
      },
    });
    const newer = makeChat({
      _id: 'chat-newer',
      updatedAt: '2026-06-08T11:00:00.000Z',
      organizationState: {
        muted: false,
        archived: false,
        pinned: false,
        favorite: false,
      },
    });

    expect(sortChatsForRequester([newer, pinned]).map((chat) => chat._id)).toEqual([
      'chat-pinned',
      'chat-newer',
    ]);
  });

  it('merges server-backed conversation organization updates into the chat cache', async () => {
    const initialChat = makeChat({
      _id: 'chat-1',
      organizationState: {
        muted: false,
        archived: false,
        pinned: false,
        favorite: false,
      },
    });
    const updatedChat = {
      ...initialChat,
      organizationState: {
        muted: true,
        archived: true,
        pinned: true,
        favorite: true,
      },
    };
    queryClient.setQueryData(chatsQueryKey, [initialChat]);
    vi.mocked(chatApi.updateChatOrganization).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          chat: updatedChat,
        },
      },
    } as Awaited<ReturnType<typeof chatApi.updateChatOrganization>>);

    const { result } = renderHook(() => useUpdateChatOrganization(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        chatId: 'chat-1',
        patch: {
          muted: true,
          archived: true,
          pinned: true,
          favorite: true,
        },
      });
    });

    await waitFor(() => {
      expect(chatApi.updateChatOrganization).toHaveBeenCalledWith('chat-1', {
        muted: true,
        archived: true,
        pinned: true,
        favorite: true,
      });
    });
    expect(queryClient.getQueryData(chatsQueryKey)).toEqual([
      expect.objectContaining({
        organizationState: {
          muted: true,
          archived: true,
          pinned: true,
          favorite: true,
        },
      }),
    ]);
  });

  it('loads pending contact requests through the shared query key', async () => {
    const contactRequest = {
      _id: 'request-1',
      requester: makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper', username: 'grace.hopper' }),
      recipient: makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', username: 'ada.lovelace' }),
      status: 'pending',
      direction: 'incoming',
      chat: null,
      createdAt: '2026-06-30T08:00:00.000Z',
      updatedAt: '2026-06-30T08:00:00.000Z',
      respondedAt: null,
    };
    vi.mocked(chatApi.getContactRequests).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          incoming: [contactRequest],
          outgoing: [],
        },
      },
    } as unknown as Awaited<ReturnType<typeof chatApi.getContactRequests>>);

    const { result } = renderHook(() => useContactRequests(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.data?.incoming[0]?._id).toBe('request-1');
    });

    expect(queryClient.getQueryData(contactRequestsQueryKey)).toEqual({
      incoming: [expect.objectContaining({ _id: 'request-1' })],
      outgoing: [],
    });
  });

  it('keeps pending create-chat responses out of the chat cache', async () => {
    const contactRequest = {
      _id: 'request-1',
      requester: makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', username: 'ada.lovelace' }),
      recipient: makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper', username: 'grace.hopper' }),
      status: 'pending',
      direction: 'outgoing',
      chat: null,
      createdAt: '2026-06-30T08:00:00.000Z',
      updatedAt: '2026-06-30T08:00:00.000Z',
      respondedAt: null,
    };
    vi.mocked(chatApi.createChat).mockResolvedValueOnce({
      data: {
        status: 'contact request pending',
        data: {
          contactRequest,
        },
      },
    } as unknown as Awaited<ReturnType<typeof chatApi.createChat>>);

    const { result } = renderHook(() => useCreateChat(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      const createResult = await result.current.mutateAsync({
        targetUsername: 'grace.hopper',
      });
      expect(createResult).toEqual({
        kind: 'contactRequest',
        contactRequest,
      });
    });

    expect(queryClient.getQueryData(chatsQueryKey)).toBeUndefined();
  });

  it('accepts contact requests and merges the returned chat', async () => {
    const chat = makeChat({ _id: 'chat-accepted' });
    vi.mocked(chatApi.acceptContactRequest).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          contactRequest: {
            _id: 'request-1',
            requester: makeUser({ _id: 'user-2', username: 'grace.hopper' }),
            recipient: makeUser({ _id: 'user-1', username: 'ada.lovelace' }),
            status: 'accepted',
            direction: 'incoming',
            chat: 'chat-accepted',
            createdAt: '2026-06-30T08:00:00.000Z',
            updatedAt: '2026-06-30T08:01:00.000Z',
            respondedAt: '2026-06-30T08:01:00.000Z',
          },
          chat,
        },
      },
    } as unknown as Awaited<ReturnType<typeof chatApi.acceptContactRequest>>);

    const { result } = renderHook(() => useAcceptContactRequest(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync('request-1');
    });

    expect(chatApi.acceptContactRequest).toHaveBeenCalledWith('request-1');
    expect(queryClient.getQueryData(chatsQueryKey)).toEqual([
      expect.objectContaining({ _id: 'chat-accepted' }),
    ]);
  });

  it('declines and cancels contact requests through lifecycle mutations', async () => {
    const contactRequest = {
      _id: 'request-1',
      requester: makeUser({ _id: 'user-1', username: 'ada.lovelace' }),
      recipient: makeUser({ _id: 'user-2', username: 'grace.hopper' }),
      status: 'declined',
      direction: 'incoming',
      chat: null,
      createdAt: '2026-06-30T08:00:00.000Z',
      updatedAt: '2026-06-30T08:01:00.000Z',
      respondedAt: '2026-06-30T08:01:00.000Z',
    };
    vi.mocked(chatApi.declineContactRequest).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          contactRequest,
        },
      },
    } as unknown as Awaited<ReturnType<typeof chatApi.declineContactRequest>>);
    vi.mocked(chatApi.cancelContactRequest).mockResolvedValueOnce({
      data: {
        status: 'success',
        data: {
          contactRequest: {
            ...contactRequest,
            status: 'canceled',
            direction: 'outgoing',
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof chatApi.cancelContactRequest>>);

    const decline = renderHook(() => useDeclineContactRequest(), {
      wrapper: createWrapper(queryClient),
    });
    const cancel = renderHook(() => useCancelContactRequest(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await decline.result.current.mutateAsync('request-1');
      await cancel.result.current.mutateAsync('request-2');
    });

    expect(chatApi.declineContactRequest).toHaveBeenCalledWith('request-1');
    expect(chatApi.cancelContactRequest).toHaveBeenCalledWith('request-2');
  });

  it('creates encrypted conversations and stores the local conversation secret', async () => {
    const encryptedChat = makeChat({
      _id: 'chat-encrypted',
      encryptionMode: 'e2ee_v1',
    });
    vi.mocked(chatApi.createChat).mockResolvedValueOnce({
      data: {
        status: 'chat created successfully',
        data: {
          chat: encryptedChat,
        },
      },
    } as Awaited<ReturnType<typeof chatApi.createChat>>);

    const { result } = renderHook(() => useCreateChat(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        targetUsername: 'grace.hopper',
        encryptionMode: 'e2ee_v1',
      });
    });

    expect(chatApi.createChat).toHaveBeenCalledWith({
      targetUsername: 'grace.hopper',
      encryptionMode: 'e2ee_v1',
    });
    expect(hasConversationSecret('chat-encrypted')).toBe(true);
    expect(queryClient.getQueryData(chatsQueryKey)).toEqual([
      expect.objectContaining({
        _id: 'chat-encrypted',
        encryptionMode: 'e2ee_v1',
      }),
    ]);
  });
});

describe('useSendMessage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    window.localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        mutations: {
          retry: false,
        },
        queries: {
          retry: false,
        },
      },
    });
    useAuthStore.setState({
      user: makeUser({ _id: 'user-1' }),
      isAuthenticated: true,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('tracks upload progress and keeps local drafts on optimistic messages', async () => {
    const file = new File(['voice'], 'voice-message.webm', { type: 'audio/webm' });
    const draft = {
      id: 'voice-draft',
      file,
      displayName: 'voice-message.webm',
      mimeType: 'audio/webm',
      size: file.size,
      kind: 'voice' as const,
      durationSeconds: 2.5,
    };
    vi.mocked(messageApi.createMessage).mockImplementation((_payload, options) => {
      options?.onUploadProgress?.({ loaded: 5, total: 10 } as AxiosProgressEvent);
      return Promise.resolve({
        data: {
          status: 'message created successfully',
          data: {
            message: makeMessage({
              _id: 'message-voice',
              chatId: 'chat-1',
              sender: 'user-1',
              text: '',
              clientMessageId: 'client-voice',
              attachments: [{
                _id: 'attachment-1',
                attachmentId: 'attachment-1',
                displayName: 'voice-message.webm',
                mimeType: 'audio/webm',
                size: file.size,
                kind: 'voice',
                durationSeconds: 2.5,
                status: 'active',
              }],
            }),
          },
        },
      } as Awaited<ReturnType<typeof messageApi.createMessage>>);
    });

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        chatId: 'chat-1',
        text: '',
        clientMessageId: 'client-voice',
        attachments: [draft],
        optimisticAttachments: [{
          _id: 'optimistic-attachment-1',
          attachmentId: 'optimistic-attachment-1',
          displayName: 'voice-message.webm',
          mimeType: 'audio/webm',
          size: file.size,
          kind: 'voice',
          durationSeconds: 2.5,
          status: 'active',
        }],
      });
    });

    await waitFor(() => {
      expect(result.current.uploadStates['client-voice']).toMatchObject({
        status: 'completed',
        progress: 100,
      });
    });

    expect(messageApi.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [draft],
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        onUploadProgress: expect.any(Function),
      })
    );
    expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toMatchObject({
      messages: [
        expect.objectContaining({
          _id: 'message-voice',
          attachments: [
            expect.objectContaining({
              kind: 'voice',
              durationSeconds: 2.5,
            }),
          ],
        }),
      ],
    });
  });

  it('sends reply targets and keeps optimistic reply metadata until canonical success', async () => {
    const replyTo: NonNullable<Message['replyTo']> = {
      messageId: 'message-source',
      sender: 'user-2',
      messageType: 'text',
      textPreview: 'Original source context',
      attachmentCount: 0,
      isDeleted: false,
      isEncrypted: false,
      createdAt: '2026-06-08T09:59:00.000Z',
    };
    let resolveCreateMessage: ((value: Awaited<ReturnType<typeof messageApi.createMessage>>) => void) | undefined;
    const createMessagePromise = new Promise<Awaited<ReturnType<typeof messageApi.createMessage>>>((resolve) => {
      resolveCreateMessage = resolve;
    });
    vi.mocked(messageApi.createMessage).mockReturnValue(createMessagePromise as ReturnType<typeof messageApi.createMessage>);

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        chatId: 'chat-1',
        text: 'Reply body',
        clientMessageId: 'client-reply',
        replyToMessageId: 'message-source',
        optimisticReplyTo: replyTo,
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toMatchObject({
        messages: [
          expect.objectContaining({
            _id: 'optimistic-client-reply',
            optimisticState: 'sending',
            replyTo,
          }),
        ],
      });
    });

    expect(messageApi.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'chat-1',
        text: 'Reply body',
        clientMessageId: 'client-reply',
        replyToMessageId: 'message-source',
      }),
      undefined
    );

    await act(async () => {
      resolveCreateMessage?.({
        data: {
          status: 'message created successfully',
          data: {
            message: makeMessage({
              _id: 'message-reply',
              chatId: 'chat-1',
              sender: 'user-1',
              text: 'Reply body',
              clientMessageId: 'client-reply',
              replyTo,
            }),
          },
        },
      } as Awaited<ReturnType<typeof messageApi.createMessage>>);
      await createMessagePromise;
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toMatchObject({
        messages: [
          expect.objectContaining({
            _id: 'message-reply',
            optimisticState: undefined,
            replyTo,
          }),
        ],
      });
    });
  });

  it('sends mention targets and keeps optimistic mention metadata until canonical success', async () => {
    const optimisticMentions: NonNullable<Message['mentions']> = [
      {
        userId: 'user-2',
        username: 'grace.hopper',
        displayName: 'Grace Hopper',
      },
    ];
    let resolveCreateMessage: ((value: Awaited<ReturnType<typeof messageApi.createMessage>>) => void) | undefined;
    const createMessagePromise = new Promise<Awaited<ReturnType<typeof messageApi.createMessage>>>((resolve) => {
      resolveCreateMessage = resolve;
    });
    vi.mocked(messageApi.createMessage).mockReturnValue(createMessagePromise as ReturnType<typeof messageApi.createMessage>);

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        chatId: 'chat-1',
        text: '@grace.hopper please review',
        clientMessageId: 'client-mention',
        mentionUserIds: ['user-2'],
        optimisticMentions,
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toMatchObject({
        messages: [
          expect.objectContaining({
            _id: 'optimistic-client-mention',
            optimisticState: 'sending',
            mentions: optimisticMentions,
          }),
        ],
      });
    });

    expect(messageApi.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'chat-1',
        text: '@grace.hopper please review',
        clientMessageId: 'client-mention',
        mentionUserIds: ['user-2'],
      }),
      undefined
    );

    await act(async () => {
      resolveCreateMessage?.({
        data: {
          status: 'message created successfully',
          data: {
            message: makeMessage({
              _id: 'message-mention',
              chatId: 'chat-1',
              sender: 'user-1',
              text: '@grace.hopper please review',
              clientMessageId: 'client-mention',
              mentions: optimisticMentions,
            }),
          },
        },
      } as Awaited<ReturnType<typeof messageApi.createMessage>>);
      await createMessagePromise;
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toMatchObject({
        messages: [
          expect.objectContaining({
            _id: 'message-mention',
            optimisticState: undefined,
            mentions: optimisticMentions,
          }),
        ],
      });
    });
  });

  it('encrypts e2ee sends without passing plaintext text to the message API', async () => {
    ensureConversationSecret('chat-1');
    vi.mocked(messageApi.createMessage).mockResolvedValue({
      data: {
        status: 'message created successfully',
        data: {
          message: makeMessage({
            _id: 'message-encrypted',
            chatId: 'chat-1',
            sender: 'user-1',
            text: '',
            clientMessageId: 'client-encrypted',
            messageType: 'encrypted',
            encryptionMode: 'e2ee_v1',
            encryptedPayload: {
              ciphertext: 'server-ciphertext',
              iv: 'server-iv',
              algorithm: 'AES-GCM',
              keyVersion: 1,
              senderDeviceId: 'device-1',
              encryptedAt: '2026-06-20T00:00:00.000Z',
            },
          }),
        },
      },
    } as Awaited<ReturnType<typeof messageApi.createMessage>>);

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        chatId: 'chat-1',
        text: ' Private encrypted text ',
        clientMessageId: 'client-encrypted',
        encryptionMode: 'e2ee_v1',
      });
    });

    await waitFor(() => {
      expect(messageApi.createMessage).toHaveBeenCalledTimes(1);
    });

    const [payload] = vi.mocked(messageApi.createMessage).mock.calls[0];
    expect(payload).toMatchObject({
      chatId: 'chat-1',
      text: '',
      clientMessageId: 'client-encrypted',
      encryptedPayload: expect.objectContaining({
        algorithm: 'AES-GCM',
        keyVersion: 1,
        ciphertext: expect.any(String),
        iv: expect.any(String),
      }),
    });
    expect(JSON.stringify(payload)).not.toContain('Private encrypted text');

    await waitFor(() => {
      expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toMatchObject({
        messages: [
          expect.objectContaining({
            _id: 'message-encrypted',
            text: '',
            messageType: 'encrypted',
            encryptionMode: 'e2ee_v1',
            decryptedText: 'Private encrypted text',
          }),
        ],
      });
    });
  });

  it('blocks encrypted reply attempts before calling the message API', async () => {
    ensureConversationSecret('chat-1');
    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        chatId: 'chat-1',
        text: 'Secret reply',
        clientMessageId: 'client-encrypted-reply',
        encryptionMode: 'e2ee_v1',
        replyToMessageId: 'message-source',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe('Replies are unavailable in encrypted conversations in this release.');
    expect(messageApi.createMessage).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toBeUndefined();
  });

  it('blocks encrypted sends when the local conversation secret is missing', async () => {
    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        chatId: 'chat-1',
        text: 'Secret missing',
        clientMessageId: 'client-missing-secret',
        encryptionMode: 'e2ee_v1',
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(messageApi.createMessage).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(messagesQueryKey('chat-1'))).toBeUndefined();
  });

  it('aborts in-flight attachment uploads by client message id', async () => {
    let capturedSignal: { aborted?: boolean } | undefined;
    const file = new File(['hello'], 'message-states-spec.pdf', { type: 'application/pdf' });
    const draft = {
      id: 'file-draft',
      file,
      displayName: 'message-states-spec.pdf',
      mimeType: 'application/pdf',
      size: file.size,
      kind: 'file' as const,
    };

    vi.mocked(messageApi.createMessage).mockImplementation((_payload, options) => {
      const signal = options?.signal as AbortSignal | undefined;
      capturedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Upload canceled', 'AbortError'));
        });
      }) as ReturnType<typeof messageApi.createMessage>;
    });

    const { result } = renderHook(() => useSendMessage(), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        chatId: 'chat-1',
        text: '',
        clientMessageId: 'client-abort',
        attachments: [draft],
        optimisticAttachments: [],
      });
    });

    await waitFor(() => {
      expect(messageApi.createMessage).toHaveBeenCalled();
    });
    act(() => {
      result.current.cancelUpload('client-abort');
    });

    await waitFor(() => {
      expect(capturedSignal?.aborted).toBe(true);
      expect(result.current.uploadStates['client-abort']).toMatchObject({
        status: 'aborted',
        errorMessage: 'Upload canceled',
      });
    });
  });
});
