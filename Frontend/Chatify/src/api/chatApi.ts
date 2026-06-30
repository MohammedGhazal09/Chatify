import axiosInstance from './axios';
import type { AxiosResponse } from 'axios';
import type {
  Chat,
  ContactRequest,
  ContactRequestsData,
  ConversationOrganizationPatch,
  CreateChatPayload,
  CreateGroupChatPayload,
} from '../types/chat';

interface ChatResponse {
  status: string;
  data: {
    chat: Chat;
    conversationControls?: Chat['conversationControls'];
  };
}

interface ContactRequestResponse {
  status: string;
  data: {
    contactRequest: ContactRequest;
  };
}

interface AcceptContactRequestResponse {
  status: string;
  data: {
    contactRequest: ContactRequest;
    chat: Chat;
  };
}

interface ContactRequestsResponse {
  status: string;
  data: ContactRequestsData;
}

interface ChatsResponse {
  status: string;
  data: {
    chats: Chat[];
  };
}

export const chatApi = {
  createChat: (payload: CreateChatPayload): Promise<AxiosResponse<ChatResponse | ContactRequestResponse>> =>
    axiosInstance.post('/api/chat/create-new-chat', payload),

  createGroupChat: (payload: CreateGroupChatPayload): Promise<AxiosResponse<ChatResponse>> =>
    axiosInstance.post('/api/chat/create-group-chat', payload),

  getAllChats: (): Promise<AxiosResponse<ChatsResponse>> =>
    axiosInstance.get('/api/chat/get-all-chats'),

  getContactRequests: (): Promise<AxiosResponse<ContactRequestsResponse>> =>
    axiosInstance.get('/api/chat/contact-requests'),

  createContactRequest: (payload: Pick<CreateChatPayload, 'targetUsername'>): Promise<AxiosResponse<ContactRequestResponse>> =>
    axiosInstance.post('/api/chat/contact-requests', payload),

  acceptContactRequest: (requestId: string): Promise<AxiosResponse<AcceptContactRequestResponse>> =>
    axiosInstance.post(`/api/chat/contact-requests/${requestId}/accept`),

  declineContactRequest: (requestId: string): Promise<AxiosResponse<ContactRequestResponse>> =>
    axiosInstance.post(`/api/chat/contact-requests/${requestId}/decline`),

  cancelContactRequest: (requestId: string): Promise<AxiosResponse<ContactRequestResponse>> =>
    axiosInstance.delete(`/api/chat/contact-requests/${requestId}`),

  updateChatOrganization: (
    chatId: string,
    payload: ConversationOrganizationPatch
  ): Promise<AxiosResponse<ChatResponse>> =>
    axiosInstance.patch(`/api/chat/${chatId}/organization`, payload),

  blockChatPeer: (chatId: string): Promise<AxiosResponse<ChatResponse>> =>
    axiosInstance.post(`/api/chat/${chatId}/block`),

  unblockChatPeer: (chatId: string): Promise<AxiosResponse<ChatResponse>> =>
    axiosInstance.delete(`/api/chat/${chatId}/block`),
};
