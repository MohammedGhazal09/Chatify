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
  previousMessages?: Message[];
  previousChats?: Chat[];
  optimisticMessage?: Message;
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
  const [messages, setMessages] = useState<Message[]>([]);

  const queryResult = useQuery({
    queryKey: messagesQueryKey(chatId ?? ''),
    queryFn: async () => {
      if (!chatId) {
        return [] as Message[];
      }
      const response = await messageApi.getAllMessages(chatId);
      return response.data.data.messages;
    },
    enabled: !!chatId && isAuthenticated,
  });

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    if (Array.isArray(queryResult.data)) {
      setMessages(queryResult.data);
    }
  }, [chatId, queryResult.data]);

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
      const previousMessages = queryClient.getQueryData<Message[]>(messagesQueryKey(chatId));
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

      queryClient.setQueryData<Message[]>(messagesQueryKey(chatId), (old = []) => [
        ...old,
        optimisticMessage,
      ]);

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

      return { previousMessages, previousChats, optimisticMessage };
    },
    onError: (_error, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData<Message[]>(messagesQueryKey(variables.chatId), context.previousMessages);
      }
      if (context?.previousChats) {
        queryClient.setQueryData<Chat[]>(chatsQueryKey, context.previousChats);
      }
    },
    onSuccess: (message, variables, context) => {
      queryClient.setQueryData<Message[]>(messagesQueryKey(variables.chatId), (old) => {
        if (!old) {
          return [message];
        }

        const optimisticId = context?.optimisticMessage?._id;
        const existingIndex = old.findIndex((existingMessage) =>
          optimisticId ? existingMessage._id === optimisticId : existingMessage._id === message._id
        );

        if (existingIndex !== -1) {
          const next = [...old];
          next[existingIndex] = message;
          return next;
        }

        return [...old, message];
      });
      queryClient.invalidateQueries({ queryKey: chatsQueryKey });
    },
    onSettled: (_message, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(variables.chatId) });
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
