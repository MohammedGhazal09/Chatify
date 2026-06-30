import { createHash, randomBytes } from 'node:crypto';
import { INVITE_TARGET_TYPES } from '../Models/inviteLinkModel.mjs';

export { INVITE_TARGET_TYPES };

export const INVITE_EXPIRY_DAYS = Object.freeze([1, 7, 30]);
export const INVITE_MAX_USES = Object.freeze([1, 5, 10]);
const INVITE_TOKEN_BYTES = 32;
const MAX_INVITE_USES_ABSOLUTE = 100;

const toIdString = (value) => (
  value?._id?.toString?.() ?? value?.toString?.() ?? ''
);

const fail = (message, statusCode = 400) => ({
  ok: false,
  message,
  statusCode,
});

export const generateInviteToken = () => randomBytes(INVITE_TOKEN_BYTES).toString('base64url');

export const hashInviteToken = (token) => (
  createHash('sha256').update(String(token ?? ''), 'utf8').digest('hex')
);

export const validateInviteToken = (value) => {
  const token = String(value ?? '').trim();

  if (!/^[A-Za-z0-9_-]{32,160}$/.test(token)) {
    return fail('Invite unavailable.', 404);
  }

  return {
    ok: true,
    token,
    tokenHash: hashInviteToken(token),
  };
};

export const normalizeInviteExpiryDays = (value) => {
  const days = Number(value ?? 7);

  if (!INVITE_EXPIRY_DAYS.includes(days)) {
    return fail('Choose a valid invite expiry.');
  }

  return {
    ok: true,
    days,
    expiresAt: new Date(Date.now() + (days * 24 * 60 * 60 * 1000)),
  };
};

export const normalizeInviteMaxUses = (value) => {
  if (value === undefined || value === null || value === '' || value === 'unlimited') {
    return { ok: true, value: null };
  }

  const maxUses = Number(value);

  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > MAX_INVITE_USES_ABSOLUTE) {
    return fail('Choose a valid invite use limit.');
  }

  if (!INVITE_MAX_USES.includes(maxUses)) {
    return fail('Choose a valid invite use limit.');
  }

  return { ok: true, value: maxUses };
};

export const getInviteState = (invite, now = new Date()) => {
  if (invite.revokedAt) {
    return 'revoked';
  }

  if (invite.expiresAt && invite.expiresAt <= now) {
    return 'expired';
  }

  if (Number.isInteger(invite.maxUses) && invite.useCount >= invite.maxUses) {
    return 'exhausted';
  }

  return 'active';
};

export const assertInviteActive = (invite, now = new Date()) => {
  const state = getInviteState(invite, now);

  if (state !== 'active') {
    return fail('Invite unavailable.', 410);
  }

  return { ok: true };
};

export const buildInviteUrl = (req, token) => {
  const frontendOrigin = (
    process.env.FRONTEND_ORIGIN ||
    process.env.FRONTEND_ORIGIN_DEV ||
    req.get?.('origin') ||
    'http://localhost:5173'
  ).replace(/\/+$/, '');

  return `${frontendOrigin}/invite/${encodeURIComponent(token)}`;
};

export const serializeInviteLink = (invite) => {
  const inviteObject = invite?.toObject?.() ?? invite;
  const state = getInviteState(inviteObject);
  const targetId = inviteObject.targetType === INVITE_TARGET_TYPES.SPACE
    ? toIdString(inviteObject.space)
    : toIdString(inviteObject.chat);
  const creator = inviteObject.createdBy?.toObject?.() ?? inviteObject.createdBy;

  return {
    _id: toIdString(inviteObject),
    id: toIdString(inviteObject),
    targetType: inviteObject.targetType,
    targetId,
    state,
    createdBy: creator && typeof creator === 'object'
      ? {
        _id: toIdString(creator),
        username: creator.username,
        firstName: creator.firstName,
        lastName: creator.lastName,
      }
      : toIdString(creator),
    expiresAt: inviteObject.expiresAt?.toISOString?.() ?? inviteObject.expiresAt ?? null,
    maxUses: inviteObject.maxUses ?? null,
    useCount: inviteObject.useCount ?? 0,
    lastUsedAt: inviteObject.lastUsedAt?.toISOString?.() ?? inviteObject.lastUsedAt ?? null,
    revokedAt: inviteObject.revokedAt?.toISOString?.() ?? inviteObject.revokedAt ?? null,
    createdAt: inviteObject.createdAt?.toISOString?.() ?? inviteObject.createdAt ?? null,
    updatedAt: inviteObject.updatedAt?.toISOString?.() ?? inviteObject.updatedAt ?? null,
  };
};
