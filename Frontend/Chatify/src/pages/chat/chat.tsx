import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEventHandler } from 'react';
import axios from 'axios';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import AccountsButton from '../../components/accountsButton';
import LoadingSpinner from '../../components/loadingSpinner';
import MessageStatus from '../../components/MessageStatus';
import OnlineStatus, { OnlineDot } from '../../components/OnlineStatus';
import TypingIndicator from '../../components/TypingIndicator';
import SettingsModal from '../../components/SettingsModal';
import { useToast } from '../../components/Toast';
import useLocalStorage from '../../hooks/useLocalStorage';
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
} from '../../hooks/useChatQueries';
import { useChatSocket } from '../../hooks/useChatSocket';
import type { Chat, Message, MessageStatusUpdateEvent, BatchReadEvent, MessageDeletedEvent, MessageEditedEvent, MessageReactionEvent } from '../../types/chat';
import './chat.css';

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format date for message separators
const formatMessageDate = (timestamp: string) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};

// Check if two dates are on different days
const isDifferentDay = (date1: string, date2: string) => {
  return new Date(date1).toDateString() !== new Date(date2).toDateString();
};

const getChatTitle = (chat: Chat, userId: string | undefined) => {
  if (chat.isGroupChat && chat.chatName) {
    return chat.chatName;
  }

  const otherMember = chat.members.find((member) => member._id !== userId);
  if (!otherMember) {
    return chat.chatName || 'Unknown chat';
  }

  return `${otherMember.firstName} ${otherMember.lastName ?? ''}`.trim();
};

// Get other member for 1-on-1 chats
const getOtherMember = (chat: Chat, userId: string | undefined) => {
  if (chat.isGroupChat) return null;
  return chat.members.find((member) => member._id !== userId) || null;
};

// Debounce hook
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

const ChatPage = () => {
  const { user, isAuthenticated } = useAuthStore();
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const logoutMutation = useLogout();
  const { showToast } = useToast();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [createChatError, setCreateChatError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; messageId: string; isOwn: boolean } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [messageSearch, setMessageSearch] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const { data: chats, isLoading: isChatsLoading, isError: chatsError, refetch: refetchChats } = useChats();
  const {
    messages,
    isLoading: isMessagesLoading,
    isError: messagesError,
    refetch: refetchMessages,
    upsertMessage,
    removeMessage,
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

  // Get unread counts for chats
  const chatIds = useMemo(() => chats?.map(c => c._id) ?? [], [chats]);
  const { data: unreadCounts } = useUnreadCounts(chatIds);
  
  // Use ref to avoid stale closure issues with mutation
  const markMessagesAsReadRef = useRef(markMessagesAsReadMutation.mutate);
  markMessagesAsReadRef.current = markMessagesAsReadMutation.mutate;

  // Handle message status updates
  const handleMessageStatusUpdate = useCallback(
    (event: MessageStatusUpdateEvent) => {
      updateMessageStatus(event.messageId, event.status, event.deliveredAt, event.readAt);
    },
    [updateMessageStatus]
  );

  // Handle batch read events
  const handleBatchRead = useCallback(
    (event: BatchReadEvent) => {
      updateMessagesStatus(event.messages);
    },
    [updateMessagesStatus]
  );

  // Handle message deleted events
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

  // Handle message edited events
  const handleMessageEdited = useCallback(
    (event: MessageEditedEvent) => {
      if (event.message) {
        upsertMessage(event.message);
        return;
      }

      const existingMessage = messages.find(m => m._id === event.messageId);
      if (existingMessage) {
        upsertMessage({
          ...existingMessage,
          text: event.text,
          isEdited: event.isEdited,
          editedAt: event.editedAt,
        });
      }
    },
    [messages, upsertMessage]
  );

  // Connect to socket and handle incoming messages
  const { emitTypingStart, emitTypingStop, emitMessageDelivered } = useChatSocket({
    chatId: selectedChatId,
    enabled: !!selectedChatId && isAuthenticated,
    onMessage: (message) => {
      upsertMessage(message);
      // Mark as delivered when we receive it
      if (message.sender !== user?._id) {
        emitMessageDelivered(message._id);
      }
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

      // Update message reactions in cache
      const message = messages?.find(m => m._id === event.messageId);
      if (message) {
        upsertMessage({ ...message, reactions: event.reactions });
      }
    },
  });

  // Debounced typing stop
  const { debouncedCallback: debouncedTypingStop, cancel: cancelTypingStop } = useDebounce(() => {
    setIsTyping(false);
    emitTypingStop();
  }, 2000);

  // Handle typing input
  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(event.target.value);

    // Emit typing start if not already typing
    if (!isTyping && event.target.value.trim()) {
      setIsTyping(true);
      emitTypingStart();
    }

    // Reset the stop timer
    if (event.target.value.trim()) {
      debouncedTypingStop();
    } else {
      // If input is empty, stop typing immediately
      cancelTypingStop();
      if (isTyping) {
        setIsTyping(false);
        emitTypingStop();
      }
    }
  };

  // Mark messages as read using Intersection Observer
  useEffect(() => {
    if (!selectedChatId || !user?._id || !messages.length) return;

    const unreadMessages = messages.filter(
      (msg) => msg.sender !== user._id && msg.status !== 'read'
    );

    if (unreadMessages.length === 0) return;

    // Use Intersection Observer to detect when messages become visible
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
          // Filter to only unread messages
          const unreadVisibleIds = visibleMessageIds.filter((id) =>
            unreadMessages.some((msg) => msg._id === id)
          );

          if (unreadVisibleIds.length > 0) {
            // Use ref to avoid stale closure
            markMessagesAsReadRef.current({
              chatId: selectedChatId,
              messageIds: unreadVisibleIds,
            });
          }
        }
      },
      { threshold: 0.5 }
    );

    // Observe all unread messages
    const container = messagesContainerRef.current;
    if (container) {
      unreadMessages.forEach((msg) => {
        const element = container.querySelector(`[data-message-id="${msg._id}"]`);
        if (element) {
          observer.observe(element);
        }
      });
    }

    return () => observer.disconnect();
  }, [selectedChatId, messages, user?._id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selectedChatId && chats && chats.length > 0) {
      setSelectedChatId(chats[0]._id);
    }
  }, [chats, selectedChatId]);

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
  }, [createChatError]);

  const selectedChat = useMemo(
    () => chats?.find((chat) => chat._id === selectedChatId) ?? null,
    [chats, selectedChatId]
  );

  // Get other member's online status for 1-on-1 chats
  const otherMember = selectedChat ? getOtherMember(selectedChat, user?._id) : null;
  const otherMemberStatus = otherMember ? onlineUsers.get(otherMember._id) : null;

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSendMessage = () => {
    if (!selectedChatId || !messageInput.trim()) {
      return;
    }

    // Stop typing when sending
    cancelTypingStop();
    if (isTyping) {
      setIsTyping(false);
      emitTypingStop();
    }

    sendMessage.mutate(
      {
        chatId: selectedChatId,
        text: messageInput.trim(),
      },
      {
        onSuccess: () => {
          setMessageInput('');
        },
      }
    );
  };

  // Handle message context menu (right-click)
  const handleMessageContextMenu = (e: React.MouseEvent, messageId: string, isOwn: boolean) => {
    e.preventDefault();
    const menuWidth = 200;
    const menuHeight = 300;
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Position to left of cursor for own messages (sender) to prevent overflow
    if (isOwn) {
      x = Math.max(10, e.clientX - menuWidth);
    } else {
      // For received messages, check if menu would overflow right edge
      if (e.clientX + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
      }
    }
    
    // Check if menu would overflow bottom edge
    if (e.clientY + menuHeight > window.innerHeight) {
      y = Math.max(10, window.innerHeight - menuHeight - 10);
    }
    
    setShowReactionPicker(false);
    setContextMenu({ x, y, messageId, isOwn });
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close modals/menus
      if (e.key === 'Escape') {
        if (editingMessageId) {
          setEditingMessageId(null);
          setEditText('');
        } else if (contextMenu) {
          setContextMenu(null);
        } else if (showEmojiPicker) {
          setShowEmojiPicker(false);
        } else if (showMessageSearch) {
          setShowMessageSearch(false);
          setMessageSearch('');
        } else if (replyingTo) {
          setReplyingTo(null);
        }
      }
      // Ctrl+F to search in chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && selectedChatId) {
        e.preventDefault();
        setShowMessageSearch(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingMessageId, contextMenu, showEmojiPicker, showMessageSearch, replyingTo, selectedChatId]);

  // Handle reply to message
  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setContextMenu(null);
  };

  // Handle delete message with optimistic update
  const handleDeleteMessage = (deleteForEveryone: boolean) => {
    if (!contextMenu || !selectedChatId) return;
    const messageId = contextMenu.messageId;
    
    // Optimistically remove message immediately
    removeMessage(messageId);
    setContextMenu(null);
    
    deleteMessageMutation.mutate(
      { messageId, deleteForEveryone, chatId: selectedChatId },
      {
        onError: (error) => {
          // Rollback: refetch messages on error
          refetchMessages();
          const message = axios.isAxiosError(error)
            ? error.response?.data?.message ?? 'Could not delete message'
            : 'Could not delete message';
          showToast(message, 'error');
        },
      }
    );
  };

  // Handle edit message
  const handleStartEdit = (messageId: string, currentText: string) => {
    setEditingMessageId(messageId);
    setEditText(currentText);
    setContextMenu(null);
  };

  const handleSaveEdit = () => {
    if (!editingMessageId || !editText.trim()) return;
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

  // Scroll detection for scroll-to-bottom button
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    setShowScrollButton(!isNearBottom);
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Handle reaction to message with optimistic update
  const handleReaction = (messageId: string, emoji: string) => {
    // Optimistic update - update message in cache immediately
    const message = allMessages.find(m => m._id === messageId);
    if (message) {
      const existingReaction = message.reactions?.find(r => r.user === user?._id && r.emoji === emoji);
      const updatedReactions = existingReaction
        ? (message.reactions || []).filter(r => !(r.user === user?._id && r.emoji === emoji))
        : [...(message.reactions || []), { user: user?._id || '', emoji }];
      
      upsertMessage({ ...message, reactions: updatedReactions });
    }
    
    toggleReactionMutation.mutate(
      { messageId, emoji },
      {
        onError: () => {
          // Rollback on error
          refetchMessages();
          showToast('Failed to add reaction', 'error');
        },
      }
    );
    setContextMenu(null);
    setShowReactionPicker(false);
  };

  // Export chat history
  const handleExportChat = () => {
    if (!selectedChat || !allMessages.length) return;
    
    const chatTitle = getChatTitle(selectedChat, user?._id);
    const exportData = allMessages.map(msg => ({
      sender: msg.sender === user?._id ? 'You' : chatTitle,
      text: msg.text,
      time: new Date(msg.createdAt).toLocaleString(),
    }));
    
    const text = exportData.map(m => `[${m.time}] ${m.sender}: ${m.text}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chatTitle}-chat-export.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleNewChat = () => {
    setIsNewChatOpen((prev) => {
      const nextState = !prev;
      if (!nextState) {
        setNewChatEmail('');
      }
      setCreateChatError(null);
      return nextState;
    });
  };

  const handleCreateChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = newChatEmail.trim();

    if (!trimmedEmail) {
      setCreateChatError('Please enter an email address.');
      return;
    }

    setCreateChatError(null);

    createChat.mutate(
      { targetEmail: trimmedEmail },
      {
        onSuccess: (chat) => {
          setSelectedChatId(chat._id);
          setIsNewChatOpen(false);
          setNewChatEmail('');
          setCreateChatError(null);
        },
        onError: (error) => {
          if (axios.isAxiosError(error)) {
            const message = error.response?.data?.message ?? 'We could not create that chat.';
            setCreateChatError(message);
          } else {
            setCreateChatError('We could not create that chat.');
          }
        },
      }
    );
  };

  const [enterToSend] = useLocalStorage('chatify_enter_to_send', true);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && enterToSend) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  if (!isAuthenticated && isChatsLoading) {
    return <LoadingSpinner />;
  }

  const allMessages = messages ?? [];
  const conversationMessages = messageSearch.trim()
    ? allMessages.filter(m => m.text.toLowerCase().includes(messageSearch.toLowerCase()))
    : allMessages;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50">
      {/* Overlay for mobile */}
      <div 
        className={`chat-overlay ${isSidebarOpen ? 'show' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />
      
      <aside className={`chat-sidebar w-80 border-r border-slate-900 bg-slate-900/60 backdrop-blur-sm flex flex-col ${isSidebarOpen ? 'open' : ''}`}>
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          {user?.profilePic ? (
            <img src={user.profilePic} alt="Profile" className="profile-pic h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="profile-pic h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center text-lg font-semibold">
              {user?.firstName?.charAt(0)}
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs text-slate-400">Logged in as</p>
            <p className="font-semibold">{user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Guest'}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Settings button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="cursor-pointer p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <div onClick={handleLogout} className="cursor-pointer">
              <AccountsButton color="#dc2626" text="Logout" />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Chats</h2>
          <button
            type="button"
            onClick={handleToggleNewChat}
            className="cursor-pointer rounded bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20"
          >
            {isNewChatOpen ? 'Close' : 'New chat'}
          </button>
        </div>

        {/* Search chats */}
        <div className="px-4 py-2 border-b border-slate-800">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {isNewChatOpen ? (
          <form onSubmit={handleCreateChatSubmit} className="border-b border-slate-800 px-4 py-3 space-y-2">
            <label htmlFor="new-chat-email" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Start a chat by email
            </label>
            <div className="flex gap-2">
              <input
                id="new-chat-email"
                type="email"
                value={newChatEmail}
                onChange={(event) => setNewChatEmail(event.target.value)}
                className="flex-1 rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="friend@example.com"
                required
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={createChat.isPending}
                className="rounded bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {createChat.isPending ? 'Adding…' : 'Add' }
              </button>
            </div>
            {createChatError ? (
              <p className="text-xs text-red-400">{createChatError}</p>
            ) : null}
          </form>
        ) : null}

        <div className="flex-1 overflow-y-auto chat-sidebar-scroll">
          {isChatsLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading chats...</div>
          ) : chatsError ? (
            <div className="p-4 text-sm text-red-400 space-y-2">
              <p>We could not load your chats.</p>
              <button
                type="button"
                onClick={() => refetchChats()}
                className="cursor-pointer rounded bg-emerald-500/10 px-3 py-1 text-emerald-300 hover:bg-emerald-500/20"
              >
                Try again
              </button>
            </div>
          ) : chats && chats.length > 0 ? (
            <ul className="space-y-1 p-2">
              {chats
                .filter((chat) => {
                  if (!searchQuery.trim()) return true;
                  const title = getChatTitle(chat, user?._id).toLowerCase();
                  return title.includes(searchQuery.toLowerCase());
                })
                .map((chat) => {
                const isActive = chat._id === selectedChatId;
                const title = getChatTitle(chat, user?._id);
                const chatOtherMember = getOtherMember(chat, user?._id);
                const memberStatus = chatOtherMember ? onlineUsers.get(chatOtherMember._id) : null;
                
                return (
                  <li key={chat._id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatId(chat._id);
                        setIsSidebarOpen(false);
                      }}
                      className={`cursor-pointer w-full rounded-lg px-3 py-2 text-left transition-colors ${
                        isActive ? 'bg-emerald-500/20 text-emerald-100' : 'hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm flex items-center gap-2">
                          {title}
                          {!chat.isGroupChat && memberStatus?.isOnline && (
                            <OnlineStatus isOnline={true} size="sm" />
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          {Number(unreadCounts?.get(chat._id)) > 0 && (
                            <span className="bg-emerald-500 text-emerald-950 text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                              {unreadCounts!.get(chat._id)! > 99 ? '99+' : unreadCounts!.get(chat._id)}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            {chat.latestMessage
                              ? formatTimestamp(chat.latestMessage.updatedAt)
                              : formatTimestamp(chat.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-400 truncate">
                        {chat.latestMessage ? chat.latestMessage.text : 'No messages yet'}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400 p-4 text-center">
              You do not have any chats yet. Start a conversation to see it here.
            </div>
          )}
        </div>
      </aside>

      <section className="flex flex-1 flex-col">
        {selectedChat ? (
          <>
            <div className="border-b border-slate-900 bg-slate-900/60 p-4 flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="cursor-pointer md:hidden text-slate-400 hover:text-emerald-400"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              
              {/* Avatar with online status */}
              {otherMember && (
                <div className="relative">
                  {otherMember.profilePic ? (
                    <img
                      src={otherMember.profilePic}
                      alt={otherMember.firstName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold">
                      {otherMember.firstName?.charAt(0)}
                    </div>
                  )}
                  <OnlineDot isOnline={otherMemberStatus?.isOnline ?? false} size="sm" />
                </div>
              )}
              
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{getChatTitle(selectedChat, user?._id)}</h2>
                {selectedChat.isGroupChat ? (
                  <p className="text-xs text-slate-400">
                    {selectedChat.members.length} member{selectedChat.members.length === 1 ? '' : 's'}
                  </p>
                ) : otherMember ? (
                  <OnlineStatus
                    isOnline={otherMemberStatus?.isOnline ?? false}
                    lastSeen={otherMemberStatus?.lastSeen}
                    showText
                    showDot={false}
                  />
                ) : null}
              </div>
              
              {/* Search toggle button */}
              <button
                onClick={() => {
                  setShowMessageSearch(!showMessageSearch);
                  if (showMessageSearch) setMessageSearch('');
                }}
                className="cursor-pointer text-slate-400 hover:text-emerald-400 p-2"
                title="Search messages"
              >
                🔍
              </button>
              
              {/* Export chat button */}
              <button
                onClick={handleExportChat}
                className="cursor-pointer text-slate-400 hover:text-emerald-400 p-2"
                title="Export chat"
              >
                📥
              </button>
            </div>

            {/* Message Search Bar */}
            {showMessageSearch && (
              <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-2">
                <input
                  type="text"
                  value={messageSearch}
                  onChange={(e) => setMessageSearch(e.target.value)}
                  placeholder="Search in conversation..."
                  className="w-full bg-slate-800 text-slate-100 text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {messageSearch && (
                  <p className="text-xs text-slate-500 mt-1">
                    Found {conversationMessages.length} message{conversationMessages.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Typing indicator below header */}
            {selectedChatId && <TypingIndicator chatId={selectedChatId} />}

            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto bg-slate-950 px-6 py-4 space-y-3 chat-messages-scroll"
            >
              {isMessagesLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Loading messages...
                </div>
              ) : messagesError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-red-400">
                  <p>We could not load this conversation.</p>
                  <button
                    type="button"
                    onClick={() => refetchMessages()}
                    className="cursor-pointer rounded bg-emerald-500/10 px-3 py-1 text-emerald-300 hover:bg-emerald-500/20"
                  >
                    Try again
                  </button>
                </div>
              ) : conversationMessages.length > 0 ? (
                <>
                  {/* Load More Button */}
                  {hasMore && (
                    <div className="flex justify-center py-2">
                      <button
                        onClick={loadMoreMessages}
                        disabled={isLoadingMore}
                        className="cursor-pointer text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoadingMore ? 'Loading...' : '↑ Load older messages'}
                      </button>
                    </div>
                  )}
                  {conversationMessages.map((message, index) => {
                    const isOwnMessage = message.sender === user?._id;
                    const prevMessage = conversationMessages[index - 1];
                    const showDateSeparator = index === 0 || (prevMessage && isDifferentDay(prevMessage.createdAt, message.createdAt));
                    const isEditing = editingMessageId === message._id;
                    
                    return (
                      <div key={message._id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-4">
                            <div className="bg-slate-800 text-slate-400 text-xs px-3 py-1 rounded-full">
                              {formatMessageDate(message.createdAt)}
                            </div>
                          </div>
                        )}
                        {isEditing ? (
                          <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[70%] space-y-2">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full p-2 rounded-lg bg-slate-800 text-slate-100 text-sm border border-emerald-500 focus:outline-none"
                                rows={3}
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={handleCancelEdit}
                                  className="cursor-pointer px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={handleSaveEdit}
                                  disabled={editMessageMutation.isPending}
                                  className="cursor-pointer px-3 py-1 text-xs bg-emerald-500 text-emerald-950 rounded hover:bg-emerald-400 disabled:cursor-not-allowed"
                                >
                                  {editMessageMutation.isPending ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <MessageBubble
                            message={message}
                            isOwnMessage={isOwnMessage}
                            isGroupChat={selectedChat.isGroupChat}
                            members={selectedChat.members}
                            onContextMenu={(e) => handleMessageContextMenu(e, message._id, isOwnMessage)}
                            onDoubleClick={(msg) => handleStartEdit(msg._id, msg.text)}
                          />
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  No messages yet. Start the conversation!
                </div>
              )}
              
              {/* Scroll to bottom button */}
              {showScrollButton && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-24 right-8 bg-emerald-500 text-emerald-950 p-3 rounded-full shadow-lg hover:bg-emerald-400 transition-all z-40"
                  title="Scroll to bottom"
                >
                  ↓
                </button>
              )}
            </div>

            <div className="border-t border-slate-900 bg-slate-900/60 p-4">
              {/* Reply Preview */}
              {replyingTo && (
                <div className="mb-2 flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2 border-l-4 border-emerald-500">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-emerald-400 font-medium">Replying to</p>
                    <p className="text-sm text-slate-300 truncate">{replyingTo.text}</p>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="cursor-pointer ml-2 text-slate-400 hover:text-slate-200"
                  >
                    ✕
                  </button>
                </div>
              )}
              
              <div className="rounded-lg bg-slate-950 border border-slate-800 focus-within:border-emerald-500">
                <textarea
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a message..."
                  className="chat-input-area h-24 w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm text-slate-100 outline-none"
                />
                <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="relative" ref={emojiPickerRef}>
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="cursor-pointer text-slate-400 hover:text-emerald-400 transition-colors p-1"
                        title="Add emoji"
                      >
                        😀
                      </button>
                      {showEmojiPicker && (
                        <div className="absolute bottom-10 left-0 z-50">
                          <EmojiPicker
                            theme={Theme.DARK}
                            onEmojiClick={(emoji) => {
                              setMessageInput(prev => prev + emoji.emoji);
                              setShowEmojiPicker(false);
                            }}
                            width={300}
                            height={400}
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Press Enter to send
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={sendMessage.isPending || !messageInput.trim() || messageInput.length > 1000}
                      className="cursor-pointer rounded bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      {sendMessage.isPending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
              {sendMessage.isError && (
                <p className="mt-2 text-sm text-red-400">We could not send your message. Please try again.</p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-950 text-center text-slate-400 px-6">
            <h2 className="text-xl font-semibold text-slate-100">Select a conversation</h2>
            <p className="text-sm">
              Choose a chat from the sidebar to read messages and start talking.
            </p>
          </div>
        )}
      </section>
      
      {/* Context Menu */}
      {contextMenu && (
        <div 
          ref={contextMenuRef}
          className="fixed bg-slate-800 rounded-lg shadow-xl py-1 z-50 min-w-[200px] border border-slate-700"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Quick Reactions */}
          <div className="flex justify-center gap-1 px-2 py-2 border-b border-slate-700">
            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
              <button
                key={emoji}
                onClick={() => handleReaction(contextMenu.messageId, emoji)}
                className="cursor-pointer text-lg hover:scale-125 transition-transform p-1"
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="cursor-pointer text-lg hover:scale-125 transition-transform p-1"
              title="More reactions"
            >
              ➕
            </button>
          </div>
          
          {/* Emoji Picker for reactions */}
          {showReactionPicker && (
            <div className="absolute bottom-full left-0 mb-2 z-50">
              <EmojiPicker
                theme={Theme.DARK}
                onEmojiClick={(emojiData) => {
                  handleReaction(contextMenu.messageId, emojiData.emoji);
                }}
                width={300}
                height={350}
              />
            </div>
          )}
          
          <button
            onClick={() => {
              const msg = conversationMessages.find(m => m._id === contextMenu.messageId);
              if (msg) handleReply(msg);
            }}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
          >
            ↩️ Reply
          </button>
          {contextMenu.isOwn && (
            <button
              onClick={() => handleStartEdit(contextMenu.messageId, conversationMessages.find(m => m._id === contextMenu.messageId)?.text || '')}
              className="cursor-pointer w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
            >
              ✏️ Edit
            </button>
          )}
          <button
            onClick={() => {
              const msg = conversationMessages.find(m => m._id === contextMenu.messageId);
              if (msg) navigator.clipboard.writeText(msg.text);
              setContextMenu(null);
            }}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
          >
            📋 Copy
          </button>
          {contextMenu.isOwn && (
            <button
              onClick={() => handleDeleteMessage(false)}
              className="cursor-pointer w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
            >
              🗑️ Delete for me
            </button>
          )}
          {contextMenu.isOwn && (
            <button
              onClick={() => handleDeleteMessage(true)}
              className="cursor-pointer w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
            >
              🗑️ Delete for everyone
            </button>
          )}
        </div>
      )}

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  isGroupChat: boolean;
  members: Chat['members'];
  onContextMenu?: (e: React.MouseEvent, message: Message) => void;
  onDoubleClick?: (message: Message) => void;
}

const MessageBubble = memo(({ message, isOwnMessage, isGroupChat, members, onContextMenu, onDoubleClick }: MessageBubbleProps) => {
  // For group chats, show "Seen by X people" for own messages
  const getSeenByText = () => {
    if (!isOwnMessage || !isGroupChat || !message.readBy || message.readBy.length === 0) {
      return null;
    }

    const readCount = message.readBy.length;
    const totalOthers = members.length - 1; // Exclude sender

    if (readCount === totalOthers) {
      return 'Seen by everyone';
    }

    return `Seen by ${readCount} ${readCount === 1 ? 'person' : 'people'}`;
  };

  // Group reactions by emoji and count
  const groupedReactions = useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    const groups = new Map<string, number>();
    message.reactions.forEach(r => {
      groups.set(r.emoji, (groups.get(r.emoji) || 0) + 1);
    });
    return Array.from(groups.entries()).map(([emoji, count]) => ({ emoji, count }));
  }, [message.reactions]);

  const seenByText = getSeenByText();

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      data-message-id={message._id}
      onContextMenu={onContextMenu ? (e) => onContextMenu(e, message) : undefined}
      onDoubleClick={onDoubleClick && isOwnMessage ? () => onDoubleClick(message) : undefined}
    >
      <div className="flex flex-col">
        <div
          className={`message-bubble max-w-[80%] rounded-2xl pl-2.5 pr-8 py-2 text-sm shadow cursor-pointer ${
            isOwnMessage
              ? 'bg-emerald-500 text-emerald-950'
              : 'bg-slate-800 text-slate-100'
          }`}
        >
          {message.isEdited && (
            <span className="text-[9px] opacity-70 italic">(edited)</span>
          )}
          <p className=''>{message.text}</p>
          <div className={`mt-1 flex items-end-safe justify-start gap-1 text-[10px] ${isOwnMessage ? 'text-emerald-900' : 'text-slate-400'}`}>
            <span className='text-nowrap'>{formatTimestamp(message.updatedAt)}</span>
            <MessageStatus status={message.status || 'sent'} isOwnMessage={isOwnMessage} />
          </div>
          {seenByText && (
            <p className="text-[9px] text-emerald-800 text-right mt-0.5">{seenByText}</p>
          )}
        </div>
        {/* Reactions display */}
        {groupedReactions.length > 0 && (
          <div className={`flex gap-1 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            {groupedReactions.map(({ emoji, count }) => (
              <span
                key={emoji}
                className="inline-flex pointer-events-none items-center gap-0.5 bg-slate-700/80 rounded-full px-1.5 py-0.5 text-xs"
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-slate-300">{count}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default ChatPage;
