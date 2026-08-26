import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import multer from 'multer';

import {
  ATTACHMENT_ERROR_CODES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_ATTACHMENT_AGGREGATE_SIZE_BYTES,
  MAX_ATTACHMENT_SIZE_BYTES,
  validateAggregateUploadSize,
} from '../Utils/attachmentValidation.mjs';
import {
  MAX_PROFILE_IMAGE_SIZE_BYTES,
  PROFILE_IMAGE_ERROR_CODES,
} from '../Utils/profileImageValidation.mjs';
import {
  UploadBudgetExceededError,
  reserveUploadBudget,
} from '../Services/uploadBudgetService.mjs';
import { authorizeUploadChatId } from './uploadAuthorization.mjs';

const MULTIPART_OVERHEAD_ALLOWANCE_BYTES = 256 * 1024;
const DEFAULT_UPLOAD_BUFFER_BUDGET_BYTES = 64 * 1024 * 1024;
const MAX_UPLOAD_BUFFER_BUDGET_BYTES = 512 * 1024 * 1024;
const UPLOAD_TEMP_MAX_AGE_MS = 60 * 60 * 1000;
const UPLOAD_TEMP_SWEEP_MS = 15 * 60 * 1000;
const UPLOAD_TEMP_DIR = path.join(os.tmpdir(), 'chatify-secure-uploads');
const BUFFER_RESERVATION = Symbol('chatify.uploadBufferReservation');
const RESOURCE_CLEANUP_REGISTERED = Symbol('chatify.uploadResourceCleanupRegistered');
const COMPLEX_DOCUMENT_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx']);

let activeUploadBufferBytes = 0;
let tempSweepTimer = null;

fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true, mode: 0o700 });

const normalizeBufferBudget = (value) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isSafeInteger(parsed) || parsed < MAX_ATTACHMENT_AGGREGATE_SIZE_BYTES) {
    return DEFAULT_UPLOAD_BUFFER_BUDGET_BYTES;
  }
  return Math.min(parsed, MAX_UPLOAD_BUFFER_BUDGET_BYTES);
};

const getUploadBufferBudgetBytes = () => normalizeBufferBudget(
  process.env.UPLOAD_BUFFER_MEMORY_BUDGET_BYTES
);

const sweepStaleTempFiles = async () => {
  const cutoff = Date.now() - UPLOAD_TEMP_MAX_AGE_MS;
  let entries = [];
  try {
    entries = await fsPromises.readdir(UPLOAD_TEMP_DIR, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.allSettled(entries
    .filter((entry) => entry.isFile())
    .map(async (entry) => {
      const filePath = path.join(UPLOAD_TEMP_DIR, entry.name);
      const stat = await fsPromises.stat(filePath);
      if (stat.mtimeMs <= cutoff) await fsPromises.unlink(filePath);
    }));
};

const startTempSweep = () => {
  if (tempSweepTimer) return;
  tempSweepTimer = setInterval(() => {
    void sweepStaleTempFiles();
  }, UPLOAD_TEMP_SWEEP_MS);
  tempSweepTimer.unref?.();
};

startTempSweep();

const uploadDiskStorage = multer.diskStorage({
  destination(_req, _file, callback) {
    callback(null, UPLOAD_TEMP_DIR);
  },
  filename(_req, _file, callback) {
    callback(null, `${Date.now()}-${randomUUID()}.upload`);
  },
});

const authorizeAttachmentFile = (req, file, callback) => {
  const extension = path.extname(String(file.originalname ?? '')).toLowerCase();
  if (COMPLEX_DOCUMENT_EXTENSIONS.has(extension)) {
    const error = new Error('Complex document containers are not accepted');
    error.code = 'UNSUPPORTED_COMPLEX_DOCUMENT';
    callback(error);
    return;
  }

  if (req.uploadAuthorizedChatId) {
    callback(null, true);
    return;
  }

  void authorizeUploadChatId({
    req,
    chatId: req.body?.chatId,
  })
    .then((chatId) => {
      req.uploadAuthorizedChatId = chatId;
      callback(null, true);
    })
    .catch(callback);
};

const exceedsDeclaredRequestSize = (req, maxBytes) => {
  const declared = Number.parseInt(req.headers['content-length'] ?? '', 10);
  return Number.isSafeInteger(declared)
    && declared > maxBytes + MULTIPART_OVERHEAD_ALLOWANCE_BYTES;
};

const attachmentUpload = multer({
  storage: uploadDiskStorage,
  fileFilter: authorizeAttachmentFile,
  limits: {
    fileSize: MAX_ATTACHMENT_SIZE_BYTES,
    files: MAX_ATTACHMENTS_PER_MESSAGE,
    fields: 20,
    fieldSize: 64 * 1024,
    parts: MAX_ATTACHMENTS_PER_MESSAGE + 20,
    headerPairs: 100,
  },
});

const profileImageUpload = multer({
  storage: uploadDiskStorage,
  limits: {
    fileSize: MAX_PROFILE_IMAGE_SIZE_BYTES,
    files: 1,
    fields: 4,
    fieldSize: 16 * 1024,
    parts: 5,
    headerPairs: 50,
  },
});

const respondUploadFailure = (res, { code, message, statusCode = 400 }) => {
  res.status(statusCode).json({ status: 'fail', code, message });
};

const mapAttachmentMulterError = (error) => {
  if (error?.statusCode && error?.code) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    };
  }
  if (error?.code === 'UNSUPPORTED_COMPLEX_DOCUMENT') {
    return {
      code: ATTACHMENT_ERROR_CODES.UNSUPPORTED_TYPE,
      message: 'PDF, DOCX, and XLSX attachments are not accepted',
    };
  }
  if (error?.code === 'LIMIT_AGGREGATE_SIZE') {
    return {
      code: ATTACHMENT_ERROR_CODES.AGGREGATE_SIZE_EXCEEDED,
      message: 'Combined attachments exceed the 25 MB request limit',
    };
  }
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return {
      code: ATTACHMENT_ERROR_CODES.SIZE_EXCEEDED,
      message: 'Attachment exceeds the 10 MB attachment limit',
    };
  }
  if (error instanceof multer.MulterError && [
    'LIMIT_FILE_COUNT',
    'LIMIT_UNEXPECTED_FILE',
  ].includes(error.code)) {
    return {
      code: ATTACHMENT_ERROR_CODES.COUNT_EXCEEDED,
      message: `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments allowed per message`,
    };
  }
  return {
    code: 'ATTACHMENT_UPLOAD_INVALID',
    message: 'Attachment upload is invalid',
  };
};

const mapProfileMulterError = (error) => {
  if (error instanceof multer.MulterError && [
    'LIMIT_FILE_SIZE',
    'LIMIT_AGGREGATE_SIZE',
  ].includes(error.code)) {
    return {
      code: PROFILE_IMAGE_ERROR_CODES.SIZE_EXCEEDED,
      message: 'Profile image must be 2 MB or smaller',
    };
  }
  if (error instanceof multer.MulterError && [
    'LIMIT_FILE_COUNT',
    'LIMIT_UNEXPECTED_FILE',
  ].includes(error.code)) {
    return {
      code: PROFILE_IMAGE_ERROR_CODES.COUNT_EXCEEDED,
      message: 'Upload exactly one profile image',
    };
  }
  return {
    code: 'PROFILE_IMAGE_UPLOAD_INVALID',
    message: 'Profile image upload is invalid',
  };
};

const getRequestFiles = (req) => {
  if (Array.isArray(req.files)) return req.files;
  return req.file ? [req.file] : [];
};

const deleteTempFiles = async (files) => {
  await Promise.allSettled(files.map(async (file) => {
    if (file?.path) await fsPromises.unlink(file.path);
  }));
};

const releaseUploadResources = async (req) => {
  const files = getRequestFiles(req);
  const reservedBytes = Number(req[BUFFER_RESERVATION] ?? 0);
  if (reservedBytes > 0) {
    activeUploadBufferBytes = Math.max(0, activeUploadBufferBytes - reservedBytes);
    req[BUFFER_RESERVATION] = 0;
  }
  files.forEach((file) => {
    delete file.buffer;
  });
  await deleteTempFiles(files);
};

const registerResponseCleanup = (req, res) => {
  if (req[RESOURCE_CLEANUP_REGISTERED]) return;
  req[RESOURCE_CLEANUP_REGISTERED] = true;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    void releaseUploadResources(req);
  };
  res.once('finish', cleanup);
  res.once('close', cleanup);
};

class UploadMemoryBudgetExceededError extends Error {
  constructor() {
    super('The server is currently processing other uploads. Try again shortly.');
    this.code = 'UPLOAD_MEMORY_BUDGET_EXCEEDED';
    this.statusCode = 503;
  }
}

const materializeFileBuffers = async (req, files) => {
  if (files.length === 0) return;
  const totalBytes = files.reduce((total, file) => total + Number(file.size ?? 0), 0);
  const memoryBudget = getUploadBufferBudgetBytes();

  if (
    !Number.isSafeInteger(totalBytes)
    || totalBytes < 0
    || activeUploadBufferBytes + totalBytes > memoryBudget
  ) {
    throw new UploadMemoryBudgetExceededError();
  }

  activeUploadBufferBytes += totalBytes;
  req[BUFFER_RESERVATION] = totalBytes;

  try {
    for (const file of files) {
      file.buffer = await fsPromises.readFile(file.path);
      if (file.buffer.length !== Number(file.size)) {
        throw new Error('Temporary upload size changed while reading');
      }
    }
  } catch (error) {
    await releaseUploadResources(req);
    throw error;
  }
};

const reserveParsedUpload = async ({ req, purpose, files }) => {
  if (!Array.isArray(files) || files.length === 0) return null;
  return reserveUploadBudget({
    userId: req.userId,
    purpose,
    bytes: files.reduce((total, file) => total + Number(file.size ?? 0), 0),
    files: files.length,
  });
};

const uploadChatMatchesAuthorizedHeader = (req) => {
  const authorized = req.uploadAuthorizedChatId?.toString?.();
  if (!authorized) return true;
  return authorized === req.body?.chatId?.toString?.();
};

const failAndCleanup = async (req, res, failure) => {
  await releaseUploadResources(req);
  respondUploadFailure(res, failure);
};

export const secureMessageAttachmentUpload = (req, res, next) => {
  if (exceedsDeclaredRequestSize(req, MAX_ATTACHMENT_AGGREGATE_SIZE_BYTES)) {
    respondUploadFailure(res, {
      code: ATTACHMENT_ERROR_CODES.AGGREGATE_SIZE_EXCEEDED,
      message: 'Combined attachments exceed the 25 MB request limit',
      statusCode: 413,
    });
    return;
  }

  attachmentUpload.array('attachments', MAX_ATTACHMENTS_PER_MESSAGE)(req, res, async (error) => {
    if (error) {
      await failAndCleanup(req, res, mapAttachmentMulterError(error));
      return;
    }

    const files = req.files ?? [];
    const aggregateResult = validateAggregateUploadSize(files);
    if (!aggregateResult.ok) {
      await failAndCleanup(req, res, aggregateResult);
      return;
    }
    if (!uploadChatMatchesAuthorizedHeader(req)) {
      await failAndCleanup(req, res, {
        code: 'UPLOAD_CHAT_MISMATCH',
        message: 'Multipart upload chat does not match the authorized chat header',
        statusCode: 403,
      });
      return;
    }

    try {
      req.uploadBudget = await reserveParsedUpload({
        req,
        purpose: 'attachment',
        files,
      });
      await materializeFileBuffers(req, files);
      registerResponseCleanup(req, res);
      next();
    } catch (uploadError) {
      if (uploadError instanceof UploadBudgetExceededError) {
        await failAndCleanup(req, res, {
          code: uploadError.code,
          message: uploadError.message,
          statusCode: uploadError.statusCode,
        });
        return;
      }
      if (uploadError instanceof UploadMemoryBudgetExceededError) {
        await failAndCleanup(req, res, {
          code: uploadError.code,
          message: uploadError.message,
          statusCode: uploadError.statusCode,
        });
        return;
      }
      await releaseUploadResources(req);
      next(uploadError);
    }
  });
};

export const secureProfileImageUpload = (req, res, next) => {
  if (exceedsDeclaredRequestSize(req, MAX_PROFILE_IMAGE_SIZE_BYTES)) {
    respondUploadFailure(res, {
      code: PROFILE_IMAGE_ERROR_CODES.SIZE_EXCEEDED,
      message: 'Profile image must be 2 MB or smaller',
      statusCode: 413,
    });
    return;
  }

  profileImageUpload.single('profileImage')(req, res, async (error) => {
    if (error) {
      await failAndCleanup(req, res, mapProfileMulterError(error));
      return;
    }

    const files = req.file ? [req.file] : [];
    try {
      req.uploadBudget = await reserveParsedUpload({
        req,
        purpose: 'profile-image',
        files,
      });
      await materializeFileBuffers(req, files);
      registerResponseCleanup(req, res);
      next();
    } catch (uploadError) {
      if (uploadError instanceof UploadBudgetExceededError) {
        await failAndCleanup(req, res, {
          code: uploadError.code,
          message: uploadError.message,
          statusCode: uploadError.statusCode,
        });
        return;
      }
      if (uploadError instanceof UploadMemoryBudgetExceededError) {
        await failAndCleanup(req, res, {
          code: uploadError.code,
          message: uploadError.message,
          statusCode: uploadError.statusCode,
        });
        return;
      }
      await releaseUploadResources(req);
      next(uploadError);
    }
  });
};

export const getUploadMemoryStatus = () => ({
  activeBytes: activeUploadBufferBytes,
  budgetBytes: getUploadBufferBudgetBytes(),
  tempDirectory: UPLOAD_TEMP_DIR,
});
