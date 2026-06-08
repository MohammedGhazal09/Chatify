import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEventHandler, MouseEvent as ReactMouseEvent } from 'react';
import axios from 'axios';
import LoadingSpinner from '../../components/loadingSpinner';
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
import type {
  BatchReadEvent,
  Message,
  MessageDeletedEvent,
  MessageEditedEvent,
  MessageReactionEvent,
  MessageStatusUpdateEvent,
} from '../../types/chat';
import {
  ChatShell,
  ChatSidebar,
  ConversationPane,
  MessageActionMenu,
} from './components';
import { useChatViewState } from './hooks/useChatViewState';
import { getChatTitle, getOtherMember } from './utils/chatDisplay';
import './chat.css';

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
  const {
    selectedChatId,
    setSelectedChatId,
    messageInput,
    setMessageInput,
    isNewChatOpen,
    setIsNewChatOpen,
    newChatEmail,
    setNewChatEmail,
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

  const chatIds = useMemo(() => chats?.map((chat) => chat._id) ?? [], [chats]);
  const { data: unreadCounts } = useUnreadCounts(chatIds);

  const markMessagesAsReadRef = useRef(markMessagesAsReadMutation.mutate);
  markMessagesAsReadRef.current = markMessagesAsReadMutation.mutate;

  const selectedChat = useMemo(
    () => chats?.find((chat) => chat._id === selectedChatId) ?? null,
    [chats, selectedChatId]
  );
  const otherMember = selectedChat ? getOtherMember(selectedChat, user?._id) : null;
  const otherMemberStatus = otherMember ? onlineUsers.get(otherMember._id) ?? null : null;
  const allMessages = useMemo(() => messages ?? [], [messages]);
  const conversationMessages = useMemo(() => (
    messageSearch.trim()
      ? allMessages.filter((message) => message.text.toLowerCase().includes(messageSearch.toLowerCase()))
      : allMessages
  ), [allMessages, messageSearch]);

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

  const { emitTypingStart, emitTypingStop, emitMessageDelivered } = useChatSocket({
    chatId: selectedChatId,
    enabled: !!selectedChatId && isAuthenticated,
    onMessage: (message) => {
      upsertMessage(message);
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

      const message = allMessages.find((item) => item._id === event.messageId);
      if (message) {
        upsertMessage({ ...message, reactions: event.reactions });
      }
    },
  });

  const { debouncedCallback: debouncedTypingStop, cancel: cancelTypingStop } = useDebounce(() => {
    setIsTyping(false);
    emitTypingStop();
  }, 2000);

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages]);

  useEffect(() => {
    if (!selectedChatId && chats && chats.length > 0) {
      setSelectedChatId(chats[0]._id);
    }
  }, [chats, selectedChatId, setSelectedChatId]);

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

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
        setShowReactionPicker(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [setContextMenu, setShowReactionPicker]);

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
          setContextMenu(null);
        } else if (showEmojiPicker) {
          setShowEmojiPicker(false);
        } else if (showMessageSearch) {
          setShowMessageSearch(false);
          setMessageSearch('');
        } else if (replyingTo) {
          setReplyingTo(null);
        } else if (isSidebarOpen) {
          setIsSidebarOpen(false);
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'f' && selectedChatId) {
        event.preventDefault();
        setShowMessageSearch(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    contextMenu,
    editingMessageId,
    isSidebarOpen,
    replyingTo,
    selectedChatId,
    setContextMenu,
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

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setContextMenu(null);
  };

  const handleDeleteMessage = (deleteForEveryone: boolean) => {
    if (!contextMenu || !selectedChatId) return;
    const messageId = contextMenu.messageId;

    removeMessage(messageId);
    setContextMenu(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleReaction = (messageId: string, emoji: string) => {
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
    setContextMenu(null);
    setShowReactionPicker(false);
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

  const handleComposerKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && enterToSend) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setIsSidebarOpen(false);
  };

  const handleToggleMessageSearch = () => {
    setShowMessageSearch((prev) => {
      if (prev) {
        setMessageSearch('');
      }
      return !prev;
    });
  };

  const handleAppendEmoji = (emoji: string) => {
    setMessageInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleCopyMessage = (message: Message) => {
    navigator.clipboard.writeText(message.text);
    setContextMenu(null);
  };

  if (!isAuthenticated && isChatsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <ChatShell
      isSidebarOpen={isSidebarOpen}
      onCloseSidebar={() => setIsSidebarOpen(false)}
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
          newChatEmail={newChatEmail}
          createChatError={createChatError}
          isCreatingChat={createChat.isPending}
          unreadCounts={unreadCounts}
          onlineUsers={onlineUsers}
          onSearchChange={setSearchQuery}
          onSelectChat={handleSelectChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onLogout={handleLogout}
          onToggleNewChat={handleToggleNewChat}
          onNewChatEmailChange={setNewChatEmail}
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
          messages={conversationMessages}
          isMessagesLoading={isMessagesLoading}
          messagesError={messagesError}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          showScrollButton={showScrollButton}
          showMessageSearch={showMessageSearch}
          messageSearch={messageSearch}
          editingMessageId={editingMessageId}
          editText={editText}
          isSavingEdit={editMessageMutation.isPending}
          messageInput={messageInput}
          replyingTo={replyingTo}
          showEmojiPicker={showEmojiPicker}
          isSending={sendMessage.isPending}
          isSendError={sendMessage.isError}
          messagesContainerRef={messagesContainerRef}
          messagesEndRef={messagesEndRef}
          emojiPickerRef={emojiPickerRef}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onToggleMessageSearch={handleToggleMessageSearch}
          onMessageSearchChange={setMessageSearch}
          onExportChat={handleExportChat}
          onLoadMore={loadMoreMessages}
          onRetryLoad={() => refetchMessages()}
          onScrollToBottom={scrollToBottom}
          onMessageContextMenu={handleMessageContextMenu}
          onStartEdit={handleStartEdit}
          onEditTextChange={setEditText}
          onSaveEdit={handleSaveEdit}
          onCancelEdit={handleCancelEdit}
          onComposerChange={handleInputChange}
          onComposerKeyDown={handleComposerKeyDown}
          onSendMessage={handleSendMessage}
          onToggleEmojiPicker={() => setShowEmojiPicker((prev) => !prev)}
          onAppendEmoji={handleAppendEmoji}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}
      overlays={(
        <>
          <MessageActionMenu
            contextMenu={contextMenu}
            messages={conversationMessages}
            showReactionPicker={showReactionPicker}
            contextMenuRef={contextMenuRef}
            onReaction={handleReaction}
            onToggleReactionPicker={() => setShowReactionPicker((prev) => !prev)}
            onReply={handleReply}
            onStartEdit={handleStartEdit}
            onDelete={handleDeleteMessage}
            onCopy={handleCopyMessage}
          />
          <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
      )}
    />
  );
};

export default ChatPage;
