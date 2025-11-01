import mongoose from 'mongoose';
import Message from '../Models/messageModel.mjs';
import Chats from '../Models/chatModel.mjs';
import asyncErrorHandler from '../Utils/asyncErrHandler.mjs';

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

export const newMessage = asyncErrorHandler(async (req, res) => {
  const { chatId, text } = req.body ?? {};

  if (!req.userId) {
    respondWithChatAccessError(res, 401, 'Authentication required');
    return;
  }

  let userObjectId;

  try {
    userObjectId = new mongoose.Types.ObjectId.createFromHexString(req.userId);
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
  });

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
    userObjectId = new mongoose.Types.ObjectId.createFromHexString(req.userId);
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
