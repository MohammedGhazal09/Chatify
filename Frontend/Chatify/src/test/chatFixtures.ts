import type { User } from '../types/auth';
import type { Chat, Message } from '../types/chat';

export const makeUser = (overrides: Partial<User> = {}): User => ({
  _id: 'user-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  authProvider: 'local',
  isVerified: true,
  ...overrides,
});

export const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  _id: 'message-1',
  clientMessageId: null,
  chatId: 'chat-1',
  sender: 'user-1',
  text: 'Hello there',
  read: false,
  status: 'sent',
  readBy: [],
  reactions: [],
  deletedFor: [],
  deletedForEveryone: false,
  createdAt: '2026-06-08T10:00:00.000Z',
  updatedAt: '2026-06-08T10:00:00.000Z',
  ...overrides,
});

export const makeChat = (overrides: Partial<Chat> = {}): Chat => ({
  _id: 'chat-1',
  members: [
    makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }),
    makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' }),
  ],
  unReadMessages: 0,
  chatName: undefined,
  isGroupChat: false,
  latestMessage: null,
  createdAt: '2026-06-08T09:00:00.000Z',
  updatedAt: '2026-06-08T10:00:00.000Z',
  ...overrides,
});
