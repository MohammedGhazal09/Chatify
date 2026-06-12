import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import { makeChat, makeMessage, makeUser } from '../test/chatFixtures';
import type { Chat } from '../types/chat';
import { chatsQueryKey, messagesQueryKey } from './useChatQueries';
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
      handlers.get(event)?.forEach((handler) => handler(...args));
    };
    socket.triggerIo = (event: string, ...args: unknown[]) => {
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
});
