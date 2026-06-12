import type { User } from '../../src/types/auth';
import type { Chat, Message, PinnedMessage, SharedAsset, TypingUser, UserOnlineStatus } from '../../src/types/chat';
import { makeChat, makeMessage } from '../../src/test/chatFixtures';

export const PHASE09_CURRENT_USER_ID = 'phase09-user-control-core';
export const PHASE09_PRIMARY_CHAT_ID = 'phase09-chat-relay-grid';
export const PHASE09_SECONDARY_CHAT_ID = 'phase09-chat-vector-archive';
export const PHASE09_TERTIARY_CHAT_ID = 'phase09-chat-cipher-vault';
export const PHASE09_RETRY_CLIENT_ID = 'phase09-client-retry';
export const PHASE09_DISMISS_CLIENT_ID = 'phase09-client-dismiss';
export const PHASE09_CONTINUATION_EMAIL = 'vector-archive@chatify.invalid';
export const PHASE09_UPLOAD_FILE_NAME = 'phase09-upload-sample.txt';

export type CreatePhase09MessageInput = {
  chatId: string;
  text: string;
  clientMessageId: string;
  hasAttachment?: boolean;
};

const phase09User = (label: string, overrides: Partial<User>): User => ({
  _id: overrides._id ?? `phase09-user-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  firstName: label,
  lastName: '',
  email: overrides.email ?? `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}@chatify.invalid`,
  authProvider: 'local',
  isVerified: true,
  showOnlineStatus: true,
  showLastSeen: true,
  ...overrides,
});

const phase09CurrentUser = phase09User('Control Core', {
  _id: PHASE09_CURRENT_USER_ID,
  email: 'control-core@chatify.invalid',
});

const relayGrid = phase09User('Relay Grid', {
  _id: 'phase09-user-relay-grid',
  email: 'relay-grid@chatify.invalid',
});

const vectorArchive = phase09User('Vector Archive', {
  _id: 'phase09-user-vector-archive',
  email: PHASE09_CONTINUATION_EMAIL,
});

const cipherVault = phase09User('Cipher Vault', {
  _id: 'phase09-user-cipher-vault',
  email: 'cipher-vault@chatify.invalid',
});

const circuitConsole = phase09User('Circuit Console', {
  _id: 'phase09-user-circuit-console',
  email: 'circuit-console@chatify.invalid',
});

export const phase09Users: User[] = [
  phase09CurrentUser,
  relayGrid,
  vectorArchive,
  cipherVault,
  circuitConsole,
];

const phase09Message = (overrides: Partial<Message>): Message => makeMessage({
  chatId: PHASE09_PRIMARY_CHAT_ID,
  readBy: [],
  reactions: [],
  ...overrides,
});

export const phase09SharedFileAttachment = {
  _id: 'phase09-attachment-routing-ledger',
  attachmentId: 'phase09-attachment-routing-ledger',
  displayName: 'phase09-routing-ledger.pdf',
  mimeType: 'application/pdf',
  size: 184 * 1024,
  kind: 'file' as const,
  status: 'active' as const,
  createdAt: '2026-06-12T09:35:00.000Z',
};

export const phase09SharedMediaAttachment = {
  _id: 'phase09-attachment-circuit-grid',
  attachmentId: 'phase09-attachment-circuit-grid',
  displayName: 'phase09-circuit-grid.png',
  mimeType: 'image/png',
  size: 76 * 1024,
  kind: 'media' as const,
  status: 'active' as const,
  createdAt: '2026-06-12T09:36:00.000Z',
};

const phase09UploadAttachment = {
  _id: 'phase09-attachment-upload-sample',
  attachmentId: 'phase09-attachment-upload-sample',
  displayName: PHASE09_UPLOAD_FILE_NAME,
  mimeType: 'text/plain',
  size: 68,
  kind: 'file' as const,
  status: 'active' as const,
  createdAt: '2026-06-12T09:44:00.000Z',
};

export const phase09PrimaryMessages: Message[] = [
  phase09Message({
    _id: 'phase09-message-session-restore',
    sender: relayGrid._id,
    text: 'Session restore kept the selected conversation stable after reload.',
    status: 'delivered',
    createdAt: '2026-06-12T09:28:00.000Z',
    updatedAt: '2026-06-12T09:28:00.000Z',
  }),
  phase09Message({
    _id: 'phase09-message-delivery-read',
    sender: phase09CurrentUser._id,
    text: 'Delivery and read receipts stay visible after interaction.',
    status: 'read',
    read: true,
    readBy: [{ user: relayGrid._id, readAt: '2026-06-12T09:29:30.000Z' }],
    createdAt: '2026-06-12T09:29:00.000Z',
    updatedAt: '2026-06-12T09:29:00.000Z',
  }),
  phase09Message({
    _id: 'phase09-message-routing-note',
    sender: relayGrid._id,
    text: 'Routing note: search should jump back to this encrypted status line.',
    status: 'delivered',
    createdAt: '2026-06-12T09:30:00.000Z',
    updatedAt: '2026-06-12T09:30:00.000Z',
  }),
  phase09Message({
    _id: 'phase09-message-shared-assets',
    sender: relayGrid._id,
    text: 'Shared abstract assets are available through protected links.',
    status: 'delivered',
    attachments: [phase09SharedFileAttachment, phase09SharedMediaAttachment],
    createdAt: '2026-06-12T09:31:00.000Z',
    updatedAt: '2026-06-12T09:31:00.000Z',
  }),
  phase09Message({
    _id: 'optimistic-phase09-retry',
    clientMessageId: PHASE09_RETRY_CLIENT_ID,
    sender: phase09CurrentUser._id,
    text: 'Retry action should recover through the quality gate.',
    status: 'sent',
    optimisticState: 'failed',
    errorMessage: 'Controlled Phase 09 retry failure',
    createdAt: '2026-06-12T09:32:00.000Z',
    updatedAt: '2026-06-12T09:32:00.000Z',
  }),
  phase09Message({
    _id: 'optimistic-phase09-dismiss',
    clientMessageId: PHASE09_DISMISS_CLIENT_ID,
    sender: phase09CurrentUser._id,
    text: 'Dismiss action should remove this controlled failure.',
    status: 'sent',
    optimisticState: 'failed',
    errorMessage: 'Controlled Phase 09 dismiss failure',
    createdAt: '2026-06-12T09:33:00.000Z',
    updatedAt: '2026-06-12T09:33:00.000Z',
  }),
];

const vectorMessage = makeMessage({
  _id: 'phase09-message-vector-ready',
  chatId: PHASE09_SECONDARY_CHAT_ID,
  sender: vectorArchive._id,
  text: 'Vector archive is ready for continuation.',
  status: 'delivered',
  createdAt: '2026-06-12T08:42:00.000Z',
  updatedAt: '2026-06-12T08:42:00.000Z',
});

const vaultMessage = makeMessage({
  _id: 'phase09-message-vault-ready',
  chatId: PHASE09_TERTIARY_CHAT_ID,
  sender: cipherVault._id,
  text: 'Cipher vault kept protected files scoped to this room.',
  status: 'read',
  createdAt: '2026-06-11T16:20:00.000Z',
  updatedAt: '2026-06-11T16:20:00.000Z',
});

const consoleMessage = makeMessage({
  _id: 'phase09-message-console-status',
  chatId: 'phase09-chat-circuit-console',
  sender: circuitConsole._id,
  text: 'Circuit console reports no layout overflow.',
  status: 'read',
  createdAt: '2026-06-10T14:15:00.000Z',
  updatedAt: '2026-06-10T14:15:00.000Z',
});

export const phase09Chats: Chat[] = [
  makeChat({
    _id: PHASE09_PRIMARY_CHAT_ID,
    members: [phase09CurrentUser, relayGrid],
    latestMessage: phase09PrimaryMessages[3],
    unReadMessages: 2,
    createdAt: '2026-06-12T08:20:00.000Z',
    updatedAt: '2026-06-12T09:33:00.000Z',
  }),
  makeChat({
    _id: PHASE09_SECONDARY_CHAT_ID,
    members: [phase09CurrentUser, vectorArchive],
    latestMessage: vectorMessage,
    createdAt: '2026-06-12T08:00:00.000Z',
    updatedAt: '2026-06-12T08:42:00.000Z',
  }),
  makeChat({
    _id: PHASE09_TERTIARY_CHAT_ID,
    members: [phase09CurrentUser, cipherVault],
    latestMessage: vaultMessage,
    unReadMessages: 1,
    createdAt: '2026-06-11T12:00:00.000Z',
    updatedAt: '2026-06-11T16:20:00.000Z',
  }),
  makeChat({
    _id: 'phase09-chat-circuit-console',
    members: [phase09CurrentUser, circuitConsole],
    latestMessage: consoleMessage,
    createdAt: '2026-06-10T10:00:00.000Z',
    updatedAt: '2026-06-10T14:15:00.000Z',
  }),
];

export const phase09SharedFiles: SharedAsset[] = [
  {
    ...phase09SharedFileAttachment,
    messageId: 'phase09-message-shared-assets',
    chatId: PHASE09_PRIMARY_CHAT_ID,
    uploader: relayGrid._id,
  },
  {
    _id: 'phase09-attachment-delivery-table',
    attachmentId: 'phase09-attachment-delivery-table',
    messageId: 'phase09-message-delivery-read',
    chatId: PHASE09_PRIMARY_CHAT_ID,
    uploader: phase09CurrentUser._id,
    displayName: 'phase09-delivery-table.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 52 * 1024,
    kind: 'file',
    status: 'active',
    createdAt: '2026-06-12T09:34:00.000Z',
  },
];

export const phase09SharedMedia: SharedAsset[] = [
  {
    ...phase09SharedMediaAttachment,
    messageId: 'phase09-message-shared-assets',
    chatId: PHASE09_PRIMARY_CHAT_ID,
    uploader: relayGrid._id,
  },
  {
    _id: 'phase09-attachment-signal-tiles',
    attachmentId: 'phase09-attachment-signal-tiles',
    messageId: 'phase09-message-routing-note',
    chatId: PHASE09_PRIMARY_CHAT_ID,
    uploader: relayGrid._id,
    displayName: 'phase09-signal-tiles.webp',
    mimeType: 'image/webp',
    size: 64 * 1024,
    kind: 'media',
    status: 'active',
    createdAt: '2026-06-12T09:37:00.000Z',
  },
];

export const phase09PinnedMessages: PinnedMessage[] = [
  {
    messageId: 'phase09-message-delivery-read',
    chatId: PHASE09_PRIMARY_CHAT_ID,
    sender: phase09CurrentUser._id,
    text: 'Delivery and read receipts stay visible after interaction.',
    attachments: [],
    pinned: true,
    pinnedBy: phase09CurrentUser._id,
    pinnedAt: '2026-06-12T09:38:00.000Z',
    createdAt: '2026-06-12T09:29:00.000Z',
    updatedAt: '2026-06-12T09:38:00.000Z',
  },
  {
    messageId: 'phase09-message-shared-assets',
    chatId: PHASE09_PRIMARY_CHAT_ID,
    sender: relayGrid._id,
    text: 'Shared abstract assets are available through protected links.',
    attachments: [phase09SharedFileAttachment, phase09SharedMediaAttachment],
    pinned: true,
    pinnedBy: phase09CurrentUser._id,
    pinnedAt: '2026-06-12T09:39:00.000Z',
    createdAt: '2026-06-12T09:31:00.000Z',
    updatedAt: '2026-06-12T09:39:00.000Z',
  },
];

export const phase09UnreadCounts: Record<string, number> = {
  [PHASE09_PRIMARY_CHAT_ID]: 2,
  [PHASE09_SECONDARY_CHAT_ID]: 0,
  [PHASE09_TERTIARY_CHAT_ID]: 1,
  'phase09-chat-circuit-console': 0,
};

export const phase09Presence: UserOnlineStatus[] = [
  {
    userId: relayGrid._id,
    userName: 'Relay Grid',
    isOnline: true,
  },
  {
    userId: vectorArchive._id,
    userName: 'Vector Archive',
    isOnline: false,
    lastSeen: '2026-06-12T08:55:00.000Z',
  },
  {
    userId: cipherVault._id,
    userName: 'Cipher Vault',
    isOnline: true,
  },
];

export const phase09TypingUsers: TypingUser[] = [
  {
    chatId: PHASE09_PRIMARY_CHAT_ID,
    userId: relayGrid._id,
    userName: 'Relay Grid',
    isTyping: true,
  },
];

export const createPhase09PersistedMessage = ({
  chatId,
  text,
  clientMessageId,
  hasAttachment = false,
}: CreatePhase09MessageInput): Message => {
  const isRetry = clientMessageId === PHASE09_RETRY_CLIENT_ID || text.includes('Retry action should recover');
  const createdAt = isRetry ? '2026-06-12T09:40:00.000Z' : '2026-06-12T09:41:00.000Z';

  return makeMessage({
    _id: isRetry ? 'phase09-message-retry-resolved' : `phase09-message-created-${clientMessageId}`,
    clientMessageId: isRetry ? PHASE09_RETRY_CLIENT_ID : clientMessageId,
    chatId,
    sender: PHASE09_CURRENT_USER_ID,
    text: isRetry ? 'Retry action recovered through the quality gate.' : text,
    status: 'read',
    read: true,
    readBy: [{ user: relayGrid._id, readAt: createdAt }],
    attachments: hasAttachment ? [phase09UploadAttachment] : [],
    createdAt,
    updatedAt: createdAt,
  });
};

export const phase09QualityGateFixture = {
  currentUser: phase09CurrentUser,
  users: phase09Users,
  selectedChatId: PHASE09_PRIMARY_CHAT_ID,
  secondaryChatId: PHASE09_SECONDARY_CHAT_ID,
  tertiaryChatId: PHASE09_TERTIARY_CHAT_ID,
  continuationEmail: PHASE09_CONTINUATION_EMAIL,
  primaryTitle: 'Relay Grid',
  secondaryTitle: 'Vector Archive',
  tertiaryTitle: 'Cipher Vault',
  chats: phase09Chats,
  messagesByChatId: {
    [PHASE09_PRIMARY_CHAT_ID]: phase09PrimaryMessages,
    [PHASE09_SECONDARY_CHAT_ID]: [vectorMessage],
    [PHASE09_TERTIARY_CHAT_ID]: [vaultMessage],
    'phase09-chat-circuit-console': [consoleMessage],
  },
  searchMessages: [
    phase09PrimaryMessages[1],
    phase09PrimaryMessages[2],
    phase09PrimaryMessages[3],
  ],
  unreadCounts: phase09UnreadCounts,
  presence: phase09Presence,
  typingUsers: phase09TypingUsers,
  sharedFiles: phase09SharedFiles,
  sharedMedia: phase09SharedMedia,
  pinnedMessages: phase09PinnedMessages,
} as const;
