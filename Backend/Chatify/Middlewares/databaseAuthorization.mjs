import mongoose from 'mongoose';

import Attachment from '../Models/attachmentModel.mjs';
import Chats from '../Models/chatModel.mjs';
import Message from '../Models/messageModel.mjs';

const PRIVATE_RESOURCE_MESSAGE = 'Resource not found';

const failPrivateResource = (res, statusCode = 404) => {
  res.status(statusCode).json({
    status: 'fail',
    message: PRIVATE_RESOURCE_MESSAGE,
  });
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
    res.status(401).json({
      status: 'fail',
      message: 'Authentication required',
    });
    return null;
  }

  return userId;
};

const handleAuthorizationError = (error, next) => {
  next(error);
};

export const requireChatMembership = (paramName = 'chatId', { statusCode = 404 } = {}) => async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const chatId = toObjectId(req.params?.[paramName]);
    if (!chatId) {
      failPrivateResource(res, statusCode);
      return;
    }

    const authorized = await Chats.exists({
      _id: chatId,
      members: userId,
    });

    if (!authorized) {
      failPrivateResource(res, statusCode);
      return;
    }

    req.authorizedChatId = chatId;
    next();
  } catch (error) {
    handleAuthorizationError(error, next);
  }
};

export const requireBodyChatMembership = (fieldName = 'chatId', { statusCode = 404 } = {}) => async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const chatId = toObjectId(req.body?.[fieldName]);
    if (!chatId) {
      failPrivateResource(res, statusCode);
      return;
    }

    const authorized = await Chats.exists({
      _id: chatId,
      members: userId,
    });

    if (!authorized) {
      failPrivateResource(res, statusCode);
      return;
    }

    req.authorizedChatId = chatId;
    next();
  } catch (error) {
    handleAuthorizationError(error, next);
  }
};

const requireRelatedChatMembership = ({
  model,
  idField,
  requestParam,
  requestProperty,
}) => async (req, res, next) => {
  try {
    const userId = requireAuthenticatedUser(req, res);
    if (!userId) return;

    const objectId = toObjectId(req.params?.[requestParam]);
    if (!objectId) {
      failPrivateResource(res);
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
      failPrivateResource(res);
      return;
    }

    req[requestProperty] = objectId;
    req.authorizedChatId = authorized[idField];
    next();
  } catch (error) {
    handleAuthorizationError(error, next);
  }
};

export const requireMessageMembership = requireRelatedChatMembership({
  model: Message,
  idField: 'chatId',
  requestParam: 'messageId',
  requestProperty: 'authorizedMessageId',
});

export const requireAttachmentMembership = requireRelatedChatMembership({
  model: Attachment,
  idField: 'chatId',
  requestParam: 'attachmentId',
  requestProperty: 'authorizedAttachmentId',
});
