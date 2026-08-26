import { randomUUID } from 'node:crypto';
import Attachment from '../Models/attachmentModel.mjs';
import Chats from '../Models/chatModel.mjs';
import IntegrationApp, {
  INTEGRATION_APP_STATUSES,
} from '../Models/integrationAppModel.mjs';
import IntegrationInstallation, {
  INTEGRATION_INSTALLATION_STATUSES,
} from '../Models/integrationInstallationModel.mjs';
import InviteLink from '../Models/inviteLinkModel.mjs';
import Message from '../Models/messageModel.mjs';
import NotificationOutbox, {
  NOTIFICATION_OUTBOX_STATUS,
} from '../Models/notificationOutboxModel.mjs';
import OAuthHandoff from '../Models/oauthHandoffModel.mjs';
import PasswordReset from '../Models/passwordResetModel.mjs';
import PrivacyOperationRun, {
  PRIVACY_OPERATION_RUN_STATUSES,
  PRIVACY_OPERATION_RUN_TRIGGERS,
} from '../Models/privacyOperationRunModel.mjs';
import PrivacyRequest, {
  PRIVACY_REQUEST_ACTIONS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from '../Models/privacyRequestModel.mjs';
import Session from '../Models/sessionModel.mjs';
import SessionFamily from '../Models/sessionFamilyModel.mjs';
import Spaces, { SPACE_ROLES } from '../Models/spaceModel.mjs';
import TwoFactorChallenge from '../Models/twoFactorChallengeModel.mjs';
import User from '../Models/userModel.mjs';
import { disconnectUserSockets } from '../Config/socket.mjs';
import { deleteProfileImageFile } from './profileImageStorageService.mjs';
import {
  markTrustedDatabaseUpdate,
  withDatabaseTransaction,
} from '../Utils/databaseSecurity.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WORKER_INTERVAL_MS = 5 * 60 * 1000;
const CLEANUP_LEASE_MS = 5 * 60 * 1000;
const SANITIZED_CLEANUP_ERROR_LENGTH = 400;

export const DEFAULT_PRIVACY_OPERATION_BATCH_SIZE = 25;
export const DEFAULT_NOTIFICATION_OUTBOX_RETENTION_DAYS = 30;

const serializeDate = (value) => value?.toISOString?.() ?? value ?? null;
const toIdString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? '';

const addCounts = (target, source) => {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + (value ?? 0);
  }
  return target;
};

const createEmptyCounts = () => ({
  deletionRequestsProcessed: 0,
  accountsAnonymized: 0,
  profileImagesDeleted: 0,
  cleanupPending: 0,
  cleanupRetried: 0,
  cleanupCompleted: 0,
  sessionsRemoved: 0,
  sessionFamiliesRemoved: 0,
  passwordResetsDeleted: 0,
  oauthHandoffsDeleted: 0,
  twoFactorChallengesDeleted: 0,
  notificationOutboxDeleted: 0,
  integrationAppsRevoked: 0,
  integrationInstallationsRevoked: 0,
  inviteLinksRevoked: 0,
  spacesTransferred: 0,
  spacesDeleted: 0,
  spaceMembershipsRemoved: 0,
  groupAdminsTransferred: 0,
  groupsDeleted: 0,
  socketsDisconnected: 0,
  expiredExportAuditsDeleted: 0,
  expiredPasswordResetsDeleted: 0,
  expiredSessionsDeleted: 0,
  expiredSessionFamiliesDeleted: 0,
  terminalNotificationOutboxDeleted: 0,
  errors: 0,
});

const getTombstoneIdentity = (userId) => {
  const normalizedId = userId.toString();
  const suffix = normalizedId.slice(-16);

  return {
    email: `deleted-${normalizedId}@chatify.invalid`,
    username: `deleted_${suffix}`,
  };
};

const getTerminalOutboxCutoff = (now = new Date()) => {
  const configuredDays = Number.parseInt(process.env.PRIVACY_OUTBOX_RETENTION_DAYS ?? '', 10);
  const retentionDays = Number.isFinite(configuredDays) && configuredDays >= 1
    ? configuredDays
    : DEFAULT_NOTIFICATION_OUTBOX_RETENTION_DAYS;

  return {
    retentionDays,
    cutoff: new Date(now.getTime() - retentionDays * DAY_MS),
  };
};

const getPrivacyWorkerIntervalMs = () => {
  const configuredInterval = Number.parseInt(process.env.PRIVACY_WORKER_INTERVAL_MS ?? '', 10);

  return Number.isFinite(configuredInterval) && configuredInterval >= 60_000
    ? configuredInterval
    : DEFAULT_WORKER_INTERVAL_MS;
};

const isPrivacyWorkerEnabled = () => (
  process.env.NODE_ENV !== 'test'
  && process.env.PRIVACY_WORKER_ENABLED !== '0'
);

const normalizeBatchLimit = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, 100)
    : DEFAULT_PRIVACY_OPERATION_BATCH_SIZE;
};

const sanitizeCleanupError = (error) => String(error?.message ?? error?.code ?? 'cleanup_failed')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
  .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi, 'Bearer [redacted-token]')
  .replace(/\b(token|secret|password|cookie)\b(?:\s*[:=]\s*\S+)?/gi, '[redacted]')
  .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted-token]')
  .slice(0, SANITIZED_CLEANUP_ERROR_LENGTH);

const anonymizeUserAccount = async ({ user, now, session }) => {
  const tombstone = getTombstoneIdentity(user._id);
  const update = User.updateOne(
    { _id: user._id },
    {
      $set: {
        firstName: 'Deleted',
        lastName: 'User',
        email: tombstone.email,
        username: tombstone.username,
        profilePic: '',
        profileBio: '',
        profileStatus: '',
        authProvider: 'local',
        isVerified: false,
        isOnline: false,
        lastSeen: now,
        showOnlineStatus: false,
        showLastSeen: false,
        showProfileStatus: false,
        role: 'user',
        notificationPreferences: {
          pushEnabled: false,
          emailNotificationsEnabled: false,
          messagePreviewMode: 'none',
          mutedChatIds: [],
          emailUnsubscribedAt: now,
          pushSubscriptions: [],
        },
      },
      $unset: {
        password: '',
        googleId: '',
        discordId: '',
        githubId: '',
        providerProfilePic: '',
        uploadedProfileImage: '',
        identityMark: '',
        identityMarkUpdatedAt: '',
        twoFactor: '',
        moderation: '',
      },
    },
    { session }
  );

  await markTrustedDatabaseUpdate(
    update,
    'Privacy deletion applies a fixed server-owned tombstone update.'
  );
};

const deleteChatData = async ({ chatIds, session }) => {
  if (chatIds.length === 0) return;

  await Attachment.updateMany(
    {
      chatId: { $in: chatIds },
      status: { $ne: 'deleted' },
    },
    { $set: { status: 'deleted' } },
    { session }
  );
  await Message.deleteMany({ chatId: { $in: chatIds } }, { session });
  await Chats.deleteMany({ _id: { $in: chatIds } }, { session });
};

const pickSpaceSuccessor = (members) => (
  members.find((member) => member.role === SPACE_ROLES.ADMIN)
  ?? members.find((member) => member.role === SPACE_ROLES.MEMBER)
  ?? members[0]
  ?? null
);

const reconcileSpaceAuthority = async ({ userId, session }) => {
  const counts = createEmptyCounts();
  const deletedSpaceIds = [];
  const spaces = await Spaces.find({
    $or: [
      { owner: userId },
      { 'members.user': userId },
    ],
  }).session(session);

  for (const space of spaces) {
    const wasOwner = toIdString(space.owner) === toIdString(userId);
    const wasMember = (space.members ?? [])
      .some((member) => toIdString(member.user) === toIdString(userId));
    const remainingMembers = (space.members ?? [])
      .filter((member) => toIdString(member.user) !== toIdString(userId));

    if (wasOwner && remainingMembers.length === 0) {
      const channelIds = await Chats.find({
        space: space._id,
        isSpaceChannel: true,
      }).distinct('_id').session(session);
      await deleteChatData({ chatIds: channelIds, session });
      await Spaces.deleteOne({ _id: space._id }, { session });
      deletedSpaceIds.push(space._id);
      counts.spacesDeleted += 1;
      if (wasMember) counts.spaceMembershipsRemoved += 1;
      continue;
    }

    if (wasOwner) {
      const successor = pickSpaceSuccessor(remainingMembers);
      const successorId = successor.user?._id ?? successor.user;
      space.owner = successorId;
      remainingMembers.forEach((member) => {
        member.role = toIdString(member.user) === toIdString(successorId)
          ? SPACE_ROLES.OWNER
          : member.role === SPACE_ROLES.OWNER
            ? SPACE_ROLES.ADMIN
            : member.role;
      });
      counts.spacesTransferred += 1;
    }

    if (wasMember) {
      space.members = remainingMembers;
      counts.spaceMembershipsRemoved += 1;
    }

    await space.save({ session });
    await Chats.updateMany(
      { space: space._id, isSpaceChannel: true },
      { $pull: { members: userId } },
      { session }
    );
  }

  return { counts, deletedSpaceIds };
};

const reconcileGroupAuthority = async ({ userId, session }) => {
  const counts = createEmptyCounts();
  const deletedGroupIds = [];
  const groups = await Chats.find({
    isGroupChat: true,
    isSpaceChannel: { $ne: true },
    groupAdmin: userId,
  }).session(session);

  for (const group of groups) {
    const successorId = (group.members ?? [])
      .find((memberId) => toIdString(memberId) !== toIdString(userId));

    if (!successorId) {
      await deleteChatData({ chatIds: [group._id], session });
      deletedGroupIds.push(group._id);
      counts.groupsDeleted += 1;
      continue;
    }

    group.groupAdmin = successorId;
    await group.save({ session });
    counts.groupAdminsTransferred += 1;
  }

  return { counts, deletedGroupIds };
};

const revokeIntegrationAuthority = async ({ userId, now, session }) => {
  const counts = createEmptyCounts();
  const appIds = await IntegrationApp.find({ owner: userId })
    .distinct('_id')
    .session(session);
  const apps = await IntegrationApp.updateMany(
    {
      owner: userId,
      status: { $ne: INTEGRATION_APP_STATUSES.REVOKED },
    },
    { $set: { status: INTEGRATION_APP_STATUSES.REVOKED } },
    { session }
  );
  const installations = await IntegrationInstallation.updateMany(
    {
      status: { $ne: INTEGRATION_INSTALLATION_STATUSES.REVOKED },
      $or: [
        { installedBy: userId },
        ...(appIds.length > 0 ? [{ app: { $in: appIds } }] : []),
      ],
    },
    {
      $set: {
        status: INTEGRATION_INSTALLATION_STATUSES.REVOKED,
        revokedAt: now,
      },
    },
    { session }
  );

  counts.integrationAppsRevoked = apps.modifiedCount ?? 0;
  counts.integrationInstallationsRevoked = installations.modifiedCount ?? 0;
  return counts;
};

const revokeInviteLinks = async ({
  userId,
  deletedSpaceIds,
  deletedGroupIds,
  now,
  session,
}) => {
  const conditions = [{ createdBy: userId }];
  if (deletedSpaceIds.length > 0) conditions.push({ space: { $in: deletedSpaceIds } });
  if (deletedGroupIds.length > 0) conditions.push({ chat: { $in: deletedGroupIds } });

  const result = await InviteLink.updateMany(
    {
      revokedAt: null,
      $or: conditions,
    },
    {
      $set: {
        revokedAt: now,
        revokedBy: userId,
      },
    },
    { session }
  );

  return result.modifiedCount ?? 0;
};

const deleteAuthenticationArtifacts = async ({ userId, session }) => {
  const counts = createEmptyCounts();

  const sessions = await Session.deleteMany({ userId }, { session });
  counts.sessionsRemoved = sessions.deletedCount ?? 0;

  const sessionFamilies = await SessionFamily.deleteMany({ userId }, { session });
  counts.sessionFamiliesRemoved = sessionFamilies.deletedCount ?? 0;

  const passwordResets = await PasswordReset.deleteMany({ userId }, { session });
  counts.passwordResetsDeleted = passwordResets.deletedCount ?? 0;

  const oauthHandoffs = await OAuthHandoff.deleteMany({ userId }, { session });
  counts.oauthHandoffsDeleted = oauthHandoffs.deletedCount ?? 0;

  const twoFactorChallenges = await TwoFactorChallenge.deleteMany({ userId }, { session });
  counts.twoFactorChallengesDeleted = twoFactorChallenges.deletedCount ?? 0;

  const outbox = await NotificationOutbox.deleteMany({
    $or: [
      { recipient: userId },
      { sender: userId },
    ],
  }, { session });
  counts.notificationOutboxDeleted = outbox.deletedCount ?? 0;

  return counts;
};

const processDeletionRequestTransaction = async ({ requestId, now }) => withDatabaseTransaction(
  async (session) => {
    const counts = createEmptyCounts();
    const request = await PrivacyRequest.findOne({
      _id: requestId,
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      status: PRIVACY_REQUEST_STATUSES.PENDING,
      scheduledFor: { $lte: now },
    }).session(session);

    if (!request) {
      return {
        processed: false,
        counts,
        userId: null,
        cleanupPending: false,
      };
    }

    const user = await User.findById(request.user)
      .select('+uploadedProfileImage +providerProfilePic +password +googleId +discordId +githubId +role +twoFactor +moderation')
      .session(session);
    const userId = user?._id ?? request.user;
    const profileImageStorageId = user?.uploadedProfileImage?.storageFileId ?? null;

    counts.deletionRequestsProcessed = 1;
    addCounts(counts, await revokeIntegrationAuthority({ userId, now, session }));
    const spaceResult = await reconcileSpaceAuthority({ userId, session });
    addCounts(counts, spaceResult.counts);
    const groupResult = await reconcileGroupAuthority({ userId, session });
    addCounts(counts, groupResult.counts);
    counts.inviteLinksRevoked = await revokeInviteLinks({
      userId,
      deletedSpaceIds: spaceResult.deletedSpaceIds,
      deletedGroupIds: groupResult.deletedGroupIds,
      now,
      session,
    });
    addCounts(counts, await deleteAuthenticationArtifacts({ userId, session }));

    if (user) {
      await anonymizeUserAccount({ user, now, session });
      counts.accountsAnonymized = 1;
    }

    const cleanupPending = Boolean(profileImageStorageId);
    request.status = cleanupPending
      ? PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING
      : PRIVACY_REQUEST_STATUSES.COMPLETED;
    request.completedAt = cleanupPending ? undefined : now;
    request.recordCounts = { ...counts };
    request.retentionSummary = {
      ...(request.retentionSummary ?? {}),
      processedAt: serializeDate(now),
      accountProfile: user
        ? 'Account profile and login identifiers were anonymized by the privacy operations worker.'
        : 'Account record was already unavailable when the privacy operations worker ran.',
      authentication: 'Sessions, challenges, handoffs, password resets, provider identifiers, integration credentials, and notification endpoints were removed or revoked.',
      conversations: 'Shared conversation records remain as redacted participant references; owner and administrator authority was transferred or closed.',
      physicalCleanup: cleanupPending
        ? 'Uploaded profile image deletion is pending durable retry.'
        : 'No uploaded profile image cleanup remained.',
    };
    request.events.push({
      action: PRIVACY_REQUEST_ACTIONS.DELETION_PROCESSED,
      actor: request.user,
      metadata: { recordCounts: request.recordCounts },
    });

    if (cleanupPending) {
      request.cleanup = {
        profileImageStorageId,
        attempts: 0,
      };
      request.events.push({
        action: PRIVACY_REQUEST_ACTIONS.DELETION_CLEANUP_PENDING,
        actor: request.user,
        metadata: { kind: 'profile_image' },
      });
      request.recordCounts.cleanupPending = 1;
    } else {
      request.cleanup = undefined;
    }

    await request.save({ session });

    return {
      processed: true,
      counts,
      userId,
      cleanupPending,
    };
  }
);

const claimCleanupRequest = async ({ requestId, now = new Date() }) => {
  const processingToken = randomUUID();
  const leaseExpiresAt = new Date(now.getTime() + CLEANUP_LEASE_MS);

  return PrivacyRequest.findOneAndUpdate(
    {
      _id: requestId,
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      status: PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
      'cleanup.profileImageStorageId': { $exists: true },
      $or: [
        { 'cleanup.leaseExpiresAt': { $lte: now } },
        { 'cleanup.leaseExpiresAt': null },
        { 'cleanup.leaseExpiresAt': { $exists: false } },
      ],
    },
    {
      $set: {
        'cleanup.processingToken': processingToken,
        'cleanup.leaseExpiresAt': leaseExpiresAt,
        'cleanup.lastAttemptAt': now,
      },
      $inc: { 'cleanup.attempts': 1 },
    },
    { new: true }
  ).select('+cleanup.processingToken');
};

const attemptDeletionCleanup = async ({ requestId, now = new Date() }) => {
  const counts = createEmptyCounts();
  const request = await claimCleanupRequest({ requestId, now });
  if (!request) return counts;

  counts.cleanupRetried = 1;
  const processingToken = request.cleanup?.processingToken;
  const storageFileId = request.cleanup?.profileImageStorageId;

  try {
    await deleteProfileImageFile(storageFileId);
    const completedAt = new Date();
    const completion = await PrivacyRequest.updateOne(
      {
        _id: request._id,
        status: PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
        'cleanup.processingToken': processingToken,
      },
      {
        $set: {
          status: PRIVACY_REQUEST_STATUSES.COMPLETED,
          completedAt,
          'recordCounts.profileImagesDeleted': 1,
          'recordCounts.cleanupPending': 0,
          'recordCounts.cleanupCompleted': 1,
          'retentionSummary.physicalCleanup': 'Uploaded profile image deletion completed.',
        },
        $unset: { cleanup: '' },
        $push: {
          events: {
            action: PRIVACY_REQUEST_ACTIONS.DELETION_CLEANUP_COMPLETED,
            actor: request.user,
            createdAt: completedAt,
            metadata: { kind: 'profile_image' },
          },
        },
      }
    );

    if (completion.modifiedCount === 1) {
      counts.profileImagesDeleted = 1;
      counts.cleanupCompleted = 1;
    }
  } catch (error) {
    counts.cleanupPending = 1;
    counts.errors = 1;
    const sanitizedError = sanitizeCleanupError(error);

    await PrivacyRequest.updateOne(
      {
        _id: request._id,
        status: PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
        'cleanup.processingToken': processingToken,
      },
      {
        $set: { 'cleanup.lastError': sanitizedError },
        $unset: {
          'cleanup.processingToken': '',
          'cleanup.leaseExpiresAt': '',
        },
      }
    );
    logger.warn('privacy.profile_image_delete_failed', {
      requestId: request._id.toString(),
      userId: request.user.toString(),
      errorCode: error?.code ?? error?.name,
    });
  }

  return counts;
};

const processDeletionRequest = async ({ requestId, now }) => {
  const existing = await PrivacyRequest.findById(requestId).select('status').lean();
  if (!existing) return createEmptyCounts();

  if (existing.status === PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING) {
    return attemptDeletionCleanup({ requestId, now });
  }

  const result = await processDeletionRequestTransaction({ requestId, now });
  if (!result.processed) return result.counts;

  if (result.userId) {
    result.counts.socketsDisconnected = disconnectUserSockets(result.userId);
    await PrivacyRequest.updateOne(
      { _id: requestId },
      { $set: { 'recordCounts.socketsDisconnected': result.counts.socketsDisconnected } }
    );
  }

  if (result.cleanupPending) {
    addCounts(result.counts, await attemptDeletionCleanup({ requestId, now: new Date() }));
  }

  return result.counts;
};

const countRetentionBacklog = async ({ now = new Date() } = {}) => {
  const { cutoff } = getTerminalOutboxCutoff(now);
  const [
    expiredExportAudits,
    expiredPasswordResets,
    expiredSessions,
    expiredSessionFamilies,
    terminalNotificationOutbox,
  ] = await Promise.all([
    PrivacyRequest.countDocuments({
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_EXPORT,
      expiresAt: { $lte: now },
    }),
    PasswordReset.countDocuments({ expiresAt: { $lte: now } }),
    Session.countDocuments({ expiresAt: { $lte: now } }),
    SessionFamily.countDocuments({ expiresAt: { $lte: now } }),
    NotificationOutbox.countDocuments({
      status: {
        $in: [
          NOTIFICATION_OUTBOX_STATUS.SENT,
          NOTIFICATION_OUTBOX_STATUS.FAILED,
        ],
      },
      updatedAt: { $lte: cutoff },
    }),
  ]);

  return {
    expiredExportAudits,
    expiredPasswordResets,
    expiredSessions,
    expiredSessionFamilies,
    terminalNotificationOutbox,
  };
};

const cleanupExpiredPrivacyArtifacts = async ({ now = new Date() } = {}) => {
  const { cutoff } = getTerminalOutboxCutoff(now);
  const [
    exportAudits,
    passwordResets,
    sessions,
    sessionFamilies,
    terminalOutbox,
  ] = await Promise.all([
    PrivacyRequest.deleteMany({
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_EXPORT,
      expiresAt: { $lte: now },
    }),
    PasswordReset.deleteMany({ expiresAt: { $lte: now } }),
    Session.deleteMany({ expiresAt: { $lte: now } }),
    SessionFamily.deleteMany({ expiresAt: { $lte: now } }),
    NotificationOutbox.deleteMany({
      status: {
        $in: [
          NOTIFICATION_OUTBOX_STATUS.SENT,
          NOTIFICATION_OUTBOX_STATUS.FAILED,
        ],
      },
      updatedAt: { $lte: cutoff },
    }),
  ]);

  return {
    expiredExportAuditsDeleted: exportAudits.deletedCount ?? 0,
    expiredPasswordResetsDeleted: passwordResets.deletedCount ?? 0,
    expiredSessionsDeleted: sessions.deletedCount ?? 0,
    expiredSessionFamiliesDeleted: sessionFamilies.deletedCount ?? 0,
    terminalNotificationOutboxDeleted: terminalOutbox.deletedCount ?? 0,
  };
};

const getDueDeletionRequests = ({ now, limit }) => PrivacyRequest.find({
  type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
  $or: [
    {
      status: PRIVACY_REQUEST_STATUSES.PENDING,
      scheduledFor: { $lte: now },
    },
    {
      status: PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
      $or: [
        { 'cleanup.leaseExpiresAt': { $lte: now } },
        { 'cleanup.leaseExpiresAt': null },
        { 'cleanup.leaseExpiresAt': { $exists: false } },
      ],
    },
  ],
})
  .select('_id status')
  .sort({ scheduledFor: 1, requestedAt: 1, _id: 1 })
  .limit(normalizeBatchLimit(limit))
  .lean();

const getTotalCount = (counts) => Object.entries(counts)
  .filter(([key]) => key !== 'errors')
  .reduce((total, [, value]) => total + (value ?? 0), 0);

export const processPrivacyOperations = async ({
  now = new Date(),
  limit = DEFAULT_PRIVACY_OPERATION_BATCH_SIZE,
  trigger = PRIVACY_OPERATION_RUN_TRIGGERS.WORKER,
  recordRun = true,
} = {}) => {
  const startedAt = new Date();
  const counts = createEmptyCounts();
  const dueRequests = await getDueDeletionRequests({ now, limit });

  for (const request of dueRequests) {
    try {
      addCounts(counts, await processDeletionRequest({ requestId: request._id, now }));
    } catch (error) {
      counts.errors += 1;
      logger.error('privacy.deletion_process_failed', {
        requestId: request._id.toString(),
        errorCode: error?.code ?? error?.name,
      });
    }
  }

  addCounts(counts, await cleanupExpiredPrivacyArtifacts({ now }));

  const completedAt = new Date();
  const status = counts.errors > 0
    ? PRIVACY_OPERATION_RUN_STATUSES.FAILED
    : PRIVACY_OPERATION_RUN_STATUSES.COMPLETED;
  const shouldRecordRun = recordRun && (getTotalCount(counts) > 0 || counts.errors > 0);

  let operationRun = null;
  if (shouldRecordRun) {
    operationRun = await PrivacyOperationRun.create({
      status,
      trigger,
      dryRun: false,
      startedAt,
      completedAt,
      counts,
    });
  }

  return {
    status,
    trigger,
    startedAt: serializeDate(startedAt),
    completedAt: serializeDate(completedAt),
    counts,
    operationRunId: operationRun?._id?.toString?.() ?? null,
  };
};

const serializeOperationRun = (run) => {
  if (!run) return null;

  return {
    _id: run._id.toString(),
    status: run.status,
    trigger: run.trigger,
    dryRun: run.dryRun === true,
    startedAt: serializeDate(run.startedAt),
    completedAt: serializeDate(run.completedAt),
    counts: run.counts ?? {},
  };
};

export const buildPrivacyOperationsPayload = async ({ now = new Date() } = {}) => {
  const { retentionDays } = getTerminalOutboxCutoff(now);
  const [
    pendingDeletionRequests,
    dueDeletionRequests,
    cleanupPendingRequests,
    completedDeletionRequests,
    retentionBacklog,
    lastRun,
  ] = await Promise.all([
    PrivacyRequest.countDocuments({
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      status: PRIVACY_REQUEST_STATUSES.PENDING,
    }),
    PrivacyRequest.countDocuments({
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      status: PRIVACY_REQUEST_STATUSES.PENDING,
      scheduledFor: { $lte: now },
    }),
    PrivacyRequest.countDocuments({
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      status: PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
    }),
    PrivacyRequest.countDocuments({
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      status: PRIVACY_REQUEST_STATUSES.COMPLETED,
    }),
    countRetentionBacklog({ now }),
    PrivacyOperationRun.findOne({}).sort({ completedAt: -1, _id: -1 }).lean(),
  ]);
  const cleanupBacklog = Object.values(retentionBacklog)
    .reduce((total, value) => total + (value ?? 0), 0);
  const status = lastRun?.status === PRIVACY_OPERATION_RUN_STATUSES.FAILED
    ? 'blocked'
    : dueDeletionRequests > 0 || cleanupPendingRequests > 0 || cleanupBacklog > 0
      ? 'attention'
      : 'ok';

  return {
    generatedAt: serializeDate(now),
    status,
    deletionRequests: {
      pending: pendingDeletionRequests,
      due: dueDeletionRequests,
      cleanupPending: cleanupPendingRequests,
      completed: completedDeletionRequests,
    },
    retention: {
      cleanupBacklog,
      notificationOutboxRetentionDays: retentionDays,
      ...retentionBacklog,
    },
    worker: {
      enabled: isPrivacyWorkerEnabled(),
      intervalMs: getPrivacyWorkerIntervalMs(),
      batchSize: DEFAULT_PRIVACY_OPERATION_BATCH_SIZE,
      lastRun: serializeOperationRun(lastRun),
    },
  };
};

let privacyWorkerTimer = null;

export const startPrivacyOperationsWorker = () => {
  if (!isPrivacyWorkerEnabled() || privacyWorkerTimer) return null;

  privacyWorkerTimer = setInterval(() => {
    processPrivacyOperations().catch((error) => {
      logger.error('privacy.worker_failed', {
        errorCode: error?.code ?? error?.name,
      });
    });
  }, getPrivacyWorkerIntervalMs());
  privacyWorkerTimer.unref?.();

  return privacyWorkerTimer;
};

export const stopPrivacyOperationsWorker = () => {
  if (!privacyWorkerTimer) return;
  clearInterval(privacyWorkerTimer);
  privacyWorkerTimer = null;
};

export const resetPrivacyOperationsWorkerForTests = () => {
  stopPrivacyOperationsWorker();
};
