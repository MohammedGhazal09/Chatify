import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';
import type { Chat, CreateChatPayload, CreateGroupChatPayload } from '../types/chat';

interface ChatResponse {
  status: string;
  data: {
    chat: Chat;
    conversationControls?: Chat['conversationControls'];
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

  createGroupChat: (payload: CreateGroupChatPayload): Promise<AxiosResponse<ChatResponse>> =>
    axiosInstance.post('/api/chat/create-group-chat', payload),

  getAllChats: (): Promise<AxiosResponse<ChatsResponse>> =>
    axiosInstance.get('/api/chat/get-all-chats'),

  blockChatPeer: (chatId: string): Promise<AxiosResponse<ChatResponse>> =>
    axiosInstance.post(`/api/chat/${chatId}/block`),

  unblockChatPeer: (chatId: string): Promise<AxiosResponse<ChatResponse>> =>
    axiosInstance.delete(`/api/chat/${chatId}/block`),
};
