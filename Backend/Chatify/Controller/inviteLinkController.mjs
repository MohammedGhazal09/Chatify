import mongoose from 'mongoose';
import Chats from '../Models/chatModel.mjs';
import InviteLink, { INVITE_TARGET_TYPES } from '../Models/inviteLinkModel.mjs';
import Spaces, { SPACE_LIMITS, SPACE_ROLES } from '../Models/spaceModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { CustomError } from '../Utils/customError.mjs';
import { emitToUserSockets, joinUserToChat } from '../Config/socket.mjs';
import { buildConversationControls, filterUnblockedContactIds } from '../Utils/conversationControls.mjs';
import { buildConversationOrganizationState, getConversationOrganizationMap } from '../Utils/conversationOrganization.mjs';
import { CHAT_ENCRYPTION_MODES, normalizeChatEncryptionMode } from '../Utils/encryptionMode.mjs';
import {
  assertInviteActive,
  buildInviteUrl,
  generateInviteToken,
  hashInviteToken,
  normalizeInviteExpiryDays,
  normalizeInviteMaxUses,
  serializeInviteLink,
  validateInviteToken,
} from '../Utils/inviteLinks.mjs';
import {
  PUBLIC_SPACE_MEMBER_SELECT,
  canManageSpace,
  findSpaceMember,
  serializeSpace,
  toIdString,
} from '../Utils/spaceAccess.mjs';

const PUBLIC_CHAT_MEMBER_SELECT = 'username firstName lastName profilePic profileBio identityMark identityMarkUpdatedAt';
const GROUP_MEMBER_MAX = 10;
const INVITE_UNAVAILABLE_MESSAGE = 'Invite unavailable.';

const isGroupMember = (chat, userId) => (
  (chat?.members ?? []).some((member) => toIdString(member) === toIdString(userId))
);

const populateGroupPublicFields = async (chat) => {
  await chat.populate('members', PUBLIC_CHAT_MEMBER_SELECT);
  await chat.populate('groupAdmin', PUBLIC_CHAT_MEMBER_SELECT);
  await chat.populate('latestMessage');

  return chat;
};

const populateInviteCreator = (query) => query.populate('createdBy', PUBLIC_CHAT_MEMBER_SELECT);

const serializeChatForInvite = async (chat, requesterId) => {
  const chatObject = chat.toObject?.() ?? chat;
  const chatId = toIdString(chatObject);
  const organizationByChatId = await getConversationOrganizationMap({
    userId: requesterId,
    chatIds: [chatId],
  });

  return {
    ...chatObject,
    _id: chatId,
    encryptionMode: normalizeChatEncryptionMode(chatObject.encryptionMode),
    members: chatObject.members ?? [],
    conversationControls: await buildConversationControls({ chat, userId: requesterId }),
    organizationState: buildConversationOrganizationState({
      chatId,
      organization: organizationByChatId.get(chatId),
      mutedChatIds: [],
    }),
  };
};

const loadGroupForInviteManagement = async ({ chatId, requesterId, next }) => {
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    next(new CustomError('Chat not found', 404));
    return null;
  }

  const chat = await Chats.findById(chatId);

  if (!chat || !chat.isGroupChat || chat.isSpaceChannel || !isGroupMember(chat, requesterId)) {
    next(new CustomError('Chat not found', 404));
    return null;
  }

  if (normalizeChatEncryptionMode(chat.encryptionMode) !== CHAT_ENCRYPTION_MODES.STANDARD) {
    next(new CustomError('Invite links are unavailable for encrypted conversations.', 400));
    return null;
  }

  if (toIdString(chat.groupAdmin) !== requesterId) {
    next(new CustomError('Only the group admin can manage invite links.', 403));
    return null;
  }

  await populateGroupPublicFields(chat);
  return chat;
};

const loadSpaceForInviteManagement = async ({ spaceId, requesterId, next }) => {
  if (!mongoose.Types.ObjectId.isValid(spaceId)) {
    next(new CustomError('Space not found', 404));
    return null;
  }

  const space = await Spaces.findById(spaceId)
    .populate('members.user', PUBLIC_SPACE_MEMBER_SELECT)
    .populate('owner', PUBLIC_SPACE_MEMBER_SELECT)
    .populate('createdBy', PUBLIC_SPACE_MEMBER_SELECT);

  if (!space || !findSpaceMember(space, requesterId)) {
    next(new CustomError('Space not found', 404));
    return null;
  }

  if (!canManageSpace(space, requesterId)) {
    next(new CustomError('Only a space owner or admin can manage invite links.', 403));
    return null;
  }

  return space;
};

const createInviteForTarget = async ({ req, res, next, targetType, chat = null, space = null }) => {
  const requesterId = req.userId?.toString();
  const expiry = normalizeInviteExpiryDays(req.body?.expiresInDays);

  if (!expiry.ok) {
    return next(new CustomError(expiry.message, expiry.statusCode));
  }

  const maxUses = normalizeInviteMaxUses(req.body?.maxUses);

  if (!maxUses.ok) {
    return next(new CustomError(maxUses.message, maxUses.statusCode));
  }

  const token = generateInviteToken();
  const invite = await InviteLink.create({
    targetType,
    chat: chat?._id,
    space: space?._id,
    tokenHash: hashInviteToken(token),
    createdBy: requesterId,
    expiresAt: expiry.expiresAt,
    maxUses: maxUses.value,
  });
  await invite.populate('createdBy', PUBLIC_CHAT_MEMBER_SELECT);

  return res.status(201).json({
    status: 'success',
    data: {
      invite: serializeInviteLink(invite),
      inviteUrl: buildInviteUrl(req, token),
    },
  });
};

export const createGroupInviteLink = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const chat = await loadGroupForInviteManagement({
    chatId: req.params.chatId,
    requesterId,
    next,
  });

  if (!chat) {
    return;
  }

  return createInviteForTarget({
    req,
    res,
    next,
    targetType: INVITE_TARGET_TYPES.GROUP,
    chat,
  });
});

export const listGroupInviteLinks = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const chat = await loadGroupForInviteManagement({
    chatId: req.params.chatId,
    requesterId,
    next,
  });

  if (!chat) {
    return;
  }

  const invites = await populateInviteCreator(InviteLink.find({
    targetType: INVITE_TARGET_TYPES.GROUP,
    chat: chat._id,
  }).sort({ createdAt: -1, _id: -1 }));

  res.status(200).json({
    status: 'success',
    data: {
      invites: invites.map(serializeInviteLink),
    },
  });
});

export const createSpaceInviteLink = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const space = await loadSpaceForInviteManagement({
    spaceId: req.params.spaceId,
    requesterId,
    next,
  });

  if (!space) {
    return;
  }

  return createInviteForTarget({
    req,
    res,
    next,
    targetType: INVITE_TARGET_TYPES.SPACE,
    space,
  });
});

export const listSpaceInviteLinks = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const space = await loadSpaceForInviteManagement({
    spaceId: req.params.spaceId,
    requesterId,
    next,
  });

  if (!space) {
    return;
  }

  const invites = await populateInviteCreator(InviteLink.find({
    targetType: INVITE_TARGET_TYPES.SPACE,
    space: space._id,
  }).sort({ createdAt: -1, _id: -1 }));

  res.status(200).json({
    status: 'success',
    data: {
      invites: invites.map(serializeInviteLink),
    },
  });
});

const loadInviteForRevocation = async ({ inviteId, requesterId, next }) => {
  if (!mongoose.Types.ObjectId.isValid(inviteId)) {
    next(new CustomError('Invite not found', 404));
    return null;
  }

  const invite = await populateInviteCreator(InviteLink.findById(inviteId));

  if (!invite) {
    next(new CustomError('Invite not found', 404));
    return null;
  }

  if (invite.targetType === INVITE_TARGET_TYPES.GROUP) {
    const chat = await loadGroupForInviteManagement({
      chatId: invite.chat,
      requesterId,
      next,
    });

    return chat ? invite : null;
  }

  const space = await loadSpaceForInviteManagement({
    spaceId: invite.space,
    requesterId,
    next,
  });

  return space ? invite : null;
};

export const revokeInviteLink = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();
  const invite = await loadInviteForRevocation({
    inviteId: req.params.inviteId,
    requesterId,
    next,
  });

  if (!invite) {
    return;
  }

  if (!invite.revokedAt) {
    invite.revokedAt = new Date();
    invite.revokedBy = requesterId;
    await invite.save();
    await invite.populate('createdBy', PUBLIC_CHAT_MEMBER_SELECT);
  }

  res.status(200).json({
    status: 'success',
    data: {
      invite: serializeInviteLink(invite),
    },
  });
});

const loadInviteByToken = async ({ token, next }) => {
  const tokenValidation = validateInviteToken(token);

  if (!tokenValidation.ok) {
    next(new CustomError(tokenValidation.message, tokenValidation.statusCode));
    return null;
  }

  const invite = await InviteLink.findOne({ tokenHash: tokenValidation.tokenHash }).select('+tokenHash');

  if (!invite) {
    next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 404));
    return null;
  }

  return invite;
};

const enforceInviteActiveForNewMember = (invite, next) => {
  const active = assertInviteActive(invite);

  if (!active.ok) {
    next(new CustomError(active.message, active.statusCode));
    return false;
  }

  return true;
};

const claimInviteUse = async (invite) => {
  const claimedAt = new Date();
  const claimedInvite = await InviteLink.findOneAndUpdate(
    {
      _id: invite._id,
      revokedAt: null,
      expiresAt: { $gt: claimedAt },
      $or: [
        { maxUses: null },
        { $expr: { $lt: ['$useCount', '$maxUses'] } },
      ],
    },
    {
      $inc: { useCount: 1 },
      $set: { lastUsedAt: claimedAt },
    },
    { new: true }
  );

  return Boolean(claimedInvite);
};

const joinGroupInvite = async ({ invite, requesterId, res, next }) => {
  const chat = await Chats.findById(invite.chat);

  if (!chat || !chat.isGroupChat || chat.isSpaceChannel) {
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 404));
  }

  if (normalizeChatEncryptionMode(chat.encryptionMode) !== CHAT_ENCRYPTION_MODES.STANDARD) {
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 404));
  }

  if (isGroupMember(chat, requesterId)) {
    await populateGroupPublicFields(chat);
    return res.status(200).json({
      status: 'success',
      data: {
        targetType: INVITE_TARGET_TYPES.GROUP,
        alreadyMember: true,
        chat: await serializeChatForInvite(chat, requesterId),
      },
    });
  }

  if (!enforceInviteActiveForNewMember(invite, next)) {
    return;
  }

  if ((chat.members ?? []).length >= GROUP_MEMBER_MAX) {
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 410));
  }

  const adminId = toIdString(chat.groupAdmin);
  const unblockedIds = await filterUnblockedContactIds({
    userId: requesterId,
    contactIds: [adminId],
  });

  if (unblockedIds.length !== 1) {
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 404));
  }

  const joinedChat = await Chats.findOneAndUpdate(
    {
      _id: chat._id,
      members: { $ne: requesterId },
      [`members.${GROUP_MEMBER_MAX - 1}`]: { $exists: false },
    },
    { $addToSet: { members: requesterId } },
    { new: true }
  );

  if (!joinedChat) {
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 410));
  }

  const inviteUseClaimed = await claimInviteUse(invite);

  if (!inviteUseClaimed) {
    await Chats.updateOne({ _id: joinedChat._id }, { $pull: { members: requesterId } });
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 410));
  }

  await populateGroupPublicFields(joinedChat);
  joinUserToChat(requesterId, joinedChat._id);
  emitToUserSockets(requesterId, 'chat:new', await serializeChatForInvite(joinedChat, requesterId));

  return res.status(200).json({
    status: 'success',
    data: {
      targetType: INVITE_TARGET_TYPES.GROUP,
      alreadyMember: false,
      chat: await serializeChatForInvite(joinedChat, requesterId),
    },
  });
};

const listChannelsForSpace = async (spaceId) => Chats.find({
  space: spaceId,
  isSpaceChannel: true,
})
  .populate('members', PUBLIC_SPACE_MEMBER_SELECT)
  .populate('latestMessage')
  .sort({ createdAt: 1, _id: 1 });

const joinSpaceInvite = async ({ invite, requesterId, res, next }) => {
  const space = await Spaces.findById(invite.space);

  if (!space) {
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 404));
  }

  if (findSpaceMember(space, requesterId)) {
    await space.populate('members.user', PUBLIC_SPACE_MEMBER_SELECT);
    await space.populate('owner', PUBLIC_SPACE_MEMBER_SELECT);
    await space.populate('createdBy', PUBLIC_SPACE_MEMBER_SELECT);
    const channels = await listChannelsForSpace(space._id);

    return res.status(200).json({
      status: 'success',
      data: {
        targetType: INVITE_TARGET_TYPES.SPACE,
        alreadyMember: true,
        space: serializeSpace(space, { requesterId, channels }),
      },
    });
  }

  if (!enforceInviteActiveForNewMember(invite, next)) {
    return;
  }

  if ((space.members ?? []).length >= SPACE_LIMITS.members) {
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 410));
  }

  const ownerId = toIdString(space.owner);
  const unblockedIds = await filterUnblockedContactIds({
    userId: requesterId,
    contactIds: [ownerId],
  });

  if (unblockedIds.length !== 1) {
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 404));
  }

  const joinedSpace = await Spaces.findOneAndUpdate(
    {
      _id: space._id,
      'members.user': { $ne: requesterId },
      [`members.${SPACE_LIMITS.members - 1}`]: { $exists: false },
    },
    { $push: { members: { user: requesterId, role: SPACE_ROLES.MEMBER, joinedAt: new Date() } } },
    { new: true }
  );

  if (!joinedSpace) {
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 410));
  }

  const inviteUseClaimed = await claimInviteUse(invite);

  if (!inviteUseClaimed) {
    await Spaces.updateOne({ _id: joinedSpace._id }, { $pull: { members: { user: requesterId } } });
    return next(new CustomError(INVITE_UNAVAILABLE_MESSAGE, 410));
  }

  await Chats.updateMany(
    { space: joinedSpace._id, isSpaceChannel: true },
    { $addToSet: { members: requesterId } }
  );

  const channels = await listChannelsForSpace(joinedSpace._id);
  channels.forEach((channel) => {
    joinUserToChat(requesterId, channel._id);
  });
  await joinedSpace.populate('members.user', PUBLIC_SPACE_MEMBER_SELECT);
  await joinedSpace.populate('owner', PUBLIC_SPACE_MEMBER_SELECT);
  await joinedSpace.populate('createdBy', PUBLIC_SPACE_MEMBER_SELECT);

  emitToUserSockets(requesterId, 'space:new', serializeSpace(joinedSpace, {
    requesterId,
    channels,
  }));

  return res.status(200).json({
    status: 'success',
    data: {
      targetType: INVITE_TARGET_TYPES.SPACE,
      alreadyMember: false,
      space: serializeSpace(joinedSpace, { requesterId, channels }),
    },
  });
};

export const joinInviteLink = asyncErrHandler(async (req, res, next) => {
  const requesterId = req.userId?.toString();

  if (!requesterId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const invite = await loadInviteByToken({
    token: req.body?.token ?? req.params.token,
    next,
  });

  if (!invite) {
    return;
  }

  if (invite.targetType === INVITE_TARGET_TYPES.GROUP) {
    return joinGroupInvite({ invite, requesterId, res, next });
  }

  return joinSpaceInvite({ invite, requesterId, res, next });
});
