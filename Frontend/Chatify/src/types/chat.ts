import type { User } from './auth';

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface ReadByEntry {
  user: string;
  readAt: string;
}

export interface Message {
  _id: string;
  chatId: string;
  sender: string;
  text: string;
  read: boolean;
  status: MessageStatus;
  deliveredAt?: string;
  readAt?: string;
  readBy?: ReadByEntry[];
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
  targetEmail: string;
  chatName?: string;
}

export interface NewMessagePayload {
  chatId: string;
  sender: string;
  text: string;
}

// Online/Offline status types
export interface UserOnlineStatus {
  userId: string;
  userName?: string;
  isOnline: boolean;
  lastSeen?: string;
}

export interface UserStatusChangeEvent {
  userId: string;
  userName: string;
  isOnline: boolean;
  lastSeen?: string;
}

// Typing indicator types
export interface TypingUser {
  chatId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

// Message status update event types
export interface MessageStatusUpdateEvent {
  messageId: string;
  status: MessageStatus;
  deliveredAt?: string;
  readAt?: string;
  readBy?: ReadByEntry[];
}

export interface MessageReadEvent {
  messageId: string;
  readBy: ReadByEntry;
  status: MessageStatus;
  readAt?: string;
}

export interface BatchReadEvent {
  chatId: string;
  userId: string;
  messages: {
    messageId: string;
    status: MessageStatus;
    readBy: ReadByEntry[];
  }[];
}