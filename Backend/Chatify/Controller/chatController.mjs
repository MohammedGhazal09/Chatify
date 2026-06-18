import mongoose from "mongoose";
import Chats from "../Models/chatModel.mjs";
import Message from "../Models/messageModel.mjs";
import User from "../Models/userModel.mjs";
import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import { CustomError } from "../Utils/customError.mjs";
import { validateUsername } from "../Utils/usernameValidation.mjs";
import {
  emitToUserSockets,
  endActiveCallForChatDueToBlock,
  joinUserToChat,
  removeUserFromChat,
} from "../Config/socket.mjs";
import {
  blockDirectChatPeer,
  buildConversationControls,
  filterUnblockedContactIds,
  unblockDirectChatPeer,
} from "../Utils/conversationControls.mjs";
import {
  buildVisibleMessageFilter,
  MESSAGE_CURSOR_SORT_DESC,
  serializeMessage,
} from "../Utils/messageState.mjs";
import { logger } from "../Utils/observabilityLogger.mjs";

const projectLatestVisibleMessage = async (chatId, requesterId) => {
  const latestVisibleMessage = await Message.findOne(
    buildVisibleMessageFilter({ chatId, userId: requesterId })
  ).sort(MESSAGE_CURSOR_SORT_DESC);

  return latestVisibleMessage ? serializeMessage(latestVisibleMessage) : null;
};

const DIRECT_CHAT_START_ERROR = "We could not start or continue that chat. Check the username and try again.";
const GROUP_CHAT_START_ERROR = "We could not create that group. Check the usernames and try again.";
const GROUP_NAME_REQUIRED_ERROR = "Enter a group name.";
const GROUP_MEMBER_MIN = 3;
const GROUP_MEMBER_MAX = 10;
const GROUP_SELECTED_MIN = GROUP_MEMBER_MIN - 1;
const GROUP_SELECTED_MAX = GROUP_MEMBER_MAX - 1;
const PUBLIC_CHAT_MEMBER_SELECT = "username firstName lastName profilePic identityMark identityMarkUpdatedAt";

const buildDirectChatKey = (leftMemberId, rightMemberId) => [leftMemberId.toString(), rightMemberId.toString()]
  .sort()
  .join(":");

const isDuplicateKeyError = (error) => error?.code === 11000;

const findDirectChat = (directKey, memberIds = []) => Chats.findOne({
  isGroupChat: false,
  $or: [
    { directKey },
    { members: { $all: memberIds } },
  ],
})
  .populate("members", PUBLIC_CHAT_MEMBER_SELECT)
  .populate("groupAdmin", PUBLIC_CHAT_MEMBER_SELECT)
  .populate("latestMessage");

const populateChatPublicFields = async (chat) => {
  await chat.populate("members", PUBLIC_CHAT_MEMBER_SELECT);
  await chat.populate("groupAdmin", PUBLIC_CHAT_MEMBER_SELECT);
  await chat.populate("latestMessage");

  return chat;
};

const serializeChatForRequester = async (chat, requesterId, latestMessage = undefined) => {
  const chatObject = chat.toObject?.() ?? chat;
  const projectedLatestMessage = latestMessage === undefined
    ? await projectLatestVisibleMessage(chatObject._id, requesterId)
    : latestMessage;

  return {
    ...chatObject,
    latestMessage: projectedLatestMessage,
    conversationControls: await buildConversationControls({ chat, userId: requesterId }),
  };
};

const respondWithExistingDirectChat = async (res, chat, requesterId) => {
  const projectedLatestMessage = await projectLatestVisibleMessage(chat._id, requesterId);

  return res.status(200).json({
    status: "success",
    data: {
      chat: await serializeChatForRequester(chat, requesterId, projectedLatestMessage),
    },
  });
};

const emitConversationControlsUpdated = async (chat) => {
  await Promise.all((chat.members ?? []).map(async (memberId) => {
    const normalizedMemberId = memberId?._id ?? memberId;

    emitToUserSockets(normalizedMemberId, 'conversation:controls-updated', {
      chatId: chat._id.toString(),
      conversationControls: await buildConversationControls({ chat, userId: normalizedMemberId }),
    });
  }));
};

const loadChatForRequester = async ({ chatId, requesterId, next }) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    next(new CustomError("Chat not found", 404));
    return null;
  }

  const chat = await Chats.findById(chatId)
    .populate("members", PUBLIC_CHAT_MEMBER_SELECT)
    .populate("latestMessage");

  if (!chat) {
    next(new CustomError("Chat not found", 404));
    return null;
  }

  const isMember = chat.members.some(
    (member) => member._id?.toString?.() === requesterId || member.toString() === requesterId
  );

  if (!isMember) {
    next(new CustomError("Chat not found", 404));
    return null;
  }

  return chat;
};

const normalizeGroupName = (value) => (
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""
);

const validateGroupName = (value) => {
  const chatName = normalizeGroupName(value);

  if (!chatName || chatName.length < 2) {
    return {
      ok: false,
      message: GROUP_NAME_REQUIRED_ERROR,
    };
  }

  if (chatName.length > 60) {
    return {
      ok: false,
      message: "Group name must be 60 characters or fewer.",
    };
  }

  return {
    ok: true,
    value: chatName,
  };
};

const validateGroupUsernames = (memberUsernames) => {
  if (!Array.isArray(memberUsernames)) {
    return {
      ok: false,
      message: "Add at least two other members.",
    };
  }

  if (memberUsernames.length < GROUP_SELECTED_MIN) {
    return {
      ok: false,
      message: "Add at least two other members.",
    };
  }

  if (memberUsernames.length > GROUP_SELECTED_MAX) {
    return {
      ok: false,
      message: "Groups can have up to 10 members.",
    };
  }

  const normalizedUsernames = [];

  for (const username of memberUsernames) {
    const validation = validateUsername(username);

    if (!validation.ok) {
      return {
        ok: false,
        message: "Use valid member usernames.",
      };
    }

    normalizedUsernames.push(validation.value);
  }

  if (new Set(normalizedUsernames).size !== normalizedUsernames.length) {
    return {
      ok: false,
      message: "Each member username must be unique.",
    };
  }

  return {
    ok: true,
    value: normalizedUsernames,
  };
};

const resolveGroupMembers = async ({ memberUsernames, requesterId }) => {
  const usernameValidation = validateGroupUsernames(memberUsernames);

  if (!usernameValidation.ok) {
    return usernameValidation;
  }

  const users = await User.find({ username: { $in: usernameValidation.value } })
    .select("username firstName lastName profilePic identityMark identityMarkUpdatedAt");
  const usersByUsername = new Map(users.map((user) => [user.username, user]));
  const orderedUsers = usernameValidation.value.map((username) => usersByUsername.get(username));

  if (orderedUsers.some((user) => !user)) {
    return {
      ok: false,
      message: GROUP_CHAT_START_ERROR,
    };
  }

  const requesterIdString = requesterId.toString();
  const targetMemberIds = orderedUsers.map((user) => user._id.toString());

  if (targetMemberIds.includes(requesterIdString)) {
    return {
      ok: false,
      message: "Each member username must be unique.",
    };
  }

  const unblockedIds = await filterUnblockedContactIds({
    userId: requesterId,
    contactIds: targetMemberIds,
  });

  if (unblockedIds.length !== targetMemberIds.length) {
    return {
      ok: false,
      message: GROUP_CHAT_START_ERROR,
    };
  }

  return {
    ok: true,
    users: orderedUsers,
    memberIds: [requesterIdString, ...targetMemberIds],
  };
};


export const createChat = asyncErrHandler(async (req, res, next) => {
  const { targetUsername, chatName } = req.body ?? {};
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const usernameValidation = validateUsername(targetUsername);

  if (!usernameValidation.ok) {
    return next(new CustomError(usernameValidation.message, 400));
  }

  const targetUser = await User.findOne({ username: usernameValidation.value });

  if (!targetUser) {
    return next(new CustomError(DIRECT_CHAT_START_ERROR, 404));
  }

  if (targetUser._id.toString() === requesterId) {
    return next(new CustomError(DIRECT_CHAT_START_ERROR, 400));
  }

  const members = [requesterId, targetUser._id];
  const directKey = buildDirectChatKey(requesterId, targetUser._id);

  const existingChat = await findDirectChat(directKey, members);

  if (existingChat) {
    return respondWithExistingDirectChat(res, existingChat, requesterId);
  }

  const payload = {
    members,
    directKey,
    isGroupChat: false,
  };

  if (chatName && typeof chatName === "string" && chatName.trim().length) {
    payload.chatName = chatName.trim();
  }

  let newChat;

  try {
    newChat = await Chats.create(payload);
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const duplicateChat = await findDirectChat(directKey, members);

    if (!duplicateChat) {
      throw error;
    }

    return respondWithExistingDirectChat(res, duplicateChat, requesterId);
  }

  await populateChatPublicFields(newChat);

  const requesterChat = await serializeChatForRequester(newChat, requesterId);
  const targetChat = await serializeChatForRequester(newChat, targetUser._id.toString());

  // Notify all members about the new chat via socket
  try {
    // Join both users to the new chat room so they can receive messages immediately
    joinUserToChat(requesterId, newChat._id);
    joinUserToChat(targetUser._id.toString(), newChat._id);
    
    // Notify the target user about the new chat so they can see it without refreshing
    emitToUserSockets(targetUser._id, 'chat:new', targetChat);
  } catch (err) {
    logger.error('chat.new_notification_failed', {
      chatId: newChat._id.toString(),
      requesterId,
      targetUserId: targetUser._id.toString(),
      error: err,
    });
  }

  res.status(201).json({
    status: "chat created successfully",
    data: {
      chat: requesterChat,
    },
  });
});

export const createGroupChat = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const groupNameValidation = validateGroupName(req.body?.chatName);

  if (!groupNameValidation.ok) {
    return next(new CustomError(groupNameValidation.message, 400));
  }

  const memberResolution = await resolveGroupMembers({
    memberUsernames: req.body?.memberUsernames,
    requesterId,
  });

  if (!memberResolution.ok) {
    return next(new CustomError(memberResolution.message, 400));
  }

  const newChat = await Chats.create({
    chatName: groupNameValidation.value,
    members: memberResolution.memberIds,
    isGroupChat: true,
    groupAdmin: requesterId,
  });

  await populateChatPublicFields(newChat);

  const requesterChat = await serializeChatForRequester(newChat, requesterId);

  try {
    await Promise.all(memberResolution.memberIds.map(async (memberId) => {
      joinUserToChat(memberId, newChat._id);

      if (memberId === requesterId) {
        return;
      }

      emitToUserSockets(
        memberId,
        'chat:new',
        await serializeChatForRequester(newChat, memberId)
      );
    }));
  } catch (err) {
    logger.error('chat.group_new_notification_failed', {
      chatId: newChat._id.toString(),
      requesterId,
      memberCount: memberResolution.memberIds.length,
      error: err,
    });
  }

  res.status(201).json({
    status: "group chat created successfully",
    data: {
      chat: requesterChat,
    },
  });
});

export const getAllChats = asyncErrHandler(async (req, res, next) => {
  const chats = await Chats.find({ members: { $in: [req.userId] } })
    .populate("members", PUBLIC_CHAT_MEMBER_SELECT)
    .populate("groupAdmin", PUBLIC_CHAT_MEMBER_SELECT)
    .sort({ updatedAt: -1 });
  const projectedChats = await Promise.all(chats.map(async (chat) => {
    return serializeChatForRequester(chat, req.userId);
  }));

  res.status(200).json({
    status: "success",
    data: {
      chats: projectedChats,
    },
  });
});

export const blockChatPeer = asyncErrHandler(async (req, res, next) => {
  const { chatId } = req.params;
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const chat = await loadChatForRequester({ chatId, requesterId, next });

  if (!chat) {
    return;
  }

  try {
    await blockDirectChatPeer({ chat, userId: requesterId });
  } catch (error) {
    return next(new CustomError(error.message, error.statusCode ?? 400));
  }

  await endActiveCallForChatDueToBlock(chat._id);
  await emitConversationControlsUpdated(chat);

  res.status(200).json({
    status: "success",
    data: {
      chat: await serializeChatForRequester(chat, requesterId),
      conversationControls: await buildConversationControls({ chat, userId: requesterId }),
    },
  });
});

export const unblockChatPeer = asyncErrHandler(async (req, res, next) => {
  const { chatId } = req.params;
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  const chat = await loadChatForRequester({ chatId, requesterId, next });

  if (!chat) {
    return;
  }

  try {
    await unblockDirectChatPeer({ chat, userId: requesterId });
  } catch (error) {
    return next(new CustomError(error.message, error.statusCode ?? 400));
  }

  await emitConversationControlsUpdated(chat);

  res.status(200).json({
    status: "success",
    data: {
      chat: await serializeChatForRequester(chat, requesterId),
      conversationControls: await buildConversationControls({ chat, userId: requesterId }),
    },
  });
});

export const deleteChat = asyncErrHandler(async (req, res, next) => {
  const { chatId } = req.params;
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  if (!chatId) {
    return next(new CustomError("Chat ID is required", 400));
  }

  const chat = await Chats.findById(chatId);

  if (!chat) {
    return next(new CustomError("Chat not found", 404));
  }

  // Check if user is a member of the chat
  const isMember = chat.members.some(
    (member) => member.toString() === requesterId
  );

  if (!isMember) {
    return next(new CustomError("You are not a member of this chat", 403));
  }

  // Get member IDs before deletion for socket notification
  const memberIds = chat.members.map((m) => m.toString());

  // Delete the chat
  await Chats.findByIdAndDelete(chatId);

  // Notify all members about the deleted chat via socket
  try {
    // Remove all members from the chat room and notify them
    memberIds.forEach((memberId) => {
      removeUserFromChat(memberId, chatId);
      emitToUserSockets(memberId, "chat:deleted", { chatId });
    });
  } catch (err) {
    logger.error('chat.delete_notification_failed', {
      chatId,
      memberCount: memberIds.length,
      error: err,
    });
  }

  res.status(200).json({
    status: "success",
    message: "Chat deleted successfully",
  });
});
