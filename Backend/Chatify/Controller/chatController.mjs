import Chats from "../Models/chatModel.mjs";
import asyncErrHandler from "../Utils/asyncErrHandler.mjs";


export const createChat = asyncErrHandler(async (req, res, next) => {
  const chat = new Chats(req.body)
  const savedChat = await chat.save();
  res.status(201).json({
    status: "chat created successfully",
    data: {
      chat: savedChat,
    },
  });
})

export const getAllChats = asyncErrHandler(async (req, res, next) => {
  const chats = await Chats.find( { members: { $in: [req.userId] } })
    .populate("members", "-password")
    .populate("latestMessage")
    .sort({ updatedAt: -1 });
    
  res.status(200).json({
    status: "success",
    data: {
      chats,
    },
  });
})