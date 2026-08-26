import Attachment from '../Models/attachmentModel.mjs';
import User from '../Models/userModel.mjs';
import {
  deleteAttachmentFile,
  getAttachmentBucket,
} from './attachmentStorageService.mjs';
import {
  deleteProfileImageFile,
  getProfileImageBucket,
} from './profileImageStorageService.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const DEFAULT_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RECONCILIATION_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MIN_RECONCILIATION_INTERVAL_MS = 5 * 60 * 1000;

const getBoundedInteger = (value, fallback, { min, max }) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) && parsed >= min
    ? Math.min(parsed, max)
    : fallback;
};

export const getUploadLifecyclePolicy = (env = process.env) => ({
  orphanGraceMs: getBoundedInteger(
    env.UPLOAD_ORPHAN_GRACE_MS,
    DEFAULT_ORPHAN_GRACE_MS,
    { min: 0, max: 30 * 24 * 60 * 60 * 1000 }
  ),
  intervalMs: getBoundedInteger(
    env.UPLOAD_RECONCILIATION_INTERVAL_MS,
    DEFAULT_RECONCILIATION_INTERVAL_MS,
    { min: MIN_RECONCILIATION_INTERVAL_MS, max: 7 * 24 * 60 * 60 * 1000 }
  ),
});

const idString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? null;

const deleteFiles = async (ids, deleteFile) => {
  let deleted = 0;
  let errors = 0;
  for (const id of ids) {
    try {
      await deleteFile(id);
      deleted += 1;
    } catch (error) {
      errors += 1;
      logger.warn('upload_lifecycle.file_delete_failed', {
        storageId: idString(id),
        error,
      });
    }
  }
  return { deleted, errors };
};

const getReferencedAttachmentStorageIds = async () => new Set(
  (await Attachment.distinct('storageFileId'))
    .map(idString)
    .filter(Boolean)
);

const getReferencedProfileStorageIds = async () => {
  const users = await User.find({
    'uploadedProfileImage.storageFileId': { $exists: true },
  }).select('+uploadedProfileImage').lean();

  return new Set(users
    .map((user) => idString(user.uploadedProfileImage?.storageFileId))
    .filter(Boolean));
};

const findOldGridFsFiles = (bucket, cutoff) => bucket.find({
  uploadDate: { $lte: cutoff },
}).toArray();

export const reconcileUploadStorage = async ({
  now = new Date(),
  orphanGraceMs = getUploadLifecyclePolicy().orphanGraceMs,
} = {}) => {
  const cutoff = new Date(new Date(now).getTime() - Math.max(0, orphanGraceMs));
  const result = {
    deletedAttachmentRecords: 0,
    deletedAttachmentFiles: 0,
    attachmentOrphansDeleted: 0,
    profileImageOrphansDeleted: 0,
    errors: 0,
  };

  const deletedAttachments = await Attachment.find({
    status: 'deleted',
    updatedAt: { $lte: cutoff },
  });
  const deletedStorageIds = deletedAttachments.map((attachment) => attachment.storageFileId);
  const deletedFileResult = await deleteFiles(deletedStorageIds, deleteAttachmentFile);
  result.deletedAttachmentFiles += deletedFileResult.deleted;
  result.errors += deletedFileResult.errors;

  if (deletedAttachments.length > 0) {
    const deletion = await Attachment.deleteMany({
      _id: { $in: deletedAttachments.map((attachment) => attachment._id) },
    });
    result.deletedAttachmentRecords = deletion.deletedCount ?? 0;
  }

  const [
    referencedAttachmentIds,
    referencedProfileIds,
    attachmentFiles,
    profileFiles,
  ] = await Promise.all([
    getReferencedAttachmentStorageIds(),
    getReferencedProfileStorageIds(),
    findOldGridFsFiles(getAttachmentBucket(), cutoff),
    findOldGridFsFiles(getProfileImageBucket(), cutoff),
  ]);

  const attachmentOrphanIds = attachmentFiles
    .map((file) => file._id)
    .filter((id) => !referencedAttachmentIds.has(idString(id)));
  const profileOrphanIds = profileFiles
    .map((file) => file._id)
    .filter((id) => !referencedProfileIds.has(idString(id)));

  const [attachmentOrphans, profileOrphans] = await Promise.all([
    deleteFiles(attachmentOrphanIds, deleteAttachmentFile),
    deleteFiles(profileOrphanIds, deleteProfileImageFile),
  ]);
  result.attachmentOrphansDeleted = attachmentOrphans.deleted;
  result.profileImageOrphansDeleted = profileOrphans.deleted;
  result.errors += attachmentOrphans.errors + profileOrphans.errors;

  return {
    ...result,
    status: result.errors > 0 ? 'degraded' : 'completed',
    checkedAt: new Date(now).toISOString(),
  };
};

let workerTimer = null;

const workerEnabled = (env = process.env) => (
  env.NODE_ENV !== 'test' && env.UPLOAD_LIFECYCLE_WORKER_ENABLED !== '0'
);

export const startUploadLifecycleWorker = (env = process.env) => {
  if (!workerEnabled(env) || workerTimer) return workerTimer;
  const { intervalMs } = getUploadLifecyclePolicy(env);
  workerTimer = setInterval(() => {
    reconcileUploadStorage().catch((error) => {
      logger.error('upload_lifecycle.worker_failed', { error });
    });
  }, intervalMs);
  workerTimer.unref?.();
  return workerTimer;
};

export const stopUploadLifecycleWorker = () => {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
};

export const resetUploadLifecycleWorkerForTests = () => {
  stopUploadLifecycleWorker();
};
