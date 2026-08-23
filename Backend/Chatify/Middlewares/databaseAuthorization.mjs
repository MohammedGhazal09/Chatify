import mongoose from 'mongoose';

import Attachment from '../Models/attachmentModel.mjs';
import Chats from '../Models/chatModel.mjs';
import Message from '../Models/messageModel.mjs';

const DEFAULT_AUTHENTICATION_MESSAGE = 'Authentication required';

const respondFailure = (res, {
  statusCode,
  message,
  code,
}) => {
  const payload = {
    status: 'fail',
    message,
  };
  if (code) payload.code = code;
  res.status(statusCode).json(payload);
};

const toObjectId = (value) => (
  mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null
);

const getAuthenticatedUserId = (req) => toObjectId(req.userId);

const requireAuthenticatedUser = (req, res) => {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    respondFailure(res, {
      statusCode: 401,
      message: DEFAULT_AUTHENTICATION_MESSAGE,
    });
    return null;
  }

  return userId;
};

const normalizeChatOptions = (options = {}) => ({
  invalidStatusCode: options.invalidStatusCode ?? 400,
  invalidMessage: options.invalidMessage ?? 'Invalid chat id',
  missingStatusCode: options.missingStatusCode ?? 404,
  missingMessage: options.missingMessage ?? 'Chat not found',
  unauthorizedStatusCode: options.unauthorizedStatusCode ?? options.statusCode ?? 403,
  unauthorizedMessage: options.unauthorizedMessage ?? 'You are not authorized to access this chat',
});

const authorizeChat = async ({ chatId, userId, res, options }) => {
  if (!chatId) {
    respondFailure(res, {
      statusCode: options.invalidStatusCode,
      message: options.invalidMessage,
    });
    return false;
  }

  const authorized = await Chats.exists({
    _id: chatId,
    members: userId,
  });

  if (authorized) return true;

  const exists = await Chats.exists({ _id: chatId });
  respondFailure(res, exists
    ? {
        statusCode: options.unauthorizedStatusCode,
        message: options.unauthorizedMessage,
      }
    : {
        statusCode: options.missingStatusCode,
        message: options.missingMessage,
      });
  return false;
};

export const requireChatMembership = (paramName = 'chatId', rawOptions = {}) => async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const chatId = toObjectId(req.params?.[paramName]);
    const options = normalizeChatOptions(rawOptions);
    if (!await authorizeChat({ chatId, userId, res, options })) return;

    req.authorizedChatId = chatId;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireBodyChatMembership = (fieldName = 'chatId', rawOptions = {}) => async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const chatId = toObjectId(req.body?.[fieldName]);
    const options = normalizeChatOptions(rawOptions);
    if (!await authorizeChat({ chatId, userId, res, options })) return;

    req.authorizedChatId = chatId;
    next();
  } catch (error) {
    next(error);
  }
};

const buildRelatedOptions = (options = {}) => ({
  invalidStatusCode: options.invalidStatusCode ?? 400,
  invalidMessage: options.invalidMessage ?? 'Invalid resource id',
  missingStatusCode: options.missingStatusCode ?? 404,
  missingMessage: options.missingMessage ?? 'Resource not found',
  unauthorizedStatusCode: options.unauthorizedStatusCode ?? 403,
  unauthorizedMessage: options.unauthorizedMessage ?? 'You are not authorized to access this resource',
  concealUnauthorized: options.concealUnauthorized === true,
});

const requireRelatedChatMembership = ({
  model,
  idField,
  requestParam,
  requestProperty,
  defaults = {},
}) => (rawOptions = {}) => async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const options = buildRelatedOptions({ ...defaults, ...rawOptions });
    const objectId = toObjectId(req.params?.[requestParam]);
    if (!objectId) {
      respondFailure(res, {
        statusCode: options.invalidStatusCode,
        message: options.invalidMessage,
      });
      return;
    }

    const [authorized] = await model.aggregate([
      { $match: { _id: objectId } },
      {
        $lookup: {
          from: Chats.collection.name,
          localField: idField,
          foreignField: '_id',
          as: '_authorizedChat',
        },
      },
      { $match: { '_authorizedChat.members': userId } },
      { $limit: 1 },
      { $project: { _id: 1, [idField]: 1 } },
    ]);

    if (!authorized) {
      const exists = options.concealUnauthorized
        ? null
        : await model.exists({ _id: objectId });
      respondFailure(res, exists
        ? {
            statusCode: options.unauthorizedStatusCode,
            message: options.unauthorizedMessage,
          }
        : {
            statusCode: options.missingStatusCode,
            message: options.missingMessage,
          });
      return;
    }

    req[requestProperty] = objectId;
    req.authorizedChatId = authorized[idField];
    next();
  } catch (error) {
    next(error);
  }
};

const messageMembership = requireRelatedChatMembership({
  model: Message,
  idField: 'chatId',
  requestParam: 'messageId',
  requestProperty: 'authorizedMessageId',
  defaults: {
    invalidMessage: 'Invalid message id',
    missingMessage: 'Message not found',
    unauthorizedMessage: 'You are not authorized to access this chat',
  },
});

const attachmentMembership = requireRelatedChatMembership({
  model: Attachment,
  idField: 'chatId',
  requestParam: 'attachmentId',
  requestProperty: 'authorizedAttachmentId',
  defaults: {
    invalidStatusCode: 404,
    invalidMessage: 'Attachment not found',
    missingStatusCode: 404,
    missingMessage: 'Attachment not found',
    unauthorizedStatusCode: 404,
    unauthorizedMessage: 'Attachment not found',
    concealUnauthorized: true,
  },
});

export const requireMessageMembership = messageMembership();
export const requireAttachmentMembership = attachmentMembership();
export const buildMessageMembershipGuard = messageMembership;
export const buildAttachmentMembershipGuard = attachmentMembership;
