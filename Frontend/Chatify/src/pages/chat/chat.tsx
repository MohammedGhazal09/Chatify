import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, KeyboardEventHandler } from 'react';
import axios from 'axios';
import AccountsButton from '../../components/accountsButton';
import LoadingSpinner from '../../components/loadingSpinner';
import { useAuthStore } from '../../store/authstore';
import { useLogout } from '../../hooks/useAuthQuery';
import { useChats, useCreateChat, useMessages, useSendMessage } from '../../hooks/useChatQueries';
import type { Chat, Message } from '../../types/chat';
import { isAxiosError } from 'axios';

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

const ChatPage = () => {
  const { user, isAuthenticated } = useAuthStore();
  const logoutMutation = useLogout();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [createChatError, setCreateChatError] = useState<string | null>(null);

  const { data: chats, isLoading: isChatsLoading, isError: chatsError, refetch: refetchChats } = useChats();
  const {
    messages,
    isLoading: isMessagesLoading,
    isError: messagesError,
    refetch: refetchMessages,
    upsertMessage,
  } = useMessages(selectedChatId);
  const sendMessage = useSendMessage();
  const createChat = useCreateChat();

  useEffect(() => {
    if (!selectedChatId && chats && chats.length > 0) {
      setSelectedChatId(chats[0]._id);
    }
  }, [chats, selectedChatId]);

  useEffect(() => {
    if (!createChatFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCreateChatFeedback(null);
    }, 4000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [createChatFeedback]);

  const selectedChat = useMemo(
    () => chats?.find((chat) => chat._id === selectedChatId) ?? null,
    [chats, selectedChatId]
  );

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
      <aside className="w-80 border-r border-slate-900 bg-slate-900/60 backdrop-blur-sm flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          {user?.profilePic ? (
            <img src={user.profilePic} alt="Profile" className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center text-lg font-semibold">
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
            className="rounded bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20"
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
                disabled={createChat.isLoading}
                className="rounded bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {createChat.isLoading ? 'Adding…' : 'Add' }
              </button>
            </div>
            {createChatError ? (
              <p className="text-xs text-red-400">{createChatError}</p>
            ) : null}
          </form>
        ) : null}

        <div className="flex-1 overflow-y-auto">
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
                return (
                  <li key={chat._id}>
                    <button
                      type="button"
                      onClick={() => setSelectedChatId(chat._id)}
                      className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                        isActive ? 'bg-emerald-500/20 text-emerald-100' : 'hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{title}</span>
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
            <div className="border-b border-slate-900 bg-slate-900/60 p-4">
              <h2 className="text-lg font-semibold">{getChatTitle(selectedChat, user?._id)}</h2>
              <p className="text-xs text-slate-400">
                {selectedChat.members.length} member{selectedChat.members.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 px-6 py-4 space-y-3">
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
                conversationMessages.map((message) => {
                  const isOwnMessage = message.sender === user?._id;
                  return (
                    <MessageBubble key={message._id} message={message} isOwnMessage={isOwnMessage} />
                  );
                })
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
                  onChange={(event) => setMessageInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a message..."
                  className="h-24 w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm text-slate-100 outline-none"
                />
                <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2">
                  <p className="text-xs text-slate-500">
                    Press Enter to send. Use Shift + Enter for a new line.
                  </p>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sendMessage.isPending || !messageInput.trim()}
                    className="rounded bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
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
}

const MessageBubble = ({ message, isOwnMessage }: MessageBubbleProps) => {
  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow ${
          isOwnMessage
            ? 'bg-emerald-500 text-emerald-950'
            : 'bg-slate-800 text-slate-100'
        }`}
      >
        <p>{message.text}</p>
        <span className={`mt-1 block text-[10px] ${isOwnMessage ? 'text-emerald-900' : 'text-slate-400'}`}>
          {formatTimestamp(message.updatedAt)}
        </span>
      </div>
    </div>
  );
};

export default ChatPage;
