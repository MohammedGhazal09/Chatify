import { randomInt } from 'node:crypto';
import { SPACE_LIMITS, SPACE_ROLES } from '../Models/spaceModel.mjs';
import { validateUsername } from './usernameValidation.mjs';

export { SPACE_LIMITS, SPACE_ROLES };

export const DEFAULT_SPACE_CHANNEL_NAME = 'general';
export const JOIN_CODE_LENGTH = 8;
// Unambiguous alphabet: no 0/O/1/I to keep shared codes easy to read and type.
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_PATTERN = /^[A-Z0-9]+$/;
export const PUBLIC_SPACE_MEMBER_SELECT = 'username firstName lastName profilePic profileBio profileStatus showProfileStatus identityMark identityMarkUpdatedAt';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const UNSAFE_TEXT_PATTERN = /(https?:\/\/|www\.|data:|javascript:|<|>|&lt;|&gt;)/i;
const CHANNEL_NAME_PATTERN = /^[a-z0-9][a-z0-9 _.-]*[a-z0-9]$/i;

const fail = (message, statusCode = 400) => ({
  ok: false,
  message,
  statusCode,
});

const normalizePlainText = (value) => (
  value === undefined || value === null
    ? ''
    : String(value).trim().replace(/\s+/g, ' ')
);

const validatePlainText = ({ value, label, minLength = 0, maxLength, required = false }) => {
  const normalized = normalizePlainText(value);

  if (required && normalized.length < minLength) {
    return fail(`${label} is required`);
  }

  if (!required && normalized.length === 0) {
    return { ok: true, value: '' };
  }

  if (normalized.length < minLength) {
    return fail(`${label} must be at least ${minLength} characters`);
  }

  if (normalized.length > maxLength) {
    return fail(`${label} must be ${maxLength} characters or fewer`);
  }

  if (CONTROL_CHARACTER_PATTERN.test(normalized) || UNSAFE_TEXT_PATTERN.test(normalized)) {
    return fail(`${label} must be plain text without links or unsafe characters`);
  }

  return { ok: true, value: normalized };
};

export const toIdString = (value) => (
  value?._id?.toString?.() ?? value?.toString?.() ?? ''
);

export const normalizeChannelKey = (value) => (
  normalizePlainText(value)
    .toLocaleLowerCase('en-US')
    .replace(/[_\s.]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
);

export const validateSpaceName = (value) => validatePlainText({
  value,
  label: 'Space name',
  minLength: 2,
  maxLength: 80,
  required: true,
});

export const validateSpaceDescription = (value) => validatePlainText({
  value,
  label: 'Space description',
  maxLength: 240,
  required: false,
});

export const validateChannelName = (value) => {
  const normalized = validatePlainText({
    value,
    label: 'Channel name',
    minLength: 2,
    maxLength: 40,
    required: true,
  });

  if (!normalized.ok) {
    return normalized;
  }

  if (!CHANNEL_NAME_PATTERN.test(normalized.value)) {
    return fail('Channel name can use letters, numbers, spaces, dots, underscores, and hyphens');
  }

  const channelKey = normalizeChannelKey(normalized.value);

  if (!channelKey) {
    return fail('Channel name is invalid');
  }

  return {
    ok: true,
    value: normalized.value,
    channelKey,
  };
};

export const validateChannelDescription = (value) => validatePlainText({
  value,
  label: 'Channel description',
  maxLength: 160,
  required: false,
});

export const validateMemberUsernames = (value, { max = SPACE_LIMITS.members - 1 } = {}) => {
  if (value === undefined || value === null) {
    return { ok: true, value: [] };
  }

  if (!Array.isArray(value)) {
    return fail('Use member usernames.');
  }

  if (value.length > max) {
    return fail(`Spaces can have up to ${SPACE_LIMITS.members} members.`);
  }

  const normalizedUsernames = [];

  for (const username of value) {
    const validation = validateUsername(username);

    if (!validation.ok) {
      return fail('Use valid member usernames.');
    }

    normalizedUsernames.push(validation.value);
  }

  if (new Set(normalizedUsernames).size !== normalizedUsernames.length) {
    return fail('Each member username must be unique.');
  }

  return {
    ok: true,
    value: normalizedUsernames,
  };
};

export const normalizeSpaceRole = (value) => (
  value === SPACE_ROLES.ADMIN ? SPACE_ROLES.ADMIN : SPACE_ROLES.MEMBER
);

export const generateJoinCode = () => {
  let code = '';

  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }

  return code;
};

export const validateJoinCode = (value) => {
  const normalized = String(value ?? '').trim().toUpperCase();

  if (normalized.length !== JOIN_CODE_LENGTH || !JOIN_CODE_PATTERN.test(normalized)) {
    return fail('Enter a valid join code.');
  }

  return { ok: true, value: normalized };
};

export const findSpaceMember = (space, userId) => {
  const targetId = toIdString(userId);

  return (space?.members ?? []).find((member) => toIdString(member.user) === targetId) ?? null;
};

export const isSpaceMember = (space, userId) => Boolean(findSpaceMember(space, userId));

export const canManageSpace = (space, userId) => {
  const member = findSpaceMember(space, userId);

  return member?.role === SPACE_ROLES.OWNER || member?.role === SPACE_ROLES.ADMIN;
};

export const serializePublicSpaceUser = (user) => {
  const userObject = user?.toObject?.() ?? user;
  const userId = toIdString(userObject);

  if (!userId) {
    return null;
  }

  const serialized = {
    _id: userId,
    id: userId,
    username: userObject.username,
    firstName: userObject.firstName,
    lastName: userObject.lastName,
    profilePic: userObject.profilePic ?? '',
    profileBio: userObject.profileBio ?? '',
    profileStatus: userObject.showProfileStatus === false ? '' : userObject.profileStatus ?? '',
    identityMark: userObject.identityMark ?? null,
    identityMarkUpdatedAt: userObject.identityMarkUpdatedAt ?? null,
  };

  Object.keys(serialized).forEach((key) => {
    if (serialized[key] === undefined) {
      delete serialized[key];
    }
  });

  return serialized;
};

export const serializeSpaceMember = (member) => {
  const user = serializePublicSpaceUser(member.user);
  const userId = user?._id ?? toIdString(member.user);

  return {
    userId,
    role: member.role,
    joinedAt: member.joinedAt?.toISOString?.() ?? null,
    ...(user ? { user } : {}),
  };
};

export const serializeChannel = (channel) => {
  const channelObject = channel?.toObject?.() ?? channel;
  const channelId = toIdString(channelObject);
  const spaceId = toIdString(channelObject.space);

  return {
    _id: channelId,
    id: channelId,
    chatName: channelObject.chatName,
    isGroupChat: true,
    isSpaceChannel: true,
    space: spaceId,
    spaceId,
    channelName: channelObject.channelName ?? channelObject.chatName,
    channelKey: channelObject.channelKey ?? normalizeChannelKey(channelObject.channelName ?? channelObject.chatName),
    channelDescription: channelObject.channelDescription ?? '',
    members: (channelObject.members ?? [])
      .map((member) => serializePublicSpaceUser(member) ?? toIdString(member))
      .filter(Boolean),
    latestMessage: channelObject.latestMessage ?? null,
    createdAt: channelObject.createdAt?.toISOString?.() ?? channelObject.createdAt ?? null,
    updatedAt: channelObject.updatedAt?.toISOString?.() ?? channelObject.updatedAt ?? null,
    conversationControls: {
      isDirectChat: false,
      canSendMessage: true,
      canBlockUser: false,
      canUnblockUser: false,
    },
  };
};

export const serializeSpace = (space, { requesterId, channels = [] } = {}) => {
  const spaceObject = space?.toObject?.() ?? space;
  const spaceId = toIdString(spaceObject);
  const defaultChannelId = toIdString(spaceObject.defaultChannel);
  const requesterMember = requesterId ? findSpaceMember(space, requesterId) : null;
  const canManage = requesterId ? canManageSpace(space, requesterId) : false;

  return {
    _id: spaceId,
    id: spaceId,
    name: spaceObject.name,
    description: spaceObject.description ?? '',
    owner: toIdString(spaceObject.owner),
    createdBy: toIdString(spaceObject.createdBy),
    requesterRole: requesterMember?.role ?? null,
    canManage,
    // The join code is shareable, so only expose it to members who can manage the space.
    ...(canManage && spaceObject.joinCode ? { joinCode: spaceObject.joinCode } : {}),
    members: (space.members ?? []).map(serializeSpaceMember),
    memberCount: (space.members ?? []).length,
    defaultChannel: defaultChannelId,
    defaultChannelId,
    channels: channels.map(serializeChannel),
    createdAt: spaceObject.createdAt?.toISOString?.() ?? spaceObject.createdAt ?? null,
    updatedAt: spaceObject.updatedAt?.toISOString?.() ?? spaceObject.updatedAt ?? null,
  };
};
