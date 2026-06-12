import User from '../Models/userModel.mjs'
import Chats from '../Models/chatModel.mjs'
import asyncErrHandler from '../Utils/asyncErrHandler.mjs'
import { CustomError } from '../Utils/customError.mjs'
import mongoose from 'mongoose'

export const getLoggedUser = asyncErrHandler(async (req, res, next) => {
  const user = await User.findById(req.userId)
  
  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    user
  });
})

export const getAllUsers = asyncErrHandler(async (req, res, next) => {
  const users = await User.find({_id: {$ne: req.userId}})
  res.status(200).json({
    status: 'success',
    users
  });
})

// Get online status for a specific user
export const getOnlineStatus = asyncErrHandler(async (req, res, next) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return next(new CustomError('Invalid user id', 400));
  }

  const user = await User.findById(userId).select('isOnline lastSeen showOnlineStatus showLastSeen firstName lastName');

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  // Respect privacy settings
  const response = {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
  };

  if (user.showOnlineStatus) {
    response.isOnline = user.isOnline;
  }

  if (user.showLastSeen && !user.isOnline) {
    response.lastSeen = user.lastSeen;
  }

  res.status(200).json({
    status: 'success',
    data: response,
  });
});

// Get online users (contacts/chat members only)
export const getOnlineUsers = asyncErrHandler(async (req, res, next) => {
  const userId = req.userId;

  // Get all chats the user is a member of
  const userChats = await Chats.find({ members: userId }).select('members');

  // Extract unique user IDs from all chats
  const contactIds = new Set();
  userChats.forEach(chat => {
    chat.members.forEach(memberId => {
      if (memberId.toString() !== userId) {
        contactIds.add(memberId.toString());
      }
    });
  });

  // Get online status for all contacts
  const contacts = await User.find({
    _id: { $in: Array.from(contactIds) },
  }).select('firstName lastName isOnline lastSeen showOnlineStatus showLastSeen profilePic');

  const onlineUsers = contacts
    .filter(user => user.showOnlineStatus && user.isOnline)
    .map(user => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePic: user.profilePic,
      isOnline: true,
    }));

  const usersWithStatus = contacts.map(user => {
    const result = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePic: user.profilePic,
    };

    if (user.showOnlineStatus) {
      result.isOnline = user.isOnline;
    }

    if (user.showLastSeen && !user.isOnline) {
      result.lastSeen = user.lastSeen;
    }

    return result;
  });

  res.status(200).json({
    status: 'success',
    data: {
      onlineUsers,
      allContacts: usersWithStatus,
    },
  });
});

// Update user privacy settings
export const updatePrivacySettings = asyncErrHandler(async (req, res, next) => {
  const { showOnlineStatus, showLastSeen } = req.body;

  const updateData = {};
  if (typeof showOnlineStatus === 'boolean') {
    updateData.showOnlineStatus = showOnlineStatus;
  }
  if (typeof showLastSeen === 'boolean') {
    updateData.showLastSeen = showLastSeen;
  }

  const user = await User.findByIdAndUpdate(
    req.userId,
    updateData,
    { new: true, runValidators: true }
  );

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      showOnlineStatus: user.showOnlineStatus,
      showLastSeen: user.showLastSeen,
    },
  });
});

