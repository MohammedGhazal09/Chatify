import validator from "validator";
import Chats from "../Models/chatModel.mjs";
import Message from "../Models/messageModel.mjs";
import User from "../Models/userModel.mjs";
import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import { CustomError } from "../Utils/customError.mjs";
import { emitToUserSockets, joinUserToChat, removeUserFromChat } from "../Config/socket.mjs";
import {
  buildVisibleMessageFilter,
  MESSAGE_CURSOR_SORT_DESC,
  serializeMessage,
} from "../Utils/messageState.mjs";

const projectLatestVisibleMessage = async (chatId, requesterId) => {
  const latestVisibleMessage = await Message.findOne(
    buildVisibleMessageFilter({ chatId, userId: requesterId })
  ).sort(MESSAGE_CURSOR_SORT_DESC);

  return latestVisibleMessage ? serializeMessage(latestVisibleMessage) : null;
};


export const createChat = asyncErrHandler(async (req, res, next) => {
  const { targetEmail, chatName } = req.body ?? {};
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError("Not authorized to access this route", 401));
  }

  if (!targetEmail || typeof targetEmail !== "string") {
    return next(new CustomError("Please provide a valid email address", 400));
  }

  const normalizedEmail = targetEmail.trim().toLowerCase();

  if (!validator.isEmail(normalizedEmail)) {
    return next(new CustomError("Please provide a valid email address", 400));
  }

  const targetUser = await User.findOne({ email: normalizedEmail });

  if (!targetUser) {
    return next(new CustomError("User with the provided email does not exist", 404));
  }

  if (targetUser._id.toString() === requesterId) {
    return next(new CustomError("Cannot create a chat with yourself", 400));
  }

  const members = [requesterId, targetUser._id];

  const existingChat = await Chats.findOne({
    isGroupChat: false,
    members: { $all: [requesterId, targetUser._id] },
  })
    .populate("members", "-password")
    .populate("latestMessage");

  if (existingChat) {
    const projectedLatestMessage = await projectLatestVisibleMessage(existingChat._id, requesterId);

    return res.status(200).json({
      status: "success",
      data: {
        chat: {
          ...existingChat.toObject(),
          latestMessage: projectedLatestMessage,
        },
      },
    });
  }

  const payload = {
    members,
    isGroupChat: false,
  };

  if (chatName && typeof chatName === "string" && chatName.trim().length) {
    payload.chatName = chatName.trim();
  }

  const newChat = await Chats.create(payload);

  await newChat.populate("members", "-password");
  await newChat.populate("latestMessage");

  // Notify all members about the new chat via socket
  try {
    // Join both users to the new chat room so they can receive messages immediately
    joinUserToChat(requesterId, newChat._id);
    joinUserToChat(targetUser._id.toString(), newChat._id);
    
    // Notify the target user about the new chat so they can see it without refreshing
    emitToUserSockets(targetUser._id, 'chat:new', newChat);
  } catch (err) {
    // Log but don't fail the request if socket notification fails
    console.error('Failed to notify users about new chat:', err);
  }

  res.status(201).json({
    status: "chat created successfully",
    data: {
      chat: newChat,
    },
  });
});

export const getAllChats = asyncErrHandler(async (req, res, next) => {
  const chats = await Chats.find({ members: { $in: [req.userId] } })
    .populate("members", "-password")
    .sort({ updatedAt: -1 });
  const projectedChats = await Promise.all(chats.map(async (chat) => {
    return {
      ...chat.toObject(),
      latestMessage: await projectLatestVisibleMessage(chat._id, req.userId),
    };
  }));

  res.status(200).json({
    status: "success",
    data: {
      chats: projectedChats,
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
    console.error("Failed to notify users about chat deletion:", err);
  }

  res.status(200).json({
    status: "success",
    message: "Chat deleted successfully",
  });
});
