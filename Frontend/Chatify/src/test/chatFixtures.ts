import type { User } from '../types/auth';
import type { AttachmentSummary, Chat, Message, PinnedMessage, SharedAsset } from '../types/chat';

export const makeUser = (overrides: Partial<User> = {}): User => ({
  _id: 'user-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  username: 'ada.lovelace',
  authProvider: 'local',
  isVerified: true,
  ...overrides,
});

export const makeCodedUser = (label: string, overrides: Partial<User> = {}): User => {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'coded-node';

  return makeUser({
    _id: `fixture-${slug}`,
    firstName: label,
    lastName: '',
    username: slug.replace(/-/g, '.'),
    profilePic: `/api/user/fixture-${slug}/profile-image?v=fixture`,
    ...overrides,
  });
};

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
  attachments: [],
  deletedFor: [],
  deletedForEveryone: false,
  pinned: false,
  pinnedBy: null,
  pinnedAt: null,
  createdAt: '2026-06-08T10:00:00.000Z',
  updatedAt: '2026-06-08T10:00:00.000Z',
  ...overrides,
});

export const makeAttachment = (overrides: Partial<AttachmentSummary> = {}): AttachmentSummary => ({
  _id: 'attachment-1',
  attachmentId: 'attachment-1',
  displayName: 'message-states-spec.pdf',
  mimeType: 'application/pdf',
  size: 280 * 1024,
  kind: 'file',
  status: 'active',
  createdAt: '2026-06-08T10:00:00.000Z',
  ...overrides,
});

export const makeSharedAsset = (overrides: Partial<SharedAsset> = {}): SharedAsset => ({
  _id: 'attachment-1',
  attachmentId: 'attachment-1',
  messageId: 'message-1',
  chatId: 'chat-1',
  uploader: 'user-1',
  displayName: 'message-states-spec.pdf',
  mimeType: 'application/pdf',
  size: 280 * 1024,
  kind: 'file',
  status: 'active',
  createdAt: '2026-06-08T10:00:00.000Z',
  ...overrides,
});

export const makePinnedMessage = (overrides: Partial<PinnedMessage> = {}): PinnedMessage => ({
  messageId: 'message-1',
  chatId: 'chat-1',
  sender: 'user-1',
  text: 'Pinned retry note',
  attachments: [],
  pinned: true,
  pinnedBy: 'user-1',
  pinnedAt: '2026-06-08T10:05:00.000Z',
  createdAt: '2026-06-08T10:00:00.000Z',
  updatedAt: '2026-06-08T10:05:00.000Z',
  ...overrides,
});

export const makeChat = (overrides: Partial<Chat> = {}): Chat => ({
  _id: 'chat-1',
  members: [
    makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', username: 'ada.lovelace' }),
    makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper', username: 'grace.hopper' }),
  ],
  unReadMessages: 0,
  chatName: undefined,
  isGroupChat: false,
  latestMessage: null,
  createdAt: '2026-06-08T09:00:00.000Z',
  updatedAt: '2026-06-08T10:00:00.000Z',
  ...overrides,
});
