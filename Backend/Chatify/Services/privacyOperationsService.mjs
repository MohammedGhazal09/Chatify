import PrivacyOperationRun, {
  PRIVACY_OPERATION_RUN_STATUSES,
  PRIVACY_OPERATION_RUN_TRIGGERS,
} from '../Models/privacyOperationRunModel.mjs';
import PrivacyRequest, {
  PRIVACY_REQUEST_ACTIONS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
} from '../Models/privacyRequestModel.mjs';
import PasswordReset from '../Models/passwordResetModel.mjs';
import Session from '../Models/sessionModel.mjs';
import NotificationOutbox, {
  NOTIFICATION_OUTBOX_STATUS,
} from '../Models/notificationOutboxModel.mjs';
import User from '../Models/userModel.mjs';
import { disconnectUserSockets } from '../Config/socket.mjs';
import { deleteProfileImageFile } from './profileImageStorageService.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WORKER_INTERVAL_MS = 5 * 60 * 1000;

export const DEFAULT_PRIVACY_OPERATION_BATCH_SIZE = 25;
export const DEFAULT_NOTIFICATION_OUTBOX_RETENTION_DAYS = 30;

const serializeDate = (value) => value?.toISOString?.() ?? value ?? null;

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
  passwordResetsDeleted: 0,
  notificationOutboxDeleted: 0,
  socketsDisconnected: 0,
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

const deleteUploadedProfileImage = async (user) => {
  const storageFileId = user?.uploadedProfileImage?.storageFileId;

  if (!storageFileId) {
    return 0;
  }

  await deleteProfileImageFile(storageFileId);
  return 1;
};

const anonymizeUserAccount = async ({ user, now }) => {
  const tombstone = getTombstoneIdentity(user._id);

  await User.updateOne(
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
    }
  );
};

const processDeletionRequest = async ({ request, now }) => {
  const counts = createEmptyCounts();
  const user = await User.findById(request.user)
    .select('+uploadedProfileImage +providerProfilePic +password +googleId +discordId +githubId +role +twoFactor +moderation');

  counts.deletionRequestsProcessed = 1;

  if (user) {
    try {
      counts.profileImagesDeleted = await deleteUploadedProfileImage(user);
    } catch (error) {
      logger.warn('privacy.profile_image_delete_failed', {
        userId: user._id.toString(),
        error,
      });
    }

    await anonymizeUserAccount({ user, now });
    counts.accountsAnonymized = 1;
    counts.socketsDisconnected = disconnectUserSockets(user._id);

    const [sessions, passwordResets, outbox] = await Promise.all([
      Session.deleteMany({ userId: user._id }),
      PasswordReset.deleteMany({ userId: user._id }),
      NotificationOutbox.deleteMany({
        $or: [
          { recipient: user._id },
          { sender: user._id },
        ],
      }),
    ]);

    counts.sessionsRemoved = sessions.deletedCount ?? 0;
    counts.passwordResetsDeleted = passwordResets.deletedCount ?? 0;
    counts.notificationOutboxDeleted = outbox.deletedCount ?? 0;
  }

  request.status = PRIVACY_REQUEST_STATUSES.COMPLETED;
  request.completedAt = now;
  request.recordCounts = {
    deletionRequestsProcessed: counts.deletionRequestsProcessed,
    accountsAnonymized: counts.accountsAnonymized,
    profileImagesDeleted: counts.profileImagesDeleted,
    sessionsRemoved: counts.sessionsRemoved,
    passwordResetsDeleted: counts.passwordResetsDeleted,
    notificationOutboxDeleted: counts.notificationOutboxDeleted,
    socketsDisconnected: counts.socketsDisconnected,
  };
  request.retentionSummary = {
    ...(request.retentionSummary ?? {}),
    processedAt: serializeDate(now),
    accountProfile: user
      ? 'Account profile and login identifiers were anonymized by the privacy operations worker.'
      : 'Account record was already unavailable when the privacy operations worker ran.',
    authentication: 'Sessions, password reset records, provider identifiers, and notification endpoints were removed or revoked.',
    conversations: 'Conversation records remain as redacted participant references where required for other participants.',
  };
  request.events.push({
    action: PRIVACY_REQUEST_ACTIONS.DELETION_PROCESSED,
    actor: request.user,
    metadata: request.recordCounts,
  });
  await request.save();

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
  status: PRIVACY_REQUEST_STATUSES.PENDING,
  scheduledFor: { $lte: now },
})
  .sort({ scheduledFor: 1, requestedAt: 1, _id: 1 })
  .limit(limit);

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
      addCounts(counts, await processDeletionRequest({ request, now }));
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
      status: PRIVACY_REQUEST_STATUSES.PENDING,
      scheduledFor: { $lte: now },
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
    : dueDeletionRequests > 0 || cleanupBacklog > 0
      ? 'attention'
      : 'ok';

  return {
    generatedAt: serializeDate(now),
    status,
    deletionRequests: {
      pending: pendingDeletionRequests,
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
