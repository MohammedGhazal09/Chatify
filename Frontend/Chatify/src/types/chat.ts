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

export type AttachmentKind = 'media' | 'file';
export type AttachmentStatus = 'active' | 'deleted';
export type SharedAssetKind = AttachmentKind;

export interface AttachmentSummary {
  _id: string;
  attachmentId: string;
  displayName: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  status: AttachmentStatus;
  createdAt?: string | null;
  localPreviewUrl?: string;
}

export interface ComposerAttachmentDraft {
  id: string;
  file: File;
  displayName: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  localPreviewUrl?: string;
}

export interface ComposerSendPayload {
  text: string;
  attachments: ComposerAttachmentDraft[];
}

export interface Message {
  _id: string;
  clientMessageId?: string | null;
  chatId: string;
  sender: string;
  text: string;
  read: boolean;
  status: MessageStatus;
  deliveredAt?: string | null;
  readAt?: string | null;
  readBy?: ReadByEntry[];
  reactions?: Reaction[];
  attachments?: AttachmentSummary[];
  localFiles?: File[];
  isEdited?: boolean;
  editedAt?: string | null;
  deletedFor?: string[];
  deletedForEveryone?: boolean;
  deletedBy?: string | null;
  deletedAt?: string | null;
  pinned?: boolean;
  pinnedBy?: string | null;
  pinnedAt?: string | null;
  optimisticState?: 'sending' | 'failed';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationInfo {
  currentPage?: number;
  totalPages?: number;
  totalMessages?: number;
  hasMore: boolean;
  limit: number;
  nextCursor?: string | null;
}

export interface CursorPaginationInfo {
  nextCursor?: string | null;
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
  text: string;
  clientMessageId: string;
  attachments?: File[];
}

export interface SharedAsset {
  _id: string;
  attachmentId: string;
  messageId: string;
  chatId: string;
  uploader: string;
  displayName: string;
  mimeType: string;
  size: number;
  kind: SharedAssetKind;
  status: AttachmentStatus;
  createdAt?: string | null;
}

export interface PinnedMessage {
  messageId: string;
  chatId: string;
  sender: string;
  text: string;
  attachments: AttachmentSummary[];
  pinned: boolean;
  pinnedBy?: string | null;
  pinnedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  message?: Message;
}

export interface MessagePinEvent {
  chatId: string;
  messageId: string;
  message: Message;
  pinnedMessage: PinnedMessage;
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
export interface MessageReceiptPatch {
  _id?: string;
  messageId: string;
  chatId?: string;
  status: MessageStatus;
  deliveredAt?: string | null;
  readAt?: string | null;
  read?: boolean;
  readBy?: ReadByEntry[];
}

export type MessageStatusUpdateEvent = MessageReceiptPatch;

export interface MessageReadEvent extends MessageReceiptPatch {
  readerId?: string;
  readEntry?: ReadByEntry | null;
}

export interface BatchReadEvent {
  chatId: string;
  userId: string;
  messages: MessageReceiptPatch[];
  receipts?: MessageReceiptPatch[];
}

// Message delete/edit events
export interface MessageDeletedEvent {
  messageId: string;
  chatId: string;
  deletedBy?: string | null;
  deletedAt?: string | null;
  deleteForEveryone: boolean;
  message?: Message;
  text?: string;
  deletedFor?: string[];
  deletedForEveryone?: boolean;
}

export interface MessageEditedEvent {
  messageId: string;
  chatId: string;
  text: string;
  isEdited: boolean;
  editedAt: string | null;
  message?: Message;
}

export interface MessageReactionEvent {
  messageId: string;
  chatId: string;
  reactions: Reaction[];
  action: 'added' | 'removed';
  userId: string;
  emoji: string;
  message?: Message;
}

// Unread count update event (via WebSocket)
export interface UnreadUpdateEvent {
  chatId: string;
  userId: string;
  count?: number; // Absolute count (when messages are marked as read)
  increment?: number; // Relative increment (when new message arrives)
}

export interface SocketReadyEvent {
  userId: string;
  socketId: string;
  joinedChats: number;
  presence?: UserOnlineStatus[];
}

export interface SocketErrorEvent {
  code: string;
  event?: string;
  message?: string;
}
