import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import Chats from '../Models/chatModel.mjs';
import IntegrationAuditLog, {
  INTEGRATION_AUDIT_ACTIONS,
  INTEGRATION_AUDIT_STATUSES,
} from '../Models/integrationAuditLogModel.mjs';
import IntegrationInstallation, {
  INTEGRATION_INSTALLATION_STATUSES,
  INTEGRATION_INSTALLATION_TARGETS,
} from '../Models/integrationInstallationModel.mjs';
import Spaces, { SPACE_ROLES } from '../Models/spaceModel.mjs';
import { CustomError } from './customError.mjs';

export const INTEGRATION_SCOPES = Object.freeze({
  MESSAGES_READ: 'messages:read',
  MESSAGES_WRITE: 'messages:write',
  CHANNELS_READ: 'channels:read',
  WEBHOOKS_SEND: 'webhooks:send',
});

export const ALL_INTEGRATION_SCOPES = Object.freeze(Object.values(INTEGRATION_SCOPES));

const toIdString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? '';

export const hashIntegrationToken = (token) => (
  createHash('sha256').update(String(token ?? ''), 'utf8').digest('base64url')
);

export const generateIntegrationToken = () => `chatify_it_${randomBytes(32).toString('base64url')}`;

export const safeHashEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

export const normalizeIntegrationScopes = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((scope) => String(scope ?? '').trim())
    .filter(Boolean))].sort();
};

export const assertValidIntegrationScopes = (scopes) => {
  const invalid = scopes.filter((scope) => !ALL_INTEGRATION_SCOPES.includes(scope));
  if (invalid.length > 0 || scopes.length === 0) {
    throw new CustomError('Invalid integration scopes', 400);
  }
};

export const assertScopesAllowed = ({ requestedScopes, allowedScopes }) => {
  const allowed = new Set(allowedScopes);
  const denied = requestedScopes.filter((scope) => !allowed.has(scope));
  if (denied.length > 0) {
    throw new CustomError('Requested scopes exceed app permissions', 403);
  }
};

export const assertIntegrationTargetInstallAllowed = async ({ targetType, targetId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new CustomError('Invalid integration target', 400);
  }

  if (targetType === INTEGRATION_INSTALLATION_TARGETS.SPACE) {
    const space = await Spaces.findOne({
      _id: targetId,
      members: {
        $elemMatch: {
          user: userId,
          role: { $in: [SPACE_ROLES.OWNER, SPACE_ROLES.ADMIN] },
        },
      },
    }).select('name');

    if (!space) {
      const exists = await Spaces.exists({ _id: targetId });
      if (!exists) throw new CustomError('Integration target not found', 404);
      throw new CustomError('Only a space owner or admin can install integrations', 403);
    }

    return {
      targetType,
      targetId: space._id,
      label: space.name,
    };
  }

  if (targetType === INTEGRATION_INSTALLATION_TARGETS.CHAT) {
    const chat = await Chats.findOne({
      _id: targetId,
      isGroupChat: true,
      isSpaceChannel: { $ne: true },
      groupAdmin: userId,
      members: userId,
    }).select('chatName channelName');

    if (!chat) {
      const exists = await Chats.exists({ _id: targetId });
      if (!exists) throw new CustomError('Integration target not found', 404);
      throw new CustomError('Only a current standard group admin can install chat integrations', 403);
    }

    return {
      targetType,
      targetId: chat._id,
      label: chat.chatName ?? chat.channelName ?? 'Group chat',
    };
  }

  throw new CustomError('Unsupported integration target', 400);
};

export const createIntegrationAuditLog = (payload) => IntegrationAuditLog.create({
  ...payload,
  metadata: payload.metadata ?? {},
});

const revokeInstallationForAuthorityLoss = async (installation) => {
  const revokedAt = new Date();
  await IntegrationInstallation.updateOne(
    {
      _id: installation._id,
      status: INTEGRATION_INSTALLATION_STATUSES.ACTIVE,
    },
    {
      $set: {
        status: INTEGRATION_INSTALLATION_STATUSES.REVOKED,
        revokedAt,
      },
    }
  );
  installation.status = INTEGRATION_INSTALLATION_STATUSES.REVOKED;
  installation.revokedAt = revokedAt;
};

export const hasCurrentIntegrationTargetAuthority = async (installation) => {
  const installedBy = installation?.installedBy;
  const targetId = installation?.targetId;
  if (!installedBy || !targetId) return false;

  if (installation.targetType === INTEGRATION_INSTALLATION_TARGETS.SPACE) {
    return Boolean(await Spaces.exists({
      _id: targetId,
      members: {
        $elemMatch: {
          user: installedBy,
          role: { $in: [SPACE_ROLES.OWNER, SPACE_ROLES.ADMIN] },
        },
      },
    }));
  }

  if (installation.targetType === INTEGRATION_INSTALLATION_TARGETS.CHAT) {
    return Boolean(await Chats.exists({
      _id: targetId,
      isGroupChat: true,
      isSpaceChannel: { $ne: true },
      groupAdmin: installedBy,
      members: installedBy,
    }));
  }

  return false;
};

export const assertCurrentIntegrationTargetAuthority = async (installation, {
  revokeOnFailure = true,
} = {}) => {
  if (await hasCurrentIntegrationTargetAuthority(installation)) return installation;

  if (revokeOnFailure) {
    await revokeInstallationForAuthorityLoss(installation);
  }
  await createIntegrationAuditLog({
    app: installation.app?._id ?? installation.app,
    installation: installation._id,
    actorUser: installation.installedBy,
    action: INTEGRATION_AUDIT_ACTIONS.RUNTIME_DENIED,
    status: INTEGRATION_AUDIT_STATUSES.DENIED,
    targetType: installation.targetType,
    targetId: installation.targetId,
    scopes: installation.scopes,
    metadata: { reason: 'target_authority_lost' },
  });
  throw new CustomError('Integration target authority has been revoked', 403);
};

export const readBearerIntegrationToken = (req) => {
  const header = req.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
};

export const loadIntegrationInstallationFromToken = async (token) => {
  const tokenHash = hashIntegrationToken(token);
  const installation = await IntegrationInstallation.findOne({ tokenHash })
    .select('+tokenHash')
    .populate('app', 'name type status allowedScopes');

  if (!installation || !safeHashEqual(installation.tokenHash, tokenHash)) {
    await createIntegrationAuditLog({
      action: INTEGRATION_AUDIT_ACTIONS.RUNTIME_DENIED,
      status: INTEGRATION_AUDIT_STATUSES.DENIED,
      metadata: { reason: 'invalid_token' },
    });
    throw new CustomError('Invalid integration token', 401);
  }

  if (
    installation.status !== INTEGRATION_INSTALLATION_STATUSES.ACTIVE
    || installation.app?.status !== 'active'
  ) {
    await createIntegrationAuditLog({
      app: installation.app?._id,
      installation: installation._id,
      action: INTEGRATION_AUDIT_ACTIONS.RUNTIME_DENIED,
      status: INTEGRATION_AUDIT_STATUSES.DENIED,
      targetType: installation.targetType,
      targetId: installation.targetId,
      scopes: installation.scopes,
      metadata: { reason: 'revoked' },
    });
    throw new CustomError('Integration installation revoked', 403);
  }

  await assertCurrentIntegrationTargetAuthority(installation);
  return installation;
};
