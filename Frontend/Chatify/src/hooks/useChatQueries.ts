import { useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../api/chatApi';
import { messageApi } from '../api/messageApi';
import { useAuthStore } from '../store/authstore';
import type { Chat, Message, MessageStatus } from '../types/chat';
import {
  applyBatchReadInCache,
  applyReceiptPatchInCache,
  createClientMessageId,
  createOptimisticMessage,
  markOptimisticMessageFailed,
  prependMessagesInCache,
  upsertMessageInCache,
  type MessagesCacheData,
} from './messageCache';

// Export query keys for use in other modules
export const chatsQueryKey = ['chats'] as const;
export const messagesQueryKey = (chatId: string) => ['messages', chatId] as const;

type SendMessageVariables = {
  chatId: string;
  text: string;
  clientMessageId?: string;
};

type SendMessageContext = {
  previousMessages?: MessagesQueryData;
  previousChats?: Chat[];
  optimisticMessage?: Message;
  clientMessageId?: string;
};

type MessagesQueryData = MessagesCacheData;

const ensureSendClientMessageId = (variables: SendMessageVariables) => {
  variables.clientMessageId = variables.clientMessageId ?? createClientMessageId();
  return variables.clientMessageId;
};

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
  const queryClient = useQueryClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const queryKey = messagesQueryKey(chatId ?? '');

  const queryResult = useQuery({
    queryKey,
    queryFn: async () => {
      if (!chatId) {
        return { messages: [] as Message[], pagination: { hasMore: false, currentPage: 1, totalPages: 1 } };
      }
      const response = await messageApi.getAllMessages(chatId, { limit: 50 });
      const cursor = response.data.data.cursor ?? {
        nextCursor: response.data.data.nextCursor ?? null,
        hasMore: response.data.data.hasMore ?? response.data.data.pagination?.hasMore ?? false,
        limit: response.data.data.pagination?.limit ?? 50,
      };

      return {
        messages: response.data.data.messages,
        pagination: response.data.data.pagination,
        cursor,
      };
    },
    enabled: !!chatId && isAuthenticated,
  });

  const messages = queryResult.data?.messages ?? [];
  const hasMore = queryResult.data?.cursor?.hasMore ?? queryResult.data?.pagination?.hasMore ?? false;

  // Load more (older) messages
  const loadMoreMessages = useCallback(async () => {
    if (!chatId || !hasMore || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const currentData = queryClient.getQueryData<MessagesQueryData>(queryKey);
      const before = currentData?.cursor?.nextCursor ?? currentData?.pagination?.nextCursor;

      if (!before) {
        return;
      }

      const response = await messageApi.getAllMessages(chatId, { before, limit: 50 });
      const olderMessages = response.data.data.messages;
      const pagination = response.data.data.pagination;
      const cursor = response.data.data.cursor ?? {
        nextCursor: response.data.data.nextCursor ?? null,
        hasMore: response.data.data.hasMore ?? pagination?.hasMore ?? false,
        limit: pagination?.limit ?? 50,
      };

      queryClient.setQueryData<MessagesQueryData>(queryKey, (old) => {
        const nextCache = prependMessagesInCache(old, olderMessages);
        return {
          ...nextCache,
          pagination,
          cursor,
        };
      });
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [chatId, hasMore, isLoadingMore, queryClient, queryKey]);

  const upsertMessage = useCallback((incoming: Message) => {
    if (!incoming.chatId) return;

    queryClient.setQueryData<MessagesQueryData>(
      messagesQueryKey(incoming.chatId),
      (old) => upsertMessageInCache(old, incoming)
    );
  }, [queryClient]);

  const removeMessage = useCallback((messageId: string) => {
    if (!chatId) return;

    queryClient.setQueryData<MessagesQueryData>(queryKey, (old) => {
      if (!old) return old;

      return {
        ...old,
        messages: old.messages.filter((message) => message._id !== messageId),
      };
    });
  }, [chatId, queryClient, queryKey]);

  const setMessages = useCallback((nextMessages: Message[] | ((messages: Message[]) => Message[])) => {
    if (!chatId) return;

    queryClient.setQueryData<MessagesQueryData>(queryKey, (old) => {
      const resolvedMessages = typeof nextMessages === 'function'
        ? nextMessages(old?.messages ?? [])
        : nextMessages;

      return {
        messages: resolvedMessages,
        pagination: old?.pagination,
        cursor: old?.cursor,
      };
    });
  }, [chatId, queryClient, queryKey]);

  // Update message status
  const updateMessageStatus = useCallback(
    (messageId: string, status: MessageStatus, deliveredAt?: string | null, readAt?: string | null) => {
      if (!chatId) return;

      queryClient.setQueryData<MessagesQueryData>(
        queryKey,
        (old) => applyReceiptPatchInCache(old, { messageId, status, deliveredAt, readAt })
      );
    },
    [chatId, queryClient, queryKey]
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
      if (!chatId) return;

      queryClient.setQueryData<MessagesQueryData>(
        queryKey,
        (old) => applyBatchReadInCache(old, {
          chatId,
          userId: '',
          messages: updates,
        })
      );
    },
    [chatId, queryClient, queryKey]
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
    mutationFn: async (variables) => {
      if (!user?._id) {
        throw new Error('You must be logged in to send messages.');
      }

      const clientMessageId = ensureSendClientMessageId(variables);
      const response = await messageApi.createMessage({
        chatId: variables.chatId,
        text: variables.text,
        clientMessageId,
      });
      return response.data.data.message;
    },
    onMutate: async (variables) => {
      if (!user?._id) {
        return {};
      }

      const clientMessageId = ensureSendClientMessageId(variables);
      const { chatId, text } = variables;
      await queryClient.cancelQueries({ queryKey: messagesQueryKey(chatId) });
      const previousData = queryClient.getQueryData<MessagesQueryData>(messagesQueryKey(chatId));
      const previousChats = queryClient.getQueryData<Chat[]>(chatsQueryKey);

      const optimisticMessage = createOptimisticMessage({
        chatId,
        senderId: user._id,
        text,
        clientMessageId,
      });

      queryClient.setQueryData<MessagesQueryData>(
        messagesQueryKey(chatId),
        (old) => upsertMessageInCache(old, optimisticMessage)
      );

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

      return { previousMessages: previousData, previousChats, optimisticMessage, clientMessageId };
    },
    onError: (_error, variables, context) => {
      const clientMessageId = context?.clientMessageId ?? variables.clientMessageId;

      if (clientMessageId) {
        queryClient.setQueryData<MessagesQueryData>(
          messagesQueryKey(variables.chatId),
          (old) => markOptimisticMessageFailed(old, clientMessageId)
        );
      }
    },
    onSuccess: (message, variables) => {
      queryClient.setQueryData<MessagesQueryData>(
        messagesQueryKey(variables.chatId),
        (old) => upsertMessageInCache(old, message)
      );
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chatId, messageIds }: { chatId: string; messageIds: string[] }) => {
      const response = await messageApi.markMessagesAsRead(chatId, messageIds);
      return response.data;
    },
    onSuccess: (response, variables) => {
      queryClient.setQueryData<MessagesQueryData>(
        messagesQueryKey(variables.chatId),
        (old) => applyBatchReadInCache(old, {
          chatId: variables.chatId,
          userId: '',
          messages: response.data.receipts ?? [],
        })
      );

      queryClient.setQueriesData<Map<string, number>>(
        { queryKey: ['unreadCounts'] },
        (old) => {
          const next = new Map(old ?? []);
          next.set(variables.chatId, response.data.unreadCount);
          return next;
        }
      );
    },
  });
};

// Delete message mutation
export const useDeleteMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, deleteForEveryone }: { messageId: string; deleteForEveryone: boolean; chatId: string }) => {
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
    onSuccess: (response, variables) => {
      queryClient.setQueryData<MessagesQueryData>(messagesQueryKey(variables.chatId), (old) => {
        if (!old) return old;

        if (variables.deleteForEveryone && response.data.message) {
          return upsertMessageInCache(old, response.data.message);
        }

        return {
          ...old,
          messages: old.messages.filter((message) => message._id !== variables.messageId),
        };
      });
      queryClient.invalidateQueries({ queryKey: chatsQueryKey });
    },
  });
};

// Edit message mutation
export const useEditMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, text }: { messageId: string; text: string }) => {
      const response = await messageApi.editMessage(messageId, text);
      return response.data.data.message;
    },
    onSuccess: (message) => {
      queryClient.setQueryData<MessagesQueryData>(
        messagesQueryKey(message.chatId),
        (old) => upsertMessageInCache(old, message)
      );
    },
  });
};

// Toggle reaction mutation
export const useToggleReaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      const response = await messageApi.toggleReaction(messageId, emoji);
      return response.data;
    },
    onSuccess: (response) => {
      queryClient.setQueryData<MessagesQueryData>(
        messagesQueryKey(response.data.message.chatId),
        (old) => upsertMessageInCache(old, response.data.message)
      );
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
