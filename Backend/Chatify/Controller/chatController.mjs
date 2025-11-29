import validator from "validator";
import Chats from "../Models/chatModel.mjs";
import User from "../Models/userModel.mjs";
import asyncErrHandler from "../Utils/asyncErrHandler.mjs";
import { CustomError } from "../Utils/customError.mjs";
import { getIO, getUserSockets } from "../Config/socket.mjs";


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
    return res.status(200).json({
      status: "success",
      data: {
        chat: existingChat,
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
    const io = getIO();
    // Notify the target user about the new chat so they can see it without refreshing
    const targetUserSockets = getUserSockets(targetUser._id.toString());
    if (targetUserSockets && targetUserSockets.size > 0) {
      targetUserSockets.forEach(socketId => {
        io.to(socketId).emit('chat:new', newChat);
      });
    }
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
    .populate("latestMessage")
    .sort({ updatedAt: -1 });

  res.status(200).json({
    status: "success",
    data: {
      chats,
    },
  });
});