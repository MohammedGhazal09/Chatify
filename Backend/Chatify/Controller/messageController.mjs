import mongoose from 'mongoose';
import multer from 'multer';
import Attachment from '../Models/attachmentModel.mjs';
import Message from '../Models/messageModel.mjs';
import Chats from '../Models/chatModel.mjs';
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
  canUserSeeMessage,
  encodeMessageCursor,
  buildReadReceiptUpdatePipeline,
  hasReceiptStateChanged,
  normalizeClientMessageId,
  normalizeMessageHistoryLimit,
  normalizeMessageSearchLimit,
  normalizeMessageSearchQuery,
  normalizeMessageText,
  normalizeReactionEmoji,
  parseMessageCursor,
  MESSAGE_STATUS,
  MESSAGE_CURSOR_SORT_DESC,
  buildStatusPatch,
  serializeAttachmentSummary,
  serializeMessage,
  serializePinnedMessage,
  toObjectId,
} from '../Utils/messageState.mjs';
import { assertConversationActivityAllowed } from '../Utils/conversationControls.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const PINNED_MESSAGES_LIMIT = 50;
const SHARED_ASSET_CURSOR_SORT_DESC = Object.freeze({ createdAt: -1, _id: -1 });
const PRIVATE_ATTACHMENT_ERROR = 'Attachment not found';

const respondWithChatAccessError = (res, statusCode, message) => {
  res.status(statusCode).json({
    status: 'fail',
    message,
  });
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

const isSameIdempotentPayload = ({ message, text, attachmentFingerprint }) => (
  message.text === text && getMessageAttachmentFingerprint(message) === attachmentFingerprint
);

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

export const newMessage = asyncErrorHandler(async (req, res) => {
  const { chatId, text, clientMessageId } = req.body ?? {};
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

  let message;

  if (idempotencyFilter) {
    logDeliveryLifecycle('create.lookup', {
      chatId: chat._id.toString(),
      clientMessageId: normalizedClientMessageId.clientMessageId,
      actorRole: 'sender',
    });

    message = await Message.findOne(idempotencyFilter).select('+attachmentFingerprint');

    if (message) {
      if (!isSameIdempotentPayload({
        message,
        text: normalizedText.text,
        attachmentFingerprint,
      })) {
        res.status(409).json({
          status: 'fail',
          message: 'clientMessageId already exists with different message text or attachment payload',
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
      attachments: storedAttachments.map((attachment) => attachment.summary),
      attachmentFingerprint,
      status: 'sent',
    });
  } catch (error) {
    await cleanupStoredAttachments(storedAttachments);

    if (error?.code === 11000 && idempotencyFilter) {
      const existingMessage = await Message.findOne(idempotencyFilter).select('+attachmentFingerprint');

      if (existingMessage) {
        if (!isSameIdempotentPayload({
          message: existingMessage,
          text: normalizedText.text,
          attachmentFingerprint,
        })) {
          res.status(409).json({
            status: 'fail',
            message: 'clientMessageId already exists with different message text or attachment payload',
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

  res.status(200).json({
    status: 'messages fetched successfully',
    data: {
      messages: orderedMessages.map((message) => serializeMessage(message)),
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

  const normalizedQuery = normalizeMessageSearchQuery(req.query.q);

  if (!normalizedQuery.ok) {
    res.status(normalizedQuery.statusCode).json({
      status: 'fail',
      message: normalizedQuery.message,
    });
    return;
  }

  const limit = normalizeMessageSearchLimit(req.query.limit);
  const visibleMessageFilter = buildVisibleMessageFilter({
    chatId: chat._id,
    userId: userObjectId,
    includeTombstones: false,
  });
  const matchingAttachmentMessageIds = await Attachment.distinct('messageId', {
    chatId: chat._id,
    status: 'active',
    displayName: { $regex: normalizedQuery.escapedQuery, $options: 'i' },
  });
  const messages = await Message.find({
    ...visibleMessageFilter,
    $or: [
      { text: { $regex: normalizedQuery.escapedQuery, $options: 'i' } },
      { _id: { $in: matchingAttachmentMessageIds } },
    ],
  })
    .sort(MESSAGE_CURSOR_SORT_DESC)
    .limit(limit);

  res.status(200).json({
    status: 'messages searched successfully',
    data: {
      messages: messages.map((message) => serializeMessage(message)),
      query: normalizedQuery.query,
      limit,
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
