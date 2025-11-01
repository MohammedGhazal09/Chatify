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

export const messageApi = {
  createMessage: (payload: NewMessagePayload): Promise<AxiosResponse<MessageResponse>> =>
    axiosInstance.post('/api/message/new-message', payload),

  getAllMessages: (chatId: string): Promise<AxiosResponse<MessagesResponse>> =>
    axiosInstance.get(`/api/message/get-all-messages/${chatId}`),
};