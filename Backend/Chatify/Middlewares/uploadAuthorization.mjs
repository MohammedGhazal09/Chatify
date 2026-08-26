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

export const authorizeUploadChatId = async ({ req, chatId }) => {
  const userId = req.userId;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw createUploadError('Authentication required', 401, 'UPLOAD_AUTH_REQUIRED');
  }
  if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
    throw createUploadError(
      'Multipart uploads require chatId before the first attachment',
      400,
      'UPLOAD_CHAT_ID_REQUIRED'
    );
  }

  const normalizedChatId = new mongoose.Types.ObjectId(chatId);
  const authorized = await Chats.exists({
    _id: normalizedChatId,
    members: userId,
  });
  if (!authorized) {
    throw createUploadError(
      'You are not authorized to upload to this chat',
      403,
      'UPLOAD_CHAT_FORBIDDEN'
    );
  }

  return normalizedChatId;
};

export const requireUploadChatMembership = async (req, res, next) => {
  if (!isMultipartRequest(req)) {
    next();
    return;
  }

  const headerChatId = req.get('x-chat-id');
  if (!headerChatId) {
    next();
    return;
  }

  try {
    req.uploadAuthorizedChatId = await authorizeUploadChatId({
      req,
      chatId: headerChatId,
    });
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
      'Multipart upload chat does not match the authorized chat',
      403,
      'UPLOAD_CHAT_MISMATCH'
    ));
    return;
  }

  req.authorizedChatId = req.uploadAuthorizedChatId;
  next();
};
