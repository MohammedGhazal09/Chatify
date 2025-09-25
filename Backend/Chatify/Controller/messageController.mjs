import Message from '../Models/messageModel.mjs';
import Chats from '../Models/chatModel.mjs';
import asyncErrorHandler from '../Utils/asyncErrHandler.mjs';

export const newMessage = asyncErrorHandler(async (req, res, next) => {
  const newMessage = new Message(req.body);
  const savedMessage = await newMessage.save();
  await Chats.findOneAndUpdate({
    _id: req.body.chatId,
  },
  {
    latestMessage: savedMessage._id,
    $inc: { unReadMessages: 1 },
  },
  {
    new: true,
  });

  res.status(201).json({
    status: "message created successfully",
    data: {
      message: savedMessage,
    },
  }); 
})

export const getAllMessages = asyncErrorHandler(async (req, res, next) => {
  const allMessages = await Message.find({chatId: req.params.id}).sort({createdAt: 1})
  res.status(200).json({
    status: "messages fetched successfully",
    data: {
      messages: allMessages,
    },
  });
})