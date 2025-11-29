import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import { chatsQueryKey } from './useChatQueries';
import type {
  Chat,
  Message,
  MessageStatusUpdateEvent,
  MessageReadEvent,
  BatchReadEvent,
  UserStatusChangeEvent,
  TypingUser,
} from '../types/chat';

type UseChatSocketOptions = {
  chatId: string | null;
  enabled?: boolean;
  onMessage?: (message: Message) => void;
  onMessageStatusUpdate?: (event: MessageStatusUpdateEvent) => void;
  onMessageRead?: (event: MessageReadEvent) => void;
  onBatchRead?: (event: BatchReadEvent) => void;
};

const resolveSocketUrl = () => {
  const envUrl = import.meta.env.VITE_SOCKET_URL ?? import.meta.env.VITE_BACKEND_URL;
  if (envUrl) {
    return envUrl;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }
};

// Typing timeout duration (3 seconds)
const TYPING_TIMEOUT = 3000;

export const useChatSocket = ({
  chatId,
  enabled = true,
  onMessage,
  onMessageStatusUpdate,
  onMessageRead,
  onBatchRead,
}: UseChatSocketOptions) => {
  const { isAuthenticated, user } = useAuthStore();
  const presenceStore = usePresenceStore();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const activeRoomRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  
  // Use ref to avoid stale closure issues with store methods
  const presenceStoreRef = useRef(presenceStore);
  presenceStoreRef.current = presenceStore;
  
  // Use ref for queryClient to avoid stale closures
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const socketUrl = useMemo(() => resolveSocketUrl(), []);

  // Connect socket and set up user connection
  useEffect(() => {
    if (!enabled || !isAuthenticated || !socketUrl) {
      return;
    }

    const socketInstance: Socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    setSocket(socketInstance);

    // Once connected, identify the user
    socketInstance.on('connect', () => {
      if (user?._id) {
        socketInstance.emit('user:connect', user._id);
      }
    });

    // Listen for user status changes
    socketInstance.on('user:status-change', (data: UserStatusChangeEvent) => {
      if (data.isOnline) {
        presenceStoreRef.current.setUserOnline(data.userId, {
          userId: data.userId,
          userName: data.userName,
          isOnline: true,
        });
      } else {
        presenceStoreRef.current.setUserOffline(data.userId, data.lastSeen);
      }
    });

    // Listen for new chat creation (when someone creates a chat with this user)
    socketInstance.on('chat:new', (newChat: Chat) => {
      // Add the new chat to the query cache
      queryClientRef.current.setQueryData<Chat[]>(chatsQueryKey, (old) => {
        if (!old) {
          return [newChat];
        }
        // Check if chat already exists
        const existingIndex = old.findIndex((chat) => chat._id === newChat._id);
        if (existingIndex !== -1) {
          return old;
        }
        // Add to the beginning of the list
        return [newChat, ...old];
      });
      
      // Automatically join the chat room so we can receive messages
      socketInstance.emit('chat:join', newChat._id);
    });

    // Listen for typing events
    socketInstance.on('user:typing', (data: TypingUser) => {
      // Don't show typing indicator for own typing
      if (data.userId === user?._id) return;

      if (data.isTyping) {
        presenceStoreRef.current.setUserTyping(data.chatId, data);

        // Clear any existing timeout for this user
        const timeoutKey = `${data.chatId}-${data.userId}`;
        if (typingTimeoutRef.current[timeoutKey]) {
          clearTimeout(typingTimeoutRef.current[timeoutKey]);
        }

        // Auto-clear typing after timeout
        typingTimeoutRef.current[timeoutKey] = setTimeout(() => {
          presenceStoreRef.current.clearUserTyping(data.chatId, data.userId);
          delete typingTimeoutRef.current[timeoutKey];
        }, TYPING_TIMEOUT);
      } else {
        presenceStoreRef.current.clearUserTyping(data.chatId, data.userId);
        const timeoutKey = `${data.chatId}-${data.userId}`;
        if (typingTimeoutRef.current[timeoutKey]) {
          clearTimeout(typingTimeoutRef.current[timeoutKey]);
          delete typingTimeoutRef.current[timeoutKey];
        }
      }
    });

    return () => {
      // Clear all typing timeouts
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
      typingTimeoutRef.current = {};

      if (activeRoomRef.current) {
        socketInstance.emit('chat:leave', activeRoomRef.current);
        activeRoomRef.current = null;
      }
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [enabled, isAuthenticated, socketUrl, user?._id]);

  // Handle incoming messages
  const handleIncomingMessage = useCallback(
    (message: Message) => {
      if (!message || (chatId && message.chatId !== chatId)) {
        return;
      }
      onMessage?.(message);
    },
    [chatId, onMessage]
  );

  // Handle message status updates
  const handleMessageStatusUpdate = useCallback(
    (event: MessageStatusUpdateEvent) => {
      onMessageStatusUpdate?.(event);
    },
    [onMessageStatusUpdate]
  );

  // Handle message read events
  const handleMessageRead = useCallback(
    (event: MessageReadEvent) => {
      onMessageRead?.(event);
    },
    [onMessageRead]
  );

  // Handle batch read events
  const handleBatchRead = useCallback(
    (event: BatchReadEvent) => {
      onBatchRead?.(event);
    },
    [onBatchRead]
  );

  // Set up message and status listeners
  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.on('message:new', handleIncomingMessage);
    socket.on('message:status-update', handleMessageStatusUpdate);
    socket.on('message:read', handleMessageRead);
    socket.on('messages:read-batch', handleBatchRead);

    return () => {
      socket.off('message:new', handleIncomingMessage);
      socket.off('message:status-update', handleMessageStatusUpdate);
      socket.off('message:read', handleMessageRead);
      socket.off('messages:read-batch', handleBatchRead);
    };
  }, [socket, handleIncomingMessage, handleMessageStatusUpdate, handleMessageRead, handleBatchRead]);

  // Handle chat room joining/leaving
  useEffect(() => {
    if (!socket || !enabled || !isAuthenticated) {
      return;
    }

    const nextRoom = chatId ?? null;
    const previousRoom = activeRoomRef.current;

    if (previousRoom && previousRoom !== nextRoom) {
      socket.emit('chat:leave', previousRoom);
    }

    if (nextRoom && nextRoom !== previousRoom) {
      socket.emit('chat:join', nextRoom);
      activeRoomRef.current = nextRoom;
    }

    if (!nextRoom) {
      activeRoomRef.current = null;
    }

    return () => {
      if (nextRoom && activeRoomRef.current === nextRoom) {
        socket.emit('chat:leave', nextRoom);
        activeRoomRef.current = null;
      }
    };
  }, [socket, chatId, enabled, isAuthenticated]);

  // Emit typing start
  const emitTypingStart = useCallback(() => {
    if (!socket || !chatId) return;
    socket.emit('typing:start', { chatId });
  }, [socket, chatId]);

  // Emit typing stop
  const emitTypingStop = useCallback(() => {
    if (!socket || !chatId) return;
    socket.emit('typing:stop', { chatId });
  }, [socket, chatId]);

  // Emit message delivered
  const emitMessageDelivered = useCallback(
    (messageId: string) => {
      if (!socket || !chatId) return;
      socket.emit('message:delivered', { messageId, chatId });
    },
    [socket, chatId]
  );

  return {
    socket,
    emitTypingStart,
    emitTypingStop,
    emitMessageDelivered,
  };
};

export default useChatSocket;
