import type { User } from './auth';

export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface ReadByEntry {
  user: string;
  readAt: string;
}

export interface Reaction {
  user: string;
  emoji: string;
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
  reactions?: Reaction[];
  isEdited?: boolean;
  editedAt?: string;
  deletedFor?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalMessages: number;
  hasMore: boolean;
  limit: number;
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

// Message delete/edit events
export interface MessageDeletedEvent {
  messageId: string;
  chatId: string;
  deletedBy: string;
  deleteForEveryone: boolean;
}

export interface MessageEditedEvent {
  messageId: string;
  chatId: string;
  text: string;
  isEdited: boolean;
  editedAt: string;
}

export interface MessageReactionEvent {
  messageId: string;
  chatId: string;
  reactions: Reaction[];
  action: 'added' | 'removed';
  userId: string;
  emoji: string;
}

// Unread count update event (via WebSocket)
export interface UnreadUpdateEvent {
  chatId: string;
  userId: string;
  count?: number; // Absolute count (when messages are marked as read)
  increment?: number; // Relative increment (when new message arrives)
}