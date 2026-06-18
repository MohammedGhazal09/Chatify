import type { Chat, Message, UserOnlineStatus } from '../../src/types/chat';
import type { User } from '../../src/types/auth';
import { makeChat, makeMessage, makeUser } from '../../src/test/chatFixtures';

export const PHASE19_CURRENT_USER_ID = 'phase19-user-current';
export const PHASE19_PRIMARY_CHAT_ID = 'phase19-chat-product-polish';
export const PHASE19_SECONDARY_CHAT_ID = 'phase19-chat-muted-routing';

const phase19User = (overrides: Partial<User>): User => makeUser({
  authProvider: 'local',
  isVerified: true,
  showOnlineStatus: true,
  showLastSeen: true,
  ...overrides,
});

const currentUser = phase19User({
  _id: PHASE19_CURRENT_USER_ID,
  firstName: 'Control',
  lastName: 'Desk',
  email: 'control-desk@chatify.invalid',
});

const productPeer = phase19User({
  _id: 'phase19-user-product-peer',
  firstName: 'Signal',
  lastName: 'Desk',
  email: 'signal-desk@chatify.invalid',
});

const mutedPeer = phase19User({
  _id: 'phase19-user-muted-peer',
  firstName: 'Quiet',
  lastName: 'Queue',
  email: 'quiet-queue@chatify.invalid',
});

const primaryMessages: Message[] = [
  makeMessage({
    _id: 'phase19-message-polish-checkpoint',
    chatId: PHASE19_PRIMARY_CHAT_ID,
    sender: productPeer._id,
    text: 'Product polish checkpoint is visible.',
    status: 'delivered',
    createdAt: '2026-06-17T08:10:00.000Z',
    updatedAt: '2026-06-17T08:10:00.000Z',
  }),
  makeMessage({
    _id: 'phase19-message-generic-notice',
    chatId: PHASE19_PRIMARY_CHAT_ID,
    sender: currentUser._id,
    text: 'Generic notification copy remains outside message previews.',
    status: 'read',
    read: true,
    readBy: [{ user: productPeer._id, readAt: '2026-06-17T08:11:00.000Z' }],
    createdAt: '2026-06-17T08:11:00.000Z',
    updatedAt: '2026-06-17T08:11:00.000Z',
  }),
];

const mutedMessages: Message[] = [
  makeMessage({
    _id: 'phase19-message-muted-state',
    chatId: PHASE19_SECONDARY_CHAT_ID,
    sender: mutedPeer._id,
    text: 'Muted routing stays readable inside the chat.',
    status: 'delivered',
    createdAt: '2026-06-17T08:05:00.000Z',
    updatedAt: '2026-06-17T08:05:00.000Z',
  }),
];

const primaryChat: Chat = makeChat({
  _id: PHASE19_PRIMARY_CHAT_ID,
  members: [currentUser, productPeer],
  latestMessage: primaryMessages[1],
  createdAt: '2026-06-17T08:00:00.000Z',
  updatedAt: '2026-06-17T08:11:00.000Z',
});

const secondaryChat: Chat = makeChat({
  _id: PHASE19_SECONDARY_CHAT_ID,
  members: [currentUser, mutedPeer],
  latestMessage: mutedMessages[0],
  createdAt: '2026-06-17T08:00:00.000Z',
  updatedAt: '2026-06-17T08:05:00.000Z',
});

const presence: UserOnlineStatus[] = [
  {
    userId: productPeer._id,
    userName: 'Signal Desk',
    isOnline: true,
    isCallReachable: true,
  },
  {
    userId: mutedPeer._id,
    userName: 'Quiet Queue',
    isOnline: true,
    isCallReachable: true,
  },
];

export const phase19ProductPolishFixture = {
  currentUser,
  selectedChatId: PHASE19_PRIMARY_CHAT_ID,
  secondaryChatId: PHASE19_SECONDARY_CHAT_ID,
  selectedTitle: 'Signal Desk',
  secondaryTitle: 'Quiet Queue',
  chats: [primaryChat, secondaryChat],
  messagesByChatId: {
    [PHASE19_PRIMARY_CHAT_ID]: primaryMessages,
    [PHASE19_SECONDARY_CHAT_ID]: mutedMessages,
  },
  searchMessages: [primaryMessages[1]],
  unreadCounts: {
    [PHASE19_PRIMARY_CHAT_ID]: 0,
    [PHASE19_SECONDARY_CHAT_ID]: 1,
  },
  presence,
} as const;
