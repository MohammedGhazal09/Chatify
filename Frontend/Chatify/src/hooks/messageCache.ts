import type {
  BatchReadEvent,
  Message,
  MessageDeletedEvent,
  MessageEditedEvent,
  MessageReactionEvent,
  MessageReceiptPatch,
  MessageStatus,
  UnreadUpdateEvent,
} from '../types/chat';

export interface MessagesCacheData {
  messages: Message[];
  pagination?: { hasMore: boolean; currentPage: number; totalPages: number };
  cursor?: { nextCursor?: string | null; hasMore: boolean; limit: number };
}

export type CreateOptimisticMessageInput = {
  chatId: string;
  sender: string;
  text: string;
  clientMessageId: string;
  createdAt?: string;
};

const statusRank: Record<MessageStatus, number> = {
  sent: 0,
  delivered: 1,
  read: 2,
};

export const createClientMessageId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const createOptimisticMessage = ({
  chatId,
  sender,
  text,
  clientMessageId,
  createdAt = new Date().toISOString(),
}: CreateOptimisticMessageInput): Message => ({
  _id: `optimistic-${clientMessageId}`,
  clientMessageId,
  chatId,
  sender,
  text,
  read: false,
  status: 'sent',
  readBy: [],
  reactions: [],
  deletedFor: [],
  deletedForEveryone: false,
  optimisticState: 'sending',
  createdAt,
  updatedAt: createdAt,
});

const messageTime = (message: Message) => new Date(message.createdAt).getTime();

export const sortMessages = (messages: Message[]) => {
  return [...messages].sort((left, right) => {
    const timeDelta = messageTime(left) - messageTime(right);

    if (timeDelta !== 0) {
      return timeDelta;
    }

    return left._id.localeCompare(right._id);
  });
};

const messagesMatch = (left: Message, right: Message) => {
  if (left._id === right._id) {
    return true;
  }

  return Boolean(left.clientMessageId && right.clientMessageId && left.clientMessageId === right.clientMessageId);
};

export const upsertMessage = (messages: Message[], incoming: Message) => {
  const existingIndex = messages.findIndex((message) => messagesMatch(message, incoming));

  if (existingIndex === -1) {
    return sortMessages([...messages, incoming]);
  }

  const nextMessages = [...messages];
  nextMessages[existingIndex] = {
    ...nextMessages[existingIndex],
    ...incoming,
    optimisticState: incoming.optimisticState,
    errorMessage: incoming.errorMessage,
  };

  return sortMessages(nextMessages);
};

export const upsertMessageInCache = (cache: MessagesCacheData | undefined, incoming: Message): MessagesCacheData => ({
  messages: upsertMessage(cache?.messages ?? [], incoming),
  pagination: cache?.pagination,
  cursor: cache?.cursor,
});

export const prependMessagesInCache = (
  cache: MessagesCacheData | undefined,
  olderMessages: Message[]
): MessagesCacheData => {
  return olderMessages.reduce(
    (nextCache, message) => upsertMessageInCache(nextCache, message),
    cache ?? { messages: [] }
  );
};

export const markOptimisticMessageFailed = (
  cache: MessagesCacheData | undefined,
  clientMessageId: string,
  errorMessage = 'Message failed to send'
): MessagesCacheData | undefined => {
  if (!cache) {
    return cache;
  }

  return {
    ...cache,
    messages: cache.messages.map((message) =>
      message.clientMessageId === clientMessageId
        ? { ...message, optimisticState: 'failed', errorMessage }
        : message
    ),
  };
};

const shouldPromoteStatus = (currentStatus: MessageStatus, nextStatus: MessageStatus) => {
  return statusRank[nextStatus] >= statusRank[currentStatus];
};

export const applyReceiptPatchToMessage = (message: Message, patch: MessageReceiptPatch): Message => {
  if (message._id !== patch.messageId && message._id !== patch._id) {
    return message;
  }

  const nextStatus = shouldPromoteStatus(message.status, patch.status) ? patch.status : message.status;

  return {
    ...message,
    status: nextStatus,
    read: patch.read ?? message.read,
    deliveredAt: patch.deliveredAt ?? message.deliveredAt,
    readAt: patch.readAt ?? message.readAt,
    readBy: patch.readBy ?? message.readBy,
  };
};

export const applyReceiptPatchInCache = (
  cache: MessagesCacheData | undefined,
  patch: MessageReceiptPatch
): MessagesCacheData | undefined => {
  if (!cache) {
    return cache;
  }

  return {
    ...cache,
    messages: cache.messages.map((message) => applyReceiptPatchToMessage(message, patch)),
  };
};

export const applyBatchReadInCache = (
  cache: MessagesCacheData | undefined,
  event: BatchReadEvent
): MessagesCacheData | undefined => {
  const patches = event.receipts ?? event.messages;
  return patches.reduce((nextCache, patch) => applyReceiptPatchInCache(nextCache, patch), cache);
};

export const applyDeletedMessageInCache = (
  cache: MessagesCacheData | undefined,
  event: MessageDeletedEvent
): MessagesCacheData | undefined => {
  if (!cache) {
    return cache;
  }

  if (event.message) {
    return upsertMessageInCache(cache, event.message);
  }

  return {
    ...cache,
    messages: cache.messages.filter((message) => message._id !== event.messageId),
  };
};

export const applyEditedMessageInCache = (
  cache: MessagesCacheData | undefined,
  event: MessageEditedEvent
): MessagesCacheData | undefined => {
  if (!cache) {
    return cache;
  }

  if (event.message) {
    return upsertMessageInCache(cache, event.message);
  }

  return {
    ...cache,
    messages: cache.messages.map((message) =>
      message._id === event.messageId
        ? {
            ...message,
            text: event.text,
            isEdited: event.isEdited,
            editedAt: event.editedAt,
          }
        : message
    ),
  };
};

export const applyReactionInCache = (
  cache: MessagesCacheData | undefined,
  event: MessageReactionEvent
): MessagesCacheData | undefined => {
  if (!cache) {
    return cache;
  }

  if (event.message) {
    return upsertMessageInCache(cache, event.message);
  }

  return {
    ...cache,
    messages: cache.messages.map((message) =>
      message._id === event.messageId
        ? { ...message, reactions: event.reactions }
        : message
    ),
  };
};

export const applyUnreadUpdate = (
  unreadCounts: Map<string, number> | undefined,
  event: UnreadUpdateEvent
) => {
  const nextCounts = new Map(unreadCounts ?? []);

  if (typeof event.count === 'number') {
    nextCounts.set(event.chatId, event.count);
    return nextCounts;
  }

  if (typeof event.increment === 'number') {
    nextCounts.set(event.chatId, (nextCounts.get(event.chatId) ?? 0) + event.increment);
  }

  return nextCounts;
};
