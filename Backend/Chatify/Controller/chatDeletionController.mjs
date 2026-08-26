import mongoose from 'mongoose';

import { emitToUserSockets, removeUserFromChat } from '../Config/socket.mjs';
import Attachment from '../Models/attachmentModel.mjs';
import Chats from '../Models/chatModel.mjs';
import Message from '../Models/messageModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { CustomError } from '../Utils/customError.mjs';
import { withDatabaseTransaction } from '../Utils/databaseSecurity.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

export const deleteChatWithUploads = asyncErrHandler(async (req, res) => {
  const requesterId = req.userId?.toString();
  const chatId = req.params?.chatId;

  if (!requesterId) {
    throw new CustomError('Not authorized to access this route', 401);
  }

  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    throw new CustomError('Invalid chat id', 400);
  }

  const requesterObjectId = new mongoose.Types.ObjectId(requesterId);
  const chatObjectId = new mongoose.Types.ObjectId(chatId);
  const memberIds = await withDatabaseTransaction(async (session) => {
    const chat = await Chats.findOne({
      _id: chatObjectId,
      members: requesterObjectId,
    }).session(session);

    if (!chat) {
      throw new CustomError('Chat not found', 404);
    }

    // Direct conversations are shared history. One participant must never be able to
    // physically delete the peer's copy. A future per-user hide/archive endpoint can
    // provide local removal without destroying shared records.
    if (!chat.isGroupChat) {
      throw new CustomError('Direct conversations cannot be deleted for every participant', 403);
    }

    if (chat.groupAdmin?.toString() !== requesterId) {
      throw new CustomError('Only the group admin can delete this chat', 403);
    }

    const members = chat.members.map((member) => member.toString());

    await Attachment.updateMany(
      {
        chatId: chatObjectId,
        status: { $ne: 'deleted' },
      },
      { $set: { status: 'deleted' } },
      { session }
    );
    await Message.deleteMany({ chatId: chatObjectId }, { session });
    await Chats.deleteOne({ _id: chatObjectId }, { session });

    return members;
  });

  try {
    memberIds.forEach((memberId) => {
      removeUserFromChat(memberId, chatId);
      emitToUserSockets(memberId, 'chat:deleted', { chatId });
    });
  } catch (error) {
    logger.error('chat.delete_notification_failed', {
      chatId,
      memberCount: memberIds.length,
      error,
    });
  }

  res.status(200).json({
    status: 'success',
    message: 'Chat deleted successfully',
  });
});
