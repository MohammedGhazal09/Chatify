import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEventHandler, MouseEvent as ReactMouseEvent } from 'react';
import axios from 'axios';
import { useQueryClient } from '@tanstack/react-query';
import { AUTH_EXPIRED_EVENT } from '../../api/axios';
import LoadingSpinner from '../../components/loadingSpinner';
import SettingsModal from '../../components/SettingsModal';
import { useToast } from '../../components/Toast';
import useLocalStorage from '../../hooks/useLocalStorage';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';
import { useSessionBroadcast } from '../../hooks/useSessionBroadcast';
import { useAuthStore } from '../../store/authstore';
import { usePresenceStore } from '../../store/presenceStore';
import { useLogout } from '../../hooks/useAuthQuery';
import {
  useChats,
  useCreateChat,
  useMessages,
  useSendMessage,
  useMarkMessagesAsRead,
  useDeleteMessage,
  useEditMessage,
  useUnreadCounts,
  useToggleReaction,
  useMessageSearch,
  useSharedAssets,
  usePinnedMessages,
  usePinMessage,
  useUnpinMessage,
  useBlockChatPeer,
  useUnblockChatPeer,
  useOnlinePresence,
} from '../../hooks/useChatQueries';
import { useChatSocket } from '../../hooks/useChatSocket';
import { useCallController } from '../../hooks/useCallController';
import type {
  BatchReadEvent,
  AttachmentSummary,
  ComposerAttachmentDraft,
  ComposerSendPayload,
  ConversationControls,
  Message,
  MessageDeletedEvent,
  MessageEditedEvent,
  MessageReactionEvent,
  MessageStatusUpdateEvent,
} from '../../types/chat';
import {
  ChatContextRail,
  CallOverlay,
  ChatShell,
  ChatSidebar,
  AttachmentPreviewModal,
  ConversationMoreMenu,
  ConversationDetailDrawer,
  ConversationPane,
  MessageActionMenu,
} from './components';
import type { AttachmentPreviewTarget } from './components/AttachmentPreviewModal';
import { createClientMessageId, MAX_MESSAGE_TEXT_LENGTH } from '../../hooks/messageCache';
import { useChatTheme } from './hooks/useChatTheme';
import { useChatViewState } from './hooks/useChatViewState';
import {
  getSelectedChatStorageKey,
  replaceSelectedChatUrl,
  useSelectedChatPersistence,
} from './hooks/useSelectedChatPersistence';
import { getChatTitle, getOtherMember } from './utils/chatDisplay';
import { buildSendDraftKey } from './sendDraftGuard';
import { validateUsername } from '../../utils/usernameValidation';
import './chat.css';

const DETAIL_RAIL_MEDIA_QUERY = '(min-width: 1280px)';

const isDesktopDetailRailViewport = () => (
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(DETAIL_RAIL_MEDIA_QUERY).matches
);

const useDebounce = (callback: () => void, delay: number) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback();
    }, delay);
  }, [callback, delay]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return { debouncedCallback, cancel };
};

const INVALID_USERNAME_COPY = 'Enter a valid username.';
const GENERIC_NEW_CHAT_ERROR_COPY = 'We could not start that chat. Check the username and try again.';

const getConversationDisabledReason = (controls?: ConversationControls) => {
  if (!controls || controls.canSendMessage) {
    return null;
  }

  if (controls.messagingDisabledReason === 'blocked_by_me') {
    return 'You blocked this user. Unblock them to send new activity.';
  }

  if (controls.messagingDisabledReason === 'blocked_me') {
    return 'This user is not available for new conversation activity.';
  }

  return 'Conversation activity is disabled.';
};

const getRequestErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }

  return fallback;
};

const ChatPage = () => {
  const { user, isAuthenticated } = useAuthStore();
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const clearPresenceState = usePresenceStore((state) => state.clearPresenceState);
  const authLogout = useAuthStore((state) => state.logout);
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  const { showToast } = useToast();
  const {
    selectedChatId,
    setSelectedChatId,
    messageInput,
    setMessageInput,
    isNewChatOpen,
    setIsNewChatOpen,
    newChatUsername,
    setNewChatUsername,
    createChatError,
    setCreateChatError,
    isSidebarOpen,
    setIsSidebarOpen,
    isTyping,
    setIsTyping,
    searchQuery,
    setSearchQuery,
    isSettingsOpen,
    setIsSettingsOpen,
    contextMenu,
    setContextMenu,
    showReactionPicker,
    setShowReactionPicker,
    editingMessageId,
    setEditingMessageId,
    editText,
    setEditText,
    showEmojiPicker,
    setShowEmojiPicker,
    replyingTo,
    setReplyingTo,
    messageSearch,
    setMessageSearch,
    showMessageSearch,
    setShowMessageSearch,
    showScrollButton,
    setShowScrollButton,
  } = useChatViewState();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const newChatButtonRef = useRef<HTMLButtonElement>(null);
  const messageSearchInputRef = useRef<HTMLInputElement>(null);
  const messageSearchButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const messageActionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const callHandlersRef = useRef<ReturnType<typeof useCallController>['socketHandlers'] | null>(null);
  const messageHighlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightDraftKeysRef = useRef(new Set<string>());
  const shouldAutoScrollRef = useRef(true);
  const previousLastMessageKeyRef = useRef<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [composerResetToken, setComposerResetToken] = useState(0);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isDetailRailOpen, setIsDetailRailOpen] = useState(() => isDesktopDetailRailViewport());
  const [isConversationMoreOpen, setIsConversationMoreOpen] = useState(false);
  const [isBrowserOnline, setIsBrowserOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine
  ));
  const [favoriteChatIds, setFavoriteChatIds] = useState<string[]>([]);
  const [attachmentPreview, setAttachmentPreview] = useState<AttachmentPreviewTarget | null>(null);
  const [activeComposerUploadId, setActiveComposerUploadId] = useState<string | null>(null);
  const favoriteStorageKey = user?._id ? `chatify_favorite_chats_${user._id}` : null;
  const chatTheme = useChatTheme(user?._id);
  const notificationPreferences = useNotificationPreferences(user?._id);

  const { data: chats, isLoading: isChatsLoading, isError: chatsError, refetch: refetchChats } = useChats();
  const {
    messages,
    isLoading: isMessagesLoading,
    isError: messagesError,
    refetch: refetchMessages,
    upsertMessage,
    removeMessage,
    dismissFailedMessage,
    updateMessageStatus,
    updateMessagesStatus,
    loadMoreMessages,
    hasMore,
    isLoadingMore,
  } = useMessages(selectedChatId);
  const sendMessage = useSendMessage();
  const createChat = useCreateChat();
  const markMessagesAsReadMutation = useMarkMessagesAsRead();
  const deleteMessageMutation = useDeleteMessage();
  const editMessageMutation = useEditMessage();
  const toggleReactionMutation = useToggleReaction();
  const pinMessageMutation = usePinMessage();
  const unpinMessageMutation = useUnpinMessage();
  const blockChatPeerMutation = useBlockChatPeer();
  const unblockChatPeerMutation = useUnblockChatPeer();

  const chatIds = useMemo(() => chats?.map((chat) => chat._id) ?? [], [chats]);
  const { data: unreadCounts } = useUnreadCounts(chatIds);

  useSelectedChatPersistence({
    userId: user?._id,
    chats,
    isChatsLoading,
    selectedChatId,
    setSelectedChatId,
  });

  const markMessagesAsReadRef = useRef(markMessagesAsReadMutation.mutate);
  markMessagesAsReadRef.current = markMessagesAsReadMutation.mutate;

  const selectedChat = useMemo(
    () => chats?.find((chat) => chat._id === selectedChatId) ?? null,
    [chats, selectedChatId]
  );
  const isSelectedChatFavorite = Boolean(selectedChatId && favoriteChatIds.includes(selectedChatId));
  const isSelectedChatMuted = Boolean(selectedChatId && notificationPreferences.isChatMuted(selectedChatId));
  const conversationControls = selectedChat?.conversationControls;
  const activeConversationDisabledReason = getConversationDisabledReason(conversationControls);
  const isConversationControlPending = blockChatPeerMutation.isPending || unblockChatPeerMutation.isPending;
  const otherMember = selectedChat ? getOtherMember(selectedChat, user?._id) : null;
  const otherMemberStatus = otherMember ? onlineUsers.get(otherMember._id) ?? null : null;
  const allMessages = useMemo(() => messages ?? [], [messages]);
  const messageSearchQuery = showMessageSearch ? messageSearch : '';
  const messageSearchResult = useMessageSearch(selectedChatId, messageSearchQuery);
  const sharedFilesQuery = useSharedAssets(selectedChatId, 'file');
  const sharedMediaQuery = useSharedAssets(selectedChatId, 'media');
  const sharedVoiceQuery = useSharedAssets(selectedChatId, 'voice');
  const pinnedMessagesQuery = usePinnedMessages(selectedChatId);
  const loadedMessageIds = useMemo(() => new Set(allMessages.map((message) => message._id)), [allMessages]);
  const activeComposerUploadState = activeComposerUploadId
    ? sendMessage.uploadStates[activeComposerUploadId]
    : undefined;

  const clearHighlightedMessage = useCallback(() => {
    if (messageHighlightTimeoutRef.current) {
      clearTimeout(messageHighlightTimeoutRef.current);
      messageHighlightTimeoutRef.current = null;
    }
    setHighlightedMessageId(null);
  }, []);

  useEffect(() => {
    if (!favoriteStorageKey) {
      setFavoriteChatIds([]);
      return;
    }

    try {
      const storedFavorites = window.localStorage.getItem(favoriteStorageKey);
      const parsedFavorites = storedFavorites ? JSON.parse(storedFavorites) : [];
      setFavoriteChatIds(Array.isArray(parsedFavorites)
        ? parsedFavorites.filter((chatId): chatId is string => typeof chatId === 'string')
        : []
      );
    } catch (error) {
      console.warn('Could not load favorite conversations:', error);
      setFavoriteChatIds([]);
    }
  }, [favoriteStorageKey]);

  const persistFavoriteChatIds = useCallback((updater: (current: string[]) => string[]) => {
    setFavoriteChatIds((currentFavorites) => {
      const nextFavorites = updater(currentFavorites);

      if (favoriteStorageKey) {
        window.localStorage.setItem(favoriteStorageKey, JSON.stringify(nextFavorites));
      }

      return nextFavorites;
    });
  }, [favoriteStorageKey]);

  const buildOptimisticAttachments = useCallback((
    payload: ComposerSendPayload,
    clientMessageId: string
  ): AttachmentSummary[] => payload.attachments.map((attachment, index) => {
    const optimisticAttachmentId = `optimistic-${clientMessageId}-${index}`;

    return {
      _id: optimisticAttachmentId,
      attachmentId: optimisticAttachmentId,
      displayName: attachment.displayName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      kind: attachment.kind,
      durationSeconds: attachment.durationSeconds ?? null,
      status: 'active',
      localPreviewUrl: attachment.localPreviewUrl,
      createdAt: new Date().toISOString(),
    };
  }), []);

  const buildRetryAttachmentDrafts = useCallback((message: Message): ComposerAttachmentDraft[] | undefined => {
    if (message.localDrafts?.length) {
      return message.localDrafts;
    }

    if (!message.localFiles?.length) {
      return undefined;
    }

    return message.localFiles.map((file, index) => {
      const attachment = message.attachments?.[index];
      const kind = attachment?.kind ?? (file.type.startsWith('image/') ? 'media' : 'file');

      return {
        id: `retry-${message.clientMessageId ?? message._id}-${index}`,
        file,
        displayName: attachment?.displayName ?? file.name,
        mimeType: attachment?.mimeType ?? file.type ?? 'application/octet-stream',
        size: attachment?.size ?? file.size,
        kind,
        durationSeconds: attachment?.durationSeconds ?? null,
        localPreviewUrl: attachment?.localPreviewUrl,
      };
    });
  }, []);

  const revokeMessageLocalPreviewUrls = useCallback((message: Message) => {
    message.attachments?.forEach((attachment) => {
      if (attachment.localPreviewUrl) {
        URL.revokeObjectURL(attachment.localPreviewUrl);
      }
    });
  }, []);

  const handleMessageStatusUpdate = useCallback(
    (event: MessageStatusUpdateEvent) => {
      updateMessageStatus(event.messageId, event.status, event.deliveredAt, event.readAt);
    },
    [updateMessageStatus]
  );

  const handleBatchRead = useCallback(
    (event: BatchReadEvent) => {
      updateMessagesStatus(event.messages);
    },
    [updateMessagesStatus]
  );

  const handleMessageDeleted = useCallback(
    (event: MessageDeletedEvent) => {
      if (event.message) {
        upsertMessage(event.message);
        return;
      }

      if (event.deleteForEveryone) {
        removeMessage(event.messageId);
      }
    },
    [removeMessage, upsertMessage]
  );

  const handleMessageEdited = useCallback(
    (event: MessageEditedEvent) => {
      if (event.message) {
        upsertMessage(event.message);
        return;
      }

      const existingMessage = allMessages.find((message) => message._id === event.messageId);
      if (existingMessage) {
        upsertMessage({
          ...existingMessage,
          text: event.text,
          isEdited: event.isEdited,
          editedAt: event.editedAt,
        });
      }
    },
    [allMessages, upsertMessage]
  );

  const {
    isSocketConnected,
    socketError,
    socketStatus,
    callConfig,
    emitTypingStart,
    emitTypingStop,
    emitCallStart,
    emitCallAccept,
    emitCallReject,
    emitCallEnd,
    emitCallSync,
    emitCallOffer,
    emitCallAnswer,
    emitCallIceCandidate,
  } = useChatSocket({
    chatId: selectedChatId,
    enabled: isAuthenticated,
    notificationPreferences: notificationPreferences.preferences,
    onBackgroundMessageAlert: (copy) => {
      showToast(copy.title, 'info');
    },
    onMessageStatusUpdate: handleMessageStatusUpdate,
    onBatchRead: handleBatchRead,
    onMessageDeleted: handleMessageDeleted,
    onMessageEdited: handleMessageEdited,
    onMessageReaction: (event: MessageReactionEvent) => {
      if (event.message) {
        upsertMessage(event.message);
        return;
      }

      const message = allMessages.find((item) => item._id === event.messageId);
      if (message) {
        upsertMessage({ ...message, reactions: event.reactions });
      }
    },
    onCallIncoming: (event) => callHandlersRef.current?.handleIncomingCall(event),
    onCallSync: (event) => callHandlersRef.current?.handleCallSync(event),
    onCallOffer: (event) => callHandlersRef.current?.handleCallOffer(event),
    onCallAnswer: (event) => callHandlersRef.current?.handleCallAnswer(event),
    onCallIceCandidate: (event) => callHandlersRef.current?.handleCallIceCandidate(event),
    onCallError: (event) => {
      showToast(event.message ?? 'Call action failed.', 'error');
    },
  });

  const presenceQuery = useOnlinePresence({
    enabled: isAuthenticated && !isSocketConnected,
    syncToStore: !isSocketConnected,
  });
  const refetchPresence = presenceQuery.refetch;
  const isPresenceChecking = Boolean(otherMember && presenceQuery.isFetching && !onlineUsers.has(otherMember._id));

  const callSocketActions = useMemo(() => ({
    emitCallStart,
    emitCallAccept,
    emitCallReject,
    emitCallEnd,
    emitCallSync,
    emitCallOffer,
    emitCallAnswer,
    emitCallIceCandidate,
  }), [
    emitCallAccept,
    emitCallAnswer,
    emitCallEnd,
    emitCallIceCandidate,
    emitCallOffer,
    emitCallReject,
    emitCallStart,
    emitCallSync,
  ]);

  const {
    state: callState,
    audioAvailability,
    videoAvailability,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    socketHandlers,
  } = useCallController({
    selectedChat,
    currentUserId: user?._id,
    otherMember,
    otherMemberStatus,
    isPresenceChecking,
    conversationControls,
    isAuthenticated,
    isSocketConnected,
    callConfig,
    socketActions: callSocketActions,
  });
  callHandlersRef.current = socketHandlers;

  const handleStartAudioCall = useCallback(() => {
    void startCall('audio');
  }, [startCall]);

  const handleStartVideoCall = useCallback(() => {
    void startCall('video');
  }, [startCall]);

  const handleAcceptCall = useCallback(() => {
    void acceptCall();
  }, [acceptCall]);

  const handleRejectCall = useCallback(() => {
    void rejectCall();
  }, [rejectCall]);

  const handleEndCall = useCallback(() => {
    void endCall();
  }, [endCall]);

  const { debouncedCallback: debouncedTypingStop, cancel: cancelTypingStop } = useDebounce(() => {
    setIsTyping(false);
    emitTypingStop();
  }, 2000);

  const clearPrivateChatState = useCallback((userIdToClear?: string | null) => {
    const storageUserId = userIdToClear ?? user?._id ?? null;

    if (storageUserId) {
      window.localStorage.removeItem(getSelectedChatStorageKey(storageUserId));
    }

    queryClient.clear();
    setSelectedChatId(null);
    setSearchQuery('');
    setMessageSearch('');
    setShowMessageSearch(false);
    setIsTyping(false);
    setIsSidebarOpen(false);
    setIsNewChatOpen(false);
    setIsDetailDrawerOpen(false);
    setIsDetailRailOpen(false);
    setAttachmentPreview(null);
    setNewChatUsername('');
    setCreateChatError(null);
    clearPresenceState();
    replaceSelectedChatUrl(null);
  }, [
    clearPresenceState,
    queryClient,
    setCreateChatError,
    setIsNewChatOpen,
    setIsSidebarOpen,
    setIsTyping,
    setMessageSearch,
    setNewChatUsername,
    setSearchQuery,
    setSelectedChatId,
    setShowMessageSearch,
    user?._id,
  ]);

  const handleSessionEnded = useCallback((userIdToClear?: string | null) => {
    clearPrivateChatState(userIdToClear);
    authLogout();
    setIsSettingsOpen(false);
  }, [authLogout, clearPrivateChatState, setIsSettingsOpen]);

  useEffect(() => {
    const handleAuthExpired = () => {
      const expiredUserId = useAuthStore.getState().user?._id ?? user?._id ?? null;
      handleSessionEnded(expiredUserId);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, [handleSessionEnded, user?._id]);

  useSessionBroadcast((event) => {
    const activeUserId = useAuthStore.getState().user?._id ?? user?._id ?? null;
    handleSessionEnded(activeUserId);

    if (event.type === 'logout') {
      showToast('Signed out in another tab.', 'info');
    } else {
      showToast('Session expired in another tab. Sign in again to continue.', 'info');
    }
  });

  useEffect(() => {
    clearHighlightedMessage();
    setAttachmentPreview(null);
    setIsDetailDrawerOpen(false);
    setIsDetailRailOpen(isDesktopDetailRailViewport());
    setIsConversationMoreOpen(false);
  }, [clearHighlightedMessage, selectedChatId]);

  useEffect(() => {
    return () => {
      if (messageHighlightTimeoutRef.current) {
        clearTimeout(messageHighlightTimeoutRef.current);
      }
    };
  }, []);

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (activeConversationDisabledReason) {
      return;
    }

    setMessageInput(event.target.value);

    if (!isTyping && event.target.value.trim()) {
      setIsTyping(true);
      emitTypingStart();
    }

    if (event.target.value.trim()) {
      debouncedTypingStop();
    } else {
      cancelTypingStop();
      if (isTyping) {
        setIsTyping(false);
        emitTypingStop();
      }
    }
  };

  useEffect(() => {
    if (!selectedChatId || !user?._id || !allMessages.length) return;

    const unreadMessages = allMessages.filter(
      (message) => message.sender !== user._id && message.status !== 'read'
    );

    if (unreadMessages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleMessageIds: string[] = [];
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.getAttribute('data-message-id');
            if (messageId && !messageId.startsWith('optimistic-')) {
              visibleMessageIds.push(messageId);
            }
          }
        });

        if (visibleMessageIds.length > 0) {
          const unreadVisibleIds = visibleMessageIds.filter((id) =>
            unreadMessages.some((message) => message._id === id)
          );

          if (unreadVisibleIds.length > 0) {
            markMessagesAsReadRef.current({
              chatId: selectedChatId,
              messageIds: unreadVisibleIds,
            });
          }
        }
      },
      { threshold: 0.5 }
    );

    const container = messagesContainerRef.current;
    if (container) {
      unreadMessages.forEach((message) => {
        const element = container.querySelector(`[data-message-id="${message._id}"]`);
        if (element) {
          observer.observe(element);
        }
      });
    }

    return () => observer.disconnect();
  }, [allMessages, selectedChatId, user?._id]);

  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      void refetchPresence();
    };
    const handleOffline = () => setIsBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refetchPresence]);

  useEffect(() => {
    const lastMessage = allMessages[allMessages.length - 1];
    if (!lastMessage) return;

    const lastMessageKey = `${lastMessage._id}:${lastMessage.updatedAt}`;
    if (previousLastMessageKeyRef.current === lastMessageKey) {
      return;
    }

    if (shouldAutoScrollRef.current || lastMessage.sender === user?._id) {
      const shouldAnimate = Boolean(previousLastMessageKeyRef.current);
      const scrollLatestIntoView = () => {
        const container = messagesContainerRef.current;

        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: shouldAnimate ? 'smooth' : 'auto',
          });
          return;
        }

        messagesEndRef.current?.scrollIntoView({
          behavior: shouldAnimate ? 'smooth' : 'auto',
          block: 'end',
        });
      };

      window.requestAnimationFrame(() => {
        scrollLatestIntoView();
        window.requestAnimationFrame(scrollLatestIntoView);
      });
    }

    previousLastMessageKeyRef.current = lastMessageKey;
  }, [allMessages, user?._id]);

  useEffect(() => {
    if (!createChatError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCreateChatError(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [createChatError, setCreateChatError]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setShowReactionPicker(false);
    window.requestAnimationFrame(() => {
      messageActionTriggerRef.current?.focus();
    });
  }, [setContextMenu, setShowReactionPicker]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        closeContextMenu();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [closeContextMenu]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShowEmojiPicker]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editingMessageId) {
          setEditingMessageId(null);
          setEditText('');
        } else if (contextMenu) {
          closeContextMenu();
        } else if (isConversationMoreOpen) {
          setIsConversationMoreOpen(false);
          window.requestAnimationFrame(() => {
            moreButtonRef.current?.focus();
          });
        } else if (showEmojiPicker) {
          setShowEmojiPicker(false);
        } else if (showMessageSearch) {
          setShowMessageSearch(false);
          setMessageSearch('');
          window.requestAnimationFrame(() => {
            messageSearchButtonRef.current?.focus();
          });
        } else if (replyingTo) {
          setReplyingTo(null);
        } else if (isSidebarOpen) {
          setIsSidebarOpen(false);
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'f' && selectedChatId) {
        event.preventDefault();
        setShowMessageSearch(true);
        window.requestAnimationFrame(() => {
          messageSearchInputRef.current?.focus();
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    contextMenu,
    closeContextMenu,
    editingMessageId,
    isSidebarOpen,
    isConversationMoreOpen,
    replyingTo,
    selectedChatId,
    setEditText,
    setEditingMessageId,
    setIsSidebarOpen,
    setMessageSearch,
    setReplyingTo,
    setShowEmojiPicker,
    setShowMessageSearch,
    showEmojiPicker,
    showMessageSearch,
  ]);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    shouldAutoScrollRef.current = isNearBottom;
    setShowScrollButton(!isNearBottom);
  }, [setShowScrollButton]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const handleLogout = async () => {
    const currentUserId = user?._id ?? null;

    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      clearPrivateChatState(currentUserId);
    }
  };

  const handleSendMessage = (payload?: ComposerSendPayload) => {
    if (activeConversationDisabledReason) {
      showToast(activeConversationDisabledReason, 'error');
      return;
    }

    const sourceText = payload?.text ?? messageInput;
    const normalizedMessageInput = sourceText.trim();
    const attachmentDrafts = payload?.attachments ?? [];

    if (
      !selectedChatId ||
      (!normalizedMessageInput && attachmentDrafts.length === 0) ||
      normalizedMessageInput.length > MAX_MESSAGE_TEXT_LENGTH
    ) {
      return;
    }

    const draftKey = buildSendDraftKey(selectedChatId, normalizedMessageInput, attachmentDrafts);
    if (inFlightDraftKeysRef.current.has(draftKey)) {
      return;
    }

    inFlightDraftKeysRef.current.add(draftKey);

    cancelTypingStop();
    if (isTyping) {
      setIsTyping(false);
      emitTypingStop();
    }

    const clientMessageId = createClientMessageId();
    const optimisticAttachments = payload ? buildOptimisticAttachments(payload, clientMessageId) : [];

    if (attachmentDrafts.length > 0) {
      setActiveComposerUploadId(clientMessageId);
    }

    sendMessage.mutate(
      {
        chatId: selectedChatId,
        text: sourceText,
        clientMessageId,
        attachments: attachmentDrafts,
        optimisticAttachments,
      },
      {
        onSuccess: () => {
          setMessageInput('');
          setComposerResetToken((currentToken) => currentToken + 1);
        },
        onSettled: () => {
          inFlightDraftKeysRef.current.delete(draftKey);
          setActiveComposerUploadId((currentUploadId) => (
            currentUploadId === clientMessageId ? null : currentUploadId
          ));
        },
      }
    );
  };

  const handleMessageContextMenu = (event: ReactMouseEvent, messageId: string, isOwn: boolean) => {
    event.preventDefault();
    const menuWidth = 200;
    const menuHeight = 300;

    let x = event.clientX;
    let y = event.clientY;

    if (isOwn) {
      x = Math.max(10, event.clientX - menuWidth);
    } else if (event.clientX + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }

    if (event.clientY + menuHeight > window.innerHeight) {
      y = Math.max(10, window.innerHeight - menuHeight - 10);
    }

    setShowReactionPicker(false);
    setContextMenu({ x, y, messageId, isOwn });
  };

  const handleOpenMessageActions = (event: ReactMouseEvent<HTMLButtonElement>, message: Message, isOwn: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    messageActionTriggerRef.current = event.currentTarget;

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 300;
    const x = Math.min(Math.max(10, rect.right - menuWidth), window.innerWidth - menuWidth - 10);
    const y = Math.min(rect.bottom + 6, window.innerHeight - menuHeight - 10);

    setShowReactionPicker(false);
    setContextMenu({ x, y, messageId: message._id, isOwn });
  };

  const handleReply = (message: Message) => {
    if (activeConversationDisabledReason) {
      showToast(activeConversationDisabledReason, 'error');
      closeContextMenu();
      return;
    }

    setReplyingTo(message);
    closeContextMenu();
  };

  const handleDeleteMessage = (deleteForEveryone: boolean) => {
    if (!contextMenu || !selectedChatId) return;
    if (deleteForEveryone && activeConversationDisabledReason) {
      showToast(activeConversationDisabledReason, 'error');
      closeContextMenu();
      return;
    }

    const messageId = contextMenu.messageId;

    removeMessage(messageId);
    closeContextMenu();

    deleteMessageMutation.mutate(
      { messageId, deleteForEveryone, chatId: selectedChatId },
      {
        onError: (error) => {
          refetchMessages();
          const message = axios.isAxiosError(error)
            ? error.response?.data?.message ?? 'Could not delete message'
            : 'Could not delete message';
          showToast(message, 'error');
        },
      }
    );
  };

  const handleStartEdit = (messageId: string, currentText: string) => {
    if (activeConversationDisabledReason) {
      showToast(activeConversationDisabledReason, 'error');
      closeContextMenu();
      return;
    }

    setEditingMessageId(messageId);
    setEditText(currentText);
    closeContextMenu();
  };

  const handleSaveEdit = () => {
    if (!editingMessageId || !editText.trim()) return;
    if (activeConversationDisabledReason) {
      showToast(activeConversationDisabledReason, 'error');
      setEditingMessageId(null);
      setEditText('');
      return;
    }

    editMessageMutation.mutate(
      { messageId: editingMessageId, text: editText.trim() },
      {
        onSuccess: (updatedMessage) => {
          upsertMessage(updatedMessage);
          setEditingMessageId(null);
          setEditText('');
        },
      }
    );
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditText('');
  };

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;

    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
      return;
    }

    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (activeConversationDisabledReason) {
      showToast(activeConversationDisabledReason, 'error');
      closeContextMenu();
      return;
    }

    const message = allMessages.find((item) => item._id === messageId);
    if (message) {
      const existingReaction = message.reactions?.find((reaction) => reaction.user === user?._id && reaction.emoji === emoji);
      const updatedReactions = existingReaction
        ? (message.reactions || []).filter((reaction) => !(reaction.user === user?._id && reaction.emoji === emoji))
        : [...(message.reactions || []), { user: user?._id || '', emoji }];

      upsertMessage({ ...message, reactions: updatedReactions });
    }

    toggleReactionMutation.mutate(
      { messageId, emoji },
      {
        onError: () => {
          refetchMessages();
          showToast('Failed to add reaction', 'error');
        },
      }
    );
  };

  const handleExportChat = () => {
    if (!selectedChat || !allMessages.length) return;

    const chatTitle = getChatTitle(selectedChat, user?._id);
    const exportData = allMessages.map((message) => ({
      sender: message.sender === user?._id ? 'You' : chatTitle,
      text: message.text,
      time: new Date(message.createdAt).toLocaleString(),
    }));

    const text = exportData.map((message) => `[${message.time}] ${message.sender}: ${message.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${chatTitle}-chat-export.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleNewChat = () => {
    setIsNewChatOpen((prev) => {
      const nextState = !prev;
      if (!nextState) {
        setNewChatUsername('');
      }
      setCreateChatError(null);
      return nextState;
    });
  };

  const handleCreateChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const usernameValidation = validateUsername(newChatUsername);

    if (!usernameValidation.ok) {
      setCreateChatError(INVALID_USERNAME_COPY);
      return;
    }

    setCreateChatError(null);

    createChat.mutate(
      { targetUsername: usernameValidation.value },
      {
        onSuccess: (chat) => {
          setSelectedChatId(chat._id);
          setIsNewChatOpen(false);
          setNewChatUsername('');
          setCreateChatError(null);
        },
        onError: (error) => {
          if (axios.isAxiosError(error)) {
            const message = error.response?.data?.message;
            setCreateChatError(
              error.response?.status === 400 && typeof message === 'string' && /username/i.test(message)
                ? INVALID_USERNAME_COPY
                : GENERIC_NEW_CHAT_ERROR_COPY
            );
          } else {
            setCreateChatError(GENERIC_NEW_CHAT_ERROR_COPY);
          }
        },
      }
    );
  };

  const [enterToSend] = useLocalStorage('chatify_enter_to_send', true);

  const handleComposerKeyDown = (event: Parameters<KeyboardEventHandler<HTMLTextAreaElement>>[0], payload: ComposerSendPayload) => {
    if (event.key === 'Enter' && !event.shiftKey && enterToSend) {
      event.preventDefault();
      handleSendMessage(payload);
    }
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setIsSidebarOpen(false);
  };

  const handleLoadMoreMessages = async () => {
    const container = messagesContainerRef.current;
    const previousScrollHeight = container?.scrollHeight ?? 0;
    await loadMoreMessages();
    window.requestAnimationFrame(() => {
      if (!container) return;
      container.scrollTop += container.scrollHeight - previousScrollHeight;
    });
  };

  const handleToggleMessageSearch = () => {
    const nextState = !showMessageSearch;

    if (!nextState) {
      setMessageSearch('');
    }

    setShowMessageSearch(nextState);
    window.requestAnimationFrame(() => {
      if (nextState) {
        messageSearchInputRef.current?.focus();
      } else {
        messageSearchButtonRef.current?.focus();
      }
    });
  };

  const handleClearMessageSearch = () => {
    setMessageSearch('');
    window.requestAnimationFrame(() => {
      messageSearchInputRef.current?.focus();
    });
  };

  const handleJumpToMessage = useCallback((messageId: string) => {
    if (!loadedMessageIds.has(messageId)) {
      showToast('That message is not loaded yet.', 'info');
      return;
    }

    setShowMessageSearch(false);
    setMessageSearch('');
    clearHighlightedMessage();
    setHighlightedMessageId(messageId);
    messageHighlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((currentMessageId) => currentMessageId === messageId ? null : currentMessageId);
      messageHighlightTimeoutRef.current = null;
    }, 1200);

    window.requestAnimationFrame(() => {
      const messageElement = messagesContainerRef.current?.querySelector(`[data-message-id="${messageId}"]`);
      messageElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [clearHighlightedMessage, loadedMessageIds, setMessageSearch, setShowMessageSearch, showToast]);

  const handleSelectMessageSearchResult = (message: Message) => {
    handleJumpToMessage(message._id);
  };

  const handleAppendEmoji = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
  };

  const handleOpenAttachmentPreview = useCallback((attachment: AttachmentPreviewTarget) => {
    if (attachment.status !== 'active') {
      showToast('Attachment is unavailable.', 'error');
      return;
    }

    setAttachmentPreview(attachment);
  }, [showToast]);

  const handleToggleFavorite = useCallback(() => {
    if (!selectedChatId) {
      return;
    }

    persistFavoriteChatIds((currentFavorites) => (
      currentFavorites.includes(selectedChatId)
        ? currentFavorites.filter((chatId) => chatId !== selectedChatId)
        : [...currentFavorites, selectedChatId]
    ));
  }, [persistFavoriteChatIds, selectedChatId]);

  const handleToggleSelectedChatMute = useCallback(() => {
    if (!selectedChatId) {
      return;
    }

    if (notificationPreferences.isChatMuted(selectedChatId)) {
      notificationPreferences.unmuteChat(selectedChatId);
      showToast('Conversation unmuted. Alerts are on for this chat.', 'info');
      return;
    }

    notificationPreferences.muteChat(selectedChatId);
    showToast('Conversation muted. Alerts are off for this chat.', 'info');
  }, [notificationPreferences, selectedChatId, showToast]);

  const handleCopyMessage = (message: Message) => {
    navigator.clipboard.writeText(message.text);
    closeContextMenu();
  };

  const handleRetryFailedMessage = (message: Message) => {
    if (activeConversationDisabledReason) {
      showToast(activeConversationDisabledReason, 'error');
      return;
    }

    if (!message.clientMessageId) {
      return;
    }

    const retryAttachments = buildRetryAttachmentDrafts(message);

    if ((message.attachments?.length ?? 0) > 0 && !retryAttachments?.length) {
      showToast('Reattach files or re-record voice to retry this message.', 'error');
      return;
    }

    if (retryAttachments?.length) {
      setActiveComposerUploadId(message.clientMessageId);
    }

    sendMessage.mutate(
      {
        chatId: message.chatId,
        text: message.text,
        clientMessageId: message.clientMessageId,
        attachments: retryAttachments,
        optimisticAttachments: message.attachments,
      },
      {
        onSettled: () => {
          setActiveComposerUploadId((currentUploadId) => (
            currentUploadId === message.clientMessageId ? null : currentUploadId
          ));
        },
      }
    );
  };

  const handleDismissFailedMessage = (message: Message) => {
    if (!message.clientMessageId) {
      return;
    }

    revokeMessageLocalPreviewUrls(message);
    dismissFailedMessage(message.clientMessageId);
  };

  const handleTogglePinMessage = (message: Message) => {
    if (!selectedChatId) {
      return;
    }

    if (activeConversationDisabledReason) {
      showToast(activeConversationDisabledReason, 'error');
      closeContextMenu();
      return;
    }

    const mutation = message.pinned ? unpinMessageMutation : pinMessageMutation;

    mutation.mutate(
      { messageId: message._id, chatId: selectedChatId },
      {
        onError: () => {
          showToast('Could not update pinned message.', 'error');
        },
      }
    );
    closeContextMenu();
  };

  const focusMoreButton = useCallback(() => {
    window.requestAnimationFrame(() => {
      moreButtonRef.current?.focus();
    });
  }, []);

  const closeDetailDrawer = useCallback(() => {
    setIsDetailDrawerOpen(false);
    focusMoreButton();
  }, [focusMoreButton]);

  const closeDetailRail = useCallback(() => {
    setIsDetailRailOpen(false);
    focusMoreButton();
  }, [focusMoreButton]);

  const handleOpenDetails = useCallback(() => {
    const isDesktopViewport = isDesktopDetailRailViewport();
    setIsConversationMoreOpen(false);

    if (isDesktopViewport) {
      setIsDetailDrawerOpen(false);
      setIsDetailRailOpen(true);
      return;
    }

    setIsDetailDrawerOpen(true);
  }, []);

  const handleToggleDetails = useCallback(() => {
    const isDesktopViewport = isDesktopDetailRailViewport();
    setIsConversationMoreOpen(false);

    if (isDesktopViewport) {
      setIsDetailDrawerOpen(false);
      setIsDetailRailOpen((currentValue) => !currentValue);
      return;
    }

    setIsDetailRailOpen(false);
    setIsDetailDrawerOpen((currentValue) => !currentValue);
  }, []);

  const handleToggleConversationMoreMenu = useCallback(() => {
    setIsConversationMoreOpen((currentValue) => !currentValue);
  }, []);

  const handleOpenMoreMenuFromDetails = useCallback(() => {
    setIsDetailDrawerOpen(false);
    setIsConversationMoreOpen((currentValue) => !currentValue);
  }, []);

  const handleBlockPeer = useCallback(() => {
    if (!selectedChatId) {
      return;
    }

    if (!conversationControls?.canBlockUser) {
      showToast('Blocking is not available for this conversation.', 'error');
      return;
    }

    blockChatPeerMutation.mutate(selectedChatId, {
      onSuccess: () => {
        setIsConversationMoreOpen(false);
        showToast('User blocked. New activity is disabled for this conversation.', 'success');
      },
      onError: (error) => {
        showToast(getRequestErrorMessage(error, 'Could not block this user.'), 'error');
      },
    });
  }, [blockChatPeerMutation, conversationControls?.canBlockUser, selectedChatId, showToast]);

  const handleUnblockPeer = useCallback(() => {
    if (!selectedChatId) {
      return;
    }

    if (!conversationControls?.canUnblockUser) {
      showToast('Unblock is not available for this conversation.', 'error');
      return;
    }

    unblockChatPeerMutation.mutate(selectedChatId, {
      onSuccess: () => {
        setIsConversationMoreOpen(false);
        showToast('User unblocked. Messaging controls are available again.', 'success');
      },
      onError: (error) => {
        showToast(getRequestErrorMessage(error, 'Could not unblock this user.'), 'error');
      },
    });
  }, [conversationControls?.canUnblockUser, selectedChatId, showToast, unblockChatPeerMutation]);

  const handleUnpinMessage = (messageId: string) => {
    if (!selectedChatId) {
      return;
    }

    if (activeConversationDisabledReason) {
      showToast(activeConversationDisabledReason, 'error');
      return;
    }

    unpinMessageMutation.mutate(
      { messageId, chatId: selectedChatId },
      {
        onError: () => {
          showToast('Could not unpin that message.', 'error');
        },
      }
    );
  };

  const isOffline = !isBrowserOnline;
  const isSessionExpired = !isAuthenticated && !isChatsLoading;
  const isSocketAuthFailed = socketStatus === 'auth_failed';
  const isReconnecting = Boolean(
    selectedChatId &&
    isAuthenticated &&
    !isOffline &&
    !isSocketAuthFailed &&
    (socketError || !isSocketConnected)
  );

  const isInitialChatListLoading = isAuthenticated && isChatsLoading && !chats;

  if ((!isAuthenticated && isChatsLoading) || isInitialChatListLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div
      className="chat-theme-root"
      data-testid="chat-root"
      data-chat-theme={chatTheme.theme}
    >
      <ChatShell
        isSidebarOpen={isSidebarOpen}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        isRightRailOpen={Boolean(selectedChat && isDetailRailOpen)}
        sidebar={(
          <ChatSidebar
            user={user}
            chats={chats}
            selectedChatId={selectedChatId}
            isOpen={isSidebarOpen}
            isLoading={isChatsLoading}
            isError={chatsError}
            searchQuery={searchQuery}
            isNewChatOpen={isNewChatOpen}
            newChatUsername={newChatUsername}
            createChatError={createChatError}
            isCreatingChat={createChat.isPending}
            unreadCounts={unreadCounts}
            mutedChatIds={notificationPreferences.mutedChatIds}
            onlineUsers={onlineUsers}
            newChatButtonRef={newChatButtonRef}
            onSearchChange={setSearchQuery}
            onSelectChat={handleSelectChat}
            onCloseSidebar={() => setIsSidebarOpen(false)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onLogout={handleLogout}
            onToggleNewChat={handleToggleNewChat}
            onNewChatUsernameChange={setNewChatUsername}
            onCreateChatSubmit={handleCreateChatSubmit}
            onRefetchChats={() => refetchChats()}
          />
        )}
        conversation={(
          <ConversationPane
          selectedChat={selectedChat}
          selectedChatId={selectedChatId}
          currentUserId={user?._id}
          otherMember={otherMember}
          otherMemberStatus={otherMemberStatus}
          isPresenceChecking={isPresenceChecking}
          messages={allMessages}
          isMessagesLoading={isMessagesLoading}
          messagesError={messagesError}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          showScrollButton={showScrollButton}
          showMessageSearch={showMessageSearch}
          showConversationMoreMenu={isConversationMoreOpen}
          showConversationDetails={isDetailRailOpen || isDetailDrawerOpen}
          conversationControls={conversationControls}
          callDisabledReason={audioAvailability.reason}
          videoCallDisabledReason={videoAvailability.reason}
          messageSearch={messageSearch}
          messageSearchInputRef={messageSearchInputRef}
          messageSearchButtonRef={messageSearchButtonRef}
          moreButtonRef={moreButtonRef}
          messageSearchResults={messageSearchResult.messages}
          messageSearchNormalizedQuery={messageSearchResult.normalizedQuery}
          isMessageSearchLoading={messageSearchResult.isSearching}
          isMessageSearchError={messageSearchResult.isError}
          isMessageSearchBelowMinimum={messageSearchResult.isBelowMinimum}
          loadedMessageIds={loadedMessageIds}
          highlightedMessageId={highlightedMessageId}
          editingMessageId={editingMessageId}
          editText={editText}
          isSavingEdit={editMessageMutation.isPending}
          messageInput={messageInput}
          replyingTo={replyingTo}
          showEmojiPicker={showEmojiPicker}
          isSending={sendMessage.isPending}
          isSendError={sendMessage.isError}
          sendDisabledReason={activeConversationDisabledReason}
          composerUploadState={activeComposerUploadState}
          isConversationControlPending={isConversationControlPending}
          composerResetToken={composerResetToken}
          isOffline={isOffline}
          isSessionExpired={isSessionExpired}
          isReconnecting={isReconnecting}
          messagesContainerRef={messagesContainerRef}
          messagesEndRef={messagesEndRef}
          emojiPickerRef={emojiPickerRef}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onStartAudioCall={handleStartAudioCall}
          onStartVideoCall={handleStartVideoCall}
          onToggleConversationMoreMenu={handleToggleConversationMoreMenu}
          onToggleConversationDetails={handleToggleDetails}
          onToggleMessageSearch={handleToggleMessageSearch}
          onMessageSearchChange={setMessageSearch}
          onClearMessageSearch={handleClearMessageSearch}
          onSelectMessageSearchResult={handleSelectMessageSearchResult}
          onExportChat={handleExportChat}
          onLoadMore={handleLoadMoreMessages}
          onRetryLoad={() => refetchMessages()}
          onScrollToBottom={scrollToBottom}
          onMessageContextMenu={handleMessageContextMenu}
          onOpenMessageActions={handleOpenMessageActions}
          onOpenAttachmentPreview={handleOpenAttachmentPreview}
          onStartEdit={handleStartEdit}
          onRetryFailed={handleRetryFailedMessage}
          onDismissFailed={handleDismissFailedMessage}
          onEditTextChange={setEditText}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onComposerChange={handleInputChange}
          onComposerKeyDown={handleComposerKeyDown}
          onSendMessage={handleSendMessage}
          onToggleEmojiPicker={() => setShowEmojiPicker((prev) => !prev)}
          onAppendEmoji={handleAppendEmoji}
          onCancelComposerUpload={() => sendMessage.cancelUpload(activeComposerUploadId)}
          onUnblockUser={handleUnblockPeer}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}
      rightRail={selectedChat ? (
        <ChatContextRail
          isOpen={isDetailRailOpen}
          selectedChat={selectedChat}
          currentUserId={user?._id}
          otherMember={otherMember}
          otherMemberStatus={otherMemberStatus}
          isPresenceChecking={isPresenceChecking}
          pinnedMessages={pinnedMessagesQuery.data ?? []}
          sharedFiles={sharedFilesQuery.data ?? []}
          sharedMedia={sharedMediaQuery.data ?? []}
          sharedVoice={sharedVoiceQuery.data ?? []}
          isPinnedLoading={pinnedMessagesQuery.isLoading}
          isSharedFilesLoading={sharedFilesQuery.isLoading}
          isSharedMediaLoading={sharedMediaQuery.isLoading}
          isSharedVoiceLoading={sharedVoiceQuery.isLoading}
          isPinnedError={pinnedMessagesQuery.isError}
          isSharedFilesError={sharedFilesQuery.isError}
          isSharedMediaError={sharedMediaQuery.isError}
          isSharedVoiceError={sharedVoiceQuery.isError}
          isAuthenticated={isAuthenticated}
          isSocketConnected={isSocketConnected}
          isReconnecting={isReconnecting}
          isOffline={isOffline}
          conversationControls={conversationControls}
          isConversationControlPending={isConversationControlPending}
          isFavorite={isSelectedChatFavorite}
          callDisabledReason={audioAvailability.reason}
          videoCallDisabledReason={videoAvailability.reason}
          onToggleFavorite={handleToggleFavorite}
          onClose={closeDetailRail}
          onStartAudioCall={handleStartAudioCall}
          onStartVideoCall={handleStartVideoCall}
          onSearchMessages={handleToggleMessageSearch}
          onOpenMoreMenu={handleOpenMoreMenuFromDetails}
          onOpenAttachmentPreview={handleOpenAttachmentPreview}
          onUnblockUser={handleUnblockPeer}
          onJumpToMessage={handleJumpToMessage}
          onUnpinMessage={handleUnpinMessage}
        />
      ) : null}
      overlays={(
        <>
          {selectedChat && (
            <ConversationDetailDrawer
              isOpen={isDetailDrawerOpen}
              selectedChat={selectedChat}
              currentUserId={user?._id}
              otherMember={otherMember}
              otherMemberStatus={otherMemberStatus}
              isPresenceChecking={isPresenceChecking}
              pinnedMessages={pinnedMessagesQuery.data ?? []}
              sharedFiles={sharedFilesQuery.data ?? []}
              sharedMedia={sharedMediaQuery.data ?? []}
              sharedVoice={sharedVoiceQuery.data ?? []}
              isPinnedLoading={pinnedMessagesQuery.isLoading}
              isSharedFilesLoading={sharedFilesQuery.isLoading}
              isSharedMediaLoading={sharedMediaQuery.isLoading}
              isSharedVoiceLoading={sharedVoiceQuery.isLoading}
              isPinnedError={pinnedMessagesQuery.isError}
              isSharedFilesError={sharedFilesQuery.isError}
              isSharedMediaError={sharedMediaQuery.isError}
              isSharedVoiceError={sharedVoiceQuery.isError}
              isAuthenticated={isAuthenticated}
              isSocketConnected={isSocketConnected}
              isReconnecting={isReconnecting}
              isOffline={isOffline}
              conversationControls={conversationControls}
              isConversationControlPending={isConversationControlPending}
              isFavorite={isSelectedChatFavorite}
              callDisabledReason={audioAvailability.reason}
              videoCallDisabledReason={videoAvailability.reason}
              onToggleFavorite={handleToggleFavorite}
              onClose={closeDetailDrawer}
              onStartAudioCall={handleStartAudioCall}
              onStartVideoCall={handleStartVideoCall}
              onSearchMessages={() => {
                setIsDetailDrawerOpen(false);
                handleToggleMessageSearch();
              }}
              onOpenMoreMenu={handleOpenMoreMenuFromDetails}
              onOpenAttachmentPreview={handleOpenAttachmentPreview}
              onUnblockUser={handleUnblockPeer}
              onJumpToMessage={(messageId) => {
                setIsDetailDrawerOpen(false);
                handleJumpToMessage(messageId);
              }}
              onUnpinMessage={handleUnpinMessage}
            />
          )}
          {selectedChat && (
            <ConversationMoreMenu
              isOpen={isConversationMoreOpen}
              anchorRef={moreButtonRef}
              conversationControls={conversationControls}
              canExport={allMessages.length > 0}
              isMuted={isSelectedChatMuted}
              isActionPending={isConversationControlPending}
              callDisabledReason={audioAvailability.reason}
              videoCallDisabledReason={videoAvailability.reason}
              onOpenDetails={handleOpenDetails}
              onStartAudioCall={handleStartAudioCall}
              onStartVideoCall={handleStartVideoCall}
              onSearchMessages={handleToggleMessageSearch}
              onExportChat={handleExportChat}
              onToggleMute={handleToggleSelectedChatMute}
              onBlockUser={handleBlockPeer}
              onUnblockUser={handleUnblockPeer}
              onClose={() => setIsConversationMoreOpen(false)}
            />
          )}
          <MessageActionMenu
            contextMenu={contextMenu}
            messages={allMessages}
            showReactionPicker={showReactionPicker}
            activeActionsDisabled={Boolean(activeConversationDisabledReason)}
            activeActionsDisabledReason={activeConversationDisabledReason}
            contextMenuRef={contextMenuRef}
            onReaction={handleReaction}
            onToggleReactionPicker={() => setShowReactionPicker((prev) => !prev)}
            onReply={handleReply}
            onStartEdit={handleStartEdit}
            onDelete={handleDeleteMessage}
            onCopy={handleCopyMessage}
            onTogglePin={handleTogglePinMessage}
            onClose={closeContextMenu}
          />
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            chatTheme={chatTheme.theme}
            chatThemePreference={chatTheme.preference}
            isChatThemeForced={chatTheme.isForced}
            onChatThemePreferenceChange={chatTheme.setPreference}
          />
          <CallOverlay
            callState={callState}
            onAccept={handleAcceptCall}
            onReject={handleRejectCall}
            onEnd={handleEndCall}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
          />
          <AttachmentPreviewModal
            attachment={attachmentPreview}
            onClose={() => setAttachmentPreview(null)}
          />
        </>
      )}
    />
    </div>
  );
};

export default ChatPage;
