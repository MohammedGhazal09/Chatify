import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEventHandler } from 'react';
import axios from 'axios';
import AccountsButton from '../../components/accountsButton';
import LoadingSpinner from '../../components/loadingSpinner';
import MessageStatus from '../../components/MessageStatus';
import OnlineStatus, { OnlineDot } from '../../components/OnlineStatus';
import TypingIndicator from '../../components/TypingIndicator';
import { useAuthStore } from '../../store/authstore';
import { usePresenceStore } from '../../store/presenceStore';
import { useLogout } from '../../hooks/useAuthQuery';
import {
  useChats,
  useCreateChat,
  useMessages,
  useSendMessage,
  useMarkMessagesAsRead,
} from '../../hooks/useChatQueries';
import { useChatSocket } from '../../hooks/useChatSocket';
import type { Chat, Message, MessageStatusUpdateEvent, BatchReadEvent } from '../../types/chat';
import './chat.css';

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [createChatError, setCreateChatError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const { data: chats, isLoading: isChatsLoading, isError: chatsError, refetch: refetchChats } = useChats();
  const {
    messages,
    isLoading: isMessagesLoading,
    isError: messagesError,
    refetch: refetchMessages,
    upsertMessage,
    updateMessageStatus,
    updateMessagesStatus,
  } = useMessages(selectedChatId);
  const sendMessage = useSendMessage();
  const createChat = useCreateChat();
  const markMessagesAsReadMutation = useMarkMessagesAsRead();
  
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

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  if (!isAuthenticated && isChatsLoading) {
    return <LoadingSpinner />;
  }

  const conversationMessages = messages ?? [];

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
            <p className="text-sm text-slate-400">Logged in as</p>
            <p className="font-semibold">{user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Guest'}</p>
          </div>
          <div onClick={handleLogout}>
            <AccountsButton color="#dc2626" text="Logout" />
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
                className="rounded bg-emerald-500/10 px-3 py-1 text-emerald-300 hover:bg-emerald-500/20"
              >
                Try again
              </button>
            </div>
          ) : chats && chats.length > 0 ? (
            <ul className="space-y-1 p-2">
              {chats.map((chat) => {
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
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
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
                        <span className="text-xs text-slate-400">
                          {chat.latestMessage
                            ? formatTimestamp(chat.latestMessage.updatedAt)
                            : formatTimestamp(chat.updatedAt)}
                        </span>
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
                className="md:hidden text-slate-400 hover:text-emerald-400"
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
            </div>

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
                    className="rounded bg-emerald-500/10 px-3 py-1 text-emerald-300 hover:bg-emerald-500/20"
                  >
                    Try again
                  </button>
                </div>
              ) : conversationMessages.length > 0 ? (
                <>
                  {conversationMessages.map((message) => {
                    const isOwnMessage = message.sender === user?._id;
                    return (
                      <MessageBubble
                        key={message._id}
                        message={message}
                        isOwnMessage={isOwnMessage}
                        isGroupChat={selectedChat.isGroupChat}
                        members={selectedChat.members}
                      />
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  No messages yet. Start the conversation!
                </div>
              )}
            </div>

            <div className="border-t border-slate-900 bg-slate-900/60 p-4">
              <div className="rounded-lg bg-slate-950 border border-slate-800 focus-within:border-emerald-500">
                <textarea
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a message..."
                  className="chat-input-area h-24 w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm text-slate-100 outline-none"
                />
                <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2">
                  <p className="text-xs text-slate-500">
                    Press Enter to send. Use Shift + Enter for a new line.
                  </p>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sendMessage.isPending || !messageInput.trim()}
                    className="cursor-pointer rounded bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {sendMessage.isPending ? 'Sending...' : 'Send'}
                  </button>
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
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  isGroupChat: boolean;
  members: Chat['members'];
}

const MessageBubble = ({ message, isOwnMessage, isGroupChat, members }: MessageBubbleProps) => {
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

  const seenByText = getSeenByText();

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      data-message-id={message._id}
    >
      <div
        className={`message-bubble max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow ${
          isOwnMessage
            ? 'bg-emerald-500 text-emerald-950'
            : 'bg-slate-800 text-slate-100'
        }`}
      >
        <p>{message.text}</p>
        <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isOwnMessage ? 'text-emerald-900' : 'text-slate-400'}`}>
          <span>{formatTimestamp(message.updatedAt)}</span>
          <MessageStatus status={message.status || 'sent'} isOwnMessage={isOwnMessage} />
        </div>
        {seenByText && (
          <p className="text-[9px] text-emerald-800 text-right mt-0.5">{seenByText}</p>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
