import mongoose from 'mongoose';
import Chats from '../Models/chatModel.mjs';
import { CustomError } from '../Utils/customError.mjs';

const isMultipartRequest = (req) => String(req.headers?.['content-type'] ?? '')
  .toLowerCase()
  .startsWith('multipart/form-data');

const createUploadError = (message, statusCode, code) => {
  const error = new CustomError(message, statusCode);
  error.code = code;
  return error;
};

export const requireUploadChatMembership = async (req, res, next) => {
  if (!isMultipartRequest(req)) {
    next();
    return;
  }

  try {
    const userId = req.userId;
    const chatId = req.get('x-chat-id');

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      next(createUploadError('Authentication required', 401, 'UPLOAD_AUTH_REQUIRED'));
      return;
    }
    if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
      next(createUploadError(
        'Multipart message uploads require a valid X-Chat-Id header',
        400,
        'UPLOAD_CHAT_HEADER_REQUIRED'
      ));
      return;
    }

    const authorized = await Chats.exists({
      _id: chatId,
      members: userId,
    });
    if (!authorized) {
      next(createUploadError(
        'You are not authorized to upload to this chat',
        403,
        'UPLOAD_CHAT_FORBIDDEN'
      ));
      return;
    }

    req.uploadAuthorizedChatId = new mongoose.Types.ObjectId(chatId);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireUploadBodyChatMatch = (req, res, next) => {
  if (!isMultipartRequest(req)) {
    next();
    return;
  }

  const authorizedChatId = req.uploadAuthorizedChatId?.toString?.();
  const bodyChatId = req.body?.chatId?.toString?.();

  if (!authorizedChatId || authorizedChatId !== bodyChatId) {
    next(createUploadError(
      'Multipart upload chat does not match the authorized chat header',
      403,
      'UPLOAD_CHAT_MISMATCH'
    ));
    return;
  }

  req.authorizedChatId = req.uploadAuthorizedChatId;
  next();
};
