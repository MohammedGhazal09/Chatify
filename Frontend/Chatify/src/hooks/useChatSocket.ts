import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { resolveSocketUrl } from '../api/apiOrigin';
import { dispatchAuthExpired, refreshAuthSession } from '../api/axios';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import {
  chatsQueryKey,
  messagesQueryKey,
  onlinePresenceQueryKey,
  pinnedMessagesQueryKey,
  userSearchQueryKey,
  usersQueryKey,
} from './useChatQueries';
import type { User } from '../types/auth';
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
import { getBrowserNotificationPermission, getSafeNotificationCopy } from '../utils/notificationPrivacy';
import type { NotificationPreferences, SafeNotificationCopy } from '../types/notifications';
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
  UserIdentityUpdatedEvent,
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
  notificationPreferences?: NotificationPreferences;
  onMessage?: (message: Message) => void;
  onBackgroundMessageAlert?: (copy: SafeNotificationCopy) => void;
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

const getDefaultNotificationPreferences = (): NotificationPreferences => ({
  soundEnabled: isSoundEnabled(),
  browserNotificationsEnabled: false,
  mutedChatIds: [],
});

const createBrowserNotification = (copy: SafeNotificationCopy, chatId: string) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (getBrowserNotificationPermission() !== 'granted') {
    return;
  }

  try {
    new window.Notification(copy.title, {
      body: copy.body,
      tag: `chatify-${chatId}`,
    });
  } catch {
    // Browser notifications are opportunistic; cache, receipts, and in-app state are authoritative.
  }
};

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

const mergeIdentityUser = (candidate: User, updatedUser: User) => (
  candidate._id === updatedUser._id
    ? {
        ...candidate,
        ...updatedUser,
        identityMark: updatedUser.identityMark ?? candidate.identityMark,
        identityMarkUpdatedAt: updatedUser.identityMarkUpdatedAt ?? candidate.identityMarkUpdatedAt,
      }
    : candidate
);

export const useChatSocket = ({
  chatId,
  enabled = true,
  notificationPreferences,
  onMessage,
  onBackgroundMessageAlert,
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

  const callbacksRef = useRef({
    onMessage,
    onBackgroundMessageAlert,
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
  });
  callbacksRef.current = {
    onMessage,
    onBackgroundMessageAlert,
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
  };

  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  const userIdRef = useRef(user?._id);
  userIdRef.current = user?._id;

  const notificationPreferencesRef = useRef<NotificationPreferences | null>(notificationPreferences ?? null);
  notificationPreferencesRef.current = notificationPreferences ?? null;

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

  const handleUserIdentityUpdated = useCallback((event: UserIdentityUpdatedEvent) => {
    if (!event?.user?._id) {
      return;
    }

    const updatedUser = event.user;
    const currentUser = useAuthStore.getState().user;

    if (currentUser?._id === updatedUser._id) {
      useAuthStore.getState().setUser(mergeIdentityUser(currentUser, updatedUser));
    }

    queryClientRef.current.setQueryData<User | null>(['auth'], (old) => (
      old ? mergeIdentityUser(old, updatedUser) : old
    ));

    queryClientRef.current.setQueryData<Chat[]>(chatsQueryKey, (old) => {
      if (!old) {
        return old;
      }

      return old.map((chat) => ({
        ...chat,
        members: chat.members.map((member) => mergeIdentityUser(member, updatedUser)),
      }));
    });

    queryClientRef.current.setQueryData<User[]>(usersQueryKey, (old) => (
      old?.map((candidate) => mergeIdentityUser(candidate, updatedUser)) ?? old
    ));
    queryClientRef.current.invalidateQueries({ queryKey: usersQueryKey });
    queryClientRef.current.invalidateQueries({ queryKey: userSearchQueryKey });
    queryClientRef.current.invalidateQueries({ queryKey: onlinePresenceQueryKey });

    event.chatIds?.forEach((targetChatId) => {
      queryClientRef.current.invalidateQueries({ queryKey: messagesQueryKey(targetChatId) });
      queryClientRef.current.invalidateQueries({ queryKey: ['sharedAssets', targetChatId] });
      queryClientRef.current.invalidateQueries({ queryKey: pinnedMessagesQueryKey(targetChatId) });
    });
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

    const handleCallIncoming = (event: CallSessionPayload) => {
      callbacksRef.current.onCallIncoming?.(event);
    };

    const handleCallSync = (event: CallSessionPayload) => {
      callbacksRef.current.onCallSync?.(event);
    };

    const handleCallOffer = (event: CallSignalEvent) => {
      callbacksRef.current.onCallOffer?.(event);
    };

    const handleCallAnswer = (event: CallSignalEvent) => {
      callbacksRef.current.onCallAnswer?.(event);
    };

    const handleCallIceCandidate = (event: CallSignalEvent) => {
      callbacksRef.current.onCallIceCandidate?.(event);
    };

    const handleCallError = (event: SocketErrorEvent) => {
      setSocketError(event);
      callbacksRef.current.onCallError?.(event);
    };

    const handleIncomingMessage = (message: Message) => {
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

      const currentUserId = userIdRef.current;
      if (message.sender !== currentUserId) {
        socketInstance.emit('message:delivered', { messageId: message._id, chatId: message.chatId });
      }

      const currentChatId = chatIdRef.current;
      const isCurrentChat = Boolean(currentChatId && message.chatId === currentChatId);
      const effectiveNotificationPreferences =
        notificationPreferencesRef.current ?? getDefaultNotificationPreferences();
      const hasScopedNotificationPreferences = Boolean(notificationPreferencesRef.current);
      const isMuted = effectiveNotificationPreferences.mutedChatIds.includes(message.chatId);
      const shouldAlert = message.sender !== currentUserId && !isCurrentChat && !isMuted;

      if (
        hasScopedNotificationPreferences &&
        message.sender !== currentUserId &&
        isCurrentChat &&
        isCallEndedActivity(message) &&
        effectiveNotificationPreferences.soundEnabled
      ) {
        playCallEndedSound();
      }

      if (shouldAlert) {
        const copy = getSafeNotificationCopy({
          eventType: isCallEndedActivity(message) ? 'call' : 'message',
          messageText: message.text,
          attachmentNames: message.attachments?.map((attachment) => attachment.displayName),
        });

        if (effectiveNotificationPreferences.soundEnabled) {
          if (isCallEndedActivity(message)) {
            playCallEndedSound();
          } else {
            playNotificationSound();
          }
        }

        if (effectiveNotificationPreferences.browserNotificationsEnabled) {
          createBrowserNotification(copy, message.chatId);
        }

        callbacksRef.current.onBackgroundMessageAlert?.(copy);
      }

      if (currentChatId && message.chatId !== currentChatId) {
        return;
      }

      if (
        !hasScopedNotificationPreferences &&
        message.sender !== currentUserId &&
        isCurrentChat &&
        isSoundEnabled()
      ) {
        if (isCallEndedActivity(message)) {
          playCallEndedSound();
        } else {
          playNotificationSound();
        }
      }

      callbacksRef.current.onMessage?.(message);
    };

    const handleMessageStatusUpdate = (event: MessageStatusUpdateEvent) => {
      const targetChatId = event.chatId ?? activeRoomRef.current;

      if (targetChatId) {
        queryClientRef.current.setQueryData<MessagesCacheData>(
          messagesQueryKey(targetChatId),
          (old) => applyReceiptPatchInCache(old, event)
        );
      }

      callbacksRef.current.onMessageStatusUpdate?.(event);
    };

    const handleMessageRead = (event: MessageReadEvent) => {
      const targetChatId = event.chatId ?? activeRoomRef.current;

      if (targetChatId) {
        queryClientRef.current.setQueryData<MessagesCacheData>(
          messagesQueryKey(targetChatId),
          (old) => applyReceiptPatchInCache(old, event)
        );
      }

      callbacksRef.current.onMessageRead?.(event);
    };

    const handleBatchRead = (event: BatchReadEvent) => {
      queryClientRef.current.setQueryData<MessagesCacheData>(
        messagesQueryKey(event.chatId),
        (old) => applyBatchReadInCache(old, event)
      );

      callbacksRef.current.onBatchRead?.(event);
    };

    const handleMessageDeleted = (event: MessageDeletedEvent) => {
      const targetChatId = event.message?.chatId ?? event.chatId;

      queryClientRef.current.setQueryData<MessagesCacheData>(
        messagesQueryKey(targetChatId),
        (old) => applyDeletedMessageInCache(old, event)
      );
      invalidateMessageDetailQueries(targetChatId);

      callbacksRef.current.onMessageDeleted?.(event);
    };

    const handleMessageEdited = (event: MessageEditedEvent) => {
      const targetChatId = event.message?.chatId ?? event.chatId;

      queryClientRef.current.setQueryData<MessagesCacheData>(
        messagesQueryKey(targetChatId),
        (old) => applyEditedMessageInCache(old, event)
      );

      callbacksRef.current.onMessageEdited?.(event);
    };

    const handleMessageReaction = (event: MessageReactionEvent) => {
      const targetChatId = event.message?.chatId ?? event.chatId;

      queryClientRef.current.setQueryData<MessagesCacheData>(
        messagesQueryKey(targetChatId),
        (old) => applyReactionInCache(old, event)
      );

      callbacksRef.current.onMessageReaction?.(event);
    };

    const handleMessagePinEvent = (
      event: MessagePinEvent,
      callback?: (event: MessagePinEvent) => void
    ) => {
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
      const currentChatId = chatIdRef.current;
      if (!currentChatId || event.chatId === currentChatId) {
        callback?.(event);
      }
    };

    const handleMessagePinned = (event: MessagePinEvent) => {
      handleMessagePinEvent(event, callbacksRef.current.onMessagePinned);
    };

    const handleMessageUnpinned = (event: MessagePinEvent) => {
      handleMessagePinEvent(event, callbacksRef.current.onMessageUnpinned);
    };

    const handleUserStatusChange = (data: UserStatusChangeEvent) => {
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
    };

    const handleChatNew = (newChat: Chat) => {
      queryClientRef.current.setQueryData<Chat[]>(chatsQueryKey, (old) => {
        if (!old) {
          return [newChat];
        }

        const existingIndex = old.findIndex((chat) => chat._id === newChat._id);
        if (existingIndex !== -1) {
          return old;
        }

        return [newChat, ...old];
      });

      if (!newChat.conversationControls) {
        queryClientRef.current.invalidateQueries({ queryKey: chatsQueryKey });
      }
    };

    const handleChatDeleted = (data: { chatId: string }) => {
      queryClientRef.current.setQueryData<Chat[]>(chatsQueryKey, (old) => {
        if (!old) return old;
        return old.filter((chat) => chat._id !== data.chatId);
      });

      queryClientRef.current.setQueriesData<Map<string, number>>(
        { queryKey: ['unreadCounts'] },
        (old) => {
          if (!old) return old;
          const newMap = new Map(old);
          newMap.delete(data.chatId);
          return newMap;
        }
      );
    };

    const handleUserTyping = (data: TypingUser) => {
      if (data.userId === userIdRef.current) return;

      if (data.isTyping) {
        presenceStoreRef.current.setUserTyping(data.chatId, data);

        const timeoutKey = `${data.chatId}-${data.userId}`;
        if (typingTimeoutRef.current[timeoutKey]) {
          clearTimeout(typingTimeoutRef.current[timeoutKey]);
        }

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
    };

    const handleUnreadUpdate = (data: UnreadUpdateEvent) => {
      if (data.userId !== userIdRef.current) return;

      queryClientRef.current.setQueriesData<Map<string, number>>(
        { queryKey: ['unreadCounts'] },
        (old) => applyUnreadUpdate(old, data)
      );
    };

    socketInstance.on('connect', handleConnect);
    socketInstance.on('socket:ready', handleSocketReady);
    socketInstance.on('disconnect', handleDisconnect);

    socketInstance.io.on('reconnect', handleReconnect);

    socketInstance.on('connect_error', handleConnectError);
    socketInstance.on('socket:error', handleSocketError);
    socketInstance.on('call:incoming', handleCallIncoming);
    socketInstance.on('call:sync', handleCallSync);
    socketInstance.on('call:offer', handleCallOffer);
    socketInstance.on('call:answer', handleCallAnswer);
    socketInstance.on('call:ice-candidate', handleCallIceCandidate);
    socketInstance.on('call:error', handleCallError);
    socketInstance.on('message:new', handleIncomingMessage);
    socketInstance.on('message:status-update', handleMessageStatusUpdate);
    socketInstance.on('message:read', handleMessageRead);
    socketInstance.on('messages:read-batch', handleBatchRead);
    socketInstance.on('message:deleted', handleMessageDeleted);
    socketInstance.on('message:edited', handleMessageEdited);
    socketInstance.on('message:reaction', handleMessageReaction);
    socketInstance.on('message:pinned', handleMessagePinned);
    socketInstance.on('message:unpinned', handleMessageUnpinned);
    socketInstance.on('user:status-change', handleUserStatusChange);
    socketInstance.on('user:identity-updated', handleUserIdentityUpdated);
    socketInstance.on('chat:new', handleChatNew);
    socketInstance.on('chat:deleted', handleChatDeleted);
    socketInstance.on('conversation:controls-updated', handleConversationControlsUpdated);
    socketInstance.on('user:typing', handleUserTyping);
    socketInstance.on('unread:update', handleUnreadUpdate);

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
      socketInstance.off('call:incoming', handleCallIncoming);
      socketInstance.off('call:sync', handleCallSync);
      socketInstance.off('call:offer', handleCallOffer);
      socketInstance.off('call:answer', handleCallAnswer);
      socketInstance.off('call:ice-candidate', handleCallIceCandidate);
      socketInstance.off('call:error', handleCallError);
      socketInstance.off('message:new', handleIncomingMessage);
      socketInstance.off('message:status-update', handleMessageStatusUpdate);
      socketInstance.off('message:read', handleMessageRead);
      socketInstance.off('messages:read-batch', handleBatchRead);
      socketInstance.off('message:deleted', handleMessageDeleted);
      socketInstance.off('message:edited', handleMessageEdited);
      socketInstance.off('message:reaction', handleMessageReaction);
      socketInstance.off('message:pinned', handleMessagePinned);
      socketInstance.off('message:unpinned', handleMessageUnpinned);
      socketInstance.off('user:status-change', handleUserStatusChange);
      socketInstance.off('user:identity-updated', handleUserIdentityUpdated);
      socketInstance.off('chat:new', handleChatNew);
      socketInstance.off('chat:deleted', handleChatDeleted);
      socketInstance.io.off('reconnect', handleReconnect);
      socketInstance.off('user:typing', handleUserTyping);
      socketInstance.off('unread:update', handleUnreadUpdate);
      socketInstance.disconnect();
      setSocket(null);
      setSocketStatus('idle');
      setSocketError(null);
      setCallConfig(null);
    };
  }, [
    enabled,
    handleConversationControlsUpdated,
    handleUserIdentityUpdated,
    invalidateMessageDetailQueries,
    isAuthenticated,
    reconcileRealtimeState,
    socketUrl,
    updateChatsLatestMessage,
    updatePresenceQueryCache,
    user?._id,
  ]);

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
