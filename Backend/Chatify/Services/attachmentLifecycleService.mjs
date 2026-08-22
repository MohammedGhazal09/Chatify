import Attachment, {
  ATTACHMENT_STORAGE_STATES,
} from '../Models/attachmentModel.mjs';
import { deleteAttachmentFile } from './attachmentStorageService.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const DEFAULT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MIN_CLEANUP_INTERVAL_MS = 60 * 1000;
const DEFAULT_RETRY_DELAY_MS = 60 * 1000;

export const DEFAULT_ATTACHMENT_CLEANUP_BATCH_SIZE = 50;

export class AttachmentCleanupError extends Error {
  constructor(message, summary) {
    super(message);
    this.name = 'AttachmentCleanupError';
    this.code = 'ATTACHMENT_CLEANUP_INCOMPLETE';
    this.statusCode = 503;
    this.summary = summary;
  }
}

const normalizeCleanupCode = (error) => {
  const candidate = String(
    error?.code
    ?? error?.codeName
    ?? error?.name
    ?? 'storage_delete_failed'
  )
    .toUpperCase()
    .replace(/[^A-Z0-9_\-]/g, '_')
    .slice(0, 80);

  return candidate || 'STORAGE_DELETE_FAILED';
};

const getRetryDelayMs = () => {
  const configured = Number.parseInt(process.env.ATTACHMENT_CLEANUP_RETRY_DELAY_MS ?? '', 10);
  return Number.isSafeInteger(configured) && configured >= MIN_CLEANUP_INTERVAL_MS
    ? Math.min(configured, 24 * 60 * 60 * 1000)
    : DEFAULT_RETRY_DELAY_MS;
};

const getCleanupIntervalMs = () => {
  const configured = Number.parseInt(process.env.ATTACHMENT_CLEANUP_INTERVAL_MS ?? '', 10);
  return Number.isSafeInteger(configured) && configured >= MIN_CLEANUP_INTERVAL_MS
    ? Math.min(configured, 24 * 60 * 60 * 1000)
    : DEFAULT_CLEANUP_INTERVAL_MS;
};

const isCleanupWorkerEnabled = () => (
  process.env.NODE_ENV !== 'test'
  && process.env.ATTACHMENT_CLEANUP_WORKER_ENABLED !== '0'
);

const makeSummary = ({ matched = 0, purged = 0, pendingCleanup = 0 } = {}) => ({
  matched,
  purged,
  pendingCleanup,
});

const markCleanupPending = async ({ attachmentId, now, error }) => {
  await Attachment.updateOne(
    { _id: attachmentId },
    {
      $set: {
        status: 'deleted',
        storageState: ATTACHMENT_STORAGE_STATES.PENDING_CLEANUP,
        deletedAt: now,
        nextCleanupAt: new Date(now.getTime() + getRetryDelayMs()),
        cleanupErrorCode: normalizeCleanupCode(error),
      },
      $inc: { cleanupAttempts: 1 },
    }
  );
};

const markCleanupComplete = async ({ attachmentId, now }) => {
  await Attachment.updateOne(
    { _id: attachmentId },
    {
      $set: {
        status: 'deleted',
        storageState: ATTACHMENT_STORAGE_STATES.DELETED,
        deletedAt: now,
        storageDeletedAt: now,
        nextCleanupAt: null,
        cleanupErrorCode: null,
      },
      $inc: { cleanupAttempts: 1 },
    }
  );
};

const markCleanupStarted = async ({ attachmentId, now }) => Attachment.findOneAndUpdate(
  {
    _id: attachmentId,
    storageState: { $ne: ATTACHMENT_STORAGE_STATES.DELETED },
  },
  {
    $set: {
      status: 'deleted',
      storageState: ATTACHMENT_STORAGE_STATES.DELETING,
      deletedAt: now,
      nextCleanupAt: null,
      cleanupErrorCode: null,
    },
  },
  { new: true }
).select('+cleanupErrorCode');

const purgeAttachmentRecord = async (attachment, now = new Date()) => {
  const claimed = await markCleanupStarted({
    attachmentId: attachment._id,
    now,
  });

  if (!claimed) {
    return { purged: 0, pendingCleanup: 0 };
  }

  try {
    await deleteAttachmentFile(claimed.storageFileId);
    await markCleanupComplete({ attachmentId: claimed._id, now });
    return { purged: 1, pendingCleanup: 0 };
  } catch (error) {
    await markCleanupPending({
      attachmentId: claimed._id,
      now,
      error,
    });
    return { purged: 0, pendingCleanup: 1 };
  }
};

const purgeRecords = async ({ attachments, now = new Date() }) => {
  const summary = makeSummary({ matched: attachments.length });

  for (const attachment of attachments) {
    const result = await purgeAttachmentRecord(attachment, now);
    summary.purged += result.purged;
    summary.pendingCleanup += result.pendingCleanup;
  }

  return summary;
};

const enforceCompleteCleanup = (summary, context) => {
  if (summary.pendingCleanup > 0) {
    throw new AttachmentCleanupError(
      `Attachment cleanup is incomplete for ${context}`,
      summary
    );
  }
  return summary;
};

export const purgeAttachmentsForMessage = async ({
  messageId,
  now = new Date(),
  throwOnFailure = true,
} = {}) => {
  const attachments = await Attachment.find({
    messageId,
    storageState: { $ne: ATTACHMENT_STORAGE_STATES.DELETED },
  }).select('+cleanupErrorCode');
  const summary = await purgeRecords({ attachments, now });
  return throwOnFailure
    ? enforceCompleteCleanup(summary, 'message deletion')
    : summary;
};

export const purgeAttachmentsForChat = async ({
  chatId,
  now = new Date(),
  throwOnFailure = true,
} = {}) => {
  const attachments = await Attachment.find({
    chatId,
    storageState: { $ne: ATTACHMENT_STORAGE_STATES.DELETED },
  }).select('+cleanupErrorCode');
  const summary = await purgeRecords({ attachments, now });
  return throwOnFailure
    ? enforceCompleteCleanup(summary, 'chat deletion')
    : summary;
};

export const purgeChatUploadsAndMessages = async ({
  chatId,
  now = new Date(),
} = {}) => {
  const summary = await purgeAttachmentsForChat({ chatId, now, throwOnFailure: true });
  const { default: Message } = await import('../Models/messageModel.mjs');

  const [messages, attachments] = await Promise.all([
    Message.deleteMany({ chatId }),
    Attachment.deleteMany({ chatId }),
  ]);

  return {
    ...summary,
    messagesDeleted: messages.deletedCount ?? 0,
    attachmentMetadataDeleted: attachments.deletedCount ?? 0,
  };
};

const loadCleanupCandidates = ({ now, limit }) => Attachment.find({
  $or: [
    {
      storageState: {
        $in: [
          ATTACHMENT_STORAGE_STATES.PENDING_CLEANUP,
          ATTACHMENT_STORAGE_STATES.DELETING,
        ],
      },
      $or: [
        { nextCleanupAt: { $lte: now } },
        { nextCleanupAt: null },
      ],
    },
    { storageState: { $exists: false } },
    { storageState: ATTACHMENT_STORAGE_STATES.ACTIVE },
  ],
})
  .sort({ nextCleanupAt: 1, updatedAt: 1, _id: 1 })
  .limit(limit)
  .select('+cleanupErrorCode');

export const cleanupAttachmentOrphans = async ({
  now = new Date(),
  limit = DEFAULT_ATTACHMENT_CLEANUP_BATCH_SIZE,
} = {}) => {
  const boundedLimit = Number.isSafeInteger(limit) && limit > 0
    ? Math.min(limit, DEFAULT_ATTACHMENT_CLEANUP_BATCH_SIZE)
    : DEFAULT_ATTACHMENT_CLEANUP_BATCH_SIZE;
  const candidates = await loadCleanupCandidates({ now, limit: boundedLimit });
  const { default: Message } = await import('../Models/messageModel.mjs');
  const attachments = [];

  for (const candidate of candidates) {
    if (
      candidate.storageState === ATTACHMENT_STORAGE_STATES.PENDING_CLEANUP
      || candidate.storageState === ATTACHMENT_STORAGE_STATES.DELETING
    ) {
      attachments.push(candidate);
      continue;
    }

    const messageExists = await Message.exists({ _id: candidate.messageId });
    if (!messageExists) attachments.push(candidate);
  }

  const summary = await purgeRecords({ attachments, now });

  if (summary.matched > 0 || summary.pendingCleanup > 0) {
    logger.info('attachment.cleanup_completed', {
      matched: summary.matched,
      purged: summary.purged,
      pendingCleanup: summary.pendingCleanup,
    });
  }

  return summary;
};

let cleanupWorkerTimer = null;

export const startAttachmentCleanupWorker = () => {
  if (!isCleanupWorkerEnabled() || cleanupWorkerTimer) return null;

  cleanupWorkerTimer = setInterval(() => {
    cleanupAttachmentOrphans().catch((error) => {
      logger.error('attachment.cleanup_worker_failed', {
        errorCode: normalizeCleanupCode(error),
      });
    });
  }, getCleanupIntervalMs());
  cleanupWorkerTimer.unref?.();

  return cleanupWorkerTimer;
};

export const stopAttachmentCleanupWorker = () => {
  if (!cleanupWorkerTimer) return;
  clearInterval(cleanupWorkerTimer);
  cleanupWorkerTimer = null;
};

export const resetAttachmentCleanupWorkerForTests = () => {
  stopAttachmentCleanupWorker();
};
