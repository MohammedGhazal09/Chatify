import mongoose from 'mongoose';
import multer from 'multer';
import { createHash } from 'node:crypto';
import Attachment from '../Models/attachmentModel.mjs';
import Message from '../Models/messageModel.mjs';
import Chats from '../Models/chatModel.mjs';
import User from '../Models/userModel.mjs';
import SavedMessage from '../Models/savedMessageModel.mjs';
import asyncErrorHandler from '../Utils/asyncErrHandler.mjs';
import { emitToUserSockets, getIO } from '../Config/socket.mjs';
import {
  deleteAttachmentFile,
  openAttachmentDownloadStream,
  uploadAttachmentBuffer,
} from '../Services/attachmentStorageService.mjs';
import {
  ATTACHMENT_ERROR_CODES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_SIZE_BYTES,
  normalizeSharedAssetKind,
  normalizeSharedAssetLimit,
  validateIncomingAttachments,
} from '../Utils/attachmentValidation.mjs';
import {
  applyReactionToggle,
  applyBeforeCursorFilter,
  buildUnreadMessageFilter,
  buildVisibleMessageFilter,
  buildReplyToSnapshot,
  canUserSeeMessage,
  encodeMessageCursor,
  buildReadReceiptUpdatePipeline,
  hasReceiptStateChanged,
  normalizeClientMessageId,
  normalizeMessageHistoryLimit,
  normalizeMessageSearchLimit,
  normalizeMessageSearchFilters,
  normalizeMessageText,
  normalizeEncryptedPayload,
  normalizeReactionEmoji,
  parseMessageCursor,
  MESSAGE_SEARCH_ATTACHMENT_TYPES,
  MESSAGE_SEARCH_TYPES,
  MESSAGE_STATUS,
  MESSAGE_CURSOR_SORT_ASC,
  MESSAGE_CURSOR_SORT_DESC,
  URL_TEXT_REGEX_SOURCE,
  buildStatusPatch,
  serializeAttachmentSummary,
  serializeMessage,
  serializePinnedMessage,
  toIdString,
  toObjectId,
} from '../Utils/messageState.mjs';
import {
  fingerprintMentions,
  pruneMentionsForText,
  resolveMessageMentions,
} from '../Utils/messageMentions.mjs';
import { assertConversationActivityAllowed } from '../Utils/conversationControls.mjs';
import { CHAT_ENCRYPTION_MODES, isEncryptedConversation, normalizeChatEncryptionMode } from '../Utils/encryptionMode.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';
import { enqueueMessageNotifications } from '../Services/notificationService.mjs';

const PINNED_MESSAGES_LIMIT = 50;
const SAVED_MESSAGES_LIMIT = 50;
const SHARED_ASSET_CURSOR_SORT_DESC = Object.freeze({ createdAt: -1, _id: -1 });
const PRIVATE_ATTACHMENT_ERROR = 'Attachment not found';
const MESSAGE_CONTEXT_LIMIT = 25;
const PRIVATE_REPLY_SOURCE_ERROR = 'Original message is not available';
const PUBLIC_SAVED_CHAT_MEMBER_SELECT = 'username firstName lastName profilePic profileBio identityMark identityMarkUpdatedAt';

const respondWithChatAccessError = (res, statusCode, message) => {
  res.status(statusCode).json({
    status: 'fail',
    message,
  });
};

const isAttachmentSearchType = (type) => MESSAGE_SEARCH_ATTACHMENT_TYPES.includes(type);

const buildSearchDateFilter = ({ from, to }) => {
  if (!from && !to) {
    return {};
  }

  const createdAt = {};

  if (from) {
    createdAt.$gte = from;
  }

  if (to) {
    createdAt.$lte = to;
  }

  return { createdAt };
};

const getAttachmentSearchMatches = async ({ chatId, type, escapedQuery }) => {
  const typedAttachmentQuery = {
    chatId,
    status: 'active',
  };

  if (isAttachmentSearchType(type)) {
    typedAttachmentQuery.kind = type;
  }

  const shouldLoadTypedAttachments = isAttachmentSearchType(type);
  const shouldLoadNameMatches = Boolean(escapedQuery) && (
    type === MESSAGE_SEARCH_TYPES.ALL ||
    isAttachmentSearchType(type)
  );
  const [typedAttachments, namedAttachments] = await Promise.all([
    shouldLoadTypedAttachments
      ? Attachment.find(typedAttachmentQuery).select('messageId displayName kind').lean()
      : Promise.resolve([]),
    shouldLoadNameMatches
      ? Attachment.find({
        ...typedAttachmentQuery,
        displayName: { $regex: escapedQuery, $options: 'i' },
      }).select('messageId displayName kind').lean()
      : Promise.resolve([]),
  ]);
  const typedMessageIds = typedAttachments.map((attachment) => attachment.messageId);
  const namedMessageIds = namedAttachments.map((attachment) => attachment.messageId);
  const attachmentsByMessageId = new Map();

  [...typedAttachments, ...namedAttachments].forEach((attachment) => {
    const messageId = attachment.messageId?.toString?.();

    if (!messageId || attachmentsByMessageId.has(messageId)) {
      return;
    }

    attachmentsByMessageId.set(messageId, attachment);
  });

  return {
    typedMessageIds,
    namedMessageIds,
    attachmentsByMessageId,
  };
};

const buildMessageSearchFilter = ({ chat, filters, attachmentMatches }) => {
  const messageFilter = {
    ...buildVisibleMessageFilter({
      chatId: chat._id,
      userId: filters.userObjectId,
      includeTombstones: false,
    }),
    ...buildSearchDateFilter(filters),
  };
  const andClauses = [];

  if (filters.senderId) {
    messageFilter.sender = filters.senderId;
  }

  if (filters.type === MESSAGE_SEARCH_TYPES.TEXT) {
    messageFilter.messageType = 'text';
    andClauses.push({ text: { $ne: '' } });
  }

  if (filters.type === MESSAGE_SEARCH_TYPES.LINK) {
    andClauses.push({ text: { $regex: URL_TEXT_REGEX_SOURCE, $options: 'i' } });
  }

  if (isAttachmentSearchType(filters.type)) {
    andClauses.push({ _id: { $in: attachmentMatches.typedMessageIds } });
  }

  if (filters.escapedQuery) {
    const searchOr = [{ text: { $regex: filters.escapedQuery, $options: 'i' } }];

    if (
      filters.type === MESSAGE_SEARCH_TYPES.ALL ||
      isAttachmentSearchType(filters.type)
    ) {
      searchOr.push({ _id: { $in: attachmentMatches.namedMessageIds } });
    }

    andClauses.push({ $or: searchOr });
  }

  if (andClauses.length > 0) {
    messageFilter.$and = andClauses;
  }

  return messageFilter;
};

const findUrlMatch = (text = '') => text.match(new RegExp(URL_TEXT_REGEX_SOURCE, 'i'))?.[0] ?? null;

const buildSearchMatch = ({ message, filters, attachmentMatches }) => {
  const messageText = message.text ?? '';
  const lowerText = messageText.toLowerCase();
  const lowerQuery = filters.query.toLowerCase();
  const attachment = attachmentMatches.attachmentsByMessageId.get(message._id.toString());

  if (filters.type === MESSAGE_SEARCH_TYPES.LINK) {
    const url = findUrlMatch(messageText);

    return {
      kind: 'link',
      label: 'Link',
      text: url,
    };
  }

  if (filters.query && lowerText.includes(lowerQuery)) {
    return {
      kind: 'text',
      label: 'Message text',
      text: filters.query,
    };
  }

  if (attachment) {
    return {
      kind: attachment.kind,
      label: `${attachment.kind[0].toUpperCase()}${attachment.kind.slice(1)} attachment`,
      attachmentName: attachment.displayName,
      attachmentKind: attachment.kind,
    };
  }

  if (filters.type === MESSAGE_SEARCH_TYPES.TEXT) {
    return {
      kind: 'text',
      label: 'Text message',
      text: filters.query || null,
    };
  }

  return {
    kind: 'message',
    label: 'Message',
    text: filters.query || null,
  };
};

const serializeSearchMessage = ({ message, filters, attachmentMatches }) => ({
  ...serializeMessage(message),
  searchMatch: buildSearchMatch({ message, filters, attachmentMatches }),
});

const serializeSearchFilters = (filters) => ({
  query: filters.query,
  type: filters.type,
  senderId: filters.senderId?.toString?.() ?? null,
  from: filters.from?.toISOString?.() ?? null,
  to: filters.to?.toISOString?.() ?? null,
});

const serializeDate = (value) => value?.toISOString?.() ?? value ?? null;

const serializeSavedPublicMember = (user) => {
  const userObject = user?.toObject?.() ?? user;

  if (!userObject) {
    return null;
  }

  return {
    _id: userObject._id?.toString?.() ?? userObject._id,
    username: userObject.username ?? '',
    firstName: userObject.firstName,
    lastName: userObject.lastName,
    profilePic: userObject.profilePic ?? '',
    profileBio: userObject.profileBio ?? '',
    identityMark: userObject.identityMark,
    identityMarkUpdatedAt: serializeDate(userObject.identityMarkUpdatedAt),
  };
};

const serializeSavedChat = (chat) => {
  const chatObject = chat?.toObject?.() ?? chat;

  if (!chatObject) {
    return null;
  }

  return {
    _id: chatObject._id?.toString?.() ?? chatObject._id,
    chatName: chatObject.chatName ?? '',
    isGroupChat: Boolean(chatObject.isGroupChat),
    isSpaceChannel: Boolean(chatObject.isSpaceChannel),
    space: chatObject.space?._id?.toString?.() ?? chatObject.space?.toString?.() ?? chatObject.space ?? null,
    spaceId: chatObject.space?._id?.toString?.() ?? chatObject.space?.toString?.() ?? chatObject.space ?? null,
    channelName: chatObject.channelName ?? '',
    channelKey: chatObject.channelKey ?? '',
    channelDescription: chatObject.channelDescription ?? '',
    encryptionMode: normalizeChatEncryptionMode(chatObject.encryptionMode),
    members: (chatObject.members ?? []).map(serializeSavedPublicMember).filter(Boolean),
    groupAdmin: serializeSavedPublicMember(chatObject.groupAdmin),
    createdAt: serializeDate(chatObject.createdAt),
    updatedAt: serializeDate(chatObject.updatedAt),
  };
};

const getMessageIdString = (message) => message?._id?.toString?.() ?? message?._id;

const getSavedEntriesByMessageId = async ({ userObjectId, messages }) => {
  const messageIds = messages
    .map((message) => message?._id)
    .filter(Boolean);

  if (messageIds.length === 0) {
    return new Map();
  }

  const savedEntries = await SavedMessage.find({
    user: userObjectId,
    message: { $in: messageIds },
  }).lean();

  return new Map(savedEntries.map((entry) => [entry.message.toString(), entry]));
};

const applySavedState = (serializedMessage, savedEntry = null) => ({
  ...serializedMessage,
  savedByRequester: Boolean(savedEntry),
  savedAt: serializeDate(savedEntry?.savedAt),
});

const serializeMessagesForRequester = async ({ messages, userObjectId }) => {
  const savedEntriesByMessageId = await getSavedEntriesByMessageId({
    userObjectId,
    messages,
  });

  return messages.map((message) => applySavedState(
    serializeMessage(message),
    savedEntriesByMessageId.get(getMessageIdString(message))
  ));
};

const isChatMember = (chat, userObjectId) => {
  const chatObject = chat?.toObject?.() ?? chat;
  return (chatObject?.members ?? []).some((member) => {
    const memberId = member?._id ?? member;
    return memberId?.toString?.() === userObjectId.toString();
  });
};

const serializeSavedMessage = ({ savedEntry, message, chat }) => {
  const savedAt = serializeDate(savedEntry.savedAt);
  const serializedMessage = applySavedState(serializeMessage(message), savedEntry);

  return {
    _id: savedEntry._id?.toString?.() ?? savedEntry._id,
    messageId: serializedMessage._id,
    chatId: serializedMessage.chatId,
    savedAt,
    savedByRequester: true,
    chat: serializeSavedChat(chat),
    message: {
      ...serializedMessage,
      savedAt,
      savedByRequester: true,
    },
  };
};

const populateSavedEntryForResponse = (savedEntry) => savedEntry.populate([
  { path: 'message' },
  {
    path: 'chat',
    populate: [
      { path: 'members', select: PUBLIC_SAVED_CHAT_MEMBER_SELECT },
      { path: 'groupAdmin', select: PUBLIC_SAVED_CHAT_MEMBER_SELECT },
    ],
  },
]);

const buildMessageWindowRangeFilter = ({ targetMessage, direction }) => {
  const createdAt = targetMessage.createdAt;
  const id = targetMessage._id;

  if (direction === 'before') {
    return {
      $or: [
        { createdAt: { $lt: createdAt } },
        { createdAt, _id: { $lt: id } },
      ],
    };
  }

  return {
    $or: [
      { createdAt: { $gt: createdAt } },
      { createdAt, _id: { $gt: id } },
    ],
  };
};

const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_BYTES,
    files: MAX_ATTACHMENTS_PER_MESSAGE,
  },
});

const parseAttachmentMetadata = (rawMetadata) => {
  if (Array.isArray(rawMetadata)) {
    return rawMetadata.map((entry) => {
      if (typeof entry !== 'string') {
        return entry;
      }

      try {
        return JSON.parse(entry);
      } catch {
        return {};
      }
    });
  }

  if (typeof rawMetadata !== 'string' || !rawMetadata.trim()) {
    return [];
  }

  try {
    const parsedMetadata = JSON.parse(rawMetadata);
    return Array.isArray(parsedMetadata) ? parsedMetadata : [];
  } catch {
    return [];
  }
};

export const parseMessageAttachments = (req, res, next) => {
  attachmentUpload.array('attachments', MAX_ATTACHMENTS_PER_MESSAGE)(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    const isTooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
    const isTooMany = error instanceof multer.MulterError && (
      error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
    );

    res.status(400).json({
      status: 'fail',
      code: isTooMany
        ? ATTACHMENT_ERROR_CODES.COUNT_EXCEEDED
        : isTooLarge
          ? ATTACHMENT_ERROR_CODES.SIZE_EXCEEDED
          : 'ATTACHMENT_UPLOAD_INVALID',
      message: isTooMany
        ? `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments allowed per message`
        : isTooLarge
          ? 'Attachment exceeds the 10 MB attachment limit'
          : 'Attachment upload is invalid',
    });
  });
};

const loadChatForUser = async (chatId, userObjectId, res, options = {}) => {
  const privateResourceMessage = options.privateResourceMessage ?? null;
  const privateResourceStatusCode = options.privateResourceStatusCode ?? null;

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    respondWithChatAccessError(res, 400, 'Invalid chat id');
    return null;
  }

  const chat = await Chats.findById(chatId);

  if (!chat) {
    respondWithChatAccessError(res, privateResourceStatusCode ?? 404, privateResourceMessage ?? 'Chat not found');
    return null;
  }

  const isMember = chat.members.some((memberId) => memberId.equals(userObjectId));

  if (!isMember) {
    respondWithChatAccessError(
      res,
      privateResourceStatusCode ?? 403,
      privateResourceMessage ?? 'You are not authorized to access this chat'
    );
    return null;
  }

  return chat;
};

const ensureConversationActivityAllowed = async ({ chat, userObjectId, res }) => {
  try {
    await assertConversationActivityAllowed({ chat, actorId: userObjectId });
    return true;
  } catch (error) {
    res.status(error.statusCode ?? 403).json({
      status: 'fail',
      code: error.code ?? 'conversation_blocked',
      message: error.message ?? 'Conversation activity is not available',
    });
    return false;
  }
};

const ensureMessagingAllowedByModeration = async ({ userObjectId, res }) => {
  const user = await User.findById(userObjectId).select('+moderation');

  if (!user) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return false;
  }

  const restrictedUntil = user?.moderation?.messagingRestrictedUntil;

  if (restrictedUntil && new Date(restrictedUntil).getTime() > Date.now()) {
    res.status(403).json({
      status: 'fail',
      code: 'moderation_restricted',
      message: 'Messaging is temporarily restricted after moderation review.',
      restrictedUntil,
    });
    return false;
  }

  return true;
};

const countUnreadForUser = (chatId, userId) => {
  return Message.countDocuments(buildUnreadMessageFilter({ chatId, userId }));
};

const emitUnreadCountToUser = async (chatId, userId) => {
  const count = await countUnreadForUser(chatId, userId);
  emitToUserSockets(userId, 'unread:update', {
    chatId: chatId.toString(),
    userId: userId.toString(),
    count,
  });
  return count;
};

const emitUnreadCountsForRecipients = async (chat, senderId) => {
  await Promise.all(
    chat.members
      .filter((memberId) => !memberId.equals(senderId))
      .map((memberId) => emitUnreadCountToUser(chat._id, memberId))
  );
};

const createAttachmentSummary = (attachment) => serializeAttachmentSummary({
  attachmentId: attachment._id,
  displayName: attachment.displayName,
  mimeType: attachment.mimeType,
  size: attachment.size,
  kind: attachment.kind,
  durationSeconds: attachment.durationSeconds,
  status: attachment.status,
  createdAt: attachment.createdAt,
});

const cleanupStoredAttachments = async (storedAttachments = []) => {
  await Promise.allSettled(storedAttachments.map(async (storedAttachment) => {
    if (storedAttachment.attachmentId) {
      await Attachment.deleteOne({ _id: storedAttachment.attachmentId });
    }

    if (storedAttachment.storageFileId) {
      await deleteAttachmentFile(storedAttachment.storageFileId);
    }
  }));
};

const storeMessageAttachments = async ({
  normalizedAttachments,
  chat,
  messageId,
  uploader,
}) => {
  const storedAttachments = [];

  try {
    for (const attachment of normalizedAttachments) {
      const storageFileId = await uploadAttachmentBuffer({
        buffer: attachment.buffer,
        filename: attachment.displayName,
        contentType: attachment.mimeType,
        metadata: {
          chatId: chat._id.toString(),
          messageId: messageId.toString(),
          uploader: uploader.toString(),
          kind: attachment.kind,
          durationSeconds: attachment.durationSeconds ?? null,
        },
      });
      const storedAttachment = { storageFileId };

      storedAttachments.push(storedAttachment);

      const createdAttachment = await Attachment.create({
        chatId: chat._id,
        messageId,
        uploader,
        storageFileId,
        displayName: attachment.displayName,
        originalExtension: attachment.originalExtension,
        mimeType: attachment.mimeType,
        size: attachment.size,
        kind: attachment.kind,
        durationSeconds: attachment.durationSeconds,
        hash: attachment.hash,
        status: 'active',
      });

      storedAttachment.attachmentId = createdAttachment._id;
      storedAttachment.summary = createAttachmentSummary(createdAttachment);
    }
  } catch (error) {
    await cleanupStoredAttachments(storedAttachments);
    throw error;
  }

  return storedAttachments;
};

const getMessageAttachmentFingerprint = (message) => message.attachmentFingerprint ?? '';
const getEncryptedPayloadFingerprint = (message) => message.encryptedPayloadFingerprint ?? '';
const serializeReplyFingerprintPayload = (replyTo = null) => {
  if (!replyTo?.messageId) {
    return null;
  }

  return {
    messageId: toIdString(replyTo.messageId),
    sender: toIdString(replyTo.sender),
    messageType: replyTo.messageType ?? 'text',
    textPreview: replyTo.textPreview ?? '',
    attachmentCount: Number.isFinite(Number(replyTo.attachmentCount))
      ? Number(replyTo.attachmentCount)
      : 0,
    isDeleted: Boolean(replyTo.isDeleted),
    isEncrypted: Boolean(replyTo.isEncrypted),
    createdAt: replyTo.createdAt
      ? new Date(replyTo.createdAt).toISOString()
      : null,
  };
};
const fingerprintReplyTo = (replyTo = null) => {
  const payload = serializeReplyFingerprintPayload(replyTo);

  return payload
    ? createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    : '';
};
const getMessageReplyFingerprint = (message) => message.replyFingerprint ?? fingerprintReplyTo(message.replyTo);
const getMessageMentionFingerprint = (message) => message.mentionFingerprint ?? '';
const normalizeRequestedReplyMessageId = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return toObjectId(value)?.toString?.() ?? value?.toString?.() ?? null;
};
const doesReplyRequestMatchMessage = (message, replyToMessageId) => (
  (toIdString(message.replyTo?.messageId) ?? null) === normalizeRequestedReplyMessageId(replyToMessageId)
);

const fingerprintEncryptedPayload = (payload) => createHash('sha256')
  .update(JSON.stringify({
    ciphertext: payload.ciphertext,
    iv: payload.iv,
    authTag: payload.authTag ?? null,
    algorithm: payload.algorithm,
    keyVersion: payload.keyVersion,
    senderDeviceId: payload.senderDeviceId,
    encryptedAt: payload.encryptedAt?.toISOString?.() ?? new Date(payload.encryptedAt).toISOString(),
    attachmentManifest: payload.attachmentManifest ?? null,
  }))
  .digest('hex');

const isSameIdempotentPayload = ({
  message,
  text,
  attachmentFingerprint,
  encryptedPayloadFingerprint = null,
  replyFingerprint = '',
  mentionFingerprint = '',
}) => {
  if (message.messageType === 'encrypted') {
    return encryptedPayloadFingerprint
      && getEncryptedPayloadFingerprint(message) === encryptedPayloadFingerprint;
  }

  return message.text === text
    && getMessageAttachmentFingerprint(message) === attachmentFingerprint
    && getMessageReplyFingerprint(message) === replyFingerprint
    && getMessageMentionFingerprint(message) === mentionFingerprint;
};

const logDeliveryLifecycle = (stage, metadata = {}) => {
  if (process.env.CHATIFY_DELIVERY_DIAGNOSTICS !== '1') {
    return;
  }

  logger.info('message.delivery.lifecycle', { stage, ...metadata });
};

const compareLatestCandidate = (candidate, current) => {
  const candidateTime = new Date(candidate.createdAt).getTime();
  const currentTime = new Date(current.createdAt).getTime();

  if (!Number.isFinite(candidateTime) || !Number.isFinite(currentTime)) {
    return 1;
  }

  if (candidateTime !== currentTime) {
    return candidateTime - currentTime;
  }

  return candidate._id.toString().localeCompare(current._id.toString());
};

const shouldSetLatestMessage = async (chatId, message) => {
  const currentChat = await Chats.findById(chatId).select('latestMessage').lean();
  const currentLatestId = currentChat?.latestMessage;

  if (!currentLatestId || currentLatestId.toString() === message._id.toString()) {
    return true;
  }

  const currentLatestMessage = await Message.findById(currentLatestId).select('createdAt').lean();

  if (!currentLatestMessage) {
    return true;
  }

  return compareLatestCandidate(message, currentLatestMessage) >= 0;
};

const refreshLatestMessage = async (chatId, message) => {
  if (!(await shouldSetLatestMessage(chatId, message))) {
    return;
  }

  await Chats.findByIdAndUpdate(chatId, {
    $set: { latestMessage: message._id },
  }, { new: true });
};

const finalizeMessageCreate = async ({
  chat,
  message,
  senderId,
  clientMessageId,
  idempotent = false,
}) => {
  await refreshLatestMessage(chat._id, message);

  const serializedMessage = serializeMessage(message);

  try {
    const io = getIO();
    logDeliveryLifecycle('socket.emit.message_new', {
      chatId: chat._id.toString(),
      messageId: message._id.toString(),
      clientMessageId,
      actorRole: 'sender',
      status: message.status,
      idempotent,
    });
    io.in(chat._id.toString()).emit('message:new', serializedMessage);
    await emitUnreadCountsForRecipients(chat, senderId);
  } catch (err) {
    logger.error('message.socket_emit_failed', {
      chatId: chat._id.toString(),
      messageId: message._id.toString(),
      clientMessageId,
      error: err,
    });
  }

  return serializedMessage;
};

const encodeSharedAssetCursor = (attachment) => {
  if (!attachment?.createdAt || !attachment?._id) {
    return null;
  }

  const createdAt = attachment.createdAt instanceof Date
    ? attachment.createdAt.toISOString()
    : new Date(attachment.createdAt).toISOString();

  return `${createdAt}_${attachment._id.toString()}`;
};

const parseSharedAssetCursor = (cursor) => {
  if (cursor === undefined || cursor === null || cursor === '') {
    return { ok: true, cursor: null };
  }

  if (typeof cursor !== 'string') {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid shared asset cursor',
    };
  }

  const separatorIndex = cursor.lastIndexOf('_');

  if (separatorIndex <= 0) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid shared asset cursor',
    };
  }

  const createdAt = new Date(cursor.slice(0, separatorIndex));
  const _id = toObjectId(cursor.slice(separatorIndex + 1));

  if (Number.isNaN(createdAt.getTime()) || !_id) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Invalid shared asset cursor',
    };
  }

  return { ok: true, cursor: { createdAt, _id } };
};

const applySharedAssetCursorFilter = (filter, cursor) => {
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

const serializeSharedAsset = (attachment) => ({
  _id: attachment._id.toString(),
  attachmentId: attachment._id.toString(),
  messageId: attachment.messageId.toString(),
  chatId: attachment.chatId.toString(),
  uploader: attachment.uploader.toString(),
  displayName: attachment.displayName,
  mimeType: attachment.mimeType,
  size: attachment.size,
  kind: attachment.kind,
  durationSeconds: Number.isFinite(Number(attachment.durationSeconds))
    ? Number(attachment.durationSeconds)
    : null,
  status: attachment.status,
  createdAt: attachment.createdAt?.toISOString?.() ?? null,
});

const loadVisibleAttachmentForUser = async ({ attachmentId, userObjectId, res }) => {
  if (!mongoose.Types.ObjectId.isValid(attachmentId)) {
    respondWithChatAccessError(res, 404, PRIVATE_ATTACHMENT_ERROR);
    return null;
  }

  const attachment = await Attachment.findById(attachmentId);

  if (!attachment || attachment.status !== 'active') {
    respondWithChatAccessError(res, 404, PRIVATE_ATTACHMENT_ERROR);
    return null;
  }

  const message = await Message.findById(attachment.messageId).select('+attachmentFingerprint');

  if (!message || message.deletedForEveryone || !canUserSeeMessage(message, userObjectId)) {
    respondWithChatAccessError(res, 404, PRIVATE_ATTACHMENT_ERROR);
    return null;
  }

  const chat = await loadChatForUser(attachment.chatId.toString(), userObjectId, res, {
    privateResourceMessage: PRIVATE_ATTACHMENT_ERROR,
    privateResourceStatusCode: 404,
  });

  if (!chat) {
    return null;
  }

  return { attachment, message, chat };
};

const emitPinEvent = async ({ chat, eventName, message }) => {
  try {
    const io = getIO();
    const serializedMessage = serializeMessage(message);

    io.in(chat._id.toString()).emit(eventName, {
      chatId: chat._id.toString(),
      messageId: message._id.toString(),
      message: serializedMessage,
      pinnedMessage: serializePinnedMessage(message),
    });
  } catch (err) {
    logger.error('message.pin_emit_failed', {
      chatId: chat._id.toString(),
      messageId: message._id.toString(),
      eventName,
      error: err,
    });
  }
};

const promoteMessageReadState = async ({ message, chat, userObjectId }) => {
  const updatedMessage = await Message.findOneAndUpdate(
    {
      _id: message._id,
      status: { $ne: MESSAGE_STATUS.READ },
      sender: { $ne: userObjectId },
      deletedForEveryone: { $ne: true },
      deletedFor: { $ne: userObjectId },
    },
    buildReadReceiptUpdatePipeline({
      readerId: userObjectId,
      chatMemberIds: chat.members,
      senderId: message.sender,
    }),
    { new: true }
  );

  const sourceMessage = updatedMessage ?? message;
  const readByEntry = sourceMessage.readBy?.find((entry) => (
    entry.user?.equals?.(userObjectId) || entry.user?.toString?.() === userObjectId.toString()
  )) ?? null;
  const readEntry = readByEntry
    ? {
        user: readByEntry.user,
        readAt: readByEntry.readAt,
      }
    : null;

  if (updatedMessage && hasReceiptStateChanged(message, updatedMessage)) {
    return { changed: true, message: updatedMessage, readEntry };
  }

  if (updatedMessage) {
    return { changed: false, message: updatedMessage, readEntry };
  }

  return { changed: false, message, readEntry: null };
};

const resolveReplyToSnapshot = async ({ replyToMessageId, chat, userObjectId, res }) => {
  if (replyToMessageId === undefined || replyToMessageId === null || replyToMessageId === '') {
    return { ok: true, replyTo: null, replyFingerprint: '' };
  }

  const replyToObjectId = toObjectId(replyToMessageId);

  if (!replyToObjectId) {
    respondWithChatAccessError(res, 404, PRIVATE_REPLY_SOURCE_ERROR);
    return { ok: false };
  }

  const sourceMessage = await Message.findOne({
    ...buildVisibleMessageFilter({
      chatId: chat._id,
      userId: userObjectId,
      includeTombstones: false,
    }),
    _id: replyToObjectId,
  });

  if (!sourceMessage) {
    respondWithChatAccessError(res, 404, PRIVATE_REPLY_SOURCE_ERROR);
    return { ok: false };
  }

  const replyTo = buildReplyToSnapshot(sourceMessage);

  return {
    ok: true,
    replyTo,
    replyFingerprint: fingerprintReplyTo(replyTo),
  };
};

const createEncryptedMessage = async ({
  req,
  res,
  chat,
  userObjectId,
  clientMessageId,
  incomingFiles,
  text,
}) => {
  if (req.body?.replyToMessageId) {
    res.status(400).json({
      status: 'fail',
      code: 'encrypted_replies_unavailable',
      message: 'Replies are unavailable in encrypted conversations in this release.',
    });
    return true;
  }

  if (req.body?.mentionUserIds) {
    res.status(400).json({
      status: 'fail',
      code: 'encrypted_mentions_unavailable',
      message: 'Mentions are unavailable in encrypted conversations in this release.',
    });
    return true;
  }

  if (incomingFiles.length > 0) {
    res.status(400).json({
      status: 'fail',
      code: 'encrypted_attachments_unavailable',
      message: 'Encrypted attachment upload is not available in this release.',
    });
    return true;
  }

  if (typeof text === 'string' && text.trim().length > 0) {
    res.status(400).json({
      status: 'fail',
      code: 'encrypted_plaintext_rejected',
      message: 'Encrypted conversations require encryptedPayload and cannot send plaintext text.',
    });
    return true;
  }

  const normalizedEncryptedPayload = normalizeEncryptedPayload(req.body?.encryptedPayload);

  if (!normalizedEncryptedPayload.ok) {
    res.status(normalizedEncryptedPayload.statusCode).json({
      status: 'fail',
      code: 'encrypted_payload_invalid',
      message: normalizedEncryptedPayload.message,
    });
    return true;
  }

  const normalizedClientMessageId = normalizeClientMessageId(clientMessageId);

  if (!normalizedClientMessageId.ok) {
    res.status(normalizedClientMessageId.statusCode).json({
      status: 'fail',
      message: normalizedClientMessageId.message,
    });
    return true;
  }

  if (!normalizedClientMessageId.clientMessageId) {
    res.status(400).json({
      status: 'fail',
      message: 'clientMessageId is required',
    });
    return true;
  }

  const encryptedPayloadFingerprint = fingerprintEncryptedPayload(normalizedEncryptedPayload.payload);
  const idempotencyFilter = {
    chatId: chat._id,
    sender: userObjectId,
    clientMessageId: normalizedClientMessageId.clientMessageId,
  };
  const existingMessage = await Message.findOne(idempotencyFilter).select('+encryptedPayloadFingerprint');

  if (existingMessage) {
    if (!isSameIdempotentPayload({
      message: existingMessage,
      encryptedPayloadFingerprint,
    })) {
      res.status(409).json({
        status: 'fail',
        message: 'clientMessageId already exists with different encrypted payload',
      });
      return true;
    }

    const serializedMessage = await finalizeMessageCreate({
      chat,
      message: existingMessage,
      senderId: userObjectId,
      clientMessageId: normalizedClientMessageId.clientMessageId,
      idempotent: true,
    });

    res.status(200).json({
      status: 'message already created',
      data: {
        message: serializedMessage,
        idempotent: true,
      },
    });
    return true;
  }

  let message;

  try {
    message = await Message.create({
      chatId: chat._id,
      sender: userObjectId,
      clientMessageId: normalizedClientMessageId.clientMessageId,
      text: '',
      messageType: 'encrypted',
      encryptionMode: CHAT_ENCRYPTION_MODES.E2EE_V1,
      encryptedPayload: normalizedEncryptedPayload.payload,
      encryptedPayloadFingerprint,
      status: 'sent',
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicateMessage = await Message.findOne(idempotencyFilter).select('+encryptedPayloadFingerprint');

      if (duplicateMessage && isSameIdempotentPayload({
        message: duplicateMessage,
        encryptedPayloadFingerprint,
      })) {
        const serializedMessage = await finalizeMessageCreate({
          chat,
          message: duplicateMessage,
          senderId: userObjectId,
          clientMessageId: normalizedClientMessageId.clientMessageId,
          idempotent: true,
        });

        res.status(200).json({
          status: 'message already created',
          data: {
            message: serializedMessage,
            idempotent: true,
          },
        });
        return true;
      }
    }

    throw error;
  }

  const serializedMessage = await finalizeMessageCreate({
    chat,
    message,
    senderId: userObjectId,
    clientMessageId: normalizedClientMessageId.clientMessageId,
  });

  try {
    await enqueueMessageNotifications({
      chat,
      message,
      senderId: userObjectId,
    });
  } catch (error) {
    logger.error('notification.enqueue_failed', {
      chatId: chat._id.toString(),
      messageId: message._id.toString(),
      error,
    });
  }

  res.status(201).json({
    status: 'message created successfully',
    data: {
      message: serializedMessage,
    },
  });
  return true;
};

export const newMessage = asyncErrorHandler(async (req, res) => {
  const { chatId, text, clientMessageId, replyToMessageId, mentionUserIds } = req.body ?? {};
  const incomingFiles = Array.isArray(req.files) ? req.files : [];
  const attachmentMetadata = parseAttachmentMetadata(req.body?.attachmentMetadata);

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;

  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const chat = await loadChatForUser(chatId, userObjectId, res);

  if (!chat) {
    return;
  }

  if (!(await ensureConversationActivityAllowed({ chat, userObjectId, res }))) {
    return;
  }

  if (!(await ensureMessagingAllowedByModeration({ userObjectId, res }))) {
    return;
  }

  if (isEncryptedConversation(chat.encryptionMode)) {
    await createEncryptedMessage({
      req,
      res,
      chat,
      userObjectId,
      clientMessageId,
      incomingFiles,
      text,
    });
    return;
  }

  const validatedAttachments = await validateIncomingAttachments(incomingFiles, {
    metadata: attachmentMetadata,
  });

  if (!validatedAttachments.ok) {
    res.status(validatedAttachments.statusCode).json({
      status: 'fail',
      code: validatedAttachments.code,
      message: validatedAttachments.message,
    });
    return;
  }

  const hasAttachments = validatedAttachments.attachments.length > 0;
  const normalizedText = normalizeMessageText(text, { allowEmpty: hasAttachments });

  if (!normalizedText.ok) {
    res.status(normalizedText.statusCode).json({
      status: 'fail',
      message: normalizedText.message,
    });
    return;
  }

  const normalizedClientMessageId = normalizeClientMessageId(clientMessageId);

  if (!normalizedClientMessageId.ok) {
    res.status(normalizedClientMessageId.statusCode).json({
      status: 'fail',
      message: normalizedClientMessageId.message,
    });
    return;
  }

  if (!normalizedClientMessageId.clientMessageId) {
    res.status(400).json({
      status: 'fail',
      message: 'clientMessageId is required',
    });
    return;
  }

  const idempotencyFilter = normalizedClientMessageId.clientMessageId
    ? {
        chatId: chat._id,
        sender: userObjectId,
        clientMessageId: normalizedClientMessageId.clientMessageId,
      }
    : null;
  const attachmentFingerprint = validatedAttachments.fingerprint;
  const mentionResolution = await resolveMessageMentions({
    chat,
    senderId: userObjectId,
    text: normalizedText.text,
    mentionUserIds,
  });

  if (!mentionResolution.ok) {
    res.status(mentionResolution.statusCode).json({
      status: 'fail',
      message: mentionResolution.message,
    });
    return;
  }

  const mentionFingerprint = mentionResolution.mentionFingerprint;

  let message;

  if (idempotencyFilter) {
    logDeliveryLifecycle('create.lookup', {
      chatId: chat._id.toString(),
      clientMessageId: normalizedClientMessageId.clientMessageId,
      actorRole: 'sender',
    });

    message = await Message.findOne(idempotencyFilter).select('+attachmentFingerprint +replyFingerprint +mentionFingerprint');

    if (message) {
      if (!doesReplyRequestMatchMessage(message, replyToMessageId) || !isSameIdempotentPayload({
          message,
          text: normalizedText.text,
          attachmentFingerprint,
          replyFingerprint: getMessageReplyFingerprint(message),
          mentionFingerprint,
        })) {
          res.status(409).json({
            status: 'fail',
            message: 'clientMessageId already exists with different message text, attachment payload, reply target, or mentions',
          });
          return;
        }

      logDeliveryLifecycle('create.idempotent', {
        chatId: chat._id.toString(),
        messageId: message._id.toString(),
        clientMessageId: normalizedClientMessageId.clientMessageId,
        actorRole: 'sender',
        status: message.status,
        idempotent: true,
      });

      const serializedMessage = await finalizeMessageCreate({
        chat,
        message,
        senderId: userObjectId,
        clientMessageId: normalizedClientMessageId.clientMessageId,
        idempotent: true,
      });

      res.status(200).json({
        status: 'message already created',
        data: {
          message: serializedMessage,
          idempotent: true,
        },
      });
      return;
    }
  }

  const replyResolution = await resolveReplyToSnapshot({
    replyToMessageId,
    chat,
    userObjectId,
    res,
  });

  if (!replyResolution.ok) {
    return;
  }

  const replyFingerprint = replyResolution.replyFingerprint;

  const messageObjectId = new mongoose.Types.ObjectId();
  let storedAttachments = [];

  try {
    storedAttachments = await storeMessageAttachments({
      normalizedAttachments: validatedAttachments.attachments,
      chat,
      messageId: messageObjectId,
      uploader: userObjectId,
    });

    message = await Message.create({
      _id: messageObjectId,
      chatId: chat._id,
      sender: userObjectId,
      clientMessageId: normalizedClientMessageId.clientMessageId ?? undefined,
      text: normalizedText.text,
      replyTo: replyResolution.replyTo ?? undefined,
      replyFingerprint: replyFingerprint || undefined,
      mentions: mentionResolution.mentions,
      mentionFingerprint: mentionFingerprint || undefined,
      attachments: storedAttachments.map((attachment) => attachment.summary),
      attachmentFingerprint,
      status: 'sent',
    });
  } catch (error) {
    await cleanupStoredAttachments(storedAttachments);

    if (error?.code === 11000 && idempotencyFilter) {
      const existingMessage = await Message.findOne(idempotencyFilter).select('+attachmentFingerprint +replyFingerprint +mentionFingerprint');

      if (existingMessage) {
        if (!isSameIdempotentPayload({
          message: existingMessage,
          text: normalizedText.text,
          attachmentFingerprint,
          replyFingerprint,
          mentionFingerprint,
        })) {
          res.status(409).json({
            status: 'fail',
            message: 'clientMessageId already exists with different message text, attachment payload, reply target, or mentions',
          });
          return;
        }

        const serializedMessage = await finalizeMessageCreate({
          chat,
          message: existingMessage,
          senderId: userObjectId,
          clientMessageId: normalizedClientMessageId.clientMessageId,
          idempotent: true,
        });

        res.status(200).json({
          status: 'message already created',
          data: {
            message: serializedMessage,
            idempotent: true,
          },
        });
        return;
      }
    }

    throw error;
  }

  const serializedMessage = await finalizeMessageCreate({
    chat,
    message,
    senderId: userObjectId,
    clientMessageId: normalizedClientMessageId.clientMessageId,
  });

  try {
    await enqueueMessageNotifications({
      chat,
      message,
      senderId: userObjectId,
    });
  } catch (error) {
    logger.error('notification.enqueue_failed', {
      chatId: chat._id.toString(),
      messageId: message._id.toString(),
      error,
    });
  }

  res.status(201).json({
    status: 'message created successfully',
    data: {
      message: serializedMessage,
    },
  });
});

export const getAllMessages = asyncErrorHandler(async (req, res) => {
  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;

  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const chat = await loadChatForUser(req.params.id, userObjectId, res);

  if (!chat) {
    return;
  }

  const limit = normalizeMessageHistoryLimit(req.query.limit);
  const parsedCursor = parseMessageCursor(req.query.before);

  if (!parsedCursor.ok) {
    res.status(parsedCursor.statusCode).json({
      status: 'fail',
      message: parsedCursor.message,
    });
    return;
  }

  const visibleMessageFilter = applyBeforeCursorFilter(
    buildVisibleMessageFilter({ chatId: chat._id, userId: userObjectId }),
    parsedCursor.cursor
  );
  const fetchedMessages = await Message.find(visibleMessageFilter)
    .sort(MESSAGE_CURSOR_SORT_DESC)
    .limit(limit + 1);
  const pageMessages = fetchedMessages.slice(0, limit);
  const hasMore = fetchedMessages.length > limit;
  const orderedMessages = pageMessages.reverse();
  const nextCursor = hasMore && orderedMessages.length > 0
    ? encodeMessageCursor(orderedMessages[0])
    : null;
  const serializedMessages = await serializeMessagesForRequester({
    messages: orderedMessages,
    userObjectId,
  });

  res.status(200).json({
    status: 'messages fetched successfully',
    data: {
      messages: serializedMessages,
      pagination: {
        currentPage: 1,
        totalPages: hasMore ? 2 : 1,
        totalMessages: undefined,
        hasMore,
        limit,
        nextCursor,
      },
      cursor: {
        nextCursor,
        hasMore,
        limit,
      },
      nextCursor,
      hasMore,
    },
  });
});

export const searchMessages = asyncErrorHandler(async (req, res) => {
  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;

  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const chat = await loadChatForUser(req.params.chatId, userObjectId, res, {
    privateResourceMessage: 'Forbidden or not found',
  });

  if (!chat) {
    return;
  }

  if (isEncryptedConversation(chat.encryptionMode)) {
    res.status(400).json({
      status: 'fail',
      code: 'encrypted_search_unavailable',
      message: 'Server-side search is not available for encrypted conversations.',
    });
    return;
  }

  const normalizedFilters = normalizeMessageSearchFilters(req.query);

  if (!normalizedFilters.ok) {
    res.status(normalizedFilters.statusCode).json({
      status: 'fail',
      message: normalizedFilters.message,
    });
    return;
  }

  const filters = {
    ...normalizedFilters,
    userObjectId,
  };
  const limit = normalizeMessageSearchLimit(req.query.limit);
  const attachmentMatches = await getAttachmentSearchMatches({
    chatId: chat._id,
    type: filters.type,
    escapedQuery: filters.escapedQuery,
  });
  const messageFilter = buildMessageSearchFilter({ chat, filters, attachmentMatches });
  const messages = await Message.find(messageFilter)
    .sort(MESSAGE_CURSOR_SORT_DESC)
    .limit(limit);

  res.status(200).json({
    status: 'messages searched successfully',
    data: {
      messages: messages.map((message) => serializeSearchMessage({ message, filters, attachmentMatches })),
      query: filters.query,
      limit,
      filters: serializeSearchFilters(filters),
    },
  });
});

export const getMessageContext = asyncErrorHandler(async (req, res) => {
  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;

  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const chat = await loadChatForUser(req.params.chatId, userObjectId, res, {
    privateResourceMessage: 'Forbidden or not found',
  });

  if (!chat) {
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.messageId)) {
    respondWithChatAccessError(res, 400, 'Invalid message id');
    return;
  }

  const targetMessageId = new mongoose.Types.ObjectId(req.params.messageId);
  const visibleMessageFilter = buildVisibleMessageFilter({
    chatId: chat._id,
    userId: userObjectId,
    includeTombstones: false,
  });
  const targetMessage = await Message.findOne({
    ...visibleMessageFilter,
    _id: targetMessageId,
  });

  if (!targetMessage) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  const requestedLimit = normalizeMessageHistoryLimit(req.query.limit);
  const limit = Math.min(requestedLimit, MESSAGE_CONTEXT_LIMIT);
  const beforeLimit = Math.floor((limit - 1) / 2);
  const afterLimit = Math.max(limit - 1 - beforeLimit, 0);
  const [olderMessagesDesc, newerMessages] = await Promise.all([
    beforeLimit > 0
      ? Message.find({
        ...visibleMessageFilter,
        ...buildMessageWindowRangeFilter({ targetMessage, direction: 'before' }),
      })
        .sort(MESSAGE_CURSOR_SORT_DESC)
        .limit(beforeLimit)
      : Promise.resolve([]),
    afterLimit > 0
      ? Message.find({
        ...visibleMessageFilter,
        ...buildMessageWindowRangeFilter({ targetMessage, direction: 'after' }),
      })
        .sort(MESSAGE_CURSOR_SORT_ASC)
        .limit(afterLimit)
      : Promise.resolve([]),
  ]);
  const olderMessages = [...olderMessagesDesc].reverse();
  const messages = [...olderMessages, targetMessage, ...newerMessages];
  const hasMoreBefore = beforeLimit > 0 && olderMessagesDesc.length === beforeLimit;
  const hasMoreAfter = afterLimit > 0 && newerMessages.length === afterLimit;
  const nextCursor = hasMoreBefore && messages.length > 0
    ? encodeMessageCursor(messages[0])
    : null;
  const serializedMessages = await serializeMessagesForRequester({
    messages,
    userObjectId,
  });

  res.status(200).json({
    status: 'message context fetched successfully',
    data: {
      targetMessageId: targetMessage._id.toString(),
      messages: serializedMessages,
      cursor: {
        nextCursor,
        hasMore: hasMoreBefore,
        limit,
      },
      context: {
        hasMoreBefore,
        hasMoreAfter,
        limit,
      },
    },
  });
});

export const previewAttachment = asyncErrorHandler(async (req, res) => {
  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;

  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const result = await loadVisibleAttachmentForUser({
    attachmentId: req.params.attachmentId,
    userObjectId,
    res,
  });

  if (!result) {
    return;
  }

  const { attachment } = result;
  const safeFilename = attachment.displayName.replace(/"/g, '');

  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Length', String(attachment.size));
  res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
  res.setHeader('Cache-Control', 'private, no-store');

  const stream = openAttachmentDownloadStream(attachment.storageFileId);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).json({ status: 'fail', message: PRIVATE_ATTACHMENT_ERROR });
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
});

export const downloadAttachment = asyncErrorHandler(async (req, res) => {
  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;

  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const result = await loadVisibleAttachmentForUser({
    attachmentId: req.params.attachmentId,
    userObjectId,
    res,
  });

  if (!result) {
    return;
  }

  const { attachment } = result;
  const safeFilename = attachment.displayName.replace(/"/g, '');

  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('Content-Length', String(attachment.size));
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Cache-Control', 'private, no-store');

  const stream = openAttachmentDownloadStream(attachment.storageFileId);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).json({ status: 'fail', message: PRIVATE_ATTACHMENT_ERROR });
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
});

export const listSharedAssets = asyncErrorHandler(async (req, res) => {
  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;

  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const chat = await loadChatForUser(req.params.chatId, userObjectId, res, {
    privateResourceMessage: 'Forbidden or not found',
  });

  if (!chat) {
    return;
  }

  const normalizedKind = normalizeSharedAssetKind(req.query.kind);

  if (!normalizedKind.ok) {
    res.status(normalizedKind.statusCode).json({
      status: 'fail',
      message: normalizedKind.message,
    });
    return;
  }

  const parsedCursor = parseSharedAssetCursor(req.query.cursor);

  if (!parsedCursor.ok) {
    res.status(parsedCursor.statusCode).json({
      status: 'fail',
      message: parsedCursor.message,
    });
    return;
  }

  const limit = normalizeSharedAssetLimit(req.query.limit);
  const visibleMessageIds = await Message.find(buildVisibleMessageFilter({
    chatId: chat._id,
    userId: userObjectId,
    includeTombstones: false,
  })).distinct('_id');
  const baseFilter = {
    chatId: chat._id,
    messageId: { $in: visibleMessageIds },
    status: 'active',
  };

  if (normalizedKind.kind) {
    baseFilter.kind = normalizedKind.kind;
  }

  const filter = applySharedAssetCursorFilter(baseFilter, parsedCursor.cursor);
  const fetchedAssets = await Attachment.find(filter)
    .sort(SHARED_ASSET_CURSOR_SORT_DESC)
    .limit(limit + 1);
  const assets = fetchedAssets.slice(0, limit);
  const hasMore = fetchedAssets.length > limit;
  const nextCursor = hasMore && assets.length > 0
    ? encodeSharedAssetCursor(assets.at(-1))
    : null;

  res.status(200).json({
    status: 'shared assets fetched successfully',
    data: {
      assets: assets.map((attachment) => serializeSharedAsset(attachment)),
      sharedAssets: assets.map((attachment) => serializeSharedAsset(attachment)),
      kind: normalizedKind.kind,
      cursor: {
        nextCursor,
        hasMore,
        limit,
      },
      nextCursor,
      hasMore,
    },
  });
});

export const listPinnedMessages = asyncErrorHandler(async (req, res) => {
  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;

  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const chat = await loadChatForUser(req.params.chatId, userObjectId, res, {
    privateResourceMessage: 'Forbidden or not found',
  });

  if (!chat) {
    return;
  }

  const messages = await Message.find({
    ...buildVisibleMessageFilter({
      chatId: chat._id,
      userId: userObjectId,
      includeTombstones: false,
    }),
    pinned: true,
  })
    .sort({ pinnedAt: -1, createdAt: -1 })
    .limit(PINNED_MESSAGES_LIMIT);

  res.status(200).json({
    status: 'pinned messages fetched successfully',
    data: {
      pinnedMessages: messages.map((message) => serializePinnedMessage(message)),
      messages: messages.map((message) => serializeMessage(message)),
      limit: PINNED_MESSAGES_LIMIT,
    },
  });
});

export const listSavedMessages = asyncErrorHandler(async (req, res) => {
  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const savedEntries = await SavedMessage.find({ user: userObjectId })
    .sort({ savedAt: -1, _id: -1 })
    .limit(SAVED_MESSAGES_LIMIT)
    .populate('message')
    .populate({
      path: 'chat',
      populate: [
        { path: 'members', select: PUBLIC_SAVED_CHAT_MEMBER_SELECT },
        { path: 'groupAdmin', select: PUBLIC_SAVED_CHAT_MEMBER_SELECT },
      ],
    });

  const visibleSavedMessages = savedEntries
    .filter((savedEntry) => {
      const message = savedEntry.message;
      const chat = savedEntry.chat;

      return Boolean(
        message &&
        chat &&
        isChatMember(chat, userObjectId) &&
        canUserSeeMessage(message, userObjectId) &&
        !message.deletedForEveryone
      );
    })
    .map((savedEntry) => serializeSavedMessage({
      savedEntry,
      message: savedEntry.message,
      chat: savedEntry.chat,
    }));

  res.status(200).json({
    status: 'saved messages fetched successfully',
    data: {
      savedMessages: visibleSavedMessages,
      messages: visibleSavedMessages.map((entry) => entry.message),
      limit: SAVED_MESSAGES_LIMIT,
    },
  });
});

export const saveMessage = asyncErrorHandler(async (req, res) => {
  const { messageId } = req.params;

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    respondWithChatAccessError(res, 400, 'Invalid message id');
    return;
  }

  const message = await Message.findById(messageId);

  if (!message) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  const chat = await loadChatForUser(message.chatId.toString(), userObjectId, res, {
    privateResourceMessage: 'Message not found',
    privateResourceStatusCode: 404,
  });

  if (!chat) {
    return;
  }

  if (!canUserSeeMessage(message, userObjectId) || message.deletedForEveryone) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  const savedEntry = await SavedMessage.findOneAndUpdate(
    {
      user: userObjectId,
      message: message._id,
    },
    {
      $setOnInsert: {
        user: userObjectId,
        message: message._id,
        chat: chat._id,
        savedAt: new Date(),
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
  const populatedSavedEntry = await populateSavedEntryForResponse(savedEntry);
  const serializedMessage = applySavedState(serializeMessage(message), savedEntry);

  res.status(200).json({
    status: 'success',
    data: {
      message: serializedMessage,
      savedMessage: serializeSavedMessage({
        savedEntry: populatedSavedEntry,
        message: populatedSavedEntry.message,
        chat: populatedSavedEntry.chat,
      }),
      savedByRequester: true,
    },
  });
});

export const unsaveMessage = asyncErrorHandler(async (req, res) => {
  const { messageId } = req.params;

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    respondWithChatAccessError(res, 400, 'Invalid message id');
    return;
  }

  const message = await Message.findById(messageId);

  if (!message) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  const chat = await loadChatForUser(message.chatId.toString(), userObjectId, res, {
    privateResourceMessage: 'Message not found',
    privateResourceStatusCode: 404,
  });

  if (!chat) {
    return;
  }

  if (!canUserSeeMessage(message, userObjectId) || message.deletedForEveryone) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  await SavedMessage.deleteOne({
    user: userObjectId,
    message: message._id,
  });

  res.status(200).json({
    status: 'success',
    data: {
      message: applySavedState(serializeMessage(message), null),
      savedMessage: null,
      savedByRequester: false,
    },
  });
});

export const pinMessage = asyncErrorHandler(async (req, res) => {
  const { messageId } = req.params;

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    respondWithChatAccessError(res, 400, 'Invalid message id');
    return;
  }

  const message = await Message.findById(messageId);

  if (!message) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  const chat = await loadChatForUser(message.chatId.toString(), userObjectId, res);
  if (!chat) {
    return;
  }

  if (!(await ensureConversationActivityAllowed({ chat, userObjectId, res }))) {
    return;
  }

  if (!canUserSeeMessage(message, userObjectId)) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  if (message.deletedForEveryone) {
    res.status(400).json({
      status: 'fail',
      message: 'Deleted messages cannot be pinned',
    });
    return;
  }

  if (!message.pinned) {
    const pinnedCount = await Message.countDocuments({
      chatId: chat._id,
      pinned: true,
      deletedForEveryone: { $ne: true },
    });

    if (pinnedCount >= PINNED_MESSAGES_LIMIT) {
      res.status(400).json({
        status: 'fail',
        message: `Maximum ${PINNED_MESSAGES_LIMIT} pinned messages allowed per chat`,
      });
      return;
    }

    message.pinned = true;
    message.pinnedBy = userObjectId;
    message.pinnedAt = new Date();
    await message.save();
  }

  await emitPinEvent({ chat, eventName: 'message:pinned', message });

  res.status(200).json({
    status: 'success',
    data: {
      message: serializeMessage(message),
      pinnedMessage: serializePinnedMessage(message),
    },
  });
});

export const unpinMessage = asyncErrorHandler(async (req, res) => {
  const { messageId } = req.params;

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    respondWithChatAccessError(res, 400, 'Invalid message id');
    return;
  }

  const message = await Message.findById(messageId);

  if (!message) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  const chat = await loadChatForUser(message.chatId.toString(), userObjectId, res);
  if (!chat) {
    return;
  }

  if (!(await ensureConversationActivityAllowed({ chat, userObjectId, res }))) {
    return;
  }

  if (!canUserSeeMessage(message, userObjectId)) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  if (message.pinned) {
    message.pinned = false;
    message.pinnedBy = undefined;
    message.pinnedAt = undefined;
    await message.save();
  }

  await emitPinEvent({ chat, eventName: 'message:unpinned', message });

  res.status(200).json({
    status: 'success',
    data: {
      message: serializeMessage(message),
      pinnedMessage: serializePinnedMessage(message),
    },
  });
});

// Mark a message as read
export const markMessageAsRead = asyncErrorHandler(async (req, res) => {
  const { messageId } = req.params;

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    respondWithChatAccessError(res, 400, 'Invalid message id');
    return;
  }

  const message = await Message.findById(messageId);

  if (!message) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  // Verify user is a member of the chat
  const chat = await loadChatForUser(message.chatId.toString(), userObjectId, res);
  if (!chat) {
    return;
  }

  if (!canUserSeeMessage(message, userObjectId)) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  if (!(await ensureConversationActivityAllowed({ chat, userObjectId, res }))) {
    return;
  }

  const readResult = await promoteMessageReadState({ message, chat, userObjectId });

  if (readResult.changed) {
    try {
      const io = getIO();
      const patch = buildStatusPatch(readResult.message);

      io.in(chat._id.toString()).emit('message:read', {
        ...patch,
        readerId: userObjectId.toString(),
        readEntry: readResult.readEntry
          ? {
              user: userObjectId.toString(),
              readAt: readResult.readEntry.readAt.toISOString(),
            }
          : null,
      });
      io.in(chat._id.toString()).emit('message:status-update', patch);
      await emitUnreadCountToUser(chat._id, userObjectId);
    } catch (err) {
      logger.error('message.read_receipt_emit_failed', {
        chatId: chat._id.toString(),
        messageId: message._id.toString(),
        userId: userObjectId.toString(),
        error: err,
      });
    }
  }

  const unreadCount = await countUnreadForUser(chat._id, userObjectId);

  res.status(200).json({
    status: 'success',
    data: {
      message: serializeMessage(readResult.message),
      receipt: buildStatusPatch(readResult.message),
      unreadCount,
    },
  });
});

// Mark multiple messages as read (batch operation)
export const markMessagesAsRead = asyncErrorHandler(async (req, res) => {
  const { chatId } = req.params;
  const { messageIds } = req.body ?? {};

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const chat = await loadChatForUser(chatId, userObjectId, res);
  if (!chat) {
    return;
  }

  if (!(await ensureConversationActivityAllowed({ chat, userObjectId, res }))) {
    return;
  }

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    res.status(400).json({
      status: 'fail',
      message: 'messageIds array is required',
    });
    return;
  }

  const validMessageIds = messageIds.filter(id => mongoose.Types.ObjectId.isValid(id));
  const visibleMessageFilter = buildVisibleMessageFilter({
    chatId: chat._id,
    userId: userObjectId,
    includeTombstones: false,
  });

  const messages = await Message.find({
    ...visibleMessageFilter,
    _id: { $in: validMessageIds },
    sender: { $ne: userObjectId },
  });

  const updatedMessages = [];
  const receiptPatches = [];

  for (const message of messages) {
    const readResult = await promoteMessageReadState({ message, chat, userObjectId });

    if (readResult.changed) {
      updatedMessages.push(readResult.message);
      receiptPatches.push(buildStatusPatch(readResult.message));
    }
  }

  const unreadCount = await countUnreadForUser(chat._id, userObjectId);

  // Emit socket events for all updated messages
  if (updatedMessages.length > 0) {
    try {
      const io = getIO();
      io.in(chat._id.toString()).emit('messages:read-batch', {
        chatId: chat._id.toString(),
        userId: userObjectId.toString(),
        messages: receiptPatches,
        receipts: receiptPatches,
      });
      await emitUnreadCountToUser(chat._id, userObjectId);
    } catch (err) {
      logger.error('message.batch_read_receipt_emit_failed', {
        chatId: chat._id.toString(),
        userId: userObjectId.toString(),
        updatedCount: updatedMessages.length,
        error: err,
      });
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      updatedCount: updatedMessages.length,
      messages: updatedMessages.map((message) => serializeMessage(message)),
      receipts: receiptPatches,
      unreadCount,
    },
  });
});

// Get unread message count for a chat
export const getUnreadCount = asyncErrorHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const chat = await loadChatForUser(chatId, userObjectId, res);
  if (!chat) {
    return;
  }

  const unreadCount = await countUnreadForUser(chat._id, userObjectId);

  res.status(200).json({
    status: 'success',
    data: {
      chatId: chat._id.toString(),
      unreadCount,
    },
  });
});

// Get batch unread counts for multiple chats
export const getBatchUnreadCounts = asyncErrorHandler(async (req, res) => {
  const { chatIds } = req.body ?? {};

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  if (!Array.isArray(chatIds) || chatIds.length === 0) {
    res.status(400).json({
      status: 'fail',
      message: 'chatIds array is required',
    });
    return;
  }

  // Limit batch size to prevent abuse
  const MAX_BATCH_SIZE = 100;
  if (chatIds.length > MAX_BATCH_SIZE) {
    res.status(400).json({
      status: 'fail',
      message: `Maximum ${MAX_BATCH_SIZE} chat IDs allowed per request`,
    });
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  // Validate all chat IDs and filter valid ones
  const validChatIds = chatIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

  // Find all chats where user is a member
  const userChats = await Chats.find({
    _id: { $in: validChatIds },
    members: userObjectId,
  }).select('_id');

  const userChatIds = userChats.map((chat) => chat._id);

  // Aggregate unread counts for all chats in one query
  const unreadCounts = await Message.aggregate([
    {
      $match: {
        chatId: { $in: userChatIds },
        sender: { $ne: userObjectId },
        'readBy.user': { $ne: userObjectId },
        deletedFor: { $ne: userObjectId },
        deletedForEveryone: { $ne: true },
      },
    },
    {
      $group: {
        _id: '$chatId',
        unreadCount: { $sum: 1 },
      },
    },
  ]);

  // Build result map including chats with 0 unread
  const countsMap = {};
  userChatIds.forEach((chatId) => {
    countsMap[chatId.toString()] = 0;
  });
  unreadCounts.forEach((item) => {
    countsMap[item._id.toString()] = item.unreadCount;
  });

  res.status(200).json({
    status: 'success',
    data: {
      counts: countsMap,
    },
  });
});

// Delete a message for the current user or tombstone it for everyone.
export const deleteMessage = asyncErrorHandler(async (req, res) => {
  const { messageId } = req.params;
  const { deleteForEveryone } = req.body ?? {};

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    respondWithChatAccessError(res, 400, 'Invalid message id');
    return;
  }

  const message = await Message.findById(messageId);

  if (!message) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  const chat = await loadChatForUser(message.chatId.toString(), userObjectId, res);
  if (!chat) {
    return;
  }

  if (!canUserSeeMessage(message, userObjectId)) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  if (deleteForEveryone) {
    if (!(await ensureConversationActivityAllowed({ chat, userObjectId, res }))) {
      return;
    }

    if (!message.sender.equals(userObjectId)) {
      respondWithChatAccessError(res, 403, 'You can only delete your own messages for everyone');
      return;
    }

    const shouldEmitDeletion = !message.deletedForEveryone;

    if (shouldEmitDeletion) {
      message.text = '';
      message.deletedForEveryone = true;
      message.deletedBy = userObjectId;
      message.deletedAt = new Date();
      message.reactions = [];
      message.attachments = (message.attachments ?? []).map((attachment) => ({
        ...(attachment.toObject?.() ?? attachment),
        status: 'deleted',
      }));
      await message.save();
      await Attachment.updateMany(
        { messageId: message._id },
        { $set: { status: 'deleted' } }
      );

      try {
        const io = getIO();
        const serializedMessage = serializeMessage(message);
        io.in(chat._id.toString()).emit('message:deleted', {
          ...serializedMessage,
          message: serializedMessage,
          messageId: serializedMessage._id,
          deleteForEveryone: true,
        });
        await Promise.all(chat.members.map((memberId) => emitUnreadCountToUser(chat._id, memberId)));
      } catch (err) {
        logger.error('message.delete_everyone_emit_failed', {
          chatId: chat._id.toString(),
          messageId: message._id.toString(),
          error: err,
        });
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Message deleted for everyone',
      data: {
        messageId,
        message: serializeMessage(message),
      },
    });
  } else {
    if (!message.deletedFor) {
      message.deletedFor = [];
    }

    const alreadyDeletedForUser = message.deletedFor.some((deletedUserId) => (
      deletedUserId.equals(userObjectId)
    ));

    if (!alreadyDeletedForUser) {
      message.deletedFor.push(userObjectId);
      await message.save();

      try {
        const serializedMessage = serializeMessage(message);
        emitToUserSockets(userObjectId, 'message:deleted', {
          ...serializedMessage,
          message: serializedMessage,
          messageId: serializedMessage._id,
          deleteForEveryone: false,
        });
        await emitUnreadCountToUser(chat._id, userObjectId);
      } catch (err) {
        logger.error('message.delete_self_emit_failed', {
          chatId: chat._id.toString(),
          messageId: message._id.toString(),
          userId: userObjectId.toString(),
          error: err,
        });
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Message deleted for you',
      data: {
        messageId,
        message: serializeMessage(message),
      },
    });
  }
});

// Edit a message (only sender can edit, within time limit)
export const editMessage = asyncErrorHandler(async (req, res) => {
  const { messageId } = req.params;
  const { text } = req.body ?? {};

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    respondWithChatAccessError(res, 400, 'Invalid message id');
    return;
  }

  const normalizedText = normalizeMessageText(text);

  if (!normalizedText.ok) {
    res.status(normalizedText.statusCode).json({
      status: 'fail',
      message: normalizedText.message,
    });
    return;
  }

  const message = await Message.findById(messageId);

  if (!message) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  const chat = await loadChatForUser(message.chatId.toString(), userObjectId, res);
  if (!chat) {
    return;
  }

  if (!(await ensureConversationActivityAllowed({ chat, userObjectId, res }))) {
    return;
  }

  if (!canUserSeeMessage(message, userObjectId)) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  if (message.deletedForEveryone) {
    res.status(400).json({
      status: 'fail',
      message: 'Deleted messages cannot be edited',
    });
    return;
  }

  if (message.messageType === 'encrypted') {
    res.status(400).json({
      status: 'fail',
      code: 'encrypted_edit_unavailable',
      message: 'Encrypted messages cannot be edited in this release.',
    });
    return;
  }

  if (!message.sender.equals(userObjectId)) {
    respondWithChatAccessError(res, 403, 'You can only edit your own messages');
    return;
  }

  const editTimeLimit = 15 * 60 * 1000;
  const messageAge = Date.now() - new Date(message.createdAt).getTime();
  if (messageAge > editTimeLimit) {
    res.status(400).json({
      status: 'fail',
      message: 'Messages can only be edited within 15 minutes of sending',
    });
    return;
  }

  message.text = normalizedText.text;
  const prunedMentions = pruneMentionsForText(message.mentions ?? [], normalizedText.text);
  message.mentions = prunedMentions;
  message.mentionFingerprint = fingerprintMentions(prunedMentions) || undefined;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  const serializedMessage = serializeMessage(message);

  try {
    const io = getIO();
    io.in(chat._id.toString()).emit('message:edited', {
      ...serializedMessage,
      message: serializedMessage,
      messageId: serializedMessage._id,
      chatId: serializedMessage.chatId,
      text: serializedMessage.text,
      isEdited: true,
      editedAt: serializedMessage.editedAt,
    });
  } catch (err) {
    logger.error('message.edit_emit_failed', {
      chatId: chat._id.toString(),
      messageId: message._id.toString(),
      error: err,
    });
  }

  res.status(200).json({
    status: 'success',
    data: { message: serializedMessage },
  });
});

// Add or toggle reaction on a message
export const toggleReaction = asyncErrorHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body ?? {};

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;
  try {
    userObjectId = new mongoose.Types.ObjectId(req.userId);
  } catch (error) {
    respondWithChatAccessError(res, 400, error.message);
    return;
  }

  const normalizedEmoji = normalizeReactionEmoji(emoji);

  if (!normalizedEmoji.ok) {
    res.status(normalizedEmoji.statusCode).json({
      status: 'fail',
      message: normalizedEmoji.message,
    });
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    res.status(400).json({
      status: 'fail',
      message: 'Invalid message ID',
    });
    return;
  }

  const message = await Message.findById(messageId);
  if (!message) {
    res.status(404).json({
      status: 'fail',
      message: 'Message not found',
    });
    return;
  }

  const chat = await loadChatForUser(message.chatId.toString(), userObjectId, res);
  if (!chat) {
    return;
  }

  if (!(await ensureConversationActivityAllowed({ chat, userObjectId, res }))) {
    return;
  }

  if (!canUserSeeMessage(message, userObjectId)) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  if (message.deletedForEveryone) {
    res.status(400).json({
      status: 'fail',
      message: 'Deleted messages cannot receive reactions',
    });
    return;
  }

  const reactionResult = applyReactionToggle(message, userObjectId, normalizedEmoji.emoji);

  if (!reactionResult.ok) {
    res.status(reactionResult.statusCode).json({
      status: 'fail',
      message: reactionResult.message,
    });
    return;
  }

  await message.save();
  const serializedMessage = serializeMessage(message);

  try {
    const io = getIO();
    io.in(chat._id.toString()).emit('message:reaction', {
      ...serializedMessage,
      message: serializedMessage,
      messageId: serializedMessage._id,
      chatId: serializedMessage.chatId,
      reactions: serializedMessage.reactions,
      action: reactionResult.action,
      userId: userObjectId.toString(),
      emoji: normalizedEmoji.emoji,
    });
  } catch (err) {
    logger.error('message.reaction_emit_failed', {
      chatId: chat._id.toString(),
      messageId: message._id.toString(),
      userId: userObjectId.toString(),
      action: reactionResult.action,
      error: err,
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      messageId: serializedMessage._id,
      message: serializedMessage,
      reactions: serializedMessage.reactions,
      action: reactionResult.action,
    },
  });
});
