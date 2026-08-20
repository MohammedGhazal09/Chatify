import { createHash } from 'node:crypto';
import User from '../Models/userModel.mjs';
import { toIdString } from './messageState.mjs';

export const MAX_MESSAGE_MENTIONS = 10;
export const PUBLIC_MENTION_USER_SELECT = 'username firstName lastName';

const USERNAME_TOKEN_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

const parseMentionInput = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return trimmed.split(',');
  }
};

export const normalizeMentionUserIds = (value) => {
  const rawIds = parseMentionInput(value)
    .map((entry) => toIdString(entry))
    .filter(Boolean);
  const mentionUserIds = Array.from(new Set(rawIds));

  if (mentionUserIds.length > MAX_MESSAGE_MENTIONS) {
    return {
      ok: false,
      statusCode: 400,
      message: `Maximum ${MAX_MESSAGE_MENTIONS} mentions allowed per message`,
    };
  }

  return {
    ok: true,
    mentionUserIds,
  };
};

const normalizeDisplayName = (user) => (
  `${user.firstName ?? ''} ${user.lastName ?? ''}`.replace(/\s+/g, ' ').trim()
  || user.username
  || 'Member'
);

const escapeRegexLiteral = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const hasVisibleMentionToken = (text, username) => {
  if (!USERNAME_TOKEN_PATTERN.test(username)) {
    return false;
  }

  const escapedUsername = escapeRegexLiteral(username);
  const tokenPattern = new RegExp(`(^|[^a-z0-9._-])@${escapedUsername}(?=$|[^a-z0-9._-])`, 'i');
  return tokenPattern.test(text);
};

export const fingerprintMentions = (mentions = []) => {
  const mentionIds = mentions
    .map((mention) => toIdString(mention.user))
    .filter(Boolean)
    .sort();

  return mentionIds.length > 0
    ? createHash('sha256').update(JSON.stringify(mentionIds)).digest('hex')
    : '';
};

export const pruneMentionsForText = (mentions = [], text = '') => (
  mentions.filter((mention) => hasVisibleMentionToken(text, mention.username ?? ''))
);

export const resolveMessageMentions = async ({
  chat,
  senderId,
  text,
  mentionUserIds: rawMentionUserIds,
}) => {
  const normalizedMentions = normalizeMentionUserIds(rawMentionUserIds);

  if (!normalizedMentions.ok) {
    return normalizedMentions;
  }

  const mentionUserIds = normalizedMentions.mentionUserIds;

  if (mentionUserIds.length === 0) {
    return {
      ok: true,
      mentions: [],
      mentionFingerprint: '',
    };
  }

  if (!chat?.isGroupChat) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Mentions are available only in group conversations and space channels',
    };
  }

  const senderIdString = toIdString(senderId);
  const chatMemberIds = new Set(
    (chat.members ?? [])
      .map((member) => toIdString(member))
      .filter(Boolean)
  );

  if (mentionUserIds.some((mentionUserId) => mentionUserId === senderIdString)) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Mention targets must be other conversation members',
    };
  }

  if (mentionUserIds.some((mentionUserId) => !chatMemberIds.has(mentionUserId))) {
    return {
      ok: false,
      statusCode: 403,
      message: 'Mention targets must be conversation members',
    };
  }

  const users = await User.find({ _id: { $in: mentionUserIds } }).select(PUBLIC_MENTION_USER_SELECT);
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  if (mentionUserIds.some((mentionUserId) => !usersById.has(mentionUserId))) {
    return {
      ok: false,
      statusCode: 403,
      message: 'Mention targets must be conversation members',
    };
  }

  const mentions = mentionUserIds.map((mentionUserId) => {
    const user = usersById.get(mentionUserId);
    return {
      user: user._id,
      username: user.username,
      displayName: normalizeDisplayName(user),
    };
  });

  if (mentions.some((mention) => !hasVisibleMentionToken(text, mention.username))) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Mentioned members must appear in the message text as @username',
    };
  }

  return {
    ok: true,
    mentions,
    mentionFingerprint: fingerprintMentions(mentions),
  };
};
