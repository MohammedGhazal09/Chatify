import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import { makeAttachment, makeChat, makeMessage, makeSpace, makeSpaceChannel, makeUser } from '../test/chatFixtures';
import { isSoundEnabled, playCallEndedSound, playNotificationSound } from '../utils/sounds';
import type { CallSessionPayload, Chat, ConversationControls, UserOnlineStatus } from '../types/chat';
import {
  chatsQueryKey,
  messagesQueryKey,
  onlinePresenceQueryKey,
  pinnedMessagesQueryKey,
  userSearchQueryKey,
  usersQueryKey,
} from './useChatQueries';
import { spaceChannelsQueryKey, spacesQueryKey } from './useSpaceQueries';
import type { MessagesCacheData } from './messageCache';
import { useChatSocket } from './useChatSocket';

type SocketEventHandler = (...args: unknown[]) => void;

const socketMockState = vi.hoisted(() => {
  type ConnectEvent = {
    event: string;
    args: unknown[];
  };

  type MockSocket = {
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    trigger: (event: string, ...args: unknown[]) => void;
    triggerIo: (event: string, ...args: unknown[]) => void;
    io: {
      on: ReturnType<typeof vi.fn>;
      off: ReturnType<typeof vi.fn>;
      reconnection: ReturnType<typeof vi.fn>;
    };
  };

  const sockets: Array<{
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    trigger: (event: string, ...args: unknown[]) => void;
    triggerIo: (event: string, ...args: unknown[]) => void;
    io: {
      on: ReturnType<typeof vi.fn>;
      off: ReturnType<typeof vi.fn>;
      reconnection: ReturnType<typeof vi.fn>;
    };
  }> = [];

  let readyPayloadOnConnect: unknown;
  let eventsOnConnect: ConnectEvent[] = [];

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

    socket.connected = false;
    socket.emit = vi.fn();
    socket.on = vi.fn((event: string, handler: SocketEventHandler) => {
      addHandler(handlers, event, handler);
      return socket;
    });
    socket.off = vi.fn((event: string, handler: SocketEventHandler) => {
      removeHandler(handlers, event, handler);
      return socket;
    });
    socket.disconnect = vi.fn(() => {
      socket.connected = false;
      return socket;
    });
    socket.connect = vi.fn(() => {
      socket.connected = true;
      handlers.get('connect')?.forEach((handler) => handler());

      if (readyPayloadOnConnect) {
        handlers.get('socket:ready')?.forEach((handler) => handler(readyPayloadOnConnect));
      }

      eventsOnConnect.forEach(({ event, args }) => {
        handlers.get(event)?.forEach((handler) => handler(...args));
      });

      return socket;
    });
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
      reconnection: vi.fn(() => socket.io),
    };

    sockets.push(socket);
    return socket;
  };

  return {
    sockets,
    createSocket,
    setReadyPayloadOnConnect: (payload: unknown) => {
      readyPayloadOnConnect = payload;
    },
    setEventsOnConnect: (events: ConnectEvent[]) => {
      eventsOnConnect = events;
    },
    clearReadyPayloadOnConnect: () => {
      readyPayloadOnConnect = undefined;
      eventsOnConnect = [];
    },
  };
});

const axiosMockState = vi.hoisted(() => ({
  refreshAuthSession: vi.fn(),
  dispatchAuthExpired: vi.fn(),
}));

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketMockState.createSocket()),
}));

vi.mock('../api/axios', () => ({
  refreshAuthSession: axiosMockState.refreshAuthSession,
  dispatchAuthExpired: axiosMockState.dispatchAuthExpired,
}));

vi.mock('../utils/sounds', () => ({
  isSoundEnabled: vi.fn(() => false),
  playCallEndedSound: vi.fn(),
  playNotificationSound: vi.fn(),
}));

const originalNotification = window.Notification;

const installNotificationMock = (permission: NotificationPermission = 'granted') => {
  const notifications: Array<{ title: string; options?: NotificationOptions }> = [];

  function NotificationMock(title: string, options?: NotificationOptions) {
    notifications.push({ title, options });
  }

  Object.defineProperty(NotificationMock, 'permission', {
    configurable: true,
    value: permission,
  });
  Object.defineProperty(NotificationMock, 'requestPermission', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: NotificationMock,
  });

  return notifications;
};

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
    socketMockState.clearReadyPayloadOnConnect();
    vi.mocked(io).mockClear();
    axiosMockState.refreshAuthSession.mockResolvedValue(undefined);
    axiosMockState.dispatchAuthExpired.mockClear();
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
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: originalNotification,
    });
    vi.clearAllMocks();
  });

  it('registers socket readiness listeners before connecting', async () => {
    socketMockState.setReadyPayloadOnConnect({
      userId: 'user-1',
      socketId: 'socket-ready',
      joinedChats: 1,
      presence: [
        { userId: 'user-2', userName: 'Grace Hopper', isOnline: true, isCallReachable: true },
      ],
    });

    const { result } = renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.socketStatus).toBe('ready');
    });

    const socket = socketMockState.sockets[0];
    const readyListenerCallIndex = socket.on.mock.calls.findIndex(([eventName]) => eventName === 'socket:ready');

    expect(readyListenerCallIndex).toBeGreaterThanOrEqual(0);
    expect(socket.on.mock.invocationCallOrder[readyListenerCallIndex]).toBeLessThan(
      socket.connect.mock.invocationCallOrder[0]
    );
    await waitFor(() => {
      expect(usePresenceStore.getState().onlineUsers.get('user-2')).toMatchObject({
        isOnline: true,
        isCallReachable: true,
      });
    });
  });

  it('handles messages emitted during socket connect before follow-up effects can run', async () => {
    const incoming = makeMessage({
      _id: 'message-connect',
      chatId: 'chat-1',
      sender: 'user-2',
      text: 'Arrived during connect',
      status: 'delivered',
      createdAt: '2026-06-15T10:00:00.000Z',
      updatedAt: '2026-06-15T10:00:00.000Z',
    });
    const onMessage = vi.fn();

    queryClient.setQueryData(chatsQueryKey, [
      makeChat({ _id: 'chat-1', latestMessage: null, updatedAt: '2026-06-15T09:59:00.000Z' }),
    ]);
    socketMockState.setEventsOnConnect([{ event: 'message:new', args: [incoming] }]);

    renderHook(() => useChatSocket({ chatId: 'chat-1', onMessage }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(incoming);
    });

    const socket = socketMockState.sockets[0];
    const messageListenerCallIndex = socket.on.mock.calls.findIndex(([eventName]) => eventName === 'message:new');

    expect(messageListenerCallIndex).toBeGreaterThanOrEqual(0);
    expect(socket.on.mock.invocationCallOrder[messageListenerCallIndex]).toBeLessThan(
      socket.connect.mock.invocationCallOrder[0]
    );
    expect(queryClient.getQueryData<MessagesCacheData>(messagesQueryKey('chat-1'))?.messages).toEqual([
      expect.objectContaining({ _id: 'message-connect', text: 'Arrived during connect' }),
    ]);
    expect(queryClient.getQueryData<Chat[]>(chatsQueryKey)?.[0]?.latestMessage).toMatchObject({
      _id: 'message-connect',
      text: 'Arrived during connect',
    });
    expect(socket.emit).toHaveBeenCalledWith('message:delivered', {
      messageId: 'message-connect',
      chatId: 'chat-1',
    });
  });

  it('handles incoming call signaling emitted during socket connect', async () => {
    const session: CallSessionPayload = {
      callId: 'call-connect',
      chatId: 'chat-1',
      callerId: 'user-2',
      calleeId: 'user-1',
      mode: 'video',
      status: 'ringing',
      startedAt: '2026-06-15T10:00:00.000Z',
      ringingAt: '2026-06-15T10:00:01.000Z',
      deliveredTo: ['user-1'],
    };
    const offer = {
      chatId: 'chat-1',
      callId: 'call-connect',
      senderId: 'user-2',
      signal: { type: 'offer', sdp: 'offer-sdp' },
    };
    const onCallIncoming = vi.fn();
    const onCallOffer = vi.fn();

    socketMockState.setEventsOnConnect([
      { event: 'call:incoming', args: [session] },
      { event: 'call:offer', args: [offer] },
    ]);

    renderHook(() => useChatSocket({ chatId: 'chat-1', onCallIncoming, onCallOffer }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(onCallIncoming).toHaveBeenCalledWith(session);
      expect(onCallOffer).toHaveBeenCalledWith(offer);
    });

    const socket = socketMockState.sockets[0];
    const incomingListenerCallIndex = socket.on.mock.calls.findIndex(([eventName]) => eventName === 'call:incoming');
    const offerListenerCallIndex = socket.on.mock.calls.findIndex(([eventName]) => eventName === 'call:offer');

    expect(incomingListenerCallIndex).toBeGreaterThanOrEqual(0);
    expect(offerListenerCallIndex).toBeGreaterThanOrEqual(0);
    expect(socket.on.mock.invocationCallOrder[incomingListenerCallIndex]).toBeLessThan(
      socket.connect.mock.invocationCallOrder[0]
    );
    expect(socket.on.mock.invocationCallOrder[offerListenerCallIndex]).toBeLessThan(
      socket.connect.mock.invocationCallOrder[0]
    );
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
      autoConnect: false,
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

  it('preserves recipient conversation controls from chat:new payloads', async () => {
    const controls: ConversationControls = {
      isDirectChat: true,
      peerId: 'user-2',
      canSendMessage: true,
      canBlockUser: true,
      canUnblockUser: false,
      blockedByMe: false,
      blockedMe: false,
      messagingDisabledReason: null,
    };

    renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    act(() => {
      socketMockState.sockets[0]?.trigger('chat:new', makeChat({
        _id: 'chat-new',
        conversationControls: controls,
      }));
    });

    expect(queryClient.getQueryData<Chat[]>(chatsQueryKey)?.[0]).toMatchObject({
      _id: 'chat-new',
      conversationControls: controls,
    });
  });

  it('keeps realtime space membership events scoped to space caches', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const removeQueriesSpy = vi.spyOn(queryClient, 'removeQueries');
    const channel = makeSpaceChannel({ _id: 'channel-general', spaceId: 'space-1', space: 'space-1' });
    const space = makeSpace({
      _id: 'space-1',
      name: 'Launch Room',
      channels: [channel],
    });

    renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    act(() => {
      socketMockState.sockets[0]?.trigger('space:new', space);
    });

    expect(queryClient.getQueryData(spacesQueryKey)).toEqual([
      expect.objectContaining({ _id: 'space-1', name: 'Launch Room' }),
    ]);
    expect(queryClient.getQueryData(spaceChannelsQueryKey('space-1'))).toEqual([
      expect.objectContaining({ _id: 'channel-general' }),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: spacesQueryKey });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: spaceChannelsQueryKey('space-1') });

    act(() => {
      socketMockState.sockets[0]?.trigger('space:removed', {
        spaceId: 'space-1',
        channelIds: ['channel-general'],
      });
    });

    expect(queryClient.getQueryData(spacesQueryKey)).toEqual([]);
    expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: spaceChannelsQueryKey('space-1') });
    expect(removeQueriesSpy).toHaveBeenCalledWith({ queryKey: messagesQueryKey('channel-general') });
  });

  it('applies same-user organization updates to the chat cache', async () => {
    queryClient.setQueryData(chatsQueryKey, [
      makeChat({
        _id: 'chat-1',
        updatedAt: '2026-06-08T10:00:00.000Z',
        organizationState: {
          muted: false,
          archived: false,
          pinned: false,
          favorite: false,
        },
      }),
      makeChat({
        _id: 'chat-2',
        updatedAt: '2026-06-08T11:00:00.000Z',
      }),
    ]);

    renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    act(() => {
      socketMockState.sockets[0]?.trigger('conversation:organization-updated', {
        chatId: 'chat-1',
        organizationState: {
          muted: true,
          archived: true,
          pinned: true,
          favorite: true,
        },
      });
    });

    expect(queryClient.getQueryData<Chat[]>(chatsQueryKey)?.[0]).toMatchObject({
      _id: 'chat-1',
      organizationState: {
        muted: true,
        archived: true,
        pinned: true,
        favorite: true,
      },
    });
  });

  it('applies realtime identity updates to chat member and user caches', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const updatedPeer = makeUser({
      _id: 'user-2',
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      profilePic: '',
      profileBio: 'Building reliable chat tools.',
      profileStatus: 'Available for focused work',
      identityMark: {
        source: 'custom',
        label: 'Relay Grid',
        initials: 'RG',
        paletteId: 'teal',
        patternId: 'rings',
        accentId: 'mint',
        updatedAt: '2026-06-17T05:00:00.000Z',
      },
    });

    queryClient.setQueryData(chatsQueryKey, [makeChat()]);
    queryClient.setQueryData(usersQueryKey, [makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper' })]);

    renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    act(() => {
      socketMockState.sockets[0]?.trigger('user:identity-updated', {
        userId: 'user-2',
        user: updatedPeer,
        chatIds: ['chat-1'],
      });
    });

    expect(queryClient.getQueryData<Chat[]>(chatsQueryKey)?.[0]?.members[1]).toMatchObject({
      _id: 'user-2',
      profileBio: 'Building reliable chat tools.',
      profileStatus: 'Available for focused work',
      identityMark: expect.objectContaining({
        source: 'custom',
        label: 'Relay Grid',
      }),
    });
    expect(queryClient.getQueryData<ReturnType<typeof makeUser>[]>(usersQueryKey)?.[0]).toMatchObject({
      _id: 'user-2',
      profileBio: 'Building reliable chat tools.',
      profileStatus: 'Available for focused work',
      identityMark: expect.objectContaining({
        initials: 'RG',
      }),
    });

    const hiddenStatusPeer = { ...updatedPeer };
    delete hiddenStatusPeer.profileStatus;

    act(() => {
      socketMockState.sockets[0]?.trigger('user:identity-updated', {
        userId: 'user-2',
        user: hiddenStatusPeer,
        chatIds: ['chat-1'],
      });
    });

    expect(queryClient.getQueryData<Chat[]>(chatsQueryKey)?.[0]?.members[1]?.profileStatus).toBeUndefined();
    expect(queryClient.getQueryData<ReturnType<typeof makeUser>[]>(usersQueryKey)?.[0]?.profileStatus).toBeUndefined();
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: usersQueryKey });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: userSearchQueryKey });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: onlinePresenceQueryKey });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: messagesQueryKey('chat-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sharedAssets', 'chat-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: pinnedMessagesQueryKey('chat-1') });
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

  it('routes eligible background messages through generic sound, browser, and in-app alerts', async () => {
    const notifications = installNotificationMock('granted');
    const onBackgroundMessageAlert = vi.fn();

    renderHook(() => useChatSocket({
      chatId: 'chat-1',
      notificationPreferences: {
        soundEnabled: true,
        browserNotificationsEnabled: true,
        pushEnabled: false,
        emailNotificationsEnabled: false,
        messagePreviewMode: 'none',
        emailUnsubscribed: false,
        pushSubscriptionCount: 0,
        mutedChatIds: [],
      },
      onBackgroundMessageAlert,
    }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];
    const incoming = makeMessage({
      _id: 'message-background-alert',
      chatId: 'chat-2',
      sender: 'user-2',
      text: 'INPUT_MESSAGE_MARKER',
      attachments: [makeAttachment({ displayName: 'INPUT_ATTACHMENT_MARKER' })],
    });

    act(() => {
      socket.trigger('message:new', incoming);
    });

    expect(queryClient.getQueryData<MessagesCacheData>(messagesQueryKey('chat-2'))?.messages).toEqual([
      expect.objectContaining({ _id: 'message-background-alert' }),
    ]);
    expect(socket.emit).toHaveBeenCalledWith('message:delivered', {
      messageId: 'message-background-alert',
      chatId: 'chat-2',
    });
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
    expect(onBackgroundMessageAlert).toHaveBeenCalledWith({
      title: 'New Chatify message',
      body: 'Open Chatify to read it.',
    });
    expect(notifications).toEqual([
      {
        title: 'New Chatify message',
        options: {
          body: 'Open Chatify to read it.',
          tag: 'chatify-chat-2',
        },
      },
    ]);
    expect(`${notifications[0]?.title} ${notifications[0]?.options?.body}`).not.toContain('INPUT_MESSAGE_MARKER');
    expect(`${notifications[0]?.title} ${notifications[0]?.options?.body}`).not.toContain('INPUT_ATTACHMENT_MARKER');
  });

  it('suppresses muted conversation alerts while preserving cache updates and delivery receipts', async () => {
    const notifications = installNotificationMock('granted');
    const onBackgroundMessageAlert = vi.fn();

    renderHook(() => useChatSocket({
      chatId: 'chat-1',
      notificationPreferences: {
        soundEnabled: true,
        browserNotificationsEnabled: true,
        pushEnabled: false,
        emailNotificationsEnabled: false,
        messagePreviewMode: 'none',
        emailUnsubscribed: false,
        pushSubscriptionCount: 0,
        mutedChatIds: ['chat-2'],
      },
      onBackgroundMessageAlert,
    }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];

    act(() => {
      socket.trigger('message:new', makeMessage({
        _id: 'message-muted-background',
        chatId: 'chat-2',
        sender: 'user-2',
        text: 'Muted background message',
      }));
    });

    expect(queryClient.getQueryData<MessagesCacheData>(messagesQueryKey('chat-2'))?.messages).toEqual([
      expect.objectContaining({ _id: 'message-muted-background' }),
    ]);
    expect(socket.emit).toHaveBeenCalledWith('message:delivered', {
      messageId: 'message-muted-background',
      chatId: 'chat-2',
    });
    expect(playNotificationSound).not.toHaveBeenCalled();
    expect(onBackgroundMessageAlert).not.toHaveBeenCalled();
    expect(notifications).toEqual([]);
  });

  it('does not create duplicate message alerts for the current foreground chat', async () => {
    const notifications = installNotificationMock('granted');
    const onBackgroundMessageAlert = vi.fn();

    renderHook(() => useChatSocket({
      chatId: 'chat-1',
      notificationPreferences: {
        soundEnabled: true,
        browserNotificationsEnabled: true,
        pushEnabled: false,
        emailNotificationsEnabled: false,
        messagePreviewMode: 'none',
        emailUnsubscribed: false,
        pushSubscriptionCount: 0,
        mutedChatIds: [],
      },
      onBackgroundMessageAlert,
    }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    act(() => {
      socketMockState.sockets[0]?.trigger('message:new', makeMessage({
        _id: 'message-foreground',
        chatId: 'chat-1',
        sender: 'user-2',
        text: 'Foreground message',
      }));
    });

    expect(playNotificationSound).not.toHaveBeenCalled();
    expect(onBackgroundMessageAlert).not.toHaveBeenCalled();
    expect(notifications).toEqual([]);
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
        isCallReachable: true,
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
          { userId: 'user-3', userName: 'Data Sync', isOnline: true, isCallReachable: true },
        ],
      });
      socket.triggerIo('reconnect');
    });

    await waitFor(() => {
      expect(usePresenceStore.getState().onlineUsers.get('user-3')).toMatchObject({
        userName: 'Data Sync',
        isOnline: true,
        isCallReachable: true,
      });
    });
    expect(usePresenceStore.getState().getTypingUsersForChat('chat-1')).toEqual([
      expect.objectContaining({ userId: 'user-2', isTyping: true }),
    ]);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: chatsQueryKey });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['unreadCounts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: messagesQueryKey('chat-1') });
  });

  it('updates the online presence query cache from realtime status changes', async () => {
    queryClient.setQueryData<UserOnlineStatus[]>(onlinePresenceQueryKey, [
      {
        userId: 'user-2',
        userName: 'Cached Contact',
        isOnline: false,
        isCallReachable: false,
        lastSeen: '2026-06-14T01:00:00.000Z',
        profileStatus: 'Cached status',
      },
    ]);

    renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    act(() => {
      socketMockState.sockets[0]?.trigger('user:status-change', {
        userId: 'user-2',
        userName: 'Realtime Contact',
        isOnline: true,
        isCallReachable: true,
        profileStatus: 'Available for focused work',
      });
    });

    expect(usePresenceStore.getState().onlineUsers.get('user-2')).toMatchObject({
      userName: 'Realtime Contact',
      isOnline: true,
      isCallReachable: true,
      profileStatus: 'Available for focused work',
    });
    expect(queryClient.getQueryData<UserOnlineStatus[]>(onlinePresenceQueryKey)).toEqual([
      expect.objectContaining({
        userId: 'user-2',
        userName: 'Realtime Contact',
        isOnline: true,
        isCallReachable: true,
        profileStatus: 'Available for focused work',
      }),
    ]);

    act(() => {
      socketMockState.sockets[0]?.trigger('user:status-change', {
        userId: 'user-2',
        userName: 'Realtime Contact',
        isOnline: false,
        lastSeen: '2026-06-14T01:05:00.000Z',
      });
    });

    expect(usePresenceStore.getState().onlineUsers.get('user-2')).toMatchObject({
      isOnline: false,
      isCallReachable: false,
      lastSeen: '2026-06-14T01:05:00.000Z',
    });
    expect(usePresenceStore.getState().onlineUsers.get('user-2')?.profileStatus).toBeUndefined();
    expect(queryClient.getQueryData<UserOnlineStatus[]>(onlinePresenceQueryKey)).toEqual([
      expect.objectContaining({
        userId: 'user-2',
        isOnline: false,
        isCallReachable: false,
        lastSeen: '2026-06-14T01:05:00.000Z',
      }),
    ]);
    expect(queryClient.getQueryData<UserOnlineStatus[]>(onlinePresenceQueryKey)?.[0]?.profileStatus).toBeUndefined();
  });

  it('publishes disconnect state and blocks call emits while disconnected', async () => {
    const { result } = renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];

    act(() => {
      socket.trigger('socket:ready', {
        userId: 'user-1',
        socketId: 'socket-1',
        joinedChats: 1,
        presence: [],
      });
    });

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

    expect(result.current.isSocketConnected).toBe(false);

    act(() => {
      socket.trigger('socket:ready', {
        userId: 'user-1',
        socketId: 'socket-2',
        joinedChats: 1,
        presence: [],
      });
    });

    expect(result.current.isSocketConnected).toBe(true);
  });

  it('refreshes auth and waits for socket readiness after socket auth errors', async () => {
    const { result } = renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(socketMockState.sockets[0]?.emit).toHaveBeenCalledWith('chat:join', 'chat-1');
    });

    const socket = socketMockState.sockets[0];

    act(() => {
      socket.trigger('connect_error', Object.assign(new Error('Socket authentication expired'), {
        data: {
          code: 'socket_auth_expired',
          message: 'Socket authentication expired',
        },
      }));
    });

    expect(result.current.socketStatus).toBe('authenticating');

    await waitFor(() => {
      expect(axiosMockState.refreshAuthSession).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(socket.io.reconnection).toHaveBeenCalledWith(true);
      expect(socket.connect).toHaveBeenCalled();
    });

    expect(result.current.isSocketConnected).toBe(false);

    act(() => {
      socket.trigger('socket:ready', {
        userId: 'user-1',
        socketId: 'socket-refreshed',
        joinedChats: 1,
        presence: [{ userId: 'user-2', isOnline: true, isCallReachable: true }],
      });
    });

    expect(result.current.socketStatus).toBe('ready');
    expect(result.current.isSocketConnected).toBe(true);
    await waitFor(() => {
      expect(usePresenceStore.getState().onlineUsers.get('user-2')).toMatchObject({
        isOnline: true,
        isCallReachable: true,
      });
    });
  });

  it('refreshes once when transport connects without socket readiness', async () => {
    vi.useFakeTimers();
    let unmount: (() => void) | undefined;
    try {
      const rendered = renderHook(() => useChatSocket({ chatId: 'chat-1' }), {
        wrapper: createWrapper(queryClient),
      });
      unmount = rendered.unmount;
      const { result } = rendered;
      const socket = socketMockState.sockets[0];

      expect(socket.connect).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(axiosMockState.refreshAuthSession).toHaveBeenCalledTimes(1);
      expect(socket.connect).toHaveBeenCalledTimes(2);
      expect(result.current.socketStatus).toBe('connecting');

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(axiosMockState.refreshAuthSession).toHaveBeenCalledTimes(1);
      expect(result.current.socketStatus).toBe('disconnected');
      expect(result.current.socketError).toMatchObject({
        code: 'socket_ready_timeout',
        message: 'Realtime connection is not ready for calls.',
      });
    } finally {
      unmount?.();
      vi.useRealTimers();
    }
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
