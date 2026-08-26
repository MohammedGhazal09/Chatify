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
import TwoFactorUsage from '../Models/twoFactorUsageModel.mjs';
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
const CLEANUP_RETRY_DELAYS_MS = Object.freeze([
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
]);

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
  sessionsRemoved: 0,
  sessionFamiliesRemoved: 0,
  passwordResetsDeleted: 0,
  oauthHandoffsDeleted: 0,
  twoFactorChallengesDeleted: 0,
  twoFactorUsageDeleted: 0,
  notificationOutboxDeleted: 0,
  integrationAppsRevoked: 0,
  integrationInstallationsRevoked: 0,
  inviteLinksRevoked: 0,
  spacesTransferred: 0,
  spacesDeleted: 0,
  groupOwnershipTransferred: 0,
  groupsDeleted: 0,
  socketsDisconnected: 0,
  cleanupRetriesScheduled: 0,
  expiredExportAuditsDeleted: 0,
  expiredPasswordResetsDeleted: 0,
  expiredSessionsDeleted: 0,
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
  process.env.NODE_ENV !== 'test' &&
  process.env.PRIVACY_WORKER_ENABLED !== '0'
);

const getCleanupRetryDelayMs = (attempts) => (
  CLEANUP_RETRY_DELAYS_MS[
    Math.min(Math.max(Number(attempts) || 0, 0), CLEANUP_RETRY_DELAYS_MS.length - 1)
  ]
);

const sanitizeCleanupErrorCode = (error) => String(
  error?.code ?? error?.name ?? 'profile_image_cleanup_failed'
)
  .replace(/[^a-z0-9_.-]/gi, '_')
  .slice(0, 120);

const deleteUploadedProfileImage = async (storageFileId) => {
  if (!storageFileId) {
    return 0;
  }

  await deleteProfileImageFile(storageFileId);
  return 1;
};

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

const markConversationDataDeleted = async ({ chatIds, session }) => {
  if (chatIds.length === 0) return;

  await Attachment.updateMany(
    { chatId: { $in: chatIds }, status: { $ne: 'deleted' } },
    { $set: { status: 'deleted' } },
    { session }
  );
  await Message.deleteMany({ chatId: { $in: chatIds } }, { session });
  await Chats.deleteMany({ _id: { $in: chatIds } }, { session });
};

const transferOrDeleteSpaces = async ({ userId, now, session }) => {
  const spaces = await Spaces.find({ 'members.user': userId }).session(session);
  let transferred = 0;
  let deleted = 0;

  for (const space of spaces) {
    const remainingMembers = (space.members ?? [])
      .filter((member) => toIdString(member.user) !== userId.toString());

    if (remainingMembers.length === 0) {
      const channels = await Chats.find({
        space: space._id,
        isSpaceChannel: true,
      })
        .select('_id')
        .session(session)
        .lean();
      const channelIds = channels.map((channel) => channel._id);

      await markConversationDataDeleted({ chatIds: channelIds, session });
      await InviteLink.updateMany(
        { space: space._id, revokedAt: null },
        { $set: { revokedAt: now, revokedBy: userId } },
        { session }
      );
      await Spaces.deleteOne({ _id: space._id }, { session });
      deleted += 1;
      continue;
    }

    if (toIdString(space.owner) === userId.toString()) {
      const successor = remainingMembers.find((member) => member.role === SPACE_ROLES.ADMIN)
        ?? remainingMembers[0];
      const successorId = successor.user?._id ?? successor.user;

      remainingMembers.forEach((member) => {
        member.role = toIdString(member.user) === toIdString(successorId)
          ? SPACE_ROLES.OWNER
          : member.role === SPACE_ROLES.OWNER
            ? SPACE_ROLES.MEMBER
            : member.role;
      });
      space.owner = successorId;
      transferred += 1;
    }

    space.members = remainingMembers;
    await space.save({ session });
    await Chats.updateMany(
      { space: space._id, isSpaceChannel: true },
      { $pull: { members: userId } },
      { session }
    );
  }

  return { transferred, deleted };
};

const transferOrDeleteGroupOwnership = async ({ userId, session }) => {
  const groups = await Chats.find({
    isGroupChat: true,
    isSpaceChannel: { $ne: true },
    groupAdmin: userId,
  })
    .select('_id members')
    .session(session);
  let transferred = 0;
  let deleted = 0;

  for (const group of groups) {
    const successorId = (group.members ?? [])
      .map((member) => member?._id ?? member)
      .find((memberId) => toIdString(memberId) !== userId.toString());

    if (successorId) {
      await Chats.updateOne(
        { _id: group._id, groupAdmin: userId },
        { $set: { groupAdmin: successorId } },
        { session }
      );
      transferred += 1;
      continue;
    }

    await markConversationDataDeleted({ chatIds: [group._id], session });
    deleted += 1;
  }

  return { transferred, deleted };
};

const revokeOwnedCredentialsAndAuthority = async ({ userId, now, session }) => {
  const ownedApps = await IntegrationApp.find({ owner: userId })
    .select('_id')
    .session(session)
    .lean();
  const ownedAppIds = ownedApps.map((app) => app._id);
  const apps = await IntegrationApp.updateMany(
    { owner: userId, status: { $ne: INTEGRATION_APP_STATUSES.REVOKED } },
    { $set: { status: INTEGRATION_APP_STATUSES.REVOKED } },
    { session }
  );
  const installations = await IntegrationInstallation.updateMany(
    {
      status: { $ne: INTEGRATION_INSTALLATION_STATUSES.REVOKED },
      $or: [
        { installedBy: userId },
        ...(ownedAppIds.length > 0 ? [{ app: { $in: ownedAppIds } }] : []),
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
  const invites = await InviteLink.updateMany(
    { createdBy: userId, revokedAt: null },
    { $set: { revokedAt: now, revokedBy: userId } },
    { session }
  );
  const spaces = await transferOrDeleteSpaces({ userId, now, session });
  const groups = await transferOrDeleteGroupOwnership({ userId, session });

  return {
    integrationAppsRevoked: apps.modifiedCount ?? 0,
    integrationInstallationsRevoked: installations.modifiedCount ?? 0,
    inviteLinksRevoked: invites.modifiedCount ?? 0,
    spacesTransferred: spaces.transferred,
    spacesDeleted: spaces.deleted,
    groupOwnershipTransferred: groups.transferred,
    groupsDeleted: groups.deleted,
  };
};

const deleteAuthenticationArtifacts = async ({ userId, session }) => {
  const [
    sessions,
    sessionFamilies,
    passwordResets,
    oauthHandoffs,
    twoFactorChallenges,
    twoFactorUsage,
    outbox,
  ] = await Promise.all([
    Session.deleteMany({ userId }, { session }),
    SessionFamily.deleteMany({ userId }, { session }),
    PasswordReset.deleteMany({ userId }, { session }),
    OAuthHandoff.deleteMany({ userId }, { session }),
    TwoFactorChallenge.deleteMany({ userId }, { session }),
    TwoFactorUsage.deleteMany({ userId }, { session }),
    NotificationOutbox.deleteMany({
      $or: [
        { recipient: userId },
        { sender: userId },
      ],
    }, { session }),
  ]);

  return {
    sessionsRemoved: sessions.deletedCount ?? 0,
    sessionFamiliesRemoved: sessionFamilies.deletedCount ?? 0,
    passwordResetsDeleted: passwordResets.deletedCount ?? 0,
    oauthHandoffsDeleted: oauthHandoffs.deletedCount ?? 0,
    twoFactorChallengesDeleted: twoFactorChallenges.deletedCount ?? 0,
    twoFactorUsageDeleted: twoFactorUsage.deletedCount ?? 0,
    notificationOutboxDeleted: outbox.deletedCount ?? 0,
  };
};

const loadDeletionRequestForWork = ({ requestId, now, session }) => PrivacyRequest.findOne({
  _id: requestId,
  type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
  $or: [
    {
      status: PRIVACY_REQUEST_STATUSES.PENDING,
      scheduledFor: { $lte: now },
    },
    {
      status: PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
      'cleanup.nextAttemptAt': { $lte: now },
    },
  ],
})
  .select('+cleanup.profileImageStorageId')
  .session(session);

const processDeletionRequestTransaction = async ({ requestId, now }) => withDatabaseTransaction(
  async (session) => {
    const counts = createEmptyCounts();
    const request = await loadDeletionRequestForWork({ requestId, now, session });

    if (!request) {
      return {
        processed: false,
        coreProcessed: false,
        counts,
        userId: null,
        profileImageStorageId: null,
        cleanupAttempts: 0,
      };
    }

    if (request.status === PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING) {
      return {
        processed: true,
        coreProcessed: false,
        counts,
        userId: request.user,
        profileImageStorageId: request.cleanup?.profileImageStorageId ?? null,
        cleanupAttempts: request.cleanup?.attempts ?? 0,
      };
    }

    const user = await User.findById(request.user)
      .select('+uploadedProfileImage +providerProfilePic +password +googleId +discordId +githubId +role +twoFactor +moderation')
      .session(session);
    const profileImageStorageId = user?.uploadedProfileImage?.storageFileId ?? null;

    counts.deletionRequestsProcessed = 1;

    if (user) {
      addCounts(counts, await revokeOwnedCredentialsAndAuthority({
        userId: user._id,
        now,
        session,
      }));
      await anonymizeUserAccount({ user, now, session });
      counts.accountsAnonymized = 1;
      addCounts(counts, await deleteAuthenticationArtifacts({
        userId: user._id,
        session,
      }));
    }

    request.status = PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING;
    request.completedAt = undefined;
    request.cleanup = {
      profileImageStorageId,
      attempts: 0,
      nextAttemptAt: now,
      lastAttemptAt: null,
      lastErrorCode: null,
    };
    request.recordCounts = {
      ...counts,
      profileImagesDeleted: 0,
      socketsDisconnected: 0,
    };
    request.retentionSummary = {
      ...(request.retentionSummary ?? {}),
      coreProcessedAt: serializeDate(now),
      accountProfile: user
        ? 'Account profile and login identifiers were anonymized by the privacy operations worker.'
        : 'Account record was already unavailable when the privacy operations worker ran.',
      authentication: 'Sessions, challenges, password reset records, provider handoffs, integration tokens, and notification endpoints were removed or revoked.',
      conversations: 'Conversation records remain as redacted participant references where required for other participants. Space and group authority was transferred or removed.',
      media: profileImageStorageId
        ? 'Profile image deletion is pending durable external cleanup.'
        : 'No uploaded profile image required external cleanup.',
    };
    request.events.push({
      action: PRIVACY_REQUEST_ACTIONS.DELETION_CORE_PROCESSED,
      actor: request.user,
      metadata: request.recordCounts,
    });
    await request.save({ session });

    return {
      processed: true,
      coreProcessed: true,
      counts,
      userId: user?._id ?? request.user,
      profileImageStorageId,
      cleanupAttempts: 0,
    };
  }
);

const completeDeletionCleanup = async ({ requestId, counts, now }) => {
  const result = await PrivacyRequest.updateOne(
    {
      _id: requestId,
      status: PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
    },
    {
      $set: {
        status: PRIVACY_REQUEST_STATUSES.COMPLETED,
        completedAt: now,
        'recordCounts.profileImagesDeleted': counts.profileImagesDeleted,
        'recordCounts.socketsDisconnected': counts.socketsDisconnected,
        'retentionSummary.completedAt': serializeDate(now),
        'retentionSummary.media': 'External profile image cleanup completed or no uploaded image required cleanup.',
      },
      $unset: {
        cleanup: '',
      },
      $push: {
        events: {
          action: PRIVACY_REQUEST_ACTIONS.DELETION_PROCESSED,
          actor: counts.userId,
          metadata: {
            profileImagesDeleted: counts.profileImagesDeleted,
            socketsDisconnected: counts.socketsDisconnected,
          },
        },
      },
    }
  );

  return (result.modifiedCount ?? 0) === 1;
};

const scheduleDeletionCleanupRetry = async ({
  requestId,
  userId,
  counts,
  attempts,
  now,
  error,
}) => {
  const nextAttempts = attempts + 1;
  const nextAttemptAt = new Date(now.getTime() + getCleanupRetryDelayMs(attempts));
  const errorCode = sanitizeCleanupErrorCode(error);

  await PrivacyRequest.updateOne(
    {
      _id: requestId,
      status: PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
    },
    {
      $set: {
        'cleanup.attempts': nextAttempts,
        'cleanup.lastAttemptAt': now,
        'cleanup.nextAttemptAt': nextAttemptAt,
        'cleanup.lastErrorCode': errorCode,
        'recordCounts.socketsDisconnected': counts.socketsDisconnected,
        'retentionSummary.media': 'External profile image cleanup is pending retry.',
      },
      $push: {
        events: {
          action: PRIVACY_REQUEST_ACTIONS.DELETION_CLEANUP_RETRY,
          actor: userId,
          metadata: {
            attempt: nextAttempts,
            nextAttemptAt: serializeDate(nextAttemptAt),
            errorCode,
          },
        },
      },
    }
  );

  counts.cleanupRetriesScheduled = 1;
  counts.errors += 1;
};

const processDeletionRequest = async ({ requestId, now }) => {
  const result = await processDeletionRequestTransaction({ requestId, now });

  if (!result.processed) {
    return result.counts;
  }

  const counts = result.counts;
  counts.userId = result.userId;

  if (result.userId) {
    counts.socketsDisconnected = disconnectUserSockets(result.userId);
  }

  try {
    counts.profileImagesDeleted = await deleteUploadedProfileImage(result.profileImageStorageId);
    await completeDeletionCleanup({ requestId, counts, now: new Date() });
  } catch (error) {
    logger.warn('privacy.profile_image_delete_failed', {
      userId: result.userId?.toString?.() ?? null,
      requestId: requestId.toString(),
      errorCode: sanitizeCleanupErrorCode(error),
    });
    await scheduleDeletionCleanupRetry({
      requestId,
      userId: result.userId,
      counts,
      attempts: result.cleanupAttempts,
      now: new Date(),
      error,
    });
  } finally {
    delete counts.userId;
  }

  return counts;
};

const countRetentionBacklog = async ({ now = new Date() } = {}) => {
  const { cutoff } = getTerminalOutboxCutoff(now);
  const [
    expiredExportAudits,
    expiredPasswordResets,
    expiredSessions,
    terminalNotificationOutbox,
  ] = await Promise.all([
    PrivacyRequest.countDocuments({
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_EXPORT,
      expiresAt: { $lte: now },
    }),
    PasswordReset.countDocuments({ expiresAt: { $lte: now } }),
    Session.countDocuments({ expiresAt: { $lte: now } }),
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
    terminalNotificationOutbox,
  };
};

const cleanupExpiredPrivacyArtifacts = async ({ now = new Date() } = {}) => {
  const { cutoff } = getTerminalOutboxCutoff(now);
  const [
    exportAudits,
    passwordResets,
    sessions,
    terminalOutbox,
  ] = await Promise.all([
    PrivacyRequest.deleteMany({
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_EXPORT,
      expiresAt: { $lte: now },
    }),
    PasswordReset.deleteMany({ expiresAt: { $lte: now } }),
    Session.deleteMany({ expiresAt: { $lte: now } }),
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
      'cleanup.nextAttemptAt': { $lte: now },
    },
  ],
})
  .select('_id')
  .sort({ 'cleanup.nextAttemptAt': 1, scheduledFor: 1, requestedAt: 1, _id: 1 })
  .limit(limit)
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
        error,
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
  if (!run) {
    return null;
  }

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
    cleanupPendingDeletionRequests,
    dueDeletionRequests,
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
      status: PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
    }),
    PrivacyRequest.countDocuments({
      type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,
      $or: [
        {
          status: PRIVACY_REQUEST_STATUSES.PENDING,
          scheduledFor: { $lte: now },
        },
        {
          status: PRIVACY_REQUEST_STATUSES.CLEANUP_PENDING,
          'cleanup.nextAttemptAt': { $lte: now },
        },
      ],
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
    : dueDeletionRequests > 0 || cleanupPendingDeletionRequests > 0 || cleanupBacklog > 0
      ? 'attention'
      : 'ok';

  return {
    generatedAt: serializeDate(now),
    status,
    deletionRequests: {
      pending: pendingDeletionRequests,
      cleanupPending: cleanupPendingDeletionRequests,
      due: dueDeletionRequests,
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
  if (!isPrivacyWorkerEnabled() || privacyWorkerTimer) {
    return null;
  }

  privacyWorkerTimer = setInterval(() => {
    processPrivacyOperations().catch((error) => {
      logger.error('privacy.worker_failed', { error });
    });
  }, getPrivacyWorkerIntervalMs());
  privacyWorkerTimer.unref?.();

  return privacyWorkerTimer;
};

export const stopPrivacyOperationsWorker = () => {
  if (!privacyWorkerTimer) {
    return;
  }

  clearInterval(privacyWorkerTimer);
  privacyWorkerTimer = null;
};

export const resetPrivacyOperationsWorkerForTests = () => {
  stopPrivacyOperationsWorker();
};
