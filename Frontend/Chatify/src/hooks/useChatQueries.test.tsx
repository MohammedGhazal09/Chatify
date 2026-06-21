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
import { makeChat, makeMessage, makeUser } from '../test/chatFixtures';
import { ensureConversationSecret, hasConversationSecret } from '../utils/encryptedMessages';
import {
  chatsQueryKey,
  messageSearchQueryKey,
  messagesQueryKey,
  pinnedMessagesQueryKey,
  sharedAssetsQueryKey,
  sortChatsForRequester,
  useCreateChat,
  useMessageContext,
  useMessageSearch,
  useOnlinePresence,
  usePinnedMessages,
  useSendMessage,
  useSharedAssets,
  useUpdateChatOrganization,
} from './useChatQueries';

vi.mock('../api/chatApi', () => ({
  chatApi: {
    createChat: vi.fn(),
    createGroupChat: vi.fn(),
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
