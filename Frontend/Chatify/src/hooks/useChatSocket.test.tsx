import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import { makeChat, makeMessage, makeUser } from '../test/chatFixtures';
import { isSoundEnabled, playCallEndedSound, playNotificationSound } from '../utils/sounds';
import type { CallSessionPayload, Chat } from '../types/chat';
import { chatsQueryKey, messagesQueryKey, pinnedMessagesQueryKey } from './useChatQueries';
import type { MessagesCacheData } from './messageCache';
import { useChatSocket } from './useChatSocket';

type SocketEventHandler = (...args: unknown[]) => void;

const socketMockState = vi.hoisted(() => {
  type MockSocket = {
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    trigger: (event: string, ...args: unknown[]) => void;
    triggerIo: (event: string, ...args: unknown[]) => void;
    io: {
      on: ReturnType<typeof vi.fn>;
      off: ReturnType<typeof vi.fn>;
    };
  };

  const sockets: Array<{
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    trigger: (event: string, ...args: unknown[]) => void;
    triggerIo: (event: string, ...args: unknown[]) => void;
    io: {
      on: ReturnType<typeof vi.fn>;
      off: ReturnType<typeof vi.fn>;
    };
  }> = [];

  const createSocket = () => {
    const handlers = new Map<string, Set<SocketEventHandler>>();
    const ioHandlers = new Map<string, Set<SocketEventHandler>>();
    const socket = {} as MockSocket;

    const addHandler = (
      registry: Map<string, Set<SocketEventHandler>>,
      event: string,
      handler: SocketEventHandler
    ) => {
      const eventHandlers = registry.get(event) ?? new Set<SocketEventHandler>();
      eventHandlers.add(handler);
      registry.set(event, eventHandlers);
    };

    const removeHandler = (
      registry: Map<string, Set<SocketEventHandler>>,
      event: string,
      handler: SocketEventHandler
    ) => {
      registry.get(event)?.delete(handler);
    };

    socket.connected = true;
    socket.emit = vi.fn();
    socket.on = vi.fn((event: string, handler: SocketEventHandler) => {
      addHandler(handlers, event, handler);
      return socket;
    });
    socket.off = vi.fn((event: string, handler: SocketEventHandler) => {
      removeHandler(handlers, event, handler);
      return socket;
    });
    socket.disconnect = vi.fn();
    socket.trigger = (event: string, ...args: unknown[]) => {
      if (event === 'connect') {
        socket.connected = true;
      }

      if (event === 'disconnect' || event === 'connect_error') {
        socket.connected = false;
      }

      handlers.get(event)?.forEach((handler) => handler(...args));
    };
    socket.triggerIo = (event: string, ...args: unknown[]) => {
      if (event === 'reconnect') {
        socket.connected = true;
      }

      ioHandlers.get(event)?.forEach((handler) => handler(...args));
    };
    socket.io = {
      on: vi.fn((event: string, handler: SocketEventHandler) => {
        addHandler(ioHandlers, event, handler);
        return socket.io;
      }),
      off: vi.fn((event: string, handler: SocketEventHandler) => {
        removeHandler(ioHandlers, event, handler);
        return socket.io;
      }),
    };

    sockets.push(socket);
    return socket;
  };

  return { sockets, createSocket };
});

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketMockState.createSocket()),
}));

vi.mock('../utils/sounds', () => ({
  isSoundEnabled: vi.fn(() => false),
  playCallEndedSound: vi.fn(),
  playNotificationSound: vi.fn(),
}));

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useChatSocket', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    socketMockState.sockets.length = 0;
    vi.mocked(io).mockClear();
    useAuthStore.setState({
      user: makeUser({ _id: 'user-1' }),
      isAuthenticated: true,
      isLoading: false,
    });
    usePresenceStore.setState({
      onlineUsers: new Map(),
      typingUsers: new Map(),
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it('clears previous chat typing state immediately when the selected chat changes', async () => {
    const { rerender, unmount } = renderHook(
      ({ chatId }) => useChatSocket({ chatId }),
      {
        initialProps: { chatId: 'chat-1' },
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    expect(io).toHaveBeenCalledWith('http://localhost:3000', expect.objectContaining({
      transports: ['polling', 'websocket'],
      withCredentials: true,
    }));

    act(() => {
      usePresenceStore.getState().setUserTyping('chat-1', {
        chatId: 'chat-1',
        userId: 'user-2',
        userName: 'Grace Hopper',
        isTyping: true,
      });
    });

    expect(usePresenceStore.getState().getTypingUsersForChat('chat-1')).toHaveLength(1);

    rerender({ chatId: 'chat-2' });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-2');
    });

    expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:leave', 'chat-1');
    expect(usePresenceStore.getState().getTypingUsersForChat('chat-1')).toEqual([]);

    unmount();
  });

  it('applies realtime message, receipt, edit, reaction, delete, and unread events to query cache', async () => {
    queryClient.setQueryData<MessagesCacheData>(messagesQueryKey('chat-1'), {
      messages: [
        makeMessage({ _id: 'message-1', chatId: 'chat-1', text: 'Original text', status: 'sent' }),
        makeMessage({ _id: 'message-delete', chatId: 'chat-1', text: 'Delete me' }),
      ],
    });
    queryClient.setQueryData(chatsQueryKey, [
      makeChat({ _id: 'chat-1', latestMessage: null, updatedAt: '2026-06-08T10:00:00.000Z' }),
    ]);
    queryClient.setQueryData(['unreadCounts', 'chat-1'], new Map([['chat-1', 1]]));

    renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];
    const incoming = makeMessage({
      _id: 'message-new',
      chatId: 'chat-1',
      sender: 'user-2',
      text: 'Realtime message',
      status: 'delivered',
      createdAt: '2026-06-08T10:05:00.000Z',
      updatedAt: '2026-06-08T10:05:00.000Z',
    });

    act(() => {
      socket.trigger('message:new', incoming);
      socket.trigger('message:status-update', {
        messageId: 'message-1',
        chatId: 'chat-1',
        status: 'read',
        read: true,
      });
      socket.trigger('message:edited', {
        messageId: 'message-1',
        chatId: 'chat-1',
        text: 'Edited text',
        isEdited: true,
        editedAt: '2026-06-08T10:06:00.000Z',
      });
      socket.trigger('message:reaction', {
        messageId: 'message-1',
        chatId: 'chat-1',
        reactions: [{ user: 'user-2', emoji: 'ok' }],
        action: 'added',
        userId: 'user-2',
        emoji: 'ok',
      });
      socket.trigger('message:deleted', {
        messageId: 'message-delete',
        chatId: 'chat-1',
        deleteForEveryone: false,
      });
      socket.trigger('unread:update', {
        chatId: 'chat-1',
        userId: 'user-1',
        count: 0,
      });
    });

    const messagesCache = queryClient.getQueryData<MessagesCacheData>(messagesQueryKey('chat-1'));
    expect(messagesCache?.messages.map((message) => message._id)).toEqual(['message-1', 'message-new']);
    expect(messagesCache?.messages.find((message) => message._id === 'message-1')).toMatchObject({
      text: 'Edited text',
      status: 'read',
      isEdited: true,
      reactions: [{ user: 'user-2', emoji: 'ok' }],
    });
    expect(queryClient.getQueryData<Chat[]>(chatsQueryKey)?.[0]?.latestMessage).toMatchObject({
      _id: 'message-new',
      text: 'Realtime message',
    });
    expect(queryClient.getQueryData<Map<string, number>>(['unreadCounts', 'chat-1'])?.get('chat-1')).toBe(0);
  });

  it('acknowledges incoming delivery only after the message is cached', async () => {
    queryClient.setQueryData<MessagesCacheData>(messagesQueryKey('chat-1'), { messages: [] });
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData');

    renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];
    const incoming = makeMessage({
      _id: 'message-delivery-ack',
      chatId: 'chat-1',
      sender: 'user-2',
      text: 'Realtime delivery',
    });

    act(() => {
      socket.trigger('message:new', incoming);
    });

    const messagesCache = queryClient.getQueryData<MessagesCacheData>(messagesQueryKey('chat-1'));
    expect(messagesCache?.messages).toEqual([expect.objectContaining({ _id: 'message-delivery-ack' })]);
    expect(socket.emit).toHaveBeenCalledWith('message:delivered', {
      messageId: 'message-delivery-ack',
      chatId: 'chat-1',
    });

    const messageCacheCallIndex = setQueryDataSpy.mock.calls.findIndex(([queryKey]) => (
      Array.isArray(queryKey) && queryKey[0] === 'messages' && queryKey[1] === 'chat-1'
    ));
    const deliveryEmitCallIndex = socket.emit.mock.calls.findIndex(([eventName]) => eventName === 'message:delivered');

    expect(messageCacheCallIndex).toBeGreaterThanOrEqual(0);
    expect(deliveryEmitCallIndex).toBeGreaterThanOrEqual(0);
    expect(setQueryDataSpy.mock.invocationCallOrder[messageCacheCallIndex]).toBeLessThan(
      socket.emit.mock.invocationCallOrder[deliveryEmitCallIndex]
    );
  });

  it('does not acknowledge delivery for the sender socket echo', async () => {
    renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];

    act(() => {
      socket.trigger('message:new', makeMessage({
        _id: 'message-self-echo',
        chatId: 'chat-1',
        sender: 'user-1',
        text: 'Own echo',
      }));
    });

    expect(socket.emit).not.toHaveBeenCalledWith('message:delivered', expect.anything());
    expect(queryClient.getQueryData<MessagesCacheData>(messagesQueryKey('chat-1'))?.messages).toEqual([
      expect.objectContaining({ _id: 'message-self-echo' }),
    ]);
  });

  it('uses the call-ended sound for ended call activity messages', async () => {
    vi.mocked(isSoundEnabled).mockReturnValue(true);

    renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];

    act(() => {
      socket.trigger('message:new', makeMessage({
        _id: 'call-ended-message',
        chatId: 'chat-1',
        sender: 'user-2',
        text: '',
        messageType: 'call',
        callActivity: {
          callId: 'call-1',
          callerId: 'user-2',
          calleeId: 'user-1',
          mode: 'audio',
          result: 'ended',
          startedAt: '2026-06-13T10:00:00.000Z',
          endedAt: '2026-06-13T10:02:00.000Z',
          durationSeconds: 120,
        },
      }));
    });

    expect(playCallEndedSound).toHaveBeenCalledTimes(1);
    expect(playNotificationSound).not.toHaveBeenCalled();
  });

  it('reconciles attachment messages and pin events while invalidating detail queries', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    queryClient.setQueryData<MessagesCacheData>(messagesQueryKey('chat-1'), {
      messages: [
        makeMessage({
          _id: 'optimistic-client-file',
          clientMessageId: 'client-file',
          chatId: 'chat-1',
          sender: 'user-1',
          text: '',
          optimisticState: 'sending',
          attachments: [
            {
              _id: 'optimistic-attachment',
              attachmentId: 'optimistic-attachment',
              displayName: 'diagram.png',
              mimeType: 'image/png',
              size: 1024,
              kind: 'media',
              status: 'active',
              localPreviewUrl: 'blob:diagram',
            },
          ],
        }),
      ],
    });

    const onMessagePinned = vi.fn();
    const onMessageUnpinned = vi.fn();

    renderHook(() => useChatSocket({ chatId: 'chat-1', onMessagePinned, onMessageUnpinned }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];
    const serverAttachmentMessage = makeMessage({
      _id: 'server-file',
      clientMessageId: 'client-file',
      chatId: 'chat-1',
      sender: 'user-1',
      text: '',
      attachments: [
        {
          _id: 'attachment-server',
          attachmentId: 'attachment-server',
          displayName: 'diagram.png',
          mimeType: 'image/png',
          size: 1024,
          kind: 'media',
          status: 'active',
        },
      ],
      createdAt: '2026-06-08T10:05:00.000Z',
      updatedAt: '2026-06-08T10:05:00.000Z',
    });

    act(() => {
      socket.trigger('message:new', serverAttachmentMessage);
      socket.trigger('message:pinned', {
        chatId: 'chat-1',
        messageId: 'server-file',
        message: { ...serverAttachmentMessage, pinned: true, pinnedBy: 'user-1', pinnedAt: '2026-06-08T10:06:00.000Z' },
        pinnedMessage: {
          messageId: 'server-file',
          chatId: 'chat-1',
          sender: 'user-1',
          text: '',
          attachments: serverAttachmentMessage.attachments ?? [],
          pinned: true,
          pinnedBy: 'user-1',
          pinnedAt: '2026-06-08T10:06:00.000Z',
          createdAt: serverAttachmentMessage.createdAt,
          updatedAt: '2026-06-08T10:06:00.000Z',
        },
      });
      socket.trigger('message:unpinned', {
        chatId: 'chat-2',
        messageId: 'unrelated-message',
        message: makeMessage({ _id: 'unrelated-message', chatId: 'chat-2', pinned: false }),
        pinnedMessage: {
          messageId: 'unrelated-message',
          chatId: 'chat-2',
          sender: 'user-2',
          text: 'Other chat',
          attachments: [],
          pinned: false,
          createdAt: '2026-06-08T10:00:00.000Z',
          updatedAt: '2026-06-08T10:00:00.000Z',
        },
      });
    });

    const selectedMessages = queryClient.getQueryData<MessagesCacheData>(messagesQueryKey('chat-1'));
    const unrelatedMessages = queryClient.getQueryData<MessagesCacheData>(messagesQueryKey('chat-2'));

    expect(selectedMessages?.messages).toHaveLength(1);
    expect(selectedMessages?.messages[0]).toMatchObject({
      _id: 'server-file',
      clientMessageId: 'client-file',
      pinned: true,
      attachments: [expect.objectContaining({ attachmentId: 'attachment-server' })],
    });
    expect(unrelatedMessages?.messages[0]).toMatchObject({ _id: 'unrelated-message', chatId: 'chat-2' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sharedAssets', 'chat-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pinnedMessagesQueryKey('chat-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pinnedMessagesQueryKey('chat-2') });
    expect(onMessagePinned).toHaveBeenCalledWith(expect.objectContaining({ chatId: 'chat-1', messageId: 'server-file' }));
    expect(onMessageUnpinned).not.toHaveBeenCalled();
  });

  it('applies typing, presence, socket ready, and reconnect events', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];

    act(() => {
      socket.trigger('user:status-change', {
        userId: 'user-2',
        userName: 'Cipher Node',
        isOnline: true,
      });
      socket.trigger('user:typing', {
        chatId: 'chat-1',
        userId: 'user-2',
        userName: 'Cipher Node',
        isTyping: true,
      });
      socket.trigger('socket:ready', {
        userId: 'user-1',
        socketId: 'socket-1',
        joinedChats: 1,
        presence: [
          { userId: 'user-3', userName: 'Data Sync', isOnline: true },
        ],
      });
      socket.triggerIo('reconnect');
    });

    expect(usePresenceStore.getState().onlineUsers.get('user-3')).toMatchObject({
      userName: 'Data Sync',
      isOnline: true,
    });
    expect(usePresenceStore.getState().getTypingUsersForChat('chat-1')).toEqual([
      expect.objectContaining({ userId: 'user-2', isTyping: true }),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chatsQueryKey });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['unreadCounts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: messagesQueryKey('chat-1') });
  });

  it('publishes disconnect state and blocks call emits while disconnected', async () => {
    const { result } = renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];
    expect(result.current.isSocketConnected).toBe(true);

    act(() => {
      socket.trigger('disconnect', 'transport close');
    });

    expect(result.current.isSocketConnected).toBe(false);

    let ack: unknown;
    await act(async () => {
      ack = await result.current.emitCallStart({ chatId: 'chat-1', mode: 'audio' });
    });

    expect(ack).toMatchObject({
      ok: false,
      event: 'call:start',
      code: 'socket_unavailable',
    });
    expect(socket.emit.mock.calls.some(([eventName]) => eventName === 'call:start')).toBe(false);

    act(() => {
      socket.triggerIo('reconnect');
    });

    expect(result.current.isSocketConnected).toBe(true);
  });

  it('routes realtime call events and resolves call acknowledgements', async () => {
    const onCallIncoming = vi.fn();
    const onCallSync = vi.fn();
    const onCallOffer = vi.fn();
    const onCallAnswer = vi.fn();
    const onCallIceCandidate = vi.fn();
    const callConfig = {
      iceServers: [{ urls: 'stun:stun.example.test:3478' }],
      turnReady: false,
      productionReady: false,
    };
    const session: CallSessionPayload = {
      callId: 'call-1',
      chatId: 'chat-1',
      callerId: 'user-1',
      calleeId: 'user-2',
      mode: 'audio',
      status: 'ringing',
      startedAt: '2026-06-13T10:00:00.000Z',
    };

    const { result } = renderHook(
      () => useChatSocket({
        chatId: 'chat-1',
        onCallIncoming,
        onCallSync,
        onCallOffer,
        onCallAnswer,
        onCallIceCandidate,
      }),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];

    act(() => {
      socket.trigger('socket:ready', {
        userId: 'user-1',
        socketId: 'socket-1',
        joinedChats: 1,
        callConfig,
      });
      socket.trigger('call:incoming', session);
      socket.trigger('call:sync', { ...session, status: 'connected' });
      socket.trigger('call:offer', {
        callId: 'call-1',
        chatId: 'chat-1',
        fromUserId: 'user-1',
        signal: { type: 'offer', sdp: 'offer-sdp' },
      });
      socket.trigger('call:answer', {
        callId: 'call-1',
        chatId: 'chat-1',
        fromUserId: 'user-2',
        signal: { type: 'answer', sdp: 'answer-sdp' },
      });
      socket.trigger('call:ice-candidate', {
        callId: 'call-1',
        chatId: 'chat-1',
        fromUserId: 'user-2',
        signal: { candidate: 'candidate', sdpMid: '0', sdpMLineIndex: 0 },
      });
    });

    await waitFor(() => {
      expect(result.current.callConfig).toEqual(callConfig);
    });
    expect(onCallIncoming).toHaveBeenCalledWith(session);
    expect(onCallSync).toHaveBeenCalledWith(expect.objectContaining({ callId: 'call-1', status: 'connected' }));
    expect(onCallOffer).toHaveBeenCalledWith(expect.objectContaining({ signal: { type: 'offer', sdp: 'offer-sdp' } }));
    expect(onCallAnswer).toHaveBeenCalledWith(expect.objectContaining({ signal: { type: 'answer', sdp: 'answer-sdp' } }));
    expect(onCallIceCandidate).toHaveBeenCalledWith(expect.objectContaining({
      signal: expect.objectContaining({ candidate: 'candidate' }),
    }));

    socket.emit.mockImplementationOnce((event: string, _payload: unknown, ack?: (response: unknown) => void) => {
      ack?.({
        ok: true,
        event,
        ...session,
      });
      return socket;
    });

    let ack: unknown;
    await act(async () => {
      ack = await result.current.emitCallStart({ chatId: 'chat-1', mode: 'audio' });
    });

    expect(socket.emit).toHaveBeenCalledWith('call:start', { chatId: 'chat-1', mode: 'audio' }, expect.any(Function));
    expect(ack).toMatchObject({ ok: true, event: 'call:start', callId: 'call-1' });
  });
});
