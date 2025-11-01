import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';
import type { Chat, CreateChatPayload } from '../types/chat';

interface ChatResponse {
  status: string;
  data: {
    chat: Chat;
  };
}

interface ChatsResponse {
  status: string;
  data: {
    chats: Chat[];
  };
}

export const chatApi = {
  createChat: (payload: CreateChatPayload): Promise<AxiosResponse<ChatResponse>> =>
    axiosInstance.post('/api/chat/create-new-chat', payload),

  getAllChats: (): Promise<AxiosResponse<ChatsResponse>> =>
    axiosInstance.get('/api/chat/get-all-chats'),
};