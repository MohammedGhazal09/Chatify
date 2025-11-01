import type { User } from './auth';

export interface Message {
  _id: string;
  chatId: string;
  sender: string;
  text: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  _id: string;
  members: User[];
  unReadMessages: number;
  chatName?: string;
  isGroupChat: boolean;
  latestMessage?: Message | null;
  groupAdmin?: User;
  groupImage?: string;
  groupDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChatPayload {
  members: string[];
  chatName?: string;
  isGroupChat?: boolean;
  groupImage?: string;
  groupDescription?: string;
}

export interface NewMessagePayload {
  chatId: string;
  sender: string;
  text: string;
}