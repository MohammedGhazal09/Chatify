import mongoose from 'mongoose';
import Message from '../Models/messageModel.mjs';
import Chats from '../Models/chatModel.mjs';
import asyncErrorHandler from '../Utils/asyncErrHandler.mjs';
import { emitToUserSockets, getIO } from '../Config/socket.mjs';
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
  normalizeMessageText,
  normalizeReactionEmoji,
  parseMessageCursor,
  MESSAGE_STATUS,
  MESSAGE_CURSOR_SORT_DESC,
  buildStatusPatch,
  serializeMessage,
} from '../Utils/messageState.mjs';

const respondWithChatAccessError = (res, statusCode, message) => {
  res.status(statusCode).json({
    status: 'fail',
    message,
  });
};

const loadChatForUser = async (chatId, userObjectId, res) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    respondWithChatAccessError(res, 400, 'Invalid chat id');
    return null;
  }

  const chat = await Chats.findById(chatId);

  if (!chat) {
    respondWithChatAccessError(res, 404, 'Chat not found');
    return null;
  }

  const isMember = chat.members.some((memberId) => memberId.equals(userObjectId));

  if (!isMember) {
    respondWithChatAccessError(res, 403, 'You are not authorized to access this chat');
    return null;
  }

  return chat;
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

  const normalizedText = normalizeMessageText(text);

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

  const idempotencyFilter = normalizedClientMessageId.clientMessageId
    ? {
        chatId: chat._id,
        sender: userObjectId,
        clientMessageId: normalizedClientMessageId.clientMessageId,
      }
    : null;

  let message;

  if (idempotencyFilter) {
    message = await Message.findOne(idempotencyFilter);

    if (message) {
      if (message.text !== normalizedText.text) {
        res.status(409).json({
          status: 'fail',
          message: 'clientMessageId already exists with different message text',
        });
        return;
      }

      res.status(200).json({
        status: 'message already created',
        data: {
          message: serializeMessage(message),
          idempotent: true,
        },
      });
      return;
    }
  }

  try {
    message = await Message.create({
      chatId: chat._id.toString(),
      sender: userObjectId,
      clientMessageId: normalizedClientMessageId.clientMessageId ?? undefined,
      text: normalizedText.text,
      status: 'sent',
    });
  } catch (error) {
    if (error?.code === 11000 && idempotencyFilter) {
      const existingMessage = await Message.findOne(idempotencyFilter);

      if (existingMessage) {
        if (existingMessage.text !== normalizedText.text) {
          res.status(409).json({
            status: 'fail',
            message: 'clientMessageId already exists with different message text',
          });
          return;
        }

        res.status(200).json({
          status: 'message already created',
          data: {
            message: serializeMessage(existingMessage),
            idempotent: true,
          },
        });
        return;
      }
    }

    throw error;
  }

  await Chats.findByIdAndUpdate(chat._id, {
    $set: { latestMessage: message._id },
  }, { new: true });

  const serializedMessage = serializeMessage(message);

  try {
    const io = getIO();
    io.in(chat._id.toString()).emit('message:new', serializedMessage);
    await emitUnreadCountsForRecipients(chat, userObjectId);
  } catch (err) {
    console.error("Message sent but failed to emit via socket.io:", err);
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
      console.error('Failed to emit read receipt:', err);
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
      console.error('Failed to emit batch read receipt:', err);
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
      await message.save();

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
        console.error('Failed to emit message deletion:', err);
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
        console.error('Failed to emit self message deletion:', err);
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
    console.error('Failed to emit message edit:', err);
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
    console.error('Failed to emit reaction update:', err);
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
