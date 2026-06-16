import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../api/chatApi';
import { messageApi } from '../api/messageApi';
import { userApi } from '../api/userApi';
import { useAuthStore } from '../store/authstore';
import { usePresenceStore } from '../store/presenceStore';
import type { AttachmentSummary, Chat, Message, MessageStatus, SharedAssetKind, UserOnlineStatus } from '../types/chat';
import {
  applyBatchReadInCache,
  applyReceiptPatchInCache,
  createClientMessageId,
  createOptimisticMessage,
  markOptimisticMessageFailed,
  dismissOptimisticMessage,
  normalizeOutgoingMessageText,
  reconcileFetchedMessagesInCache,
  prependMessagesInCache,
  upsertMessageInCache,
  type MessagesCacheData,
} from './messageCache';

// Export query keys for use in other modules
export const chatsQueryKey = ['chats'] as const;
export const messagesQueryKey = (chatId: string) => ['messages', chatId] as const;
export const messageSearchQueryKey = (chatId: string, query: string) => ['messageSearch', chatId, query] as const;
export const sharedAssetsQueryKey = (chatId: string, kind?: SharedAssetKind) => ['sharedAssets', chatId, kind ?? 'all'] as const;
export const pinnedMessagesQueryKey = (chatId: string) => ['pinnedMessages', chatId] as const;
export const onlinePresenceQueryKey = ['onlinePresence'] as const;
export const usersQueryKey = ['users'] as const;
export const userSearchQueryKey = ['userSearch'] as const;

type SendMessageVariables = {
  chatId: string;
  text: string;
  clientMessageId?: string;
  attachments?: File[];
  optimisticAttachments?: AttachmentSummary[];
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

const MESSAGE_SEARCH_DEBOUNCE_MS = 300;
const MIN_MESSAGE_SEARCH_LENGTH = 2;

const normalizeSearchText = (query: string) => query.trim();

const hasAttachmentFiles = (attachments?: File[]) => Boolean(attachments?.length);

const getPresenceName = (user: { firstName?: string; lastName?: string }) => (
  `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
);

const normalizePresenceSnapshot = (
  contacts: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    isOnline?: boolean;
    isCallReachable?: boolean;
    lastSeen?: string;
  }>
): UserOnlineStatus[] => contacts.map((contact) => ({
  userId: contact._id,
  userName: getPresenceName(contact),
  isOnline: contact.isOnline === true,
  isCallReachable: contact.isCallReachable === true,
  lastSeen: contact.lastSeen,
}));

const invalidateDetailQueries = (queryClient: ReturnType<typeof useQueryClient>, chatId: string) => {
  queryClient.invalidateQueries({ queryKey: ['sharedAssets', chatId] });
  queryClient.invalidateQueries({ queryKey: pinnedMessagesQueryKey(chatId) });
};

const mergeChatInCache = (queryClient: ReturnType<typeof useQueryClient>, updatedChat: Chat) => {
  queryClient.setQueryData<Chat[]>(chatsQueryKey, (old) => {
    if (!old) {
      return [updatedChat];
    }

    let found = false;
    const nextChats = old.map((chat) => {
      if (chat._id !== updatedChat._id) {
        return chat;
      }

      found = true;
      return {
        ...chat,
        ...updatedChat,
        latestMessage: updatedChat.latestMessage ?? chat.latestMessage,
      };
    });

    return found ? nextChats : [updatedChat, ...old];
  });
};

const invalidateConversationQueries = (
  queryClient: ReturnType<typeof useQueryClient>,
  chatId: string
) => {
  queryClient.invalidateQueries({ queryKey: messagesQueryKey(chatId) });
  queryClient.invalidateQueries({ queryKey: ['messageSearch', chatId] });
  invalidateDetailQueries(queryClient, chatId);
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

export const useOnlinePresence = ({
  enabled = true,
  syncToStore = true,
}: { enabled?: boolean; syncToStore?: boolean } = {}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const replaceOnlineUsers = usePresenceStore((state) => state.replaceOnlineUsers);
  const query = useQuery({
    queryKey: onlinePresenceQueryKey,
    queryFn: async () => {
      const response = await userApi.getOnlineUsers();
      return normalizePresenceSnapshot(response.data.data.allContacts);
    },
    enabled: enabled && isAuthenticated,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (syncToStore && query.data) {
      replaceOnlineUsers(query.data);
    }
  }, [query.data, replaceOnlineUsers, syncToStore]);

  return query;
};

export const useMessages = (chatId: string | null) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const queryKey = messagesQueryKey(chatId ?? '');

  const queryResult = useQuery({
    queryKey,
    queryFn: async (): Promise<MessagesCacheData> => {
      if (!chatId) {
        return {
          messages: [],
          pagination: { hasMore: false, currentPage: 1, totalPages: 1, limit: 50 },
          cursor: undefined,
        };
      }
      const response = await messageApi.getAllMessages(chatId, { limit: 50 });
      const cursor = response.data.data.cursor ?? {
        nextCursor: response.data.data.nextCursor ?? null,
        hasMore: response.data.data.hasMore ?? response.data.data.pagination?.hasMore ?? false,
        limit: response.data.data.pagination?.limit ?? 50,
      };
      const existingCache = queryClient.getQueryData<MessagesQueryData>(queryKey);

      return reconcileFetchedMessagesInCache(
        existingCache,
        response.data.data.messages,
        response.data.data.pagination,
        cursor
      );
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

  const dismissFailedMessage = useCallback((clientMessageId: string) => {
    if (!chatId) return;

    queryClient.setQueryData<MessagesQueryData>(
      queryKey,
      (old) => dismissOptimisticMessage(old, clientMessageId)
    );
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
    dismissFailedMessage,
    setMessages,
    updateMessageStatus,
    updateMessagesStatus,
    loadMoreMessages,
    hasMore,
    isLoadingMore,
  };
};

export const useMessageSearch = (chatId: string | null, query: string) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const trimmedQuery = normalizeSearchText(query);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const isBelowMinimum = trimmedQuery.length > 0 && trimmedQuery.length < MIN_MESSAGE_SEARCH_LENGTH;
  const isDebouncing = trimmedQuery.length >= MIN_MESSAGE_SEARCH_LENGTH && trimmedQuery !== debouncedQuery;

  useEffect(() => {
    if (trimmedQuery.length < MIN_MESSAGE_SEARCH_LENGTH) {
      setDebouncedQuery('');
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(trimmedQuery);
    }, MESSAGE_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [trimmedQuery]);

  const queryResult = useQuery({
    queryKey: messageSearchQueryKey(chatId ?? '', debouncedQuery),
    queryFn: async () => {
      if (!chatId || debouncedQuery.length < MIN_MESSAGE_SEARCH_LENGTH) {
        return [];
      }

      const response = await messageApi.searchMessages(chatId, {
        q: debouncedQuery,
        limit: 25,
      });

      return response.data.data.messages;
    },
    enabled: Boolean(chatId && isAuthenticated && debouncedQuery.length >= MIN_MESSAGE_SEARCH_LENGTH),
  });

  return {
    ...queryResult,
    messages: queryResult.data ?? [],
    normalizedQuery: debouncedQuery,
    isBelowMinimum,
    isDebouncing,
    isSearching: isDebouncing || queryResult.isLoading || queryResult.isFetching,
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
      const normalizedText = normalizeOutgoingMessageText(variables.text, {
        allowEmpty: hasAttachmentFiles(variables.attachments),
      });

      if (!normalizedText.ok) {
        throw new Error(normalizedText.message);
      }

      const response = await messageApi.createMessage({
        chatId: variables.chatId,
        text: normalizedText.text,
        clientMessageId,
        attachments: variables.attachments,
      });
      return response.data.data.message;
    },
    onMutate: async (variables) => {
      if (!user?._id) {
        return {};
      }

      const clientMessageId = ensureSendClientMessageId(variables);
      const normalizedText = normalizeOutgoingMessageText(variables.text, {
        allowEmpty: hasAttachmentFiles(variables.attachments),
      });

      if (!normalizedText.ok) {
        throw new Error(normalizedText.message);
      }

      const { chatId } = variables;
      await queryClient.cancelQueries({ queryKey: messagesQueryKey(chatId) });
      const previousData = queryClient.getQueryData<MessagesQueryData>(messagesQueryKey(chatId));
      const previousChats = queryClient.getQueryData<Chat[]>(chatsQueryKey);

      const optimisticMessage = createOptimisticMessage({
        chatId,
        senderId: user._id,
        text: normalizedText.text,
        clientMessageId,
        attachments: variables.optimisticAttachments,
        localFiles: variables.attachments,
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
      if (hasAttachmentFiles(variables.attachments)) {
        queryClient.invalidateQueries({ queryKey: ['sharedAssets', variables.chatId] });
      }
    },
  });
};

export const useSharedAssets = (chatId: string | null, kind?: SharedAssetKind) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: sharedAssetsQueryKey(chatId ?? '', kind),
    queryFn: async () => {
      if (!chatId) {
        return [];
      }

      const response = await messageApi.getSharedAssets(chatId, { kind, limit: 12 });
      return response.data.data.assets ?? response.data.data.sharedAssets ?? [];
    },
    enabled: Boolean(chatId && isAuthenticated),
  });
};

export const usePinnedMessages = (chatId: string | null) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: pinnedMessagesQueryKey(chatId ?? ''),
    queryFn: async () => {
      if (!chatId) {
        return [];
      }

      const response = await messageApi.getPinnedMessages(chatId);
      return response.data.data.pinnedMessages;
    },
    enabled: Boolean(chatId && isAuthenticated),
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

export const useBlockChatPeer = () => {
  const queryClient = useQueryClient();

  return useMutation<Chat, unknown, string>({
    mutationFn: async (chatId) => {
      const response = await chatApi.blockChatPeer(chatId);
      return response.data.data.chat;
    },
    onSuccess: (chat) => {
      mergeChatInCache(queryClient, chat);
      invalidateConversationQueries(queryClient, chat._id);
    },
  });
};

export const useUnblockChatPeer = () => {
  const queryClient = useQueryClient();

  return useMutation<Chat, unknown, string>({
    mutationFn: async (chatId) => {
      const response = await chatApi.unblockChatPeer(chatId);
      return response.data.data.chat;
    },
    onSuccess: (chat) => {
      mergeChatInCache(queryClient, chat);
      invalidateConversationQueries(queryClient, chat._id);
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
      invalidateDetailQueries(queryClient, variables.chatId);
    },
  });
};

// Edit message mutation
export const useEditMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, text }: { messageId: string; text: string }) => {
      const normalizedText = normalizeOutgoingMessageText(text);

      if (!normalizedText.ok) {
        throw new Error(normalizedText.message);
      }

      const response = await messageApi.editMessage(messageId, normalizedText.text);
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

export const usePinMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId }: { messageId: string; chatId: string }) => {
      const response = await messageApi.pinMessage(messageId);
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<MessagesQueryData>(
        messagesQueryKey(variables.chatId),
        (old) => upsertMessageInCache(old, data.message)
      );
      queryClient.invalidateQueries({ queryKey: pinnedMessagesQueryKey(variables.chatId) });
    },
  });
};

export const useUnpinMessage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId }: { messageId: string; chatId: string }) => {
      const response = await messageApi.unpinMessage(messageId);
      return response.data.data;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData<MessagesQueryData>(
        messagesQueryKey(variables.chatId),
        (old) => upsertMessageInCache(old, data.message)
      );
      queryClient.invalidateQueries({ queryKey: pinnedMessagesQueryKey(variables.chatId) });
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
