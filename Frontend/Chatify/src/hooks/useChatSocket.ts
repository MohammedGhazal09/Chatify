import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authstore';
import type { Message } from '../types/chat';

type UseChatSocketOptions = {
  chatId: string | null;
  enabled?: boolean;
  onMessage?: (message: Message) => void;
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

export const useChatSocket = ({ chatId, enabled = true, onMessage }: UseChatSocketOptions) => {
  const { isAuthenticated } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const activeRoomRef = useRef<string | null>(null);

  const socketUrl = useMemo(() => resolveSocketUrl(), []);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !socketUrl) {
      return;
    }

    const socketInstance: Socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    setSocket(socketInstance);

    return () => {
      if (activeRoomRef.current) {
        socketInstance.emit('chat:leave', activeRoomRef.current);
        activeRoomRef.current = null;
      }
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [enabled, isAuthenticated, socketUrl]);

  const handleIncomingMessage = useCallback(
    (message: Message) => {
      if (!message || (chatId && message.chatId !== chatId)) {
        return;
      }
      onMessage?.(message);
    },
    [chatId, onMessage]
  );

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.on('message:new', handleIncomingMessage);

    return () => {
      socket.off('message:new', handleIncomingMessage);
    };
  }, [socket, handleIncomingMessage]);

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

  return socket;
};

export default useChatSocket;
