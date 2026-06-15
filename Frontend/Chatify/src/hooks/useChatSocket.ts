import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { resolveSocketUrl } from '../api/apiOrigin';
import { dispatchAuthExpired, refreshAuthSession } from '../api/axios';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import { chatsQueryKey, messagesQueryKey, onlinePresenceQueryKey, pinnedMessagesQueryKey } from './useChatQueries';
import {
  applyBatchReadInCache,
  applyDeletedMessageInCache,
  applyEditedMessageInCache,
  applyReactionInCache,
  applyReceiptPatchInCache,
  applyUnreadUpdate,
  mergeCanonicalMessage,
  upsertMessageInCache,
  type MessagesCacheData,
} from './messageCache';
import { playNotificationSound, playCallEndedSound, isSoundEnabled } from '../utils/sounds';
import type {
  Chat,
  Message,
  MessageStatusUpdateEvent,
  MessageReadEvent,
  BatchReadEvent,
  UserOnlineStatus,
  UserStatusChangeEvent,
  TypingUser,
  MessageDeletedEvent,
  MessageEditedEvent,
  MessagePinEvent,
  MessageReactionEvent,
  UnreadUpdateEvent,
  SocketErrorEvent,
  SocketReadyEvent,
  ConversationControlsUpdatedEvent,
  CallActionAck,
  CallIceConfig,
  CallMode,
  CallSessionPayload,
  CallSignalEvent,
  CallSocketEventName,
} from '../types/chat';

type UseChatSocketOptions = {
  chatId: string | null;
  enabled?: boolean;
  onMessage?: (message: Message) => void;
  onMessageStatusUpdate?: (event: MessageStatusUpdateEvent) => void;
  onMessageRead?: (event: MessageReadEvent) => void;
  onBatchRead?: (event: BatchReadEvent) => void;
  onMessageDeleted?: (event: MessageDeletedEvent) => void;
  onMessageEdited?: (event: MessageEditedEvent) => void;
  onMessageReaction?: (event: MessageReactionEvent) => void;
  onMessagePinned?: (event: MessagePinEvent) => void;
  onMessageUnpinned?: (event: MessagePinEvent) => void;
  onCallIncoming?: (event: CallSessionPayload) => void;
  onCallSync?: (event: CallSessionPayload) => void;
  onCallOffer?: (event: CallSignalEvent) => void;
  onCallAnswer?: (event: CallSignalEvent) => void;
  onCallIceCandidate?: (event: CallSignalEvent) => void;
  onCallError?: (event: SocketErrorEvent) => void;
};

export type SocketConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'reconnecting'
  | 'authenticating'
  | 'auth_failed'
  | 'disconnected';

// Typing timeout duration (3 seconds)
const TYPING_TIMEOUT = 3000;
const CALL_ACK_TIMEOUT_MS = 8000;
const SOCKET_READY_TIMEOUT_MS = 5000;

type CallEmitPayload = Record<string, unknown>;

const isCallEndedActivity = (message: Message) => (
  message.messageType === 'call' && message.callActivity?.result === 'ended'
);

const clearTypingTimeoutsForChat = (
  timeouts: Record<string, ReturnType<typeof setTimeout>>,
  chatId: string
) => {
  const timeoutPrefix = `${chatId}-`;

  Object.entries(timeouts).forEach(([timeoutKey, timeoutId]) => {
    if (timeoutKey.startsWith(timeoutPrefix)) {
      clearTimeout(timeoutId);
      delete timeouts[timeoutKey];
    }
  });
};

export const useChatSocket = ({
  chatId,
  enabled = true,
  onMessage,
  onMessageStatusUpdate,
  onMessageRead,
  onBatchRead,
  onMessageDeleted,
  onMessageEdited,
  onMessageReaction,
  onMessagePinned,
  onMessageUnpinned,
  onCallIncoming,
  onCallSync,
  onCallOffer,
  onCallAnswer,
  onCallIceCandidate,
  onCallError,
}: UseChatSocketOptions) => {
  const { isAuthenticated, user } = useAuthStore();
  const presenceStore = usePresenceStore();
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketStatus, setSocketStatus] = useState<SocketConnectionStatus>('idle');
  const [socketError, setSocketError] = useState<SocketErrorEvent | null>(null);
  const [callConfig, setCallConfig] = useState<CallIceConfig | null>(null);
  const activeRoomRef = useRef<string | null>(null);
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const authRefreshInFlightRef = useRef(false);
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRetryAttemptedRef = useRef(false);
  
  // Use ref to avoid stale closure issues with store methods
  const presenceStoreRef = useRef(presenceStore);
  presenceStoreRef.current = presenceStore;
  
  // Use ref for queryClient to avoid stale closures
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  const socketUrl = useMemo(() => resolveSocketUrl(), []);
  const isSocketConnected = socketStatus === 'ready';

  const updatePresenceQueryCache = useCallback((event: UserStatusChangeEvent) => {
    queryClientRef.current.setQueryData<UserOnlineStatus[]>(onlinePresenceQueryKey, (old) => {
      const current = old ?? [];
      const existingIndex = current.findIndex((status) => status.userId === event.userId);
      const existing = existingIndex >= 0 ? current[existingIndex] : undefined;
      const nextStatus: UserOnlineStatus = event.isOnline
        ? {
            ...existing,
            userId: event.userId,
            userName: event.userName ?? existing?.userName,
            isOnline: true,
            isCallReachable: event.isCallReachable === true,
            lastSeen: undefined,
          }
        : {
            ...existing,
            userId: event.userId,
            userName: event.userName ?? existing?.userName,
            isOnline: false,
            isCallReachable: false,
            lastSeen: event.lastSeen ?? existing?.lastSeen,
          };

      if (existingIndex < 0) {
        return [...current, nextStatus];
      }

      const next = [...current];
      next[existingIndex] = nextStatus;
      return next;
    });
  }, []);

  const reconcileRealtimeState = useCallback(async (ready?: SocketReadyEvent) => {
    if (ready?.presence) {
      await queryClientRef.current.cancelQueries({ queryKey: onlinePresenceQueryKey });
      queryClientRef.current.setQueryData<UserOnlineStatus[]>(onlinePresenceQueryKey, ready.presence);
      queryClientRef.current.invalidateQueries({ queryKey: onlinePresenceQueryKey, refetchType: 'none' });
      presenceStoreRef.current.replaceOnlineUsers(ready.presence);
    }

    queryClientRef.current.invalidateQueries({ queryKey: chatsQueryKey });
    queryClientRef.current.invalidateQueries({ queryKey: ['unreadCounts'] });

    if (activeRoomRef.current) {
      queryClientRef.current.invalidateQueries({
        queryKey: messagesQueryKey(activeRoomRef.current),
      });
    }

  }, []);

  const updateChatsLatestMessage = useCallback((incoming: Message) => {
    queryClientRef.current.setQueryData<Chat[]>(chatsQueryKey, (old) => {
      if (!old) {
        return old;
      }

      let touched = false;

      const nextChats = old.map((chat) => {
        if (chat._id !== incoming.chatId) {
          return chat;
        }

        touched = true;
        const latestMessage = chat.latestMessage &&
          (chat.latestMessage._id === incoming._id ||
            (chat.latestMessage.clientMessageId &&
              incoming.clientMessageId &&
              chat.latestMessage.clientMessageId === incoming.clientMessageId))
          ? mergeCanonicalMessage(chat.latestMessage, incoming)
          : incoming;

        return {
          ...chat,
          latestMessage,
          updatedAt: incoming.createdAt,
        };
      });

      if (!touched) {
        return old;
      }

      return [...nextChats].sort((left, right) => (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ));
    });
  }, []);

  const invalidateMessageDetailQueries = useCallback((targetChatId: string) => {
    queryClientRef.current.invalidateQueries({ queryKey: ['sharedAssets', targetChatId] });
    queryClientRef.current.invalidateQueries({ queryKey: pinnedMessagesQueryKey(targetChatId) });
  }, []);

  const handleConversationControlsUpdated = useCallback((event: ConversationControlsUpdatedEvent) => {
    queryClientRef.current.setQueryData<Chat[]>(chatsQueryKey, (old) => {
      if (!old) {
        return old;
      }

      return old.map((chat) => chat._id === event.chatId
        ? { ...chat, conversationControls: event.conversationControls }
        : chat
      );
    });

    if (!event.conversationControls.canSendMessage) {
      presenceStoreRef.current.clearAllTypingForChat(event.chatId);
    }
  }, []);

  // Connect socket and set up user connection
  useEffect(() => {
    if (!enabled || !isAuthenticated || !socketUrl) {
      setSocketStatus('idle');
      return;
    }

    let disposed = false;
    readyRetryAttemptedRef.current = false;
    const socketInstance: Socket = io(socketUrl, {
      withCredentials: true,
      transports: ['polling', 'websocket'],
      autoConnect: false,
    });

    setSocketStatus('connecting');
    setSocket(socketInstance);

    const clearReadyTimeout = () => {
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
    };

    const isSocketAuthError = (code?: string) => (
      code === 'socket_auth_required' ||
      code === 'socket_auth_invalid' ||
      code === 'socket_auth_expired'
    );

    const refreshSocketSession = async () => {
      if (authRefreshInFlightRef.current) {
        return;
      }

      authRefreshInFlightRef.current = true;
      clearReadyTimeout();
      setSocketStatus('authenticating');

      try {
        socketInstance.io.reconnection(false);
        socketInstance.disconnect();
        await refreshAuthSession();

        if (disposed) {
          return;
        }

        socketInstance.io.reconnection(true);
        setSocketError(null);
        setSocketStatus('connecting');
        socketInstance.connect();
      } catch {
        if (disposed) {
          return;
        }

        setSocketStatus('auth_failed');
        dispatchAuthExpired();
      } finally {
        authRefreshInFlightRef.current = false;
      }
    };

    const scheduleReadyTimeout = () => {
      clearReadyTimeout();
      readyTimeoutRef.current = setTimeout(() => {
        if (disposed) {
          return;
        }

        const payload = {
          code: 'socket_ready_timeout',
          message: 'Realtime connection is not ready for calls.',
        };

        setSocketError(payload);
        queryClientRef.current.invalidateQueries({ queryKey: onlinePresenceQueryKey });

        if (readyRetryAttemptedRef.current) {
          setSocketStatus('disconnected');
          return;
        }

        readyRetryAttemptedRef.current = true;
        void refreshSocketSession();
      }, SOCKET_READY_TIMEOUT_MS);
    };

    const handleReconnect = () => {
      setSocketStatus('reconnecting');
      setSocketError(null);
      scheduleReadyTimeout();
    };

    const handleConnect = () => {
      setSocketStatus('connecting');
      setSocketError(null);
      scheduleReadyTimeout();
    };

    const handleSocketReady = (data: SocketReadyEvent) => {
      clearReadyTimeout();
      authRefreshInFlightRef.current = false;
      readyRetryAttemptedRef.current = false;
      setSocketStatus('ready');
      setSocketError(null);
      setCallConfig(data.callConfig ?? null);
      void reconcileRealtimeState(data);
    };

    const handleDisconnect = () => {
      clearReadyTimeout();
      setSocketStatus('disconnected');
    };

    const handleConnectError = (error: Error & { data?: Partial<SocketErrorEvent> }) => {
      const payload = {
        code: error.data?.code ?? 'socket_connect_error',
        message: error.data?.message ?? error.message,
      };

      clearReadyTimeout();
      setSocketStatus('disconnected');
      setSocketError(payload);
      queryClientRef.current.invalidateQueries({ queryKey: onlinePresenceQueryKey });

      if (isSocketAuthError(payload.code)) {
        void refreshSocketSession();
      }
    };

    const handleSocketError = (data: SocketErrorEvent) => {
      setSocketError(data);
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('socket:ready', handleSocketReady);
    socketInstance.on('disconnect', handleDisconnect);

    socketInstance.io.on('reconnect', handleReconnect);

    socketInstance.on('connect_error', handleConnectError);
    socketInstance.on('socket:error', handleSocketError);

    // Listen for user status changes
    socketInstance.on('user:status-change', (data: UserStatusChangeEvent) => {
      if (data.isOnline) {
        presenceStoreRef.current.setUserOnline(data.userId, {
          userId: data.userId,
          userName: data.userName,
          isOnline: true,
          isCallReachable: data.isCallReachable === true,
        });
      } else {
        presenceStoreRef.current.setUserOffline(data.userId, data.lastSeen);
      }

      updatePresenceQueryCache(data);
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

      if (!newChat.conversationControls) {
        queryClientRef.current.invalidateQueries({ queryKey: chatsQueryKey });
      }
      
      // Note: Backend now auto-joins users to chat rooms, no need to manually join
    });

    // Listen for chat deletion
    socketInstance.on('chat:deleted', (data: { chatId: string }) => {
      // Remove the deleted chat from the query cache
      queryClientRef.current.setQueryData<Chat[]>(chatsQueryKey, (old) => {
        if (!old) return old;
        return old.filter((chat) => chat._id !== data.chatId);
      });
      
      // Clear any unread counts for this chat
      queryClientRef.current.setQueriesData<Map<string, number>>(
        { queryKey: ['unreadCounts'] },
        (old) => {
          if (!old) return old;
          const newMap = new Map(old);
          newMap.delete(data.chatId);
          return newMap;
        }
      );
    });

    socketInstance.on('conversation:controls-updated', handleConversationControlsUpdated);

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

    // Listen for unread count updates
    socketInstance.on('unread:update', (data: UnreadUpdateEvent) => {
      // Only update for current user
      if (data.userId !== user?._id) return;

      // Update the cached unread counts directly
      queryClientRef.current.setQueriesData<Map<string, number>>(
        { queryKey: ['unreadCounts'] },
        (old) => applyUnreadUpdate(old, data)
      );
    });

    socketInstance.connect();

    return () => {
      disposed = true;
      clearReadyTimeout();
      // Clear all typing timeouts
      Object.values(typingTimeoutRef.current).forEach(clearTimeout);
      typingTimeoutRef.current = {};
      presenceStoreRef.current.clearPresenceState();

      if (activeRoomRef.current) {
        socketInstance.emit('chat:leave', activeRoomRef.current);
        activeRoomRef.current = null;
      }
      socketInstance.off('conversation:controls-updated', handleConversationControlsUpdated);
      socketInstance.off('connect', handleConnect);
      socketInstance.off('socket:ready', handleSocketReady);
      socketInstance.off('disconnect', handleDisconnect);
      socketInstance.off('connect_error', handleConnectError);
      socketInstance.off('socket:error', handleSocketError);
      socketInstance.io.off('reconnect', handleReconnect);
      socketInstance.disconnect();
      setSocket(null);
      setSocketStatus('idle');
      setSocketError(null);
      setCallConfig(null);
    };
  }, [enabled, handleConversationControlsUpdated, isAuthenticated, socketUrl, user?._id, reconcileRealtimeState, updatePresenceQueryCache]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleCallIncoming = (event: CallSessionPayload) => {
      onCallIncoming?.(event);
    };

    const handleCallSync = (event: CallSessionPayload) => {
      onCallSync?.(event);
    };

    const handleCallOffer = (event: CallSignalEvent) => {
      onCallOffer?.(event);
    };

    const handleCallAnswer = (event: CallSignalEvent) => {
      onCallAnswer?.(event);
    };

    const handleCallIceCandidate = (event: CallSignalEvent) => {
      onCallIceCandidate?.(event);
    };

    const handleCallError = (event: SocketErrorEvent) => {
      setSocketError(event);
      onCallError?.(event);
    };

    socket.on('call:incoming', handleCallIncoming);
    socket.on('call:sync', handleCallSync);
    socket.on('call:offer', handleCallOffer);
    socket.on('call:answer', handleCallAnswer);
    socket.on('call:ice-candidate', handleCallIceCandidate);
    socket.on('call:error', handleCallError);

    return () => {
      socket.off('call:incoming', handleCallIncoming);
      socket.off('call:sync', handleCallSync);
      socket.off('call:offer', handleCallOffer);
      socket.off('call:answer', handleCallAnswer);
      socket.off('call:ice-candidate', handleCallIceCandidate);
      socket.off('call:error', handleCallError);
    };
  }, [socket, onCallIncoming, onCallSync, onCallOffer, onCallAnswer, onCallIceCandidate, onCallError]);

  // Handle incoming messages
  const handleIncomingMessage = useCallback(
    (message: Message) => {
      if (!message) {
        return;
      }

      queryClientRef.current.setQueryData<MessagesCacheData>(
        messagesQueryKey(message.chatId),
        (old) => upsertMessageInCache(old, message)
      );
      updateChatsLatestMessage(message);
      if ((message.attachments?.length ?? 0) > 0) {
        queryClientRef.current.invalidateQueries({ queryKey: ['sharedAssets', message.chatId] });
      }

      if (socket && message.sender !== user?._id) {
        socket.emit('message:delivered', { messageId: message._id, chatId: message.chatId });
      }

      if (chatId && message.chatId !== chatId) {
        return;
      }

      // Play notification sound for messages from others
      if (message.sender !== user?._id && isSoundEnabled()) {
        if (isCallEndedActivity(message)) {
          playCallEndedSound();
        } else {
          playNotificationSound();
        }
      }

      onMessage?.(message);
    },
    [chatId, onMessage, socket, updateChatsLatestMessage, user?._id]
  );

  // Handle message status updates
  const handleMessageStatusUpdate = useCallback(
    (event: MessageStatusUpdateEvent) => {
      const targetChatId = event.chatId ?? activeRoomRef.current;

      if (targetChatId) {
        queryClientRef.current.setQueryData<MessagesCacheData>(
          messagesQueryKey(targetChatId),
          (old) => applyReceiptPatchInCache(old, event)
        );
      }

      onMessageStatusUpdate?.(event);
    },
    [onMessageStatusUpdate]
  );

  // Handle message read events
  const handleMessageRead = useCallback(
    (event: MessageReadEvent) => {
      const targetChatId = event.chatId ?? activeRoomRef.current;

      if (targetChatId) {
        queryClientRef.current.setQueryData<MessagesCacheData>(
          messagesQueryKey(targetChatId),
          (old) => applyReceiptPatchInCache(old, event)
        );
      }

      onMessageRead?.(event);
    },
    [onMessageRead]
  );

  // Handle batch read events
  const handleBatchRead = useCallback(
    (event: BatchReadEvent) => {
      queryClientRef.current.setQueryData<MessagesCacheData>(
        messagesQueryKey(event.chatId),
        (old) => applyBatchReadInCache(old, event)
      );

      onBatchRead?.(event);
    },
    [onBatchRead]
  );

  // Handle message deleted events
  const handleMessageDeleted = useCallback(
    (event: MessageDeletedEvent) => {
      const targetChatId = event.message?.chatId ?? event.chatId;

      queryClientRef.current.setQueryData<MessagesCacheData>(
        messagesQueryKey(targetChatId),
        (old) => applyDeletedMessageInCache(old, event)
      );
      invalidateMessageDetailQueries(targetChatId);

      onMessageDeleted?.(event);
    },
    [invalidateMessageDetailQueries, onMessageDeleted]
  );

  // Handle message edited events
  const handleMessageEdited = useCallback(
    (event: MessageEditedEvent) => {
      const targetChatId = event.message?.chatId ?? event.chatId;

      queryClientRef.current.setQueryData<MessagesCacheData>(
        messagesQueryKey(targetChatId),
        (old) => applyEditedMessageInCache(old, event)
      );

      onMessageEdited?.(event);
    },
    [onMessageEdited]
  );

  // Handle message reaction events
  const handleMessageReaction = useCallback(
    (event: MessageReactionEvent) => {
      const targetChatId = event.message?.chatId ?? event.chatId;

      queryClientRef.current.setQueryData<MessagesCacheData>(
        messagesQueryKey(targetChatId),
        (old) => applyReactionInCache(old, event)
      );

      onMessageReaction?.(event);
    },
    [onMessageReaction]
  );

  const handleMessagePinEvent = useCallback(
    (event: MessagePinEvent, callback?: (event: MessagePinEvent) => void) => {
      if (!event?.chatId) {
        return;
      }

      if (event.message) {
        queryClientRef.current.setQueryData<MessagesCacheData>(
          messagesQueryKey(event.chatId),
          (old) => upsertMessageInCache(old, event.message)
        );
      }

      queryClientRef.current.invalidateQueries({ queryKey: pinnedMessagesQueryKey(event.chatId) });
      if (!chatId || event.chatId === chatId) {
        callback?.(event);
      }
    },
    [chatId]
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
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('message:edited', handleMessageEdited);
    socket.on('message:reaction', handleMessageReaction);
    socket.on('message:pinned', (event: MessagePinEvent) => handleMessagePinEvent(event, onMessagePinned));
    socket.on('message:unpinned', (event: MessagePinEvent) => handleMessagePinEvent(event, onMessageUnpinned));

    return () => {
      socket.off('message:new', handleIncomingMessage);
      socket.off('message:status-update', handleMessageStatusUpdate);
      socket.off('message:read', handleMessageRead);
      socket.off('messages:read-batch', handleBatchRead);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('message:edited', handleMessageEdited);
      socket.off('message:reaction', handleMessageReaction);
      socket.off('message:pinned');
      socket.off('message:unpinned');
    };
  }, [socket, handleIncomingMessage, handleMessageStatusUpdate, handleMessageRead, handleBatchRead, handleMessageDeleted, handleMessageEdited, handleMessageReaction, handleMessagePinEvent, onMessagePinned, onMessageUnpinned]);

  // Handle chat room joining/leaving
  useEffect(() => {
    if (!socket || !enabled || !isAuthenticated) {
      return;
    }

    const nextRoom = chatId ?? null;
    const previousRoom = activeRoomRef.current;

    if (previousRoom && previousRoom !== nextRoom) {
      socket.emit('chat:leave', previousRoom);
      presenceStoreRef.current.clearAllTypingForChat(previousRoom);
      clearTypingTimeoutsForChat(typingTimeoutRef.current, previousRoom);
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
        presenceStoreRef.current.clearAllTypingForChat(nextRoom);
        clearTypingTimeoutsForChat(typingTimeoutRef.current, nextRoom);
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

  const emitCallAction = useCallback((event: CallSocketEventName, payload: CallEmitPayload): Promise<CallActionAck> => {
    if (!socket || !isSocketConnected) {
      return Promise.resolve({
        ok: false,
        event,
        code: 'socket_unavailable',
        message: 'Realtime connection unavailable',
      });
    }

    return new Promise((resolve) => {
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        resolve({
          ok: false,
          event,
          code: 'ack_timeout',
          message: 'Call action timed out',
        });
      }, CALL_ACK_TIMEOUT_MS);

      socket.emit(event, payload, (response?: CallActionAck) => {
        if (settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);
        resolve(response ?? {
          ok: false,
          event,
          code: 'empty_ack',
          message: 'Call action returned an empty acknowledgement',
        });
      });
    });
  }, [isSocketConnected, socket]);

  const emitCallStart = useCallback((payload: { chatId: string; mode: CallMode }) => {
    return emitCallAction('call:start', payload);
  }, [emitCallAction]);

  const emitCallAccept = useCallback((payload: { chatId: string; callId: string }) => {
    return emitCallAction('call:accept', payload);
  }, [emitCallAction]);

  const emitCallReject = useCallback((payload: { chatId: string; callId: string }) => {
    return emitCallAction('call:reject', payload);
  }, [emitCallAction]);

  const emitCallEnd = useCallback((payload: { chatId: string; callId: string; reason?: string }) => {
    return emitCallAction('call:end', payload);
  }, [emitCallAction]);

  const emitCallSync = useCallback((payload: { chatId: string }) => {
    return emitCallAction('call:sync', payload);
  }, [emitCallAction]);

  const emitCallOffer = useCallback((payload: { chatId: string; callId: string; signal: RTCSessionDescriptionInit }) => {
    return emitCallAction('call:offer', payload);
  }, [emitCallAction]);

  const emitCallAnswer = useCallback((payload: { chatId: string; callId: string; signal: RTCSessionDescriptionInit }) => {
    return emitCallAction('call:answer', payload);
  }, [emitCallAction]);

  const emitCallIceCandidate = useCallback((payload: { chatId: string; callId: string; signal: RTCIceCandidateInit }) => {
    return emitCallAction('call:ice-candidate', payload);
  }, [emitCallAction]);

  return {
    socket,
    socketStatus,
    isSocketConnected,
    socketError,
    callConfig,
    emitTypingStart,
    emitTypingStop,
    emitMessageDelivered,
    emitCallStart,
    emitCallAccept,
    emitCallReject,
    emitCallEnd,
    emitCallSync,
    emitCallOffer,
    emitCallAnswer,
    emitCallIceCandidate,
  };
};

export default useChatSocket;
