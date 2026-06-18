import User from '../Models/userModel.mjs'
import Chats from '../Models/chatModel.mjs'
import asyncErrHandler from '../Utils/asyncErrHandler.mjs'
import { CustomError } from '../Utils/customError.mjs'
import mongoose from 'mongoose'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import {
  emitToUserSockets,
  isUserOnline as hasActiveSocket,
} from '../Config/socket.mjs'
import {
  deleteProfileImageFile,
  openProfileImageDownloadStream,
  uploadProfileImageBuffer,
} from '../Services/profileImageStorageService.mjs'
import {
  MAX_PROFILE_IMAGE_SIZE_BYTES,
  PROFILE_IMAGE_ERROR_CODES,
  validateIncomingProfileImage,
} from '../Utils/profileImageValidation.mjs'
import {
  serializeIdentityMark,
  serializeIdentityUser,
  validateIdentityMarkPayload,
} from '../Utils/identityMark.mjs'
import { logger } from '../Utils/observabilityLogger.mjs'
import {
  USERNAME_ERROR_CODES,
  buildUsernameConflict,
  validateUsername,
} from '../Utils/usernameValidation.mjs'

const PROFILE_IMAGE_NOT_FOUND = 'Profile image not found';

const profileImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROFILE_IMAGE_SIZE_BYTES,
    files: 1,
  },
});

const createProfileImageVersion = () => randomUUID();

const isExternalProfilePic = (value) => (
  typeof value === 'string' &&
  /^https?:\/\//i.test(value)
);

const buildProfileImageFilename = ({ userId, extension }) => (
  `${userId}-profile-image.${extension}`
);

const respondWithProfileImageUploadError = (res, error) => {
  const isTooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';

  res.status(400).json({
    status: 'fail',
    code: isTooLarge
      ? PROFILE_IMAGE_ERROR_CODES.SIZE_EXCEEDED
      : 'PROFILE_IMAGE_UPLOAD_INVALID',
    message: isTooLarge
      ? 'Profile image exceeds the 2 MB limit'
      : 'Profile image upload is invalid',
  });
};

export const parseProfileImageUpload = (req, res, next) => {
  profileImageUpload.single('profileImage')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    respondWithProfileImageUploadError(res, error);
  });
};

const loadProfileImageUser = (userId) => User.findById(userId)
  .select('+providerProfilePic +uploadedProfileImage');

const serializeProfileImageUser = (user) => user.toJSON();

const serializePublicIdentityUser = (user) => {
  const serializedUser = serializeIdentityUser(user);

  return {
    _id: serializedUser._id?.toString?.() ?? serializedUser._id,
    username: serializedUser.username ?? '',
    firstName: serializedUser.firstName,
    lastName: serializedUser.lastName,
    profilePic: serializedUser.profilePic ?? '',
    identityMark: serializedUser.identityMark,
    identityMarkUpdatedAt: serializedUser.identityMarkUpdatedAt ?? null,
  };
};

const serializeIdentityEventUser = (user) => {
  return serializePublicIdentityUser(user);
};

const getIdentityPayload = (req) => {
  if (
    req.body?.identityMark &&
    typeof req.body.identityMark === 'object' &&
    !Array.isArray(req.body.identityMark)
  ) {
    return req.body.identityMark;
  }

  return req.body;
};

const emitIdentityUpdated = async (user) => {
  const chats = await Chats.find({ members: user._id }).select('_id members');
  const recipientIds = new Set([user._id.toString()]);
  const chatIds = chats.map((chat) => {
    chat.members.forEach((memberId) => {
      recipientIds.add(memberId.toString());
    });

    return chat._id.toString();
  });
  const payload = {
    userId: user._id.toString(),
    user: serializeIdentityEventUser(user),
    chatIds,
  };

  recipientIds.forEach((recipientId) => {
    emitToUserSockets(recipientId, 'user:identity-updated', payload);
  });
};

const getContactIdsForUser = async (userId) => {
  const userChats = await Chats.find({ members: userId }).select('members');
  const contactIds = new Set();
  const normalizedUserId = userId.toString();

  userChats.forEach(chat => {
    chat.members.forEach(memberId => {
      const contactId = memberId.toString();

      if (contactId !== normalizedUserId) {
        contactIds.add(contactId);
      }
    });
  });

  return Array.from(contactIds);
};

const cleanupProfileImage = async (storageFileId) => {
  if (!storageFileId) {
    return;
  }

  try {
    await deleteProfileImageFile(storageFileId);
  } catch (error) {
    logger.warn('profile_image.cleanup_skipped', {
      error,
    });
  }
};

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

export const setUsername = asyncErrHandler(async (req, res, next) => {
  const validation = validateUsername(req.body?.username);

  if (!validation.ok) {
    return res.status(400).json({
      status: 'fail',
      code: validation.code,
      message: validation.message,
    });
  }

  const user = await User.findById(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  if (user.username) {
    return res.status(409).json({
      status: 'fail',
      code: USERNAME_ERROR_CODES.ALREADY_SET,
      message: 'This account already has a username',
    });
  }

  const usernameExists = await User.exists({
    _id: { $ne: user._id },
    username: validation.value,
  });

  if (usernameExists) {
    const conflict = buildUsernameConflict();
    return res.status(409).json({
      status: 'fail',
      code: conflict.code,
      message: conflict.message,
    });
  }

  user.username = validation.value;
  await user.save();

  return res.status(200).json({
    status: 'success',
    data: {
      user: user.toJSON(),
    },
  });
});

export const getAllUsers = asyncErrHandler(async (req, res, next) => {
  const contactIds = await getContactIdsForUser(req.userId);
  const users = await User.find({ _id: { $in: contactIds } })
    .select('username firstName lastName profilePic identityMark identityMarkUpdatedAt')

  res.status(200).json({
    status: 'success',
    users: users.map(serializePublicIdentityUser),
  });
})

// Get online status for a specific user
export const getOnlineStatus = asyncErrHandler(async (req, res, next) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return next(new CustomError('Invalid user id', 400));
  }

  const user = await User.findById(userId).select('username isOnline lastSeen showOnlineStatus showLastSeen firstName lastName profilePic identityMark identityMarkUpdatedAt');

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  // Respect privacy settings
  const response = {
    _id: user._id,
    username: user.username ?? '',
    firstName: user.firstName,
    lastName: user.lastName,
    profilePic: user.profilePic,
    identityMark: serializeIdentityMark(user),
    identityMarkUpdatedAt: serializeIdentityMark(user).updatedAt,
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
  const contactIds = await getContactIdsForUser(userId);

  // Get online status for all contacts
  const contacts = await User.find({
    _id: { $in: contactIds },
  }).select('username firstName lastName isOnline lastSeen showOnlineStatus showLastSeen profilePic identityMark identityMarkUpdatedAt');

  const onlineUsers = contacts
    .filter(user => user.showOnlineStatus && user.isOnline)
    .map(user => ({
      _id: user._id,
      username: user.username ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
      profilePic: user.profilePic,
      identityMark: serializeIdentityMark(user),
      identityMarkUpdatedAt: serializeIdentityMark(user).updatedAt,
      isOnline: true,
      isCallReachable: user.isOnline && hasActiveSocket(user._id),
    }));

  const usersWithStatus = contacts.map(user => {
    const result = {
      _id: user._id,
      username: user.username ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
      profilePic: user.profilePic,
      identityMark: serializeIdentityMark(user),
      identityMarkUpdatedAt: serializeIdentityMark(user).updatedAt,
    };

    if (user.showOnlineStatus) {
      result.isOnline = user.isOnline;
      result.isCallReachable = user.isOnline && hasActiveSocket(user._id);
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

export const updateIdentityMark = asyncErrHandler(async (req, res, next) => {
  const user = await User.findById(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  const validation = validateIdentityMarkPayload(getIdentityPayload(req), user);

  if (!validation.ok) {
    return res.status(validation.statusCode).json({
      status: 'fail',
      code: validation.code,
      message: validation.message,
    });
  }

  user.setIdentityMark(validation.value);
  await user.save();
  await emitIdentityUpdated(user);

  return res.status(200).json({
    status: 'success',
    data: {
      user: serializeIdentityUser(user),
    },
  });
});

export const uploadProfileImage = asyncErrHandler(async (req, res, next) => {
  const validation = await validateIncomingProfileImage(req.file);

  if (!validation.ok) {
    return res.status(validation.statusCode).json({
      status: 'fail',
      code: validation.code,
      message: validation.message,
    });
  }

  const user = await loadProfileImageUser(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  const previousStorageFileId = user.uploadedProfileImage?.storageFileId;
  const profileImage = validation.profileImage;
  const version = createProfileImageVersion();
  const storageFileId = await uploadProfileImageBuffer({
    buffer: profileImage.buffer,
    filename: buildProfileImageFilename({
      userId: user._id.toString(),
      extension: profileImage.originalExtension,
    }),
    contentType: profileImage.mimeType,
    metadata: {
      userId: user._id.toString(),
      purpose: 'profile-image',
    },
  });

  if (!user.providerProfilePic && isExternalProfilePic(user.profilePic)) {
    user.providerProfilePic = user.profilePic;
  }

  user.setUploadedProfileImage({
    storageFileId,
    mimeType: profileImage.mimeType,
    size: profileImage.size,
    version,
  });

  try {
    await user.save();
  } catch (error) {
    await cleanupProfileImage(storageFileId);
    throw error;
  }

  if (previousStorageFileId) {
    await cleanupProfileImage(previousStorageFileId);
  }

  return res.status(200).json({
    status: 'success',
    data: {
      user: serializeProfileImageUser(user),
    },
  });
});

export const removeProfileImage = asyncErrHandler(async (req, res, next) => {
  const user = await loadProfileImageUser(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  const previousStorageFileId = user.uploadedProfileImage?.storageFileId;
  user.clearUploadedProfileImage();
  await user.save();

  if (previousStorageFileId) {
    await cleanupProfileImage(previousStorageFileId);
  }

  return res.status(200).json({
    status: 'success',
    data: {
      user: serializeProfileImageUser(user),
    },
  });
});

export const getProfileImage = asyncErrHandler(async (req, res, next) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return next(new CustomError(PROFILE_IMAGE_NOT_FOUND, 404));
  }

  const user = await loadProfileImageUser(userId);

  if (!user?.uploadedProfileImage?.storageFileId) {
    return next(new CustomError(PROFILE_IMAGE_NOT_FOUND, 404));
  }

  if (
    typeof req.query?.v === 'string' &&
    req.query.v &&
    req.query.v !== user.uploadedProfileImage.version
  ) {
    return next(new CustomError(PROFILE_IMAGE_NOT_FOUND, 404));
  }

  const stream = openProfileImageDownloadStream(user.uploadedProfileImage.storageFileId);

  res.set({
    'Content-Type': user.uploadedProfileImage.mimeType,
    'Cache-Control': 'private, max-age=300',
    'Content-Disposition': 'inline; filename="profile-image"',
  });

  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).json({
        status: 'fail',
        message: PROFILE_IMAGE_NOT_FOUND,
      });
      return;
    }

    res.destroy();
  });

  stream.pipe(res);
});

