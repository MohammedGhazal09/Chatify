import type { User } from '../../src/types/auth';
import type { Chat, Message, PinnedMessage, SharedAsset, TypingUser, UserOnlineStatus } from '../../src/types/chat';
import { makeChat, makeCodedUser, makeMessage } from '../../src/test/chatFixtures';

export interface Phase06FileChip {
  name: string;
  meta: string;
}

export type Phase06VisualMessage = Message & {
  fileChip?: Phase06FileChip;
};

export const PHASE06_CURRENT_USER_ID = 'phase06-user-ax-7f3c';
export const PHASE06_SELECTED_CHAT_ID = 'phase06-chat-in-8b21';
export const PHASE06_SECONDARY_CHAT_ID = 'phase06-chat-ds-4c9a';

const makePhase06Message = (overrides: Partial<Phase06VisualMessage>): Phase06VisualMessage => ({
  ...makeMessage(),
  ...overrides,
}) as Phase06VisualMessage;

export const phase06CurrentUser = makeCodedUser('AX-7F3C', {
  _id: PHASE06_CURRENT_USER_ID,
  email: 'ax-7f3c@chatify.invalid',
});

export const phase06InNode = makeCodedUser('IN-8B21', {
  _id: 'phase06-user-in-8b21',
  email: 'in-8b21@chatify.invalid',
});

export const phase06DataSync = makeCodedUser('DS-4C9A', {
  _id: 'phase06-user-ds-4c9a',
  email: 'ds-4c9a@chatify.invalid',
});

export const phase06ProtocolRoom = makeCodedUser('PR-0E6F', {
  _id: 'phase06-user-pr-0e6f',
  email: 'pr-0e6f@chatify.invalid',
});

export const phase06PacketMonitor = makeCodedUser('PM-3D12', {
  _id: 'phase06-user-pm-3d12',
  email: 'pm-3d12@chatify.invalid',
});

export const phase06QualityArray = makeCodedUser('QA-77AA', {
  _id: 'phase06-user-qa-77aa',
  email: 'qa-77aa@chatify.invalid',
});

export const phase06CipherNode = makeCodedUser('Cipher Node', {
  _id: 'phase06-user-cipher-node',
  email: 'cipher-node@chatify.invalid',
});

export const phase06Users: User[] = [
  phase06CurrentUser,
  phase06InNode,
  phase06DataSync,
  phase06ProtocolRoom,
  phase06PacketMonitor,
  phase06QualityArray,
  phase06CipherNode,
];

export const phase06SelectedMessages: Phase06VisualMessage[] = [
  makePhase06Message({
    _id: 'phase06-message-reconnect',
    chatId: PHASE06_SELECTED_CHAT_ID,
    sender: phase06InNode._id,
    text: 'The socket reconnect looked clean. Presence updated fast.',
    read: false,
    status: 'delivered',
    createdAt: '2025-05-12T09:28:00.000Z',
    updatedAt: '2025-05-12T09:28:00.000Z',
  }),
  makePhase06Message({
    _id: 'phase06-message-delivery',
    chatId: PHASE06_SELECTED_CHAT_ID,
    sender: phase06CurrentUser._id,
    text: 'Good. Next I am making delivery, read, and retry states obvious.',
    read: true,
    status: 'read',
    readBy: [{ user: phase06InNode._id, readAt: '2025-05-12T09:29:20.000Z' }],
    createdAt: '2025-05-12T09:29:00.000Z',
    updatedAt: '2025-05-12T09:29:00.000Z',
  }),
  makePhase06Message({
    _id: 'phase06-message-quiet',
    chatId: PHASE06_SELECTED_CHAT_ID,
    sender: phase06InNode._id,
    text: 'Keep it quiet and secure, not noisy.',
    read: false,
    status: 'delivered',
    createdAt: '2025-05-12T09:30:00.000Z',
    updatedAt: '2025-05-12T09:30:00.000Z',
  }),
  makePhase06Message({
    _id: 'phase06-message-trust',
    chatId: PHASE06_SELECTED_CHAT_ID,
    sender: phase06CurrentUser._id,
    text: 'Exactly. Clear status, fewer distractions, better trust.',
    read: true,
    status: 'read',
    readBy: [{ user: phase06InNode._id, readAt: '2025-05-12T09:31:10.000Z' }],
    isEdited: true,
    createdAt: '2025-05-12T09:31:00.000Z',
    updatedAt: '2025-05-12T09:31:00.000Z',
  }),
  makePhase06Message({
    _id: 'phase06-message-file-chip',
    chatId: PHASE06_SELECTED_CHAT_ID,
    sender: phase06InNode._id,
    text: '',
    read: false,
    status: 'delivered',
    attachments: [
      {
        _id: 'phase06-attachment-message-states',
        attachmentId: 'phase06-attachment-message-states',
        displayName: 'message-states-spec.pdf',
        mimeType: 'application/pdf',
        size: 280 * 1024,
        kind: 'file',
        status: 'active',
        createdAt: '2025-05-12T09:32:00.000Z',
      },
    ],
    fileChip: { name: 'message-states-spec.pdf', meta: 'PDF - 280 KB' },
    createdAt: '2025-05-12T09:32:00.000Z',
    updatedAt: '2025-05-12T09:32:00.000Z',
  }),
  makePhase06Message({
    _id: 'phase06-message-retrying',
    clientMessageId: 'phase06-client-retrying',
    chatId: PHASE06_SELECTED_CHAT_ID,
    sender: phase06CurrentUser._id,
    text: 'Pushing the retry logic update now.',
    read: false,
    status: 'sent',
    optimisticState: 'sending',
    createdAt: '2025-05-12T09:33:00.000Z',
    updatedAt: '2025-05-12T09:33:00.000Z',
  }),
  makePhase06Message({
    _id: 'phase06-message-failed',
    clientMessageId: 'phase06-client-failed',
    chatId: PHASE06_SELECTED_CHAT_ID,
    sender: phase06CurrentUser._id,
    text: 'Status check: retry packet needs another pass.',
    read: false,
    status: 'sent',
    optimisticState: 'failed',
    errorMessage: 'Fixture retry failed',
    createdAt: '2025-05-12T09:34:00.000Z',
    updatedAt: '2025-05-12T09:34:00.000Z',
  }),
];

const makeLatestMessage = (chatId: string, sender: string, text: string, updatedAt: string) => makeMessage({
  _id: `${chatId}-latest`,
  chatId,
  sender,
  text,
  read: true,
  status: 'read',
  createdAt: updatedAt,
  updatedAt,
});

export const phase06Chats: Chat[] = [
  makeChat({
    _id: PHASE06_SELECTED_CHAT_ID,
    members: [phase06CurrentUser, phase06InNode],
    unReadMessages: 2,
    latestMessage: phase06SelectedMessages[5],
    createdAt: '2025-05-12T09:20:00.000Z',
    updatedAt: '2025-05-12T09:34:00.000Z',
  }),
  makeChat({
    _id: PHASE06_SECONDARY_CHAT_ID,
    members: [phase06CurrentUser, phase06DataSync],
    latestMessage: makeLatestMessage(PHASE06_SECONDARY_CHAT_ID, phase06DataSync._id, 'Backfill complete.', '2025-05-12T09:21:00.000Z'),
    createdAt: '2025-05-12T08:20:00.000Z',
    updatedAt: '2025-05-12T09:21:00.000Z',
  }),
  makeChat({
    _id: 'phase06-chat-pr-0e6f',
    members: [phase06CurrentUser, phase06ProtocolRoom],
    latestMessage: makeLatestMessage('phase06-chat-pr-0e6f', phase06ProtocolRoom._id, 'Spec review at 10:00 UTC.', '2025-05-12T09:05:00.000Z'),
    unReadMessages: 1,
    createdAt: '2025-05-11T09:05:00.000Z',
    updatedAt: '2025-05-12T09:05:00.000Z',
  }),
  makeChat({
    _id: 'phase06-chat-pm-3d12',
    members: [phase06CurrentUser, phase06PacketMonitor],
    latestMessage: makeLatestMessage('phase06-chat-pm-3d12', phase06PacketMonitor._id, 'Can we sync later today?', '2025-05-11T12:00:00.000Z'),
    createdAt: '2025-05-11T09:00:00.000Z',
    updatedAt: '2025-05-11T12:00:00.000Z',
  }),
  makeChat({
    _id: 'phase06-chat-qa-77aa',
    members: [phase06CurrentUser, phase06QualityArray],
    latestMessage: makeLatestMessage('phase06-chat-qa-77aa', phase06QualityArray._id, 'Looks good on staging.', '2025-05-10T17:00:00.000Z'),
    createdAt: '2025-05-10T09:00:00.000Z',
    updatedAt: '2025-05-10T17:00:00.000Z',
  }),
  makeChat({
    _id: 'phase06-chat-cipher-node',
    chatName: 'Cipher Node',
    isGroupChat: true,
    members: [phase06CurrentUser, phase06CipherNode, phase06ProtocolRoom],
    latestMessage: makeLatestMessage('phase06-chat-cipher-node', phase06CipherNode._id, 'Key rotation completed.', '2025-05-09T17:00:00.000Z'),
    createdAt: '2025-05-09T09:00:00.000Z',
    updatedAt: '2025-05-09T17:00:00.000Z',
  }),
];

export const phase06SearchMessages = [
  phase06SelectedMessages[0],
  phase06SelectedMessages[3],
];

export const phase06UnreadCounts: Record<string, number> = {
  [PHASE06_SELECTED_CHAT_ID]: 2,
  [PHASE06_SECONDARY_CHAT_ID]: 0,
  'phase06-chat-pr-0e6f': 1,
  'phase06-chat-pm-3d12': 0,
  'phase06-chat-qa-77aa': 0,
  'phase06-chat-cipher-node': 0,
};

export const phase06Presence: UserOnlineStatus[] = [
  {
    userId: phase06InNode._id,
    userName: 'IN-8B21',
    isOnline: true,
    isCallReachable: true,
  },
  {
    userId: phase06DataSync._id,
    userName: 'DS-4C9A',
    isOnline: true,
    isCallReachable: true,
  },
];

export const phase06TypingUsers: TypingUser[] = [
  {
    chatId: PHASE06_SELECTED_CHAT_ID,
    userId: phase06InNode._id,
    userName: 'IN-8B21',
    isTyping: true,
  },
];

export const phase06SharedFiles: SharedAsset[] = [
  {
    _id: 'phase06-attachment-message-states',
    attachmentId: 'phase06-attachment-message-states',
    messageId: 'phase06-message-file-chip',
    chatId: PHASE06_SELECTED_CHAT_ID,
    uploader: phase06InNode._id,
    displayName: 'message-states-spec.pdf',
    mimeType: 'application/pdf',
    size: 280 * 1024,
    kind: 'file',
    status: 'active',
    createdAt: '2025-05-12T09:32:00.000Z',
  },
];

export const phase06SharedMedia: SharedAsset[] = [
  {
    _id: 'phase06-attachment-abstract-grid',
    attachmentId: 'phase06-attachment-abstract-grid',
    messageId: 'phase06-message-file-chip',
    chatId: PHASE06_SELECTED_CHAT_ID,
    uploader: phase06InNode._id,
    displayName: 'abstract-grid.png',
    mimeType: 'image/png',
    size: 512,
    kind: 'media',
    status: 'active',
    createdAt: '2025-05-12T09:33:00.000Z',
  },
];

export const phase06PinnedMessages: PinnedMessage[] = [
  {
    messageId: 'phase06-message-trust',
    chatId: PHASE06_SELECTED_CHAT_ID,
    sender: phase06CurrentUser._id,
    text: 'Exactly. Clear status, fewer distractions, better trust.',
    attachments: [],
    pinned: true,
    pinnedBy: phase06CurrentUser._id,
    pinnedAt: '2025-05-12T09:35:00.000Z',
    createdAt: '2025-05-12T09:31:00.000Z',
    updatedAt: '2025-05-12T09:35:00.000Z',
  },
];

export const phase06VisualFixture = {
  currentUser: phase06CurrentUser,
  users: phase06Users,
  selectedChatId: PHASE06_SELECTED_CHAT_ID,
  secondaryChatId: PHASE06_SECONDARY_CHAT_ID,
  selectedTitle: 'IN-8B21',
  chats: phase06Chats,
  messagesByChatId: {
    [PHASE06_SELECTED_CHAT_ID]: phase06SelectedMessages,
    [PHASE06_SECONDARY_CHAT_ID]: [
      makeLatestMessage(PHASE06_SECONDARY_CHAT_ID, phase06DataSync._id, 'Backfill complete.', '2025-05-12T09:21:00.000Z'),
    ],
  },
  searchMessages: phase06SearchMessages,
  unreadCounts: phase06UnreadCounts,
  presence: phase06Presence,
  typingUsers: phase06TypingUsers,
  sharedFiles: phase06SharedFiles,
  sharedMedia: phase06SharedMedia,
  pinnedMessages: phase06PinnedMessages,
} as const;
