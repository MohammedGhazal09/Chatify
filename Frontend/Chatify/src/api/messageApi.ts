import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';
import type { Message, NewMessagePayload } from '../types/chat';

interface MessageResponse {
  status: string;
  data: {
    message: Message;
  };
}

interface MessagesResponse {
  status: string;
  data: {
    messages: Message[];
  };
}

interface UnreadCountResponse {
  status: string;
  data: {
    chatId: string;
    unreadCount: number;
  };
}

interface MarkReadResponse {
  status: string;
  data: {
    updatedCount?: number;
    messages?: Message[];
    message?: Message;
  };
}

export const messageApi = {
  createMessage: (payload: NewMessagePayload): Promise<AxiosResponse<MessageResponse>> =>
    axiosInstance.post('/api/message/new-message', payload),

  getAllMessages: (chatId: string): Promise<AxiosResponse<MessagesResponse>> =>
    axiosInstance.get(`/api/message/get-all-messages/${chatId}`),

  markMessageAsRead: (messageId: string): Promise<AxiosResponse<MarkReadResponse>> =>
    axiosInstance.patch(`/api/message/${messageId}/read`),

  markMessagesAsRead: (chatId: string, messageIds: string[]): Promise<AxiosResponse<MarkReadResponse>> =>
    axiosInstance.patch(`/api/message/${chatId}/mark-read`, { messageIds }),

  getUnreadCount: (chatId: string): Promise<AxiosResponse<UnreadCountResponse>> =>
    axiosInstance.get(`/api/message/${chatId}/unread-count`),
};