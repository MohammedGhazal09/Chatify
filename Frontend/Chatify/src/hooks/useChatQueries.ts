import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../api/chatApi';
import { messageApi } from '../api/messageApi';
import { useAuthStore } from '../store/authstore';
import type { Chat, Message } from '../types/chat';

const chatsQueryKey = ['chats'] as const;
const messagesQueryKey = (chatId: string) => ['messages', chatId] as const;

type SendMessageVariables = {
  chatId: string;
  text: string;
};

type SendMessageContext = {
  previousMessages?: Message[];
  previousChats?: Chat[];
  optimisticMessage?: Message;
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

  return useQuery({
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
          return old;
        }
        return old.map((existingMessage) =>
          context?.optimisticMessage && existingMessage._id === context.optimisticMessage._id
            ? message
            : existingMessage
        );
      });
      queryClient.invalidateQueries({ queryKey: chatsQueryKey });
    },
    onSettled: (_message, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey(variables.chatId) });
    },
  });
};