import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';
import type { Message, PaginationInfo } from '../types/chat';

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
    pagination?: PaginationInfo;
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

interface DeleteResponse {
  status: string;
  message: string;
  data: {
    messageId: string;
  };
}

export const messageApi = {
  createMessage: (payload: { chatId: string; text: string; sender: string }): Promise<AxiosResponse<MessageResponse>> =>
    axiosInstance.post('/api/message/new-message', payload),

  getAllMessages: (chatId: string, page = 1, limit = 50): Promise<AxiosResponse<MessagesResponse>> =>
    axiosInstance.get(`/api/message/get-all-messages/${chatId}?page=${page}&limit=${limit}`),

  markMessageAsRead: (messageId: string): Promise<AxiosResponse<MarkReadResponse>> =>
    axiosInstance.patch(`/api/message/${messageId}/read`),

  markMessagesAsRead: (chatId: string, messageIds: string[]): Promise<AxiosResponse<MarkReadResponse>> =>
    axiosInstance.patch(`/api/message/${chatId}/mark-read`, { messageIds }),

  getUnreadCount: (chatId: string): Promise<AxiosResponse<UnreadCountResponse>> =>
    axiosInstance.get(`/api/message/${chatId}/unread-count`),

  deleteMessage: (messageId: string, deleteForEveryone = false): Promise<AxiosResponse<DeleteResponse>> =>
    axiosInstance.delete(`/api/message/${messageId}`, { data: { deleteForEveryone } }),

  editMessage: (messageId: string, text: string): Promise<AxiosResponse<MessageResponse>> =>
    axiosInstance.patch(`/api/message/${messageId}/edit`, { text }),
};