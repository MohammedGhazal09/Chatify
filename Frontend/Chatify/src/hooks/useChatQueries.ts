import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../api/chatApi';
import { messageApi } from '../api/messageApi';
import { useAuthStore } from '../store/authstore';
import type { Chat, Message, MessageStatus } from '../types/chat';

// Export query keys for use in other modules
export const chatsQueryKey = ['chats'] as const;
export const messagesQueryKey = (chatId: string) => ['messages', chatId] as const;

type SendMessageVariables = {
  chatId: string;
  text: string;
};

type SendMessageContext = {
  previousMessages?: MessagesQueryData;
  previousChats?: Chat[];
  optimisticMessage?: Message;
};

// Type for query data after pagination update
interface MessagesQueryData {
  messages: Message[];
  pagination?: { hasMore: boolean; currentPage: number; totalPages: number };
}

type CreateChatVariables = {
  targetEmail: string;
  chatName?: string;
};

export const useChats = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: chatsQueryKey,
    queryFn: async () => {
      const response = await chatApi.getAllChats();
      return response.data.data.chats;
    },
    enabled: isAuthenticated,
  });
};

export const useMessages = (chatId: string | null) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const queryResult = useQuery({
    queryKey: messagesQueryKey(chatId ?? ''),
    queryFn: async () => {
      if (!chatId) {
        return { messages: [] as Message[], pagination: { hasMore: false, currentPage: 1, totalPages: 1 } };
      }
      const response = await messageApi.getAllMessages(chatId, 1, 50);
      return {
        messages: response.data.data.messages,
        pagination: response.data.data.pagination,
      };
    },
    enabled: !!chatId && isAuthenticated,
  });

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setCurrentPage(1);
      setHasMore(true);
      return;
    }

    if (queryResult.data) {
      setMessages(queryResult.data.messages);
      setHasMore(queryResult.data.pagination?.hasMore ?? false);
      setCurrentPage(1);
    }
  }, [chatId, queryResult.data]);

  // Load more (older) messages
  const loadMoreMessages = useCallback(async () => {
    if (!chatId || !hasMore || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const response = await messageApi.getAllMessages(chatId, nextPage, 50);
      const olderMessages = response.data.data.messages;
      const pagination = response.data.data.pagination;
      
      setMessages(prev => {
        // Prepend older messages and dedupe
        const existingIds = new Set(prev.map(m => m._id));
        const newMessages = olderMessages.filter(m => !existingIds.has(m._id));
        return [...newMessages, ...prev].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      setCurrentPage(nextPage);
      setHasMore(pagination?.hasMore ?? false);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, currentPage, hasMore, isLoadingMore]);

  const upsertMessage = useCallback((incoming: Message) => {
    setMessages((previous) => {
      const index = previous.findIndex((message) => message._id === incoming._id);
      if (index !== -1) {
        const next = [...previous];
        next[index] = incoming;
        return next;
      }
      return [...previous, incoming].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((previous) => previous.filter((message) => message._id !== messageId));
  }, []);

  // Update message status
  const updateMessageStatus = useCallback(
    (messageId: string, status: MessageStatus, deliveredAt?: string, readAt?: string) => {
      setMessages((previous) =>
        previous.map((message) =>
          message._id === messageId
            ? { ...message, status, deliveredAt, readAt }
            : message
        )
      );
    },
    []
  );

  // Update multiple messages at once (for batch read operations)
  const updateMessagesStatus = useCallback(
    (
      updates: Array<{
        messageId: string;
        status: MessageStatus;
        readBy?: Array<{ user: string; readAt: string }>;
      }>
    ) => {
      setMessages((previous) =>
        previous.map((message) => {
          const update = updates.find((u) => u.messageId === message._id);
          if (update) {
            return {
              ...message,
              status: update.status,
              readBy: update.readBy || message.readBy,
            };
          }
          return message;
        })
      );
    },
    []
  );

  return {
    ...queryResult,
    messages,
    upsertMessage,
    removeMessage,
    setMessages,
    updateMessageStatus,
    updateMessagesStatus,
    loadMoreMessages,
    hasMore,
    isLoadingMore,
  };
};

export const useSendMessage = () => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation<Message, unknown, SendMessageVariables, SendMessageContext>({
    mutationFn: async ({ chatId, text }) => {
      if (!user?._id) {
        throw new Error('You must be logged in to send messages.');
      }
      const response = await messageApi.createMessage({
        chatId,
        text,
        sender: user._id,
      });
      return response.data.data.message;
    },
    onMutate: async ({ chatId, text }) => {
      if (!user?._id) {
        return {};
      }
      await queryClient.cancelQueries({ queryKey: messagesQueryKey(chatId) });
      const previousData = queryClient.getQueryData<MessagesQueryData>(messagesQueryKey(chatId));
      const previousChats = queryClient.getQueryData<Chat[]>(chatsQueryKey);

      const optimisticMessage: Message = {
        _id: `optimistic-${Date.now()}`,
        chatId,
        sender: user._id,
        text,
        read: false,
        status: 'sent',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<MessagesQueryData>(messagesQueryKey(chatId), (old) => ({
        messages: [...(old?.messages ?? []), optimisticMessage],
        pagination: old?.pagination,
      }));

      queryClient.setQueryData<Chat[]>(chatsQueryKey, (old) => {
        if (!old) {
          return old;
        }
        return old.map((chat) =>
          chat._id === chatId
            ? {
                ...chat,
                latestMessage: optimisticMessage,
                updatedAt: optimisticMessage.createdAt,
              }
            : chat
        );
      });

      return { previousMessages: previousData, previousChats, optimisticMessage };
    },
    onError: (_error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData<MessagesQueryData>(messagesQueryKey(variables.chatId), context.previousMessages);
      }
      if (context?.previousChats) {
        queryClient.setQueryData<Chat[]>(chatsQueryKey, context.previousChats);
      }
    },
    onSuccess: (message, variables, context) => {
      queryClient.setQueryData<MessagesQueryData>(messagesQueryKey(variables.chatId), (old) => {
        if (!old) {
          return { messages: [message] };
        }

        const optimisticId = context?.optimisticMessage?._id;
        const existingIndex = old.messages.findIndex((existingMessage) =>
          optimisticId ? existingMessage._id === optimisticId : existingMessage._id === message._id
        );

        if (existingIndex !== -1) {
          const next = [...old.messages];
          next[existingIndex] = message;
          return { ...old, messages: next };
        }

        return { ...old, messages: [...old.messages, message] };
      });
      queryClient.invalidateQueries({ queryKey: chatsQueryKey });
    },
  });
};

export const useCreateChat = () => {
  const queryClient = useQueryClient();

  return useMutation<Chat, unknown, CreateChatVariables>({
    mutationFn: async (payload) => {
      const response = await chatApi.createChat(payload);
      return response.data.data.chat;
    },
    onSuccess: (chat) => {
      queryClient.setQueryData<Chat[]>(chatsQueryKey, (old) => {
        if (!old) {
          return [chat];
        }

        const existingIndex = old.findIndex((existingChat) => existingChat._id === chat._id);
        if (existingIndex !== -1) {
          const updatedChats = [...old];
          updatedChats[existingIndex] = chat;
          return updatedChats;
        }

        return [chat, ...old];
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: chatsQueryKey });
    },
  });
};

// Mark messages as read mutation
export const useMarkMessagesAsRead = () => {
  return useMutation({
    mutationFn: async ({ chatId, messageIds }: { chatId: string; messageIds: string[] }) => {
      const response = await messageApi.markMessagesAsRead(chatId, messageIds);
      return response.data;
    },
  });
};

// Delete message mutation
export const useDeleteMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, deleteForEveryone, chatId }: { messageId: string; deleteForEveryone: boolean; chatId: string }) => {
      const response = await messageApi.deleteMessage(messageId, deleteForEveryone);
      return response.data;
    },
    onMutate: async ({ messageId, chatId }) => {
      // Cancel any in-flight queries to prevent overwrites
      await queryClient.cancelQueries({ queryKey: messagesQueryKey(chatId) });

      // Save previous state for rollback
      const previousMessages = queryClient.getQueryData<MessagesQueryData>(messagesQueryKey(chatId));

      // Optimistically remove message from query cache
      queryClient.setQueryData<MessagesQueryData>(messagesQueryKey(chatId), (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: old.messages.filter((m) => m._id !== messageId),
        };
      });

      return { previousMessages, chatId };
    },
    onError: (_error, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData<MessagesQueryData>(messagesQueryKey(variables.chatId), context.previousMessages);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatsQueryKey });
    },
  });
};

// Edit message mutation
export const useEditMessage = () => {
  return useMutation({
    mutationFn: async ({ messageId, text }: { messageId: string; text: string }) => {
      const response = await messageApi.editMessage(messageId, text);
      return response.data.data.message;
    },
  });
};

// Toggle reaction mutation
export const useToggleReaction = () => {
  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const response = await messageApi.toggleReaction(messageId, emoji);
      return response.data;
    },
  });
};

// Get unread counts for all chats (batch API - no polling, uses WebSocket updates)
export const useUnreadCounts = (chatIds: string[]) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['unreadCounts', chatIds.join(',')],
    queryFn: async () => {
      if (chatIds.length === 0) {
        return new Map<string, number>();
      }
      const response = await messageApi.getBatchUnreadCounts(chatIds);
      const counts = response.data.data.counts;
      return new Map(Object.entries(counts).map(([chatId, count]) => [chatId, count]));
    },
    enabled: isAuthenticated && chatIds.length > 0,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
};
