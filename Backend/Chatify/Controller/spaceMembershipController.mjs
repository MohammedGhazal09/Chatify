import mongoose from 'mongoose';
import Chats from '../Models/chatModel.mjs';
import Spaces, { SPACE_LIMITS, SPACE_ROLES } from '../Models/spaceModel.mjs';
import User from '../Models/userModel.mjs';
import { emitToUserSockets, joinUserToChat, removeUserFromChat } from '../Config/socket.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { CustomError } from '../Utils/customError.mjs';
import { filterUnblockedContactIds } from '../Utils/conversationControls.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';
import {
  PUBLIC_SPACE_MEMBER_SELECT,
  findSpaceMember,
  normalizeSpaceRole,
  serializeSpace,
  toIdString,
} from '../Utils/spaceAccess.mjs';
import { validateUsername } from '../Utils/usernameValidation.mjs';

const SPACE_NOT_FOUND_MESSAGE = 'Space not found';
const SPACE_MEMBER_ERROR = 'We could not update that space member. Check the username and try again.';
const MANAGER_ROLES = Object.freeze([SPACE_ROLES.OWNER, SPACE_ROLES.ADMIN]);

const populateSpacePublicFields = async (space) => {
  await space.populate('members.user', PUBLIC_SPACE_MEMBER_SELECT);
  await space.populate('owner', PUBLIC_SPACE_MEMBER_SELECT);
  await space.populate('createdBy', PUBLIC_SPACE_MEMBER_SELECT);
  return space;
};

const listChannelsForSpace = (spaceId) => Chats.find({
  space: spaceId,
  isSpaceChannel: true,
})
  .populate('members', PUBLIC_SPACE_MEMBER_SELECT)
  .populate('latestMessage')
  .sort({ createdAt: 1, _id: 1 });

const emitSpaceUpdate = async ({ space, channels, excludeUserIds = [] }) => {
  const excluded = new Set(excludeUserIds.map((id) => id.toString()));

  await Promise.all((space.members ?? []).map(async (member) => {
    const memberId = toIdString(member.user);
    if (!memberId || excluded.has(memberId)) return;

    emitToUserSockets(memberId, 'space:updated', serializeSpace(space, {
      requesterId: memberId,
      channels,
    }));
  }));
};

const ensureValidSpaceId = (spaceId, next) => {
  if (mongoose.Types.ObjectId.isValid(spaceId)) return true;
  next(new CustomError(SPACE_NOT_FOUND_MESSAGE, 404));
  return false;
};

const loadMutationFailure = async ({ spaceId, requesterId, targetUserId, requestedRole }) => {
  const current = await Spaces.findById(spaceId).select('owner members');
  if (!current || !findSpaceMember(current, requesterId)) {
    return new CustomError(SPACE_NOT_FOUND_MESSAGE, 404);
  }

  const requester = findSpaceMember(current, requesterId);
  if (!MANAGER_ROLES.includes(requester?.role)) {
    return new CustomError('Only a space owner or admin can manage this space', 403);
  }
  if (requestedRole === SPACE_ROLES.ADMIN && requester.role !== SPACE_ROLES.OWNER) {
    return new CustomError('Only the space owner can assign administrator roles', 403);
  }
  if (findSpaceMember(current, targetUserId)) {
    return new CustomError('User is already a space member.', 409);
  }
  if ((current.members ?? []).length >= SPACE_LIMITS.members) {
    return new CustomError(`Spaces can have up to ${SPACE_LIMITS.members} members.`, 400);
  }

  return new CustomError('Space membership changed. Refresh and try again.', 409);
};

export const addSpaceMember = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const { spaceId } = req.params;

  if (!requesterId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }
  if (!ensureValidSpaceId(spaceId, next)) return;

  const usernameValidation = validateUsername(req.body?.username);
  if (!usernameValidation.ok) {
    return next(new CustomError('Use a valid member username.', 400));
  }

  const targetUser = await User.findOne({ username: usernameValidation.value })
    .select(PUBLIC_SPACE_MEMBER_SELECT);
  if (!targetUser) {
    return next(new CustomError(SPACE_MEMBER_ERROR, 404));
  }

  const requestedRole = normalizeSpaceRole(req.body?.role);
  const unblockedIds = await filterUnblockedContactIds({
    userId: requesterId,
    contactIds: [targetUser._id],
  });
  if (unblockedIds.length !== 1) {
    return next(new CustomError(SPACE_MEMBER_ERROR, 404));
  }

  const allowedRequesterRoles = requestedRole === SPACE_ROLES.ADMIN
    ? [SPACE_ROLES.OWNER]
    : MANAGER_ROLES;
  const updatedSpace = await Spaces.findOneAndUpdate(
    {
      _id: spaceId,
      $and: [
        {
          members: {
            $elemMatch: {
              user: requesterId,
              role: { $in: allowedRequesterRoles },
            },
          },
        },
        { 'members.user': { $ne: targetUser._id } },
        { [`members.${SPACE_LIMITS.members - 1}`]: { $exists: false } },
      ],
    },
    {
      $push: {
        members: {
          user: targetUser._id,
          role: requestedRole,
          joinedAt: new Date(),
        },
      },
    },
    { new: true, runValidators: true }
  );

  if (!updatedSpace) {
    return next(await loadMutationFailure({
      spaceId,
      requesterId,
      targetUserId: targetUser._id,
      requestedRole,
    }));
  }

  await Chats.updateMany(
    { space: updatedSpace._id, isSpaceChannel: true },
    { $addToSet: { members: targetUser._id } }
  );
  const channels = await listChannelsForSpace(updatedSpace._id);
  channels.forEach((channel) => joinUserToChat(targetUser._id, channel._id));
  await populateSpacePublicFields(updatedSpace);

  try {
    emitToUserSockets(targetUser._id, 'space:new', serializeSpace(updatedSpace, {
      requesterId: targetUser._id.toString(),
      channels,
    }));
    await emitSpaceUpdate({
      space: updatedSpace,
      channels,
      excludeUserIds: [targetUser._id],
    });
  } catch (error) {
    logger.error('space.add_member_notification_failed', {
      spaceId: updatedSpace._id.toString(),
      requesterId,
      targetUserId: targetUser._id.toString(),
      error,
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      space: serializeSpace(updatedSpace, { requesterId, channels }),
    },
  });
});

const loadRemovalFailure = async ({ spaceId, requesterId, targetUserId }) => {
  const current = await Spaces.findById(spaceId).select('owner members');
  if (!current || !findSpaceMember(current, requesterId)) {
    return new CustomError(SPACE_NOT_FOUND_MESSAGE, 404);
  }

  const requester = findSpaceMember(current, requesterId);
  if (!MANAGER_ROLES.includes(requester?.role)) {
    return new CustomError('Only a space owner or admin can manage this space', 403);
  }

  const target = findSpaceMember(current, targetUserId);
  if (!target) return new CustomError(SPACE_MEMBER_ERROR, 404);
  if (target.role === SPACE_ROLES.OWNER) {
    return new CustomError('The space owner cannot be removed.', 403);
  }
  if (target.role === SPACE_ROLES.ADMIN && requester.role !== SPACE_ROLES.OWNER) {
    return new CustomError('Only the space owner can remove an administrator', 403);
  }

  return new CustomError('Space membership changed. Refresh and try again.', 409);
};

export const removeSpaceMember = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const { spaceId, memberId } = req.params;

  if (!requesterId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }
  if (!ensureValidSpaceId(spaceId, next)) return;
  if (!mongoose.Types.ObjectId.isValid(memberId)) {
    return next(new CustomError(SPACE_MEMBER_ERROR, 404));
  }

  const snapshot = await Spaces.findById(spaceId).select('members');
  const targetMember = findSpaceMember(snapshot, memberId);
  if (!targetMember) return next(new CustomError(SPACE_MEMBER_ERROR, 404));
  if (targetMember.role === SPACE_ROLES.OWNER) {
    return next(new CustomError('The space owner cannot be removed.', 403));
  }

  const allowedRequesterRoles = targetMember.role === SPACE_ROLES.ADMIN
    ? [SPACE_ROLES.OWNER]
    : MANAGER_ROLES;
  const updatedSpace = await Spaces.findOneAndUpdate(
    {
      _id: spaceId,
      $and: [
        {
          members: {
            $elemMatch: {
              user: requesterId,
              role: { $in: allowedRequesterRoles },
            },
          },
        },
        {
          members: {
            $elemMatch: {
              user: memberId,
              role: targetMember.role,
            },
          },
        },
      ],
    },
    { $pull: { members: { user: memberId, role: targetMember.role } } },
    { new: true, runValidators: true }
  );

  if (!updatedSpace) {
    return next(await loadRemovalFailure({
      spaceId,
      requesterId,
      targetUserId: memberId,
    }));
  }

  await Chats.updateMany(
    { space: updatedSpace._id, isSpaceChannel: true },
    { $pull: { members: memberId } }
  );
  const channels = await listChannelsForSpace(updatedSpace._id);
  channels.forEach((channel) => removeUserFromChat(memberId, channel._id));
  await populateSpacePublicFields(updatedSpace);

  try {
    emitToUserSockets(memberId, 'space:removed', {
      spaceId: updatedSpace._id.toString(),
      channelIds: channels.map((channel) => channel._id.toString()),
    });
    await emitSpaceUpdate({ space: updatedSpace, channels });
  } catch (error) {
    logger.error('space.remove_member_notification_failed', {
      spaceId: updatedSpace._id.toString(),
      requesterId,
      targetUserId: memberId,
      error,
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      space: serializeSpace(updatedSpace, { requesterId, channels }),
    },
  });
});
