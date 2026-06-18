import type { User } from './auth';

export type MessageStatus = 'sent' | 'delivered' | 'read';
export type MessageType = 'text' | 'call';
export type CallMode = 'audio' | 'video';
export type CallStatus =
  | 'ringing'
  | 'connected'
  | 'rejected'
  | 'missed'
  | 'ended'
  | 'failed'
  | 'canceled'
  | 'blocked';
export type CallUiStatus =
  | 'idle'
  | 'incoming'
  | 'outgoing'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'rejected'
  | 'missed'
  | 'busy'
  | 'permission_denied'
  | 'failed'
  | 'ended';
export type CallEndReason = 'missed' | 'rejected' | 'ended' | 'failed' | 'canceled' | 'blocked';

export interface CallActivity {
  callId: string | null;
  callerId: string | null;
  calleeId: string | null;
  mode: CallMode | null;
  result: CallEndReason | null;
  startedAt?: string | null;
  ringingAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
}

export interface CallIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CallIceConfig {
  iceServers: CallIceServer[];
  turnReady: boolean;
  productionReady: boolean;
  warnings?: string[];
}

export interface CallSessionPayload {
  callId: string;
  chatId: string;
  callerId: string;
  calleeId: string | null;
  recipientIds?: string[];
  acceptedBy?: string | null;
  isGroupCall?: boolean;
  mode: CallMode;
  status: CallStatus;
  startedAt?: string | null;
  ringingAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  endedReason?: CallEndReason | string | null;
  deliveredTo?: string[];
  durationSeconds?: number | null;
  fromUserId?: string;
  callConfig?: CallIceConfig;
}

export type CallSocketEventName =
  | 'call:start'
  | 'call:accept'
  | 'call:reject'
  | 'call:end'
  | 'call:offer'
  | 'call:answer'
  | 'call:ice-candidate'
  | 'call:sync';

export interface CallActionAck extends Partial<CallSessionPayload> {
  ok: boolean;
  event: CallSocketEventName;
  code?: string;
  message?: string;
  call?: CallSessionPayload | null;
  callConfig?: CallIceConfig;
}

export interface CallSignalEvent {
  callId: string;
  chatId: string;
  fromUserId: string;
  signal: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
}

export interface ReadByEntry {
  user: string;
  readAt: string;
}

export interface Reaction {
  user: string;
  emoji: string;
}

export type AttachmentKind = 'media' | 'file' | 'voice';
export type AttachmentStatus = 'active' | 'deleted';
export type SharedAssetKind = AttachmentKind;

export interface AttachmentSummary {
  _id: string;
  attachmentId: string;
  displayName: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  durationSeconds?: number | null;
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
  durationSeconds?: number | null;
  localPreviewUrl?: string;
}

export type MessageUploadAttachment = File | ComposerAttachmentDraft;

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
  messageType?: MessageType;
  callActivity?: CallActivity | null;
  read: boolean;
  status: MessageStatus;
  deliveredAt?: string | null;
  readAt?: string | null;
  readBy?: ReadByEntry[];
  reactions?: Reaction[];
  attachments?: AttachmentSummary[];
  localFiles?: File[];
  localDrafts?: ComposerAttachmentDraft[];
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

export type MessagingDisabledReason = 'blocked_by_me' | 'blocked_me' | null;

export interface ConversationControls {
  isDirectChat: boolean;
  peerId: string | null;
  canSendMessage: boolean;
  canBlockUser: boolean;
  canUnblockUser: boolean;
  blockedByMe: boolean;
  blockedMe: boolean;
  messagingDisabledReason: MessagingDisabledReason;
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
  conversationControls?: ConversationControls;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChatPayload {
  targetUsername: string;
  chatName?: string;
}

export interface CreateGroupChatPayload {
  chatName: string;
  memberUsernames: string[];
}

export interface NewMessagePayload {
  chatId: string;
  text: string;
  clientMessageId: string;
  attachments?: MessageUploadAttachment[];
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
  durationSeconds?: number | null;
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
  username?: string;
  userName?: string;
  isOnline: boolean;
  isCallReachable?: boolean;
  lastSeen?: string;
}

export interface UserStatusChangeEvent {
  userId: string;
  username?: string;
  userName: string;
  isOnline: boolean;
  isCallReachable?: boolean;
  lastSeen?: string;
}

// Typing indicator types
export interface TypingUser {
  chatId: string;
  userId: string;
  username?: string;
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
  callConfig?: CallIceConfig;
}

export interface SocketErrorEvent {
  code: string;
  event?: string;
  message?: string;
}

export interface ConversationControlsUpdatedEvent {
  chatId: string;
  conversationControls: ConversationControls;
}

export interface UserIdentityUpdatedEvent {
  userId: string;
  user: User;
  chatIds?: string[];
}
