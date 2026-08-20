import mongoose from 'mongoose';
import Chats from '../Models/chatModel.mjs';
import Message from '../Models/messageModel.mjs';

export class ChatAccessError extends Error {
  constructor(code, message = 'Socket access failed') {
    super(message);
    this.name = 'ChatAccessError';
    this.code = code;
  }
}

export const normalizeObjectId = (value, code = 'invalid_payload') => {
  const normalizedValue = value?.toString?.() ?? value;

  if (!mongoose.Types.ObjectId.isValid(normalizedValue)) {
    throw new ChatAccessError(code, 'Invalid socket payload');
  }

  return new mongoose.Types.ObjectId(normalizedValue);
};

export const assertChatMember = async ({ chatId, userId }) => {
  const chatObjectId = normalizeObjectId(chatId);
  const userObjectId = normalizeObjectId(userId);

  const chat = await Chats.findOne({
    _id: chatObjectId,
    members: userObjectId,
  });

  if (!chat) {
    throw new ChatAccessError('forbidden_or_not_found', 'Forbidden or not found');
  }

  return chat;
};

export const assertMessageChatMember = async ({ messageId, userId }) => {
  const messageObjectId = normalizeObjectId(messageId);
  const userObjectId = normalizeObjectId(userId);

  const message = await Message.findById(messageObjectId);

  if (!message) {
    throw new ChatAccessError('forbidden_or_not_found', 'Forbidden or not found');
  }

  const chat = await Chats.findOne({
    _id: message.chatId,
    members: userObjectId,
  });

  if (!chat) {
    throw new ChatAccessError('forbidden_or_not_found', 'Forbidden or not found');
  }

  return { message, chat };
};
