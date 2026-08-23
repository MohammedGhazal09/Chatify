import UploadBudget, { UPLOAD_BUDGET_PURPOSES } from '../Models/uploadBudgetModel.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const INDEX_READY = Symbol.for('chatify.uploadBudget.indexReady');

const DEFAULT_LIMITS = Object.freeze({
  [UPLOAD_BUDGET_PURPOSES.ATTACHMENT]: Object.freeze({
    maxBytes: 100 * 1024 * 1024,
    maxFiles: 100,
    maxRequests: 50,
  }),
  [UPLOAD_BUDGET_PURPOSES.PROFILE_IMAGE]: Object.freeze({
    maxBytes: 20 * 1024 * 1024,
    maxFiles: 20,
    maxRequests: 20,
  }),
});

export class UploadBudgetExceededError extends Error {
  constructor(purpose) {
    super('Upload quota exceeded. Try again after the current daily window resets.');
    this.name = 'UploadBudgetExceededError';
    this.code = 'UPLOAD_BUDGET_EXCEEDED';
    this.statusCode = 429;
    this.purpose = purpose;
  }
}

const normalizePositiveInteger = (value, fallback, max) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, max)
    : fallback;
};

export const getUploadBudgetLimits = (purpose, env = process.env) => {
  const defaults = DEFAULT_LIMITS[purpose];
  if (!defaults) throw new TypeError('Unsupported upload budget purpose');
  const prefix = purpose === UPLOAD_BUDGET_PURPOSES.ATTACHMENT
    ? 'ATTACHMENT_UPLOAD_DAILY'
    : 'PROFILE_IMAGE_UPLOAD_DAILY';
  return {
    maxBytes: normalizePositiveInteger(
      env[`${prefix}_BYTES`],
      defaults.maxBytes,
      1024 * 1024 * 1024
    ),
    maxFiles: normalizePositiveInteger(
      env[`${prefix}_FILES`],
      defaults.maxFiles,
      10_000
    ),
    maxRequests: normalizePositiveInteger(
      env[`${prefix}_REQUESTS`],
      defaults.maxRequests,
      10_000
    ),
  };
};

const startOfUtcDay = (value) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const ensureIndexes = () => {
  UploadBudget[INDEX_READY] ??= UploadBudget.createIndexes();
  return UploadBudget[INDEX_READY];
};

const isDuplicateKeyError = (error) => error?.code === 11000;

export const reserveUploadBudget = async ({
  userId,
  purpose,
  bytes,
  files,
  now = new Date(),
  limits = getUploadBudgetLimits(purpose),
} = {}) => {
  const normalizedBytes = Number(bytes);
  const normalizedFiles = Number(files);

  if (!userId || !Object.values(UPLOAD_BUDGET_PURPOSES).includes(purpose)) {
    throw new TypeError('Upload budget requires a user and supported purpose');
  }
  if (
    !Number.isSafeInteger(normalizedBytes)
    || normalizedBytes < 0
    || !Number.isSafeInteger(normalizedFiles)
    || normalizedFiles < 1
  ) {
    throw new TypeError('Upload budget bytes and file count are invalid');
  }
  if (
    normalizedBytes > limits.maxBytes
    || normalizedFiles > limits.maxFiles
    || limits.maxRequests < 1
  ) {
    throw new UploadBudgetExceededError(purpose);
  }

  await ensureIndexes();
  const periodStart = startOfUtcDay(now);
  const expiresAt = new Date(periodStart.getTime() + (2 * DAY_MS));
  const filter = {
    userId,
    purpose,
    periodStart,
    bytes: { $lte: limits.maxBytes - normalizedBytes },
    files: { $lte: limits.maxFiles - normalizedFiles },
    requests: { $lte: limits.maxRequests - 1 },
  };

  try {
    const budget = await UploadBudget.findOneAndUpdate(
      filter,
      {
        $inc: {
          bytes: normalizedBytes,
          files: normalizedFiles,
          requests: 1,
        },
        $setOnInsert: { expiresAt },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    if (!budget) throw new UploadBudgetExceededError(purpose);

    return {
      purpose,
      periodStart: budget.periodStart.toISOString(),
      bytes: budget.bytes,
      files: budget.files,
      requests: budget.requests,
      limits: { ...limits },
    };
  } catch (error) {
    if (isDuplicateKeyError(error) || error instanceof UploadBudgetExceededError) {
      throw new UploadBudgetExceededError(purpose);
    }
    throw error;
  }
};
