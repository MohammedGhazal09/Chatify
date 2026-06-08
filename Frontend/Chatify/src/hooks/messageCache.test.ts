import { describe, expect, it } from 'vitest';
import type { Message } from '../types/chat';
import {
  applyBatchReadInCache,
  applyDeletedMessageInCache,
  applyReceiptPatchInCache,
  applyUnreadUpdate,
  createOptimisticMessage,
  markOptimisticMessageFailed,
  prependMessagesInCache,
  upsertMessageInCache,
  type MessagesCacheData,
} from './messageCache';

const makeMessage = (overrides: Partial<Message> = {}): Message => ({
  _id: 'message-1',
  clientMessageId: null,
  chatId: 'chat-1',
  sender: 'user-1',
  text: 'Hello',
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

describe('message cache helpers', () => {
  it('converges optimistic insert plus HTTP success by clientMessageId', () => {
    const optimistic = createOptimisticMessage({
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'Pending',
      clientMessageId: 'client-1',
      createdAt: '2026-06-08T10:00:00.000Z',
    });
    const serverMessage = makeMessage({
      _id: 'server-1',
      clientMessageId: 'client-1',
      text: 'Pending',
      createdAt: '2026-06-08T10:00:01.000Z',
      updatedAt: '2026-06-08T10:00:01.000Z',
    });

    const withOptimistic = upsertMessageInCache(undefined, optimistic);
    const withServer = upsertMessageInCache(withOptimistic, serverMessage);

    expect(withServer.messages).toHaveLength(1);
    expect(withServer.messages[0]).toMatchObject({
      _id: 'server-1',
      clientMessageId: 'client-1',
      optimisticState: undefined,
    });
  });

  it('handles socket echo before HTTP success without duplicates', () => {
    const optimistic = createOptimisticMessage({
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'Race',
      clientMessageId: 'client-race',
    });
    const socketMessage = makeMessage({
      _id: 'server-race',
      clientMessageId: 'client-race',
      text: 'Race',
    });

    const cache = [optimistic, socketMessage, socketMessage].reduce<MessagesCacheData | undefined>(
      (nextCache, message) => upsertMessageInCache(nextCache, message),
      undefined
    );

    expect(cache?.messages).toHaveLength(1);
    expect(cache?.messages[0]._id).toBe('server-race');
  });

  it('dedupes duplicate refetch/prepend payloads by _id', () => {
    const existing = makeMessage({ _id: 'message-1' });
    const older = makeMessage({
      _id: 'message-0',
      createdAt: '2026-06-08T09:59:00.000Z',
      updatedAt: '2026-06-08T09:59:00.000Z',
    });
    const cache = prependMessagesInCache({ messages: [existing] }, [older, existing]);

    expect(cache.messages.map((message) => message._id)).toEqual(['message-0', 'message-1']);
  });

  it('preserves cursor metadata while prepending older messages', () => {
    const existing = makeMessage({ _id: 'message-2' });
    const older = makeMessage({
      _id: 'message-1',
      createdAt: '2026-06-08T09:59:00.000Z',
      updatedAt: '2026-06-08T09:59:00.000Z',
    });
    const cache = prependMessagesInCache(
      {
        messages: [existing],
        cursor: { nextCursor: 'cursor-before-message-2', hasMore: true, limit: 50 },
      },
      [older]
    );

    expect(cache.messages.map((message) => message._id)).toEqual(['message-1', 'message-2']);
    expect(cache.cursor).toEqual({ nextCursor: 'cursor-before-message-2', hasMore: true, limit: 50 });
  });

  it('marks a failed optimistic send without removing concurrent messages', () => {
    const optimistic = createOptimisticMessage({
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'Will fail',
      clientMessageId: 'client-fail',
    });
    const concurrent = makeMessage({
      _id: 'message-concurrent',
      sender: 'user-2',
      text: 'Arrived meanwhile',
      createdAt: '2026-06-08T10:00:02.000Z',
      updatedAt: '2026-06-08T10:00:02.000Z',
    });

    const failedCache = markOptimisticMessageFailed(
      { messages: [optimistic, concurrent] },
      'client-fail',
      'Network failed'
    );

    expect(failedCache?.messages).toHaveLength(2);
    expect(failedCache?.messages.find((message) => message.clientMessageId === 'client-fail')).toMatchObject({
      optimisticState: 'failed',
      errorMessage: 'Network failed',
    });
    expect(failedCache?.messages.find((message) => message._id === 'message-concurrent')).toBeTruthy();
  });

  it('replaces a failed retry with the same clientMessageId by the persisted message', () => {
    const failed = createOptimisticMessage({
      chatId: 'chat-1',
      senderId: 'user-1',
      text: 'Retry',
      clientMessageId: 'client-retry',
    });
    const failedCache = markOptimisticMessageFailed({ messages: [failed] }, 'client-retry');
    const serverMessage = makeMessage({
      _id: 'server-retry',
      clientMessageId: 'client-retry',
      text: 'Retry',
    });
    const resolvedCache = upsertMessageInCache(failedCache, serverMessage);

    expect(resolvedCache.messages).toHaveLength(1);
    expect(resolvedCache.messages[0]).toMatchObject({
      _id: 'server-retry',
      optimisticState: undefined,
      errorMessage: undefined,
    });
  });

  it('prevents status patches from downgrading read messages', () => {
    const readMessage = makeMessage({
      status: 'read',
      read: true,
      deliveredAt: '2026-06-08T10:00:01.000Z',
      readAt: '2026-06-08T10:00:02.000Z',
    });
    const patchedCache = applyReceiptPatchInCache(
      { messages: [readMessage] },
      {
        messageId: 'message-1',
        status: 'delivered',
        deliveredAt: '2026-06-08T10:00:03.000Z',
      }
    );

    expect(patchedCache?.messages[0]).toMatchObject({
      status: 'read',
      deliveredAt: '2026-06-08T10:00:03.000Z',
      readAt: '2026-06-08T10:00:02.000Z',
    });
  });

  it('applies batch read patches and absolute unread updates', () => {
    const cache = applyBatchReadInCache(
      { messages: [makeMessage({ _id: 'message-1' }), makeMessage({ _id: 'message-2' })] },
      {
        chatId: 'chat-1',
        userId: 'user-2',
        messages: [
          { messageId: 'message-1', status: 'read', read: true },
          { messageId: 'message-2', status: 'read', read: true },
        ],
      }
    );
    const unreadCounts = applyUnreadUpdate(new Map([['chat-1', 5]]), {
      chatId: 'chat-1',
      userId: 'user-2',
      count: 0,
    });

    expect(cache?.messages.map((message) => message.status)).toEqual(['read', 'read']);
    expect(unreadCounts.get('chat-1')).toBe(0);
  });

  it('replaces existing message content with canonical tombstones', () => {
    const existing = makeMessage({
      _id: 'message-delete',
      text: 'Sensitive content',
    });
    const tombstone = makeMessage({
      _id: 'message-delete',
      text: '',
      deletedForEveryone: true,
      deletedBy: 'user-1',
      deletedAt: '2026-06-08T10:00:05.000Z',
      updatedAt: '2026-06-08T10:00:05.000Z',
    });
    const cache = applyDeletedMessageInCache(
      { messages: [existing] },
      {
        messageId: 'message-delete',
        chatId: 'chat-1',
        deleteForEveryone: true,
        message: tombstone,
      }
    );

    expect(cache?.messages).toHaveLength(1);
    expect(cache?.messages[0]).toMatchObject({
      _id: 'message-delete',
      text: '',
      deletedForEveryone: true,
      deletedBy: 'user-1',
    });
  });
});
