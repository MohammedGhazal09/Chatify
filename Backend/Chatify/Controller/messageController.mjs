import mongoose from 'mongoose';
import Message from '../Models/messageModel.mjs';
import Chats from '../Models/chatModel.mjs';
import asyncErrorHandler from '../Utils/asyncErrHandler.mjs';
import { getIO } from '../Config/socket.mjs';

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

export const newMessage = asyncErrorHandler(async (req, res, next) => {
  const { chatId, text } = req.body ?? {};

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

  const sanitizedText = typeof text === 'string' ? text.trim() : '';

  if (!sanitizedText) {
    res.status(400).json({
      status: 'fail',
      message: 'Message text is required',
    });
    return;
  }

  const message = await Message.create({
    chatId: chat._id,
    sender: userObjectId,
    text: sanitizedText,
    status: 'sent',
  });

  const seializedMessage = message.toObject();

  const recipientCount = chat.members.reduce((count, memberId) => {
    if (memberId.equals(userObjectId)) {
      return count;
    }

    return count + 1;
  }, 0);

  const chatUpdate = {
    $set: { latestMessage: message._id },
  };

  if (recipientCount > 0) {
    chatUpdate.$inc = { unReadMessages: recipientCount };
  }

  await Chats.findByIdAndUpdate(chat._id, chatUpdate, { new: true });

  try {
    const io = getIO();
    // Emit to everyone in the room including sender
    io.in(chat._id.toString()).emit('message:new', seializedMessage)
  } catch (err) {
    console.error("Message sent but failed to emit via socket.io:", err);
  }

  res.status(201).json({
    status: 'message created successfully',
    data: {
      message,
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

  const allMessages = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 });

  res.status(200).json({
    status: 'messages fetched successfully',
    data: {
      messages: allMessages,
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
