import type { User } from '../../src/types/auth';
import type { Chat, Message, TypingUser, UserOnlineStatus } from '../../src/types/chat';
import { makeChat, makeCodedUser, makeMessage } from '../../src/test/chatFixtures';

export const PHASE07_CURRENT_USER_ID = 'behavior-user-control';
export const PHASE07_PRIMARY_CHAT_ID = 'behavior-chat-relay-node';
export const PHASE07_SECONDARY_CHAT_ID = 'behavior-chat-matrix-sync';
export const PHASE07_RETRY_CLIENT_ID = 'behavior-client-retry';
export const PHASE07_DISMISS_CLIENT_ID = 'behavior-client-dismiss';
export const PHASE07_CONTINUATION_EMAIL = 'matrix-sync@chatify.invalid';

export type CreateMessageInput = {
  chatId: string;
  text: string;
  clientMessageId: string;
};

const phase07CurrentUser = makeCodedUser('PX-42A', {
  _id: PHASE07_CURRENT_USER_ID,
  email: 'px-42a@chatify.invalid',
});

const relayNode = makeCodedUser('Relay Node', {
  _id: 'behavior-user-relay-node',
  email: 'relay-node@chatify.invalid',
});

const matrixSync = makeCodedUser('Matrix Sync', {
  _id: 'behavior-user-matrix-sync',
  email: PHASE07_CONTINUATION_EMAIL,
});

const signalDock = makeCodedUser('Signal Dock', {
  _id: 'behavior-user-signal-dock',
  email: 'signal-dock@chatify.invalid',
});

export const phase07Users: User[] = [phase07CurrentUser, relayNode, matrixSync, signalDock];

const behaviorMessage = (overrides: Partial<Message>): Message => makeMessage({
  chatId: PHASE07_PRIMARY_CHAT_ID,
  readBy: [],
  reactions: [],
  ...overrides,
});

const directConversationControls = (peerId: string) => ({
  isDirectChat: true,
  peerId,
  canSendMessage: true,
  canBlockUser: true,
  canUnblockUser: false,
  blockedByMe: false,
  blockedMe: false,
  messagingDisabledReason: null,
});

export const phase07PrimaryMessages: Message[] = [
  behaviorMessage({
    _id: 'behavior-message-live-data',
    sender: relayNode._id,
    text: 'Live data handoff completed after the reconnect check.',
    status: 'delivered',
    createdAt: '2025-06-03T11:20:00.000Z',
    updatedAt: '2025-06-03T11:20:00.000Z',
  }),
  behaviorMessage({
    _id: 'behavior-message-runtime-state',
    sender: phase07CurrentUser._id,
    text: 'Search, send, and retry now stay wired to runtime state.',
    status: 'read',
    read: true,
    readBy: [{ user: relayNode._id, readAt: '2025-06-03T11:21:15.000Z' }],
    createdAt: '2025-06-03T11:21:00.000Z',
    updatedAt: '2025-06-03T11:21:00.000Z',
  }),
  behaviorMessage({
    _id: 'optimistic-behavior-retry',
    clientMessageId: PHASE07_RETRY_CLIENT_ID,
    sender: phase07CurrentUser._id,
    text: 'Retry packet stalled during browser proof.',
    status: 'sent',
    optimisticState: 'failed',
    errorMessage: 'Controlled retry failure',
    createdAt: '2025-06-03T11:22:00.000Z',
    updatedAt: '2025-06-03T11:22:00.000Z',
  }),
  behaviorMessage({
    _id: 'optimistic-behavior-dismiss',
    clientMessageId: PHASE07_DISMISS_CLIENT_ID,
    sender: phase07CurrentUser._id,
    text: 'Dismiss packet should disappear from the view.',
    status: 'sent',
    optimisticState: 'failed',
    errorMessage: 'Controlled dismiss failure',
    createdAt: '2025-06-03T11:23:00.000Z',
    updatedAt: '2025-06-03T11:23:00.000Z',
  }),
];

const secondaryMessage = makeMessage({
  _id: 'behavior-message-matrix-ready',
  chatId: PHASE07_SECONDARY_CHAT_ID,
  sender: matrixSync._id,
  text: 'Matrix sync is ready for the continuation path.',
  status: 'delivered',
  createdAt: '2025-06-03T10:10:00.000Z',
  updatedAt: '2025-06-03T10:10:00.000Z',
});

export const phase07Chats: Chat[] = [
  makeChat({
    _id: PHASE07_PRIMARY_CHAT_ID,
    members: [phase07CurrentUser, relayNode],
    conversationControls: directConversationControls(relayNode._id),
    latestMessage: phase07PrimaryMessages[1],
    unReadMessages: 2,
    createdAt: '2025-06-03T10:00:00.000Z',
    updatedAt: '2025-06-03T11:23:00.000Z',
  }),
  makeChat({
    _id: PHASE07_SECONDARY_CHAT_ID,
    members: [phase07CurrentUser, matrixSync],
    conversationControls: directConversationControls(matrixSync._id),
    latestMessage: secondaryMessage,
    createdAt: '2025-06-03T09:00:00.000Z',
    updatedAt: '2025-06-03T10:10:00.000Z',
  }),
  makeChat({
    _id: 'behavior-chat-signal-dock',
    members: [phase07CurrentUser, signalDock],
    conversationControls: directConversationControls(signalDock._id),
    latestMessage: makeMessage({
      _id: 'behavior-message-signal-dock',
      chatId: 'behavior-chat-signal-dock',
      sender: signalDock._id,
      text: 'Status panel confirms the quieter controls.',
      status: 'read',
      createdAt: '2025-06-02T16:10:00.000Z',
      updatedAt: '2025-06-02T16:10:00.000Z',
    }),
    createdAt: '2025-06-02T15:00:00.000Z',
    updatedAt: '2025-06-02T16:10:00.000Z',
  }),
];

export const phase07UnreadCounts: Record<string, number> = {
  [PHASE07_PRIMARY_CHAT_ID]: 2,
  [PHASE07_SECONDARY_CHAT_ID]: 0,
  'behavior-chat-signal-dock': 1,
};

export const phase07Presence: UserOnlineStatus[] = [
  {
    userId: relayNode._id,
    userName: 'Relay Node',
    isOnline: true,
    isCallReachable: true,
  },
  {
    userId: matrixSync._id,
    userName: 'Matrix Sync',
    isOnline: false,
    lastSeen: '2025-06-03T10:15:00.000Z',
  },
];

export const phase07TypingUsers: TypingUser[] = [
  {
    chatId: PHASE07_PRIMARY_CHAT_ID,
    userId: relayNode._id,
    userName: 'Relay Node',
    isTyping: true,
  },
];

export const createPhase07PersistedMessage = ({
  chatId,
  text,
  clientMessageId,
}: CreateMessageInput): Message => {
  const isRetry = clientMessageId === PHASE07_RETRY_CLIENT_ID || text.includes('Retry packet stalled');
  const createdAt = isRetry ? '2025-06-03T11:24:00.000Z' : '2025-06-03T11:25:00.000Z';

  return makeMessage({
    _id: isRetry ? 'behavior-message-retry-resolved' : `behavior-message-created-${clientMessageId}`,
    clientMessageId: isRetry ? PHASE07_RETRY_CLIENT_ID : clientMessageId,
    chatId,
    sender: PHASE07_CURRENT_USER_ID,
    text: isRetry ? 'Retry packet recovered through mocked API.' : text,
    status: 'sent',
    createdAt,
    updatedAt: createdAt,
  });
};

export const phase07BehaviorFixture = {
  currentUser: phase07CurrentUser,
  selectedChatId: PHASE07_PRIMARY_CHAT_ID,
  secondaryChatId: PHASE07_SECONDARY_CHAT_ID,
  continuationEmail: PHASE07_CONTINUATION_EMAIL,
  primaryTitle: 'Relay Node',
  secondaryTitle: 'Matrix Sync',
  chats: phase07Chats,
  messagesByChatId: {
    [PHASE07_PRIMARY_CHAT_ID]: phase07PrimaryMessages,
    [PHASE07_SECONDARY_CHAT_ID]: [secondaryMessage],
    'behavior-chat-signal-dock': [phase07Chats[2].latestMessage as Message],
  },
  searchMessages: [
    phase07PrimaryMessages[0],
    phase07PrimaryMessages[1],
  ],
  unreadCounts: phase07UnreadCounts,
  presence: phase07Presence,
  typingUsers: phase07TypingUsers,
} as const;
