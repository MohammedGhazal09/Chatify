import mongoose from 'mongoose';
import Message from '../Models/messageModel.mjs';
import Chats from '../Models/chatModel.mjs';
import asyncErrorHandler from '../Utils/asyncErrHandler.mjs';
import { emitToUserSockets, getIO } from '../Config/socket.mjs';
import {
  buildUnreadMessageFilter,
  normalizeClientMessageId,
  normalizeMessageText,
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
      chatId: chat._id,
      sender: userObjectId,
      clientMessageId: normalizedClientMessageId.clientMessageId ?? undefined,
      text: normalizedText.text,
      status: 'sent',
    });
  } catch (error) {
    if (error?.code === 11000 && idempotencyFilter) {
      const existingMessage = await Message.findOne(idempotencyFilter);

      if (existingMessage?.text === normalizedText.text) {
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

  // Pagination params
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 messages per request
  const skip = (page - 1) * limit;

  // Get total count for pagination info
  const totalMessages = await Message.countDocuments({ chatId: chat._id });
  const totalPages = Math.ceil(totalMessages / limit);

  // Fetch messages with pagination (newest first for infinite scroll)
  const allMessages = await Message.find({ chatId: chat._id })
    .sort({ createdAt: -1 }) // Newest first
    .skip(skip)
    .limit(limit);

  // Reverse to show oldest first in UI
  const orderedMessages = allMessages.reverse();

  res.status(200).json({
    status: 'messages fetched successfully',
    data: {
      messages: orderedMessages,
      pagination: {
        currentPage: page,
        totalPages,
        totalMessages,
        hasMore: page < totalPages,
        limit,
      },
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

  // Don't mark own messages as read
  if (message.sender.equals(userObjectId)) {
    res.status(200).json({
      status: 'success',
      message: 'Cannot mark own message as read',
      data: { message },
    });
    return;
  }

  // Check if user already read this message
  const alreadyRead = message.readBy.some(entry => entry.user.equals(userObjectId));
  
  if (!alreadyRead) {
    const now = new Date();
    message.readBy.push({ user: userObjectId, readAt: now });
    
    // For 1-on-1 chats, mark as read immediately
    // For group chats, mark as read when all members have read
    if (!chat.isGroupChat) {
      message.status = 'read';
      message.readAt = now;
      message.read = true;
    } else {
      // For group chats, check if all members (except sender) have read
      const otherMembers = chat.members.filter(m => !m.equals(message.sender));
      const readCount = message.readBy.length;
      if (readCount >= otherMembers.length) {
        message.status = 'read';
        message.readAt = now;
        message.read = true;
      }
    }

    await message.save();

    // Emit socket event for read receipt
    try {
      const io = getIO();
      io.in(chat._id.toString()).emit('message:read', {
        messageId: message._id,
        readBy: { user: userObjectId, readAt: now },
        status: message.status,
        readAt: message.readAt,
      });
      
      // Notify sender specifically about status update
      io.in(chat._id.toString()).emit('message:status-update', {
        messageId: message._id,
        status: message.status,
        readBy: message.readBy,
      });
    } catch (err) {
      console.error('📛 Failed to emit read receipt:', err);
    }
  }

  res.status(200).json({
    status: 'success',
    data: { message },
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
  const now = new Date();

  // Find messages that need to be marked as read
  const messages = await Message.find({
    _id: { $in: validMessageIds },
    chatId: chat._id,
    sender: { $ne: userObjectId }, // Exclude own messages
    'readBy.user': { $ne: userObjectId }, // Exclude already read
  });

  const updatedMessages = [];

  for (const message of messages) {
    message.readBy.push({ user: userObjectId, readAt: now });

    // Determine status based on chat type
    if (!chat.isGroupChat) {
      message.status = 'read';
      message.readAt = now;
      message.read = true;
    } else {
      const otherMembers = chat.members.filter(m => !m.equals(message.sender));
      const readCount = message.readBy.length;
      if (readCount >= otherMembers.length) {
        message.status = 'read';
        message.readAt = now;
        message.read = true;
      }
    }

    await message.save();
    updatedMessages.push(message);
  }

  // Emit socket events for all updated messages
  if (updatedMessages.length > 0) {
    try {
      const io = getIO();
      io.in(chat._id.toString()).emit('messages:read-batch', {
        chatId: chat._id,
        userId: userObjectId,
        messages: updatedMessages.map(m => ({
          messageId: m._id,
          status: m.status,
          readBy: m.readBy,
        })),
      });

      // Emit unread count reset only to the user who read the messages.
      emitToUserSockets(userObjectId, 'unread:update', {
        chatId: chat._id.toString(),
        userId: userObjectId.toString(),
        count: 0,
      });
    } catch (err) {
      console.error('📛 Failed to emit batch read receipt:', err);
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      updatedCount: updatedMessages.length,
      messages: updatedMessages,
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

  // Count messages not sent by user and not read by user
  const unreadCount = await Message.countDocuments({
    chatId: chat._id,
    sender: { $ne: userObjectId },
    'readBy.user': { $ne: userObjectId },
  });

  res.status(200).json({
    status: 'success',
    data: {
      chatId: chat._id,
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

// Delete a message (only sender can delete)
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

  // Verify user is the sender
  if (!message.sender.equals(userObjectId)) {
    respondWithChatAccessError(res, 403, 'You can only delete your own messages');
    return;
  }

  const chat = await loadChatForUser(message.chatId.toString(), userObjectId, res);
  if (!chat) {
    return;
  }

  if (deleteForEveryone) {
    // Delete for everyone - remove the message entirely
    await Message.findByIdAndDelete(messageId);

    // Update latest message if this was it
    if (chat.latestMessage?.toString() === messageId) {
      const newLatestMessage = await Message.findOne({ chatId: chat._id })
        .sort({ createdAt: -1 });
      await Chats.findByIdAndUpdate(chat._id, {
        latestMessage: newLatestMessage?._id || null,
      });
    }

    // Emit socket event for message deletion
    try {
      const io = getIO();
      io.in(chat._id.toString()).emit('message:deleted', {
        messageId,
        chatId: chat._id,
        deletedBy: userObjectId,
        deleteForEveryone: true,
      });
    } catch (err) {
      console.error('📛 Failed to emit message deletion:', err);
    }

    res.status(200).json({
      status: 'success',
      message: 'Message deleted for everyone',
      data: { messageId },
    });
  } else {
    // Soft delete - just mark as deleted for the user
    if (!message.deletedFor) {
      message.deletedFor = [];
    }
    if (!message.deletedFor.includes(userObjectId)) {
      message.deletedFor.push(userObjectId);
    }
    await message.save();

    res.status(200).json({
      status: 'success',
      message: 'Message deleted for you',
      data: { messageId },
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

  const sanitizedText = typeof text === 'string' ? text.trim() : '';
  if (!sanitizedText) {
    res.status(400).json({
      status: 'fail',
      message: 'Message text is required',
    });
    return;
  }

  const message = await Message.findById(messageId);

  if (!message) {
    respondWithChatAccessError(res, 404, 'Message not found');
    return;
  }

  // Verify user is the sender
  if (!message.sender.equals(userObjectId)) {
    respondWithChatAccessError(res, 403, 'You can only edit your own messages');
    return;
  }

  // Check if message is within edit time limit (15 minutes)
  const editTimeLimit = 15 * 60 * 1000; // 15 minutes
  const messageAge = Date.now() - new Date(message.createdAt).getTime();
  if (messageAge > editTimeLimit) {
    res.status(400).json({
      status: 'fail',
      message: 'Messages can only be edited within 15 minutes of sending',
    });
    return;
  }

  const chat = await loadChatForUser(message.chatId.toString(), userObjectId, res);
  if (!chat) {
    return;
  }

  // Update the message
  message.text = sanitizedText;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  // Emit socket event for message edit
  try {
    const io = getIO();
    io.in(chat._id.toString()).emit('message:edited', {
      messageId,
      chatId: chat._id,
      text: sanitizedText,
      isEdited: true,
      editedAt: message.editedAt,
    });
  } catch (err) {
    console.error('📛 Failed to emit message edit:', err);
  }

  res.status(200).json({
    status: 'success',
    data: { message },
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

  if (!emoji || typeof emoji !== 'string') {
    res.status(400).json({
      status: 'fail',
      message: 'Emoji is required',
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

  // Check if user already reacted with this emoji
  const existingReactionIndex = message.reactions?.findIndex(
    (r) => r.user.equals(userObjectId) && r.emoji === emoji
  ) ?? -1;

  let action;
  if (existingReactionIndex > -1) {
    // Remove the reaction (toggle off)
    message.reactions.splice(existingReactionIndex, 1);
    action = 'removed';
  } else {
    // Add the reaction
    if (!message.reactions) {
      message.reactions = [];
    }
    message.reactions.push({ user: userObjectId, emoji });
    action = 'added';
  }

  await message.save();

  // Emit socket event for reaction update
  try {
    const io = getIO();
    io.in(chat._id.toString()).emit('message:reaction', {
      messageId,
      chatId: chat._id.toString(),
      reactions: message.reactions,
      action,
      userId: req.userId,
      emoji,
    });
  } catch (err) {
    console.error('📛 Failed to emit reaction update:', err);
  }

  res.status(200).json({
    status: 'success',
    data: {
      messageId,
      reactions: message.reactions,
      action,
    },
  });
});
