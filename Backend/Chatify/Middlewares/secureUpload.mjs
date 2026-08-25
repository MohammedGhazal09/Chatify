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

const AGGREGATE_STATE = Symbol('chatify.aggregateUploadState');
const MULTIPART_OVERHEAD_ALLOWANCE_BYTES = 256 * 1024;

const buildAggregateMemoryStorage = (maxAggregateSize) => ({
  _handleFile(req, file, callback) {
    req[AGGREGATE_STATE] ??= { bytes: 0, failed: false };
    const state = req[AGGREGATE_STATE];
    const chunks = [];
    let size = 0;
    let completed = false;

    const finish = (error, value) => {
      if (completed) return;
      completed = true;
      callback(error, value);
    };

    file.stream.on('data', (chunk) => {
      if (state.failed) {
        const error = new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname);
        error.code = 'LIMIT_AGGREGATE_SIZE';
        finish(error);
        return;
      }

      const normalizedChunk = Buffer.from(chunk);
      state.bytes += normalizedChunk.length;
      size += normalizedChunk.length;

      if (state.bytes > maxAggregateSize) {
        state.failed = true;
        chunks.length = 0;
        const error = new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname);
        error.code = 'LIMIT_AGGREGATE_SIZE';
        finish(error);
        return;
      }

      chunks.push(normalizedChunk);
    });
    file.stream.on('error', (error) => finish(error));
    file.stream.on('end', () => {
      if (state.failed) {
        const error = new multer.MulterError('LIMIT_FILE_SIZE', file.fieldname);
        error.code = 'LIMIT_AGGREGATE_SIZE';
        finish(error);
        return;
      }
      finish(null, { buffer: Buffer.concat(chunks, size), size });
    });
  },
  _removeFile(_req, file, callback) {
    delete file.buffer;
    callback(null);
  },
});

const exceedsDeclaredRequestSize = (req, maxBytes) => {
  const declared = Number.parseInt(req.headers['content-length'] ?? '', 10);
  return Number.isSafeInteger(declared)
    && declared > maxBytes + MULTIPART_OVERHEAD_ALLOWANCE_BYTES;
};

const attachmentUpload = multer({
  storage: buildAggregateMemoryStorage(MAX_ATTACHMENT_AGGREGATE_SIZE_BYTES),
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
  storage: buildAggregateMemoryStorage(MAX_PROFILE_IMAGE_SIZE_BYTES),
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
  res.status(statusCode).json({
    status: 'fail',
    code,
    message,
  });
};

const mapAttachmentMulterError = (error) => {
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

const reserveParsedUpload = async ({ req, purpose, files }) => {
  if (!Array.isArray(files) || files.length === 0) return null;
  return reserveUploadBudget({
    userId: req.userId,
    purpose,
    bytes: files.reduce((total, file) => total + Number(file.size ?? 0), 0),
    files: files.length,
  });
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
      respondUploadFailure(res, mapAttachmentMulterError(error));
      return;
    }

    const aggregateResult = validateAggregateUploadSize(req.files ?? []);
    if (!aggregateResult.ok) {
      respondUploadFailure(res, aggregateResult);
      return;
    }

    try {
      req.uploadBudget = await reserveParsedUpload({
        req,
        purpose: 'attachment',
        files: req.files ?? [],
      });
      next();
    } catch (budgetError) {
      if (budgetError instanceof UploadBudgetExceededError) {
        respondUploadFailure(res, {
          code: budgetError.code,
          message: budgetError.message,
          statusCode: budgetError.statusCode,
        });
        return;
      }
      next(budgetError);
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
      respondUploadFailure(res, mapProfileMulterError(error));
      return;
    }

    try {
      req.uploadBudget = await reserveParsedUpload({
        req,
        purpose: 'profile-image',
        files: req.file ? [req.file] : [],
      });
      next();
    } catch (budgetError) {
      if (budgetError instanceof UploadBudgetExceededError) {
        respondUploadFailure(res, {
          code: budgetError.code,
          message: budgetError.message,
          statusCode: budgetError.statusCode,
        });
        return;
      }
      next(budgetError);
    }
  });
};
