import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import { makeUser } from '../test/chatFixtures';
import { useChatSocket } from './useChatSocket';

const socketMockState = vi.hoisted(() => {
  const sockets: Array<{
    connected: boolean;
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    io: {
      on: ReturnType<typeof vi.fn>;
      off: ReturnType<typeof vi.fn>;
    };
  }> = [];

  const createSocket = () => {
    const socket = {
      connected: true,
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn(),
      io: {
        on: vi.fn(),
        off: vi.fn(),
      },
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

describe('useChatSocket room cleanup', () => {
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
});
