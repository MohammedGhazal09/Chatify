import mongoose from 'mongoose';
import Chats from '../Models/chatModel.mjs';
import Spaces, { SPACE_LIMITS, SPACE_ROLES } from '../Models/spaceModel.mjs';
import User from '../Models/userModel.mjs';
import { emitToUserSockets, joinUserToChat, removeUserFromChat } from '../Config/socket.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { CustomError } from '../Utils/customError.mjs';
import { filterUnblockedContactIds } from '../Utils/conversationControls.mjs';
import { CHAT_ENCRYPTION_MODES } from '../Utils/encryptionMode.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';
import {
  DEFAULT_SPACE_CHANNEL_NAME,
  PUBLIC_SPACE_MEMBER_SELECT,
  canManageSpace,
  findSpaceMember,
  normalizeChannelKey,
  normalizeSpaceRole,
  serializeChannel,
  serializeSpace,
  toIdString,
  validateChannelDescription,
  validateChannelName,
  validateMemberUsernames,
  validateSpaceDescription,
  validateSpaceName,
} from '../Utils/spaceAccess.mjs';
import { validateUsername } from '../Utils/usernameValidation.mjs';

const SPACE_NOT_FOUND_MESSAGE = 'Space not found';
const SPACE_MEMBER_ERROR = 'We could not update that space member. Check the username and try again.';

const isDuplicateKeyError = (error) => error?.code === 11000;

const populateSpacePublicFields = async (space) => {
  await space.populate('members.user', PUBLIC_SPACE_MEMBER_SELECT);
  await space.populate('owner', PUBLIC_SPACE_MEMBER_SELECT);
  await space.populate('createdBy', PUBLIC_SPACE_MEMBER_SELECT);

  return space;
};

const populateChannelPublicFields = async (channel) => {
  await channel.populate('members', PUBLIC_SPACE_MEMBER_SELECT);
  await channel.populate('latestMessage');

  return channel;
};

const listChannelsForSpace = async (spaceId) => {
  const channels = await Chats.find({
    space: spaceId,
    isSpaceChannel: true,
  })
    .populate('members', PUBLIC_SPACE_MEMBER_SELECT)
    .populate('latestMessage')
    .sort({ createdAt: 1, _id: 1 });

  return channels;
};

const loadMemberSpace = async ({ spaceId, requesterId, next }) => {
  if (!mongoose.Types.ObjectId.isValid(spaceId)) {
    next(new CustomError(SPACE_NOT_FOUND_MESSAGE, 404));
    return null;
  }

  const space = await Spaces.findById(spaceId);

  if (!space || !findSpaceMember(space, requesterId)) {
    next(new CustomError(SPACE_NOT_FOUND_MESSAGE, 404));
    return null;
  }

  await populateSpacePublicFields(space);
  return space;
};

const loadManageableSpace = async ({ spaceId, requesterId, next }) => {
  const space = await loadMemberSpace({ spaceId, requesterId, next });

  if (!space) {
    return null;
  }

  if (!canManageSpace(space, requesterId)) {
    next(new CustomError('Only a space owner or admin can manage this space', 403));
    return null;
  }

  return space;
};

const resolveUsersByUsername = async (usernames) => {
  const users = await User.find({ username: { $in: usernames } })
    .select(PUBLIC_SPACE_MEMBER_SELECT);
  const usersByUsername = new Map(users.map((user) => [user.username, user]));
  const orderedUsers = usernames.map((username) => usersByUsername.get(username));

  if (orderedUsers.some((user) => !user)) {
    return {
      ok: false,
      message: SPACE_MEMBER_ERROR,
    };
  }

  return {
    ok: true,
    users: orderedUsers,
  };
};

const resolveInitialMembers = async ({ requesterId, memberUsernames }) => {
  const usernameValidation = validateMemberUsernames(memberUsernames);

  if (!usernameValidation.ok) {
    return usernameValidation;
  }

  const resolvedUsers = await resolveUsersByUsername(usernameValidation.value);

  if (!resolvedUsers.ok) {
    return resolvedUsers;
  }

  const requesterIdString = requesterId.toString();
  const memberIds = resolvedUsers.users.map((user) => user._id.toString());

  if (memberIds.includes(requesterIdString)) {
    return {
      ok: false,
      message: 'Each member username must be unique.',
    };
  }

  const unblockedIds = await filterUnblockedContactIds({
    userId: requesterId,
    contactIds: memberIds,
  });

  if (unblockedIds.length !== memberIds.length) {
    return {
      ok: false,
      message: SPACE_MEMBER_ERROR,
    };
  }

  return {
    ok: true,
    memberIds: [requesterIdString, ...memberIds],
  };
};

const emitSpaceUpdate = async ({ space, channels, eventName = 'space:updated', excludeUserIds = [] }) => {
  const excluded = new Set(excludeUserIds.map((id) => id.toString()));

  await Promise.all((space.members ?? []).map(async (member) => {
    const memberId = toIdString(member.user);

    if (!memberId || excluded.has(memberId)) {
      return;
    }

    emitToUserSockets(memberId, eventName, serializeSpace(space, {
      requesterId: memberId,
      channels,
    }));
  }));
};

const createSpaceChannelRecord = async ({ space, name, description = '' }) => {
  const channelNameValidation = validateChannelName(name);

  if (!channelNameValidation.ok) {
    return channelNameValidation;
  }

  const channelDescriptionValidation = validateChannelDescription(description);

  if (!channelDescriptionValidation.ok) {
    return channelDescriptionValidation;
  }

  const channel = await Chats.create({
    chatName: channelNameValidation.value,
    members: space.members.map((member) => member.user?._id ?? member.user),
    isGroupChat: true,
    isSpaceChannel: true,
    space: space._id,
    channelName: channelNameValidation.value,
    channelKey: channelNameValidation.channelKey,
    channelDescription: channelDescriptionValidation.value,
    encryptionMode: CHAT_ENCRYPTION_MODES.STANDARD,
  });

  await populateChannelPublicFields(channel);
  return {
    ok: true,
    channel,
  };
};

export const createSpace = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const nameValidation = validateSpaceName(req.body?.name);
  if (!nameValidation.ok) {
    return next(new CustomError(nameValidation.message, nameValidation.statusCode));
  }

  const descriptionValidation = validateSpaceDescription(req.body?.description);
  if (!descriptionValidation.ok) {
    return next(new CustomError(descriptionValidation.message, descriptionValidation.statusCode));
  }

  const memberResolution = await resolveInitialMembers({
    requesterId,
    memberUsernames: req.body?.memberUsernames,
  });

  if (!memberResolution.ok) {
    return next(new CustomError(memberResolution.message, memberResolution.statusCode ?? 400));
  }

  const space = await Spaces.create({
    name: nameValidation.value,
    description: descriptionValidation.value,
    owner: requesterId,
    createdBy: requesterId,
    members: memberResolution.memberIds.map((memberId, index) => ({
      user: memberId,
      role: index === 0 ? SPACE_ROLES.OWNER : SPACE_ROLES.MEMBER,
    })),
  });

  let defaultChannelResult;

  try {
    defaultChannelResult = await createSpaceChannelRecord({
      space,
      name: DEFAULT_SPACE_CHANNEL_NAME,
      description: 'Default channel',
    });
  } catch (error) {
    await Spaces.findByIdAndDelete(space._id);
    throw error;
  }

  if (!defaultChannelResult.ok) {
    await Spaces.findByIdAndDelete(space._id);
    return next(new CustomError(defaultChannelResult.message, defaultChannelResult.statusCode));
  }

  space.defaultChannel = defaultChannelResult.channel._id;
  await space.save();
  await populateSpacePublicFields(space);

  const channels = [defaultChannelResult.channel];

  try {
    memberResolution.memberIds.forEach((memberId) => {
      joinUserToChat(memberId, defaultChannelResult.channel._id);
    });
    await emitSpaceUpdate({
      space,
      channels,
      eventName: 'space:new',
      excludeUserIds: [requesterId],
    });
  } catch (error) {
    logger.error('space.create_notification_failed', {
      spaceId: space._id.toString(),
      requesterId,
      memberCount: memberResolution.memberIds.length,
      error,
    });
  }

  res.status(201).json({
    status: 'success',
    data: {
      space: serializeSpace(space, { requesterId, channels }),
      channel: serializeChannel(defaultChannelResult.channel),
    },
  });
});

export const getSpaces = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const spaces = await Spaces.find({ 'members.user': req.userId })
    .populate('members.user', PUBLIC_SPACE_MEMBER_SELECT)
    .populate('owner', PUBLIC_SPACE_MEMBER_SELECT)
    .populate('createdBy', PUBLIC_SPACE_MEMBER_SELECT)
    .sort({ updatedAt: -1, _id: -1 });
  const channels = await Chats.find({
    space: { $in: spaces.map((space) => space._id) },
    isSpaceChannel: true,
    members: req.userId,
  })
    .populate('members', PUBLIC_SPACE_MEMBER_SELECT)
    .populate('latestMessage')
    .sort({ createdAt: 1, _id: 1 });
  const channelsBySpaceId = new Map();

  channels.forEach((channel) => {
    const spaceId = toIdString(channel.space);
    const group = channelsBySpaceId.get(spaceId) ?? [];
    group.push(channel);
    channelsBySpaceId.set(spaceId, group);
  });

  res.status(200).json({
    status: 'success',
    data: {
      spaces: spaces.map((space) => serializeSpace(space, {
        requesterId,
        channels: channelsBySpaceId.get(space._id.toString()) ?? [],
      })),
    },
  });
});

export const getSpace = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const space = await loadMemberSpace({
    spaceId: req.params.spaceId,
    requesterId,
    next,
  });

  if (!space) {
    return;
  }

  const channels = await listChannelsForSpace(space._id);

  res.status(200).json({
    status: 'success',
    data: {
      space: serializeSpace(space, { requesterId, channels }),
    },
  });
});

export const addSpaceMember = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const space = await loadManageableSpace({
    spaceId: req.params.spaceId,
    requesterId,
    next,
  });

  if (!space) {
    return;
  }

  const usernameValidation = validateUsername(req.body?.username);
  if (!usernameValidation.ok) {
    return next(new CustomError('Use a valid member username.', 400));
  }

  const targetUser = await User.findOne({ username: usernameValidation.value })
    .select(PUBLIC_SPACE_MEMBER_SELECT);

  if (!targetUser) {
    return next(new CustomError(SPACE_MEMBER_ERROR, 404));
  }

  if (findSpaceMember(space, targetUser._id)) {
    return next(new CustomError('User is already a space member.', 409));
  }

  if ((space.members ?? []).length >= SPACE_LIMITS.members) {
    return next(new CustomError(`Spaces can have up to ${SPACE_LIMITS.members} members.`, 400));
  }

  const unblockedIds = await filterUnblockedContactIds({
    userId: requesterId,
    contactIds: [targetUser._id],
  });

  if (unblockedIds.length !== 1) {
    return next(new CustomError(SPACE_MEMBER_ERROR, 404));
  }

  space.members.push({
    user: targetUser._id,
    role: normalizeSpaceRole(req.body?.role),
  });
  await space.save();

  const channels = await listChannelsForSpace(space._id);
  await Chats.updateMany(
    { space: space._id, isSpaceChannel: true },
    { $addToSet: { members: targetUser._id } }
  );
  channels.forEach((channel) => {
    channel.members.push(targetUser);
    joinUserToChat(targetUser._id, channel._id);
  });

  await populateSpacePublicFields(space);

  try {
    emitToUserSockets(targetUser._id, 'space:new', serializeSpace(space, {
      requesterId: targetUser._id.toString(),
      channels,
    }));
    await emitSpaceUpdate({
      space,
      channels,
      excludeUserIds: [targetUser._id],
    });
  } catch (error) {
    logger.error('space.add_member_notification_failed', {
      spaceId: space._id.toString(),
      requesterId,
      targetUserId: targetUser._id.toString(),
      error,
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      space: serializeSpace(space, { requesterId, channels }),
    },
  });
});

export const removeSpaceMember = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const space = await loadManageableSpace({
    spaceId: req.params.spaceId,
    requesterId,
    next,
  });

  if (!space) {
    return;
  }

  if (!mongoose.Types.ObjectId.isValid(req.params.memberId)) {
    return next(new CustomError(SPACE_MEMBER_ERROR, 404));
  }

  const targetMember = findSpaceMember(space, req.params.memberId);

  if (!targetMember) {
    return next(new CustomError(SPACE_MEMBER_ERROR, 404));
  }

  if (targetMember.role === SPACE_ROLES.OWNER) {
    return next(new CustomError('The space owner cannot be removed.', 403));
  }

  const targetUserId = toIdString(targetMember.user);

  space.members = space.members.filter((member) => toIdString(member.user) !== targetUserId);
  await space.save();

  const channels = await listChannelsForSpace(space._id);
  await Chats.updateMany(
    { space: space._id, isSpaceChannel: true },
    { $pull: { members: targetUserId } }
  );
  channels.forEach((channel) => {
    channel.members = channel.members.filter((member) => toIdString(member) !== targetUserId);
    removeUserFromChat(targetUserId, channel._id);
  });

  await populateSpacePublicFields(space);

  try {
    emitToUserSockets(targetUserId, 'space:removed', {
      spaceId: space._id.toString(),
      channelIds: channels.map((channel) => channel._id.toString()),
    });
    await emitSpaceUpdate({ space, channels });
  } catch (error) {
    logger.error('space.remove_member_notification_failed', {
      spaceId: space._id.toString(),
      requesterId,
      targetUserId,
      error,
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      space: serializeSpace(space, { requesterId, channels }),
    },
  });
});

export const getSpaceChannels = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const space = await loadMemberSpace({
    spaceId: req.params.spaceId,
    requesterId,
    next,
  });

  if (!space) {
    return;
  }

  const channels = await listChannelsForSpace(space._id);

  res.status(200).json({
    status: 'success',
    data: {
      channels: channels.map(serializeChannel),
    },
  });
});

export const createSpaceChannel = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const space = await loadManageableSpace({
    spaceId: req.params.spaceId,
    requesterId,
    next,
  });

  if (!space) {
    return;
  }

  const channelCount = await Chats.countDocuments({
    space: space._id,
    isSpaceChannel: true,
  });

  if (channelCount >= SPACE_LIMITS.channels) {
    return next(new CustomError(`Spaces can have up to ${SPACE_LIMITS.channels} channels.`, 400));
  }

  const nameValidation = validateChannelName(req.body?.name);

  if (!nameValidation.ok) {
    return next(new CustomError(nameValidation.message, nameValidation.statusCode));
  }

  const duplicate = await Chats.findOne({
    space: space._id,
    isSpaceChannel: true,
    channelKey: normalizeChannelKey(nameValidation.value),
  }).select('_id');

  if (duplicate) {
    return next(new CustomError('A channel with that name already exists.', 409));
  }

  let channelResult;

  try {
    channelResult = await createSpaceChannelRecord({
      space,
      name: nameValidation.value,
      description: req.body?.description,
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    return next(new CustomError('A channel with that name already exists.', 409));
  }

  if (!channelResult.ok) {
    return next(new CustomError(channelResult.message, channelResult.statusCode));
  }

  try {
    (space.members ?? []).forEach((member) => {
      joinUserToChat(toIdString(member.user), channelResult.channel._id);
    });
    await emitSpaceUpdate({
      space,
      channels: await listChannelsForSpace(space._id),
    });
  } catch (error) {
    logger.error('space.channel_create_notification_failed', {
      spaceId: space._id.toString(),
      channelId: channelResult.channel._id.toString(),
      requesterId,
      error,
    });
  }

  res.status(201).json({
    status: 'success',
    data: {
      channel: serializeChannel(channelResult.channel),
    },
  });
});
