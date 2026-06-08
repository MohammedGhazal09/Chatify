import mongoose from 'mongoose';

export const MAX_MESSAGE_TEXT_LENGTH = 1000;
export const MAX_REACTION_TEXT_LENGTH = 32;
export const MAX_REACTIONS_PER_MESSAGE = 50;
export const DEFAULT_MESSAGE_HISTORY_LIMIT = 50;
export const MAX_MESSAGE_HISTORY_LIMIT = 100;
export const MESSAGE_STATUS = Object.freeze({
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
});
export const MESSAGE_STATUS_RANK = Object.freeze({
  [MESSAGE_STATUS.SENT]: 0,
  [MESSAGE_STATUS.DELIVERED]: 1,
  [MESSAGE_STATUS.READ]: 2,
});
export const MESSAGE_CURSOR_SORT_DESC = Object.freeze({ createdAt: -1, _id: -1 });
export const MESSAGE_CURSOR_SORT_ASC = Object.freeze({ createdAt: 1, _id: 1 });

const toPlainObject = (value) => value?.toObject?.() ?? value ?? {};

export const toIdString = (value) => {
  const candidate = value?._id ?? value;
  return candidate?.toString?.() ?? null;
};

export const toObjectId = (value) => {
  const normalizedValue = value?._id?.toString?.() ?? value?.toString?.() ?? value;

  if (!mongoose.Types.ObjectId.isValid(normalizedValue)) {
    return null;
  }

  return new mongoose.Types.ObjectId(normalizedValue);
};

export const idsEqual = (left, right) => {
  const leftId = toIdString(left);
  const rightId = toIdString(right);
  return Boolean(leftId && rightId && leftId === rightId);
};

export const normalizeMessageText = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Message text is required',
    };
  }

  if (text.length > MAX_MESSAGE_TEXT_LENGTH) {
    return {
      ok: false,
      statusCode: 400,
      message: `Message exceeds maximum length of ${MAX_MESSAGE_TEXT_LENGTH} characters`,
    };
  }

  return { ok: true, text };
};

export const normalizeClientMessageId = (value) => {
  if (value === undefined || value === null) {
    return { ok: true, clientMessageId: null };
  }

  const clientMessageId = typeof value === 'string' ? value.trim() : '';

  if (!clientMessageId) {
    return {
      ok: false,
      statusCode: 400,
      message: 'clientMessageId must be a non-empty string when provided',
    };
  }

  return { ok: true, clientMessageId };
};

const serializeDate = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const serializeReadBy = (readBy = []) => readBy.map((entry) => ({
  user: toIdString(entry.user),
  readAt: serializeDate(entry.readAt),
}));

export const serializeReactions = (reactions = []) => reactions.map((reaction) => ({
  user: toIdString(reaction.user),
  emoji: reaction.emoji,
}));

export const serializeMessage = (message) => {
  const plainMessage = toPlainObject(message);

  return {
    _id: toIdString(plainMessage._id),
    clientMessageId: plainMessage.clientMessageId ?? null,
    chatId: toIdString(plainMessage.chatId),
    sender: toIdString(plainMessage.sender),
    text: plainMessage.text ?? '',
    read: Boolean(plainMessage.read),
    status: plainMessage.status ?? MESSAGE_STATUS.SENT,
    deliveredAt: serializeDate(plainMessage.deliveredAt),
    readAt: serializeDate(plainMessage.readAt),
    readBy: serializeReadBy(plainMessage.readBy ?? []),
    reactions: serializeReactions(plainMessage.reactions ?? []),
    isEdited: Boolean(plainMessage.isEdited),
    editedAt: serializeDate(plainMessage.editedAt),
    deletedFor: (plainMessage.deletedFor ?? []).map((userId) => toIdString(userId)).filter(Boolean),
    deletedForEveryone: Boolean(plainMessage.deletedForEveryone),
    deletedBy: toIdString(plainMessage.deletedBy),
    deletedAt: serializeDate(plainMessage.deletedAt),
    createdAt: serializeDate(plainMessage.createdAt),
    updatedAt: serializeDate(plainMessage.updatedAt),
  };
};

export const buildVisibleMessageFilter = ({ chatId, userId, includeTombstones = true }) => {
  const chatObjectId = toObjectId(chatId);
  const userObjectId = toObjectId(userId);
  const filter = {
    chatId: chatObjectId,
    deletedFor: { $ne: userObjectId },
  };

  if (!includeTombstones) {
    filter.deletedForEveryone = { $ne: true };
  }

  return filter;
};

export const normalizeMessageHistoryLimit = (value) => {
  const parsedLimit = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    return DEFAULT_MESSAGE_HISTORY_LIMIT;
  }

  return Math.min(parsedLimit, MAX_MESSAGE_HISTORY_LIMIT);
};

export const encodeMessageCursor = (message) => {
  const serializedMessage = serializeMessage(message);

  if (!serializedMessage.createdAt || !serializedMessage._id) {
    return null;
  }

  return `${serializedMessage.createdAt}_${serializedMessage._id}`;
};

export const parseMessageCursor = (cursor) => {
  if (cursor === undefined || cursor === null || cursor === '') {
    return { ok: true, cursor: null };
  }

  if (typeof cursor !== 'string') {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid message cursor',
    };
  }

  const separatorIndex = cursor.lastIndexOf('_');

  if (separatorIndex <= 0) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid message cursor',
    };
  }

  const createdAtValue = cursor.slice(0, separatorIndex);
  const messageIdValue = cursor.slice(separatorIndex + 1);
  const createdAt = new Date(createdAtValue);
  const messageObjectId = toObjectId(messageIdValue);

  if (Number.isNaN(createdAt.getTime()) || !messageObjectId) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid message cursor',
    };
  }

  return {
    ok: true,
    cursor: {
      createdAt,
      _id: messageObjectId,
    },
  };
};

export const applyBeforeCursorFilter = (filter, cursor) => {
  if (!cursor) {
    return filter;
  }

  return {
    ...filter,
    $or: [
      { createdAt: { $lt: cursor.createdAt } },
      {
        createdAt: cursor.createdAt,
        _id: { $lt: cursor._id },
      },
    ],
  };
};

export const buildUnreadMessageFilter = ({ chatId, userId }) => {
  const chatObjectId = toObjectId(chatId);
  const userObjectId = toObjectId(userId);

  return {
    chatId: chatObjectId,
    sender: { $ne: userObjectId },
    'readBy.user': { $ne: userObjectId },
    deletedFor: { $ne: userObjectId },
    deletedForEveryone: { $ne: true },
  };
};

export const canUserSeeMessage = (message, userId) => {
  const plainMessage = toPlainObject(message);
  return !(plainMessage.deletedFor ?? []).some((deletedUserId) => idsEqual(deletedUserId, userId));
};

const isStatusAtLeast = (currentStatus, targetStatus) => {
  return MESSAGE_STATUS_RANK[currentStatus] >= MESSAGE_STATUS_RANK[targetStatus];
};

export const buildStatusPatch = (message) => {
  const serializedMessage = serializeMessage(message);

  return {
    _id: serializedMessage._id,
    messageId: serializedMessage._id,
    chatId: serializedMessage.chatId,
    status: serializedMessage.status,
    deliveredAt: serializedMessage.deliveredAt,
    readAt: serializedMessage.readAt,
    read: serializedMessage.read,
    readBy: serializedMessage.readBy,
  };
};

export const applyDeliveredStatus = (message, userId, now = new Date()) => {
  if (idsEqual(message.sender, userId) || message.deletedForEveryone) {
    return { changed: false, patch: buildStatusPatch(message) };
  }

  if (isStatusAtLeast(message.status, MESSAGE_STATUS.DELIVERED)) {
    return { changed: false, patch: buildStatusPatch(message) };
  }

  message.status = MESSAGE_STATUS.DELIVERED;
  message.deliveredAt = message.deliveredAt ?? now;

  return { changed: true, patch: buildStatusPatch(message) };
};

const allReadableMembersHaveRead = ({ message, chat, readerId }) => {
  const readerIds = new Set(
    (message.readBy ?? [])
      .map((entry) => toIdString(entry.user))
      .filter(Boolean)
  );

  if (readerId) {
    readerIds.add(toIdString(readerId));
  }

  return chat.members
    .filter((memberId) => !idsEqual(memberId, message.sender))
    .every((memberId) => readerIds.has(toIdString(memberId)));
};

export const applyReadStatus = (message, chat, readerId, now = new Date()) => {
  if (idsEqual(message.sender, readerId) || message.deletedForEveryone) {
    return { changed: false, patch: buildStatusPatch(message), readEntry: null };
  }

  let changed = false;
  let readEntry = null;
  const alreadyRead = (message.readBy ?? []).some((entry) => idsEqual(entry.user, readerId));

  if (!alreadyRead) {
    readEntry = { user: toObjectId(readerId), readAt: now };
    message.readBy.push(readEntry);
    changed = true;
  }

  if (allReadableMembersHaveRead({ message, chat, readerId })) {
    if (!isStatusAtLeast(message.status, MESSAGE_STATUS.READ)) {
      message.status = MESSAGE_STATUS.READ;
      changed = true;
    }
    message.read = true;
    message.readAt = message.readAt ?? now;
    message.deliveredAt = message.deliveredAt ?? now;
  } else if (!isStatusAtLeast(message.status, MESSAGE_STATUS.DELIVERED)) {
    message.status = MESSAGE_STATUS.DELIVERED;
    message.deliveredAt = message.deliveredAt ?? now;
    changed = true;
  }

  return { changed, patch: buildStatusPatch(message), readEntry };
};

export const normalizeReactionEmoji = (value) => {
  const emoji = typeof value === 'string' ? value.trim() : '';

  if (!emoji) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Emoji is required',
    };
  }

  if (emoji.length > MAX_REACTION_TEXT_LENGTH) {
    return {
      ok: false,
      statusCode: 400,
      message: `Emoji exceeds maximum length of ${MAX_REACTION_TEXT_LENGTH} characters`,
    };
  }

  return { ok: true, emoji };
};

export const applyReactionToggle = (message, userId, emoji) => {
  const reactions = message.reactions ?? [];
  const existingReactionIndex = reactions.findIndex(
    (reaction) => idsEqual(reaction.user, userId) && reaction.emoji === emoji
  );

  if (existingReactionIndex > -1) {
    reactions.splice(existingReactionIndex, 1);
    return { ok: true, action: 'removed' };
  }

  if (reactions.length >= MAX_REACTIONS_PER_MESSAGE) {
    return {
      ok: false,
      statusCode: 400,
      message: `Maximum ${MAX_REACTIONS_PER_MESSAGE} reactions allowed per message`,
    };
  }

  reactions.push({ user: toObjectId(userId), emoji });
  message.reactions = reactions;

  return { ok: true, action: 'added' };
};
