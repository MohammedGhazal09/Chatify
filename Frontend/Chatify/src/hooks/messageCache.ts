import type {
  BatchReadEvent,
  ComposerAttachmentDraft,
  CursorPaginationInfo,
  Message,
  MessageDeletedEvent,
  MessageEditedEvent,
  MessageReactionEvent,
  MessageReceiptPatch,
  MessageStatus,
  PaginationInfo,
  UnreadUpdateEvent,
} from '../types/chat';

export const MAX_MESSAGE_TEXT_LENGTH = 1000;

export interface MessagesCacheData {
  messages: Message[];
  pagination?: PaginationInfo;
  cursor?: CursorPaginationInfo;
}

export type CreateOptimisticMessageInput = {
  chatId: string;
  senderId: string;
  text: string;
  clientMessageId: string;
  messageType?: Message['messageType'];
  encryptionMode?: Message['encryptionMode'];
  encryptedPayload?: Message['encryptedPayload'];
  replyTo?: Message['replyTo'];
  mentions?: Message['mentions'];
  decryptedText?: string;
  attachments?: Message['attachments'];
  localFiles?: File[];
  localDrafts?: ComposerAttachmentDraft[];
  createdAt?: string;
};

const statusRank: Record<MessageStatus, number> = {
  sent: 0,
  delivered: 1,
  read: 2,
};

const isOptimisticMessage = (message?: Message) => {
  if (!message) {
    return false;
  }

  return Boolean(message.optimisticState || message._id.startsWith('optimistic-'));
};

const messageVersionTime = (message?: Message) => {
  if (!message) {
    return Number.NEGATIVE_INFINITY;
  }

  const version = new Date(message.updatedAt ?? message.createdAt).getTime();
  return Number.isFinite(version) ? version : Number.NEGATIVE_INFINITY;
};

const messageIdentityKey = (message: Message) => {
  return message.clientMessageId ? `client:${message.clientMessageId}` : `id:${message._id}`;
};

const messageIdentityKeys = (message: Message) => {
  const keys: string[] = [];

  if (message.clientMessageId) {
    keys.push(`client:${message.clientMessageId}`);
  }

  if (message._id) {
    keys.push(`id:${message._id}`);
  }

  return keys.length > 0 ? keys : [messageIdentityKey(message)];
};

const mergeUniqueStrings = (left: string[] = [], right: string[] = []) => {
  return Array.from(new Set([...left, ...right].filter((value): value is string => Boolean(value))));
};

const compareMessageTimeline = (left: Message, right: Message) => {
  const leftTime = new Date(left.createdAt).getTime();
  const rightTime = new Date(right.createdAt).getTime();

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return left._id.localeCompare(right._id);
};

const mergeReadByEntries = (left: Message['readBy'] = [], right: Message['readBy'] = []) => {
  const entries = new Map<string, NonNullable<Message['readBy']>[number]>();

  const addEntry = (entry: NonNullable<Message['readBy']>[number]) => {
    const user = entry.user;
    const userId = user?.toString?.() ?? user;

    if (!userId) {
      return;
    }

    const readAt = entry.readAt ?? null;
    const current = entries.get(userId);

    if (!current) {
      entries.set(userId, { user: userId, readAt });
      return;
    }

    const currentTime = current.readAt ? new Date(current.readAt).getTime() : Number.POSITIVE_INFINITY;
    const nextTime = readAt ? new Date(readAt).getTime() : Number.POSITIVE_INFINITY;

    if (nextTime < currentTime) {
      entries.set(userId, { user: userId, readAt });
    }
  };

  left.forEach(addEntry);
  right.forEach(addEntry);

  return Array.from(entries.values()).sort((a, b) => a.user.localeCompare(b.user));
};

const shouldPreferIncomingContent = (existing: Message | undefined, incoming: Message) => {
  if (!existing) {
    return true;
  }

  const existingOptimistic = isOptimisticMessage(existing);
  const incomingOptimistic = isOptimisticMessage(incoming);
  const sameClientMessageId = Boolean(
    existing.clientMessageId &&
    incoming.clientMessageId &&
    existing.clientMessageId === incoming.clientMessageId
  );

  if (existingOptimistic && sameClientMessageId && !incomingOptimistic) {
    return true;
  }

  if (!existingOptimistic && incomingOptimistic) {
    return false;
  }

  return messageVersionTime(incoming) >= messageVersionTime(existing);
};

export const mergeCanonicalMessage = (existing: Message | undefined, incoming: Message): Message => {
  const preferIncomingContent = shouldPreferIncomingContent(existing, incoming);
  const contentSource = preferIncomingContent ? incoming : existing ?? incoming;
  const mergedReadBy = mergeReadByEntries(existing?.readBy ?? [], incoming.readBy ?? []);
  const mergedDeletedFor = mergeUniqueStrings(existing?.deletedFor ?? [], incoming.deletedFor ?? []);
  const deletedForEveryone = Boolean(existing?.deletedForEveryone || incoming.deletedForEveryone);
  const shouldPreserveExistingDeletedAttachments = Boolean(
    deletedForEveryone &&
    existing?.attachments?.length &&
    (!incoming.attachments || incoming.attachments.length === 0)
  );
  const attachments = shouldPreserveExistingDeletedAttachments
    ? [...(existing?.attachments ?? [])]
    : preferIncomingContent
      ? [...(incoming.attachments ?? existing?.attachments ?? [])]
      : [...(existing?.attachments ?? incoming.attachments ?? [])];
  const status = statusRank[incoming.status] >= statusRank[existing?.status ?? 'sent']
    ? incoming.status
    : existing?.status ?? incoming.status;

  return {
    ...(existing ?? {}),
    ...contentSource,
    _id: incoming._id ?? existing?._id ?? contentSource._id,
    clientMessageId: incoming.clientMessageId ?? existing?.clientMessageId ?? null,
    chatId: incoming.chatId ?? existing?.chatId ?? contentSource.chatId,
    sender: incoming.sender ?? existing?.sender ?? contentSource.sender,
    text: deletedForEveryone ? '' : (preferIncomingContent ? incoming.text : existing?.text ?? incoming.text ?? ''),
    messageType: incoming.messageType ?? existing?.messageType ?? contentSource.messageType,
    encryptionMode: incoming.encryptionMode ?? existing?.encryptionMode ?? contentSource.encryptionMode,
    encryptedPayload: incoming.encryptedPayload ?? existing?.encryptedPayload ?? contentSource.encryptedPayload,
    replyTo: preferIncomingContent
      ? incoming.replyTo ?? existing?.replyTo ?? null
      : existing?.replyTo ?? incoming.replyTo ?? null,
    mentions: preferIncomingContent
      ? [...(incoming.mentions ?? existing?.mentions ?? [])]
      : [...(existing?.mentions ?? incoming.mentions ?? [])],
    decryptedText: incoming.decryptedText ?? existing?.decryptedText ?? contentSource.decryptedText,
    read: Boolean(existing?.read || incoming.read || status === 'read'),
    status,
    deliveredAt: existing?.deliveredAt ?? incoming.deliveredAt ?? null,
    readAt: existing?.readAt ?? incoming.readAt ?? null,
    readBy: mergedReadBy,
    reactions: preferIncomingContent ? [...(incoming.reactions ?? [])] : [...(existing?.reactions ?? incoming.reactions ?? [])],
    attachments: deletedForEveryone
      ? attachments.map((attachment) => ({ ...attachment, status: 'deleted' as const }))
      : attachments,
    localFiles: existing?.localFiles ?? incoming.localFiles,
    localDrafts: existing?.localDrafts ?? incoming.localDrafts,
    isEdited: Boolean(existing?.isEdited || incoming.isEdited),
    editedAt: existing?.editedAt ?? incoming.editedAt ?? null,
    deletedFor: mergedDeletedFor,
    deletedForEveryone,
    deletedBy: existing?.deletedBy ?? incoming.deletedBy ?? null,
    deletedAt: existing?.deletedAt ?? incoming.deletedAt ?? null,
    optimisticState: preferIncomingContent ? incoming.optimisticState : existing?.optimisticState,
    errorMessage: preferIncomingContent ? incoming.errorMessage : existing?.errorMessage,
    createdAt: preferIncomingContent ? incoming.createdAt ?? existing?.createdAt : existing?.createdAt ?? incoming.createdAt,
    updatedAt: preferIncomingContent ? incoming.updatedAt ?? existing?.updatedAt : existing?.updatedAt ?? incoming.updatedAt,
  };
};

export const reconcileFetchedMessagesInCache = (
  cache: MessagesCacheData | undefined,
  fetchedMessages: Message[],
  pagination?: PaginationInfo,
  cursor?: CursorPaginationInfo
): MessagesCacheData => {
  const existingMessages = cache?.messages ?? [];
  const fetchedBoundary = fetchedMessages[0] ?? null;
  const existingByIdentity = new Map<string, Message>();
  existingMessages.forEach((message) => {
    messageIdentityKeys(message).forEach((key) => {
      existingByIdentity.set(key, message);
    });
  });

  const findExistingMessage = (incoming: Message) => {
    for (const key of messageIdentityKeys(incoming)) {
      const existing = existingByIdentity.get(key);
      if (existing) {
        return existing;
      }
    }

    return undefined;
  };

  const retainedOlderMessages = fetchedBoundary
    ? existingMessages.filter((message) => !message.optimisticState && compareMessageTimeline(message, fetchedBoundary) < 0)
    : [];

  const retainedOptimisticMessages = existingMessages.filter((message) => {
    if (!message.optimisticState) {
      return false;
    }

    return !fetchedMessages.some((incoming) => messagesMatch(message, incoming));
  });

  const mergedFetchedMessages = fetchedMessages.map((incoming) => (
    mergeCanonicalMessage(findExistingMessage(incoming), incoming)
  ));

  return {
    messages: sortMessages([
      ...retainedOlderMessages,
      ...mergedFetchedMessages,
      ...retainedOptimisticMessages,
    ].reduce<Message[]>((accumulator, message) => upsertMessage(accumulator, message), [])),
    pagination,
    cursor,
  };
};

export const normalizeOutgoingMessageText = (value: string, options: { allowEmpty?: boolean } = {}) => {
  const text = value.trim();

  if (!text) {
    if (options.allowEmpty) {
      return { ok: true, text: '' } as const;
    }

    return {
      ok: false,
      message: 'Message text is required',
    } as const;
  }

  if (text.length > MAX_MESSAGE_TEXT_LENGTH) {
    return {
      ok: false,
      message: `Message exceeds maximum length of ${MAX_MESSAGE_TEXT_LENGTH} characters`,
    } as const;
  }

  return { ok: true, text } as const;
};

export const createClientMessageId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `client-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const createOptimisticMessage = ({
  chatId,
  senderId,
  text,
  clientMessageId,
  messageType = 'text',
  encryptionMode,
  encryptedPayload = null,
  replyTo = null,
  mentions = [],
  decryptedText,
  attachments = [],
  localFiles = [],
  localDrafts = [],
  createdAt = new Date().toISOString(),
}: CreateOptimisticMessageInput): Message => ({
  _id: `optimistic-${clientMessageId}`,
  clientMessageId,
  chatId,
  sender: senderId,
  text,
  messageType,
  encryptionMode,
  encryptedPayload,
  replyTo,
  mentions,
  decryptedText,
  read: false,
  status: 'sent',
  readBy: [],
  reactions: [],
  attachments,
  localFiles,
  localDrafts,
  deletedFor: [],
  deletedForEveryone: false,
  pinned: false,
  pinnedBy: null,
  pinnedAt: null,
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
  return Boolean(
    (left.clientMessageId && right.clientMessageId && left.clientMessageId === right.clientMessageId) ||
      (left._id && right._id && left._id === right._id)
  );
};

export const upsertMessage = (messages: Message[], incoming: Message) => {
  const existingIndex = messages.findIndex((message) => messagesMatch(message, incoming));

  if (existingIndex === -1) {
    return sortMessages([...messages, incoming]);
  }

  const nextMessages = [...messages];
  nextMessages[existingIndex] = mergeCanonicalMessage(nextMessages[existingIndex], incoming);

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
      message.clientMessageId === clientMessageId && message.optimisticState === 'sending'
        ? { ...message, optimisticState: 'failed', errorMessage }
        : message
    ),
  };
};

export const dismissOptimisticMessage = (
  cache: MessagesCacheData | undefined,
  clientMessageId: string
): MessagesCacheData | undefined => {
  if (!cache) {
    return cache;
  }

  return {
    ...cache,
    messages: cache.messages.filter((message) => (
      !(message.clientMessageId === clientMessageId && message.optimisticState === 'failed')
    )),
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
  const nextReadBy = mergeReadByEntries(message.readBy ?? [], patch.readBy ?? []);

  return {
    ...message,
    status: nextStatus,
    read: Boolean(message.read || patch.read || nextStatus === 'read'),
    deliveredAt: message.deliveredAt ?? patch.deliveredAt,
    readAt: message.readAt ?? patch.readAt,
    readBy: nextReadBy,
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

  if (!event.deleteForEveryone) {
    return {
      ...cache,
      messages: cache.messages.filter((message) => message._id !== event.messageId),
    };
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
