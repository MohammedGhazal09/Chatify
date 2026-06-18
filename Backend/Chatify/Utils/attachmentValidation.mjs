import crypto from 'node:crypto';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const MIN_VOICE_DURATION_SECONDS = 1;
export const MAX_VOICE_DURATION_SECONDS = 120;
export const DEFAULT_SHARED_ASSET_LIMIT = 12;
export const MAX_SHARED_ASSET_LIMIT = 50;

export const ATTACHMENT_ERROR_CODES = Object.freeze({
  COUNT_EXCEEDED: 'ATTACHMENT_COUNT_EXCEEDED',
  EMPTY_FILE: 'ATTACHMENT_EMPTY',
  SIZE_EXCEEDED: 'ATTACHMENT_SIZE_EXCEEDED',
  UNSUPPORTED_TYPE: 'ATTACHMENT_TYPE_UNSUPPORTED',
  INVALID_FILENAME: 'ATTACHMENT_FILENAME_INVALID',
  VOICE_DURATION_INVALID: 'VOICE_DURATION_INVALID',
  VOICE_DURATION_EXCEEDED: 'VOICE_DURATION_EXCEEDED',
});

const ALLOWED_ATTACHMENT_TYPES = Object.freeze({
  '.png': { mimeTypes: ['image/png'], kind: 'media', signatureRequired: true },
  '.jpg': { mimeTypes: ['image/jpeg'], kind: 'media', signatureRequired: true },
  '.jpeg': { mimeTypes: ['image/jpeg'], kind: 'media', signatureRequired: true },
  '.gif': { mimeTypes: ['image/gif'], kind: 'media', signatureRequired: true },
  '.webp': { mimeTypes: ['image/webp'], kind: 'media', signatureRequired: true },
  '.pdf': { mimeTypes: ['application/pdf'], kind: 'file', signatureRequired: true },
  '.txt': { mimeTypes: ['text/plain'], kind: 'file', signatureRequired: false },
  '.csv': { mimeTypes: ['text/csv', 'application/csv', 'text/plain'], kind: 'file', signatureRequired: false },
  '.webm': { mimeTypes: ['audio/webm'], kind: 'voice', signatureRequired: false },
  '.ogg': { mimeTypes: ['audio/ogg', 'audio/opus'], kind: 'voice', signatureRequired: false },
  '.opus': { mimeTypes: ['audio/ogg', 'audio/opus'], kind: 'voice', signatureRequired: false },
  '.docx': {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    kind: 'file',
    signatureRequired: false,
  },
  '.xlsx': {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    kind: 'file',
    signatureRequired: false,
  },
});

const CONTROL_CHARS_REGEX = /[\u0000-\u001f\u007f]/g;

export const buildAttachmentError = (code, message, statusCode = 400) => ({
  ok: false,
  code,
  message,
  statusCode,
});

const hashBuffer = (buffer) => crypto
  .createHash('sha256')
  .update(buffer)
  .digest('hex');

export const sanitizeAttachmentDisplayName = (value) => {
  const rawName = typeof value === 'string' ? value : 'attachment';
  const baseName = path.basename(rawName).replace(CONTROL_CHARS_REGEX, '').trim();
  const normalizedName = baseName
    .replace(/[\\/]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w .()\-]/g, '_')
    .trim();

  if (!normalizedName || normalizedName === '.' || normalizedName === '..') {
    return null;
  }

  if (normalizedName.length <= 140) {
    return normalizedName;
  }

  const extension = path.extname(normalizedName);
  const stemLength = Math.max(1, 140 - extension.length);
  return `${normalizedName.slice(0, stemLength)}${extension}`;
};

const getAllowedType = (displayName) => {
  const extension = path.extname(displayName).toLowerCase();
  return {
    extension,
    allowedType: ALLOWED_ATTACHMENT_TYPES[extension] ?? null,
  };
};

const normalizeMimeType = (mimeType) => {
  if (typeof mimeType !== 'string') {
    return '';
  }

  return mimeType.split(';')[0].trim().toLowerCase();
};

const matchesAllowedMime = (mimeType, allowedType) => {
  const normalizedMimeType = normalizeMimeType(mimeType);

  if (!normalizedMimeType) {
    return false;
  }

  return allowedType.mimeTypes.includes(normalizedMimeType);
};

const normalizeTextLikeMime = (mimeType, extension) => {
  if (extension === '.txt' && (!mimeType || mimeType === 'application/octet-stream')) {
    return 'text/plain';
  }

  if (extension === '.csv' && (!mimeType || mimeType === 'application/octet-stream')) {
    return 'text/csv';
  }

  return mimeType;
};

export const buildAttachmentFingerprint = (attachments = []) => hashBuffer(Buffer.from(JSON.stringify(
  attachments.map((attachment) => ({
    displayName: attachment.displayName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    kind: attachment.kind,
    durationSeconds: attachment.durationSeconds ?? null,
    hash: attachment.hash,
  }))
)));

const normalizeVoiceDurationSeconds = (metadata = {}) => {
  const rawDuration = metadata.durationSeconds ?? metadata.duration ?? metadata.duration_secs;
  const durationSeconds = Number(rawDuration);

  if (!Number.isFinite(durationSeconds) || durationSeconds < MIN_VOICE_DURATION_SECONDS) {
    return buildAttachmentError(
      ATTACHMENT_ERROR_CODES.VOICE_DURATION_INVALID,
      `Voice messages must be at least ${MIN_VOICE_DURATION_SECONDS} second long`
    );
  }

  if (durationSeconds > MAX_VOICE_DURATION_SECONDS) {
    return buildAttachmentError(
      ATTACHMENT_ERROR_CODES.VOICE_DURATION_EXCEEDED,
      `Voice messages cannot exceed ${MAX_VOICE_DURATION_SECONDS} seconds`
    );
  }

  return {
    ok: true,
    durationSeconds: Math.round(durationSeconds * 1000) / 1000,
  };
};

export const validateIncomingAttachments = async (files = [], options = {}) => {
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: true, attachments: [], fingerprint: '' };
  }

  if (files.length > MAX_ATTACHMENTS_PER_MESSAGE) {
    return buildAttachmentError(
      ATTACHMENT_ERROR_CODES.COUNT_EXCEEDED,
      `Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments allowed per message`
    );
  }

  const attachments = [];
  const metadata = Array.isArray(options.metadata) ? options.metadata : [];

  for (const [index, file] of files.entries()) {
    const displayName = sanitizeAttachmentDisplayName(file.originalname);

    if (!displayName) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.INVALID_FILENAME,
        'Attachment filename is invalid'
      );
    }

    if (!file.buffer?.length || file.size <= 0) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.EMPTY_FILE,
        `${displayName} is empty`
      );
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.SIZE_EXCEEDED,
        `${displayName} exceeds the 10 MB attachment limit`
      );
    }

    const { extension, allowedType } = getAllowedType(displayName);

    if (!allowedType) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.UNSUPPORTED_TYPE,
        `${displayName} has an unsupported file type`
      );
    }

    let detectedType;
    try {
      detectedType = await fileTypeFromBuffer(file.buffer);
    } catch {
      detectedType = undefined;
    }
    let mimeType = normalizeMimeType(detectedType?.mime ?? file.mimetype ?? '');
    mimeType = normalizeTextLikeMime(mimeType, extension);

    if (allowedType.signatureRequired) {
      if (!detectedType || !matchesAllowedMime(detectedType.mime, allowedType)) {
        return buildAttachmentError(
          ATTACHMENT_ERROR_CODES.UNSUPPORTED_TYPE,
          `${displayName} does not match its allowed file type`
        );
      }
    } else if (!matchesAllowedMime(mimeType, allowedType)) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.UNSUPPORTED_TYPE,
        `${displayName} has an unsupported content type`
      );
    }

    const attachment = {
      displayName,
      originalExtension: extension.slice(1),
      mimeType,
      size: file.size,
      kind: allowedType.kind,
      hash: hashBuffer(file.buffer),
      buffer: file.buffer,
    };

    if (allowedType.kind === 'voice') {
      const durationResult = normalizeVoiceDurationSeconds(metadata[index]);

      if (!durationResult.ok) {
        return durationResult;
      }

      attachment.durationSeconds = durationResult.durationSeconds;
    }

    attachments.push(attachment);
  }

  return {
    ok: true,
    attachments,
    fingerprint: buildAttachmentFingerprint(attachments),
  };
};

export const normalizeSharedAssetKind = (value) => {
  if (value === undefined || value === null || value === '') {
    return { ok: true, kind: null };
  }

  if (value === 'media' || value === 'file' || value === 'voice') {
    return { ok: true, kind: value };
  }

  return {
    ok: false,
    statusCode: 400,
    message: 'Shared asset kind must be media, file, or voice',
  };
};

export const normalizeSharedAssetLimit = (value) => {
  const parsedLimit = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedLimit) || parsedLimit < 1) {
    return DEFAULT_SHARED_ASSET_LIMIT;
  }

  return Math.min(parsedLimit, MAX_SHARED_ASSET_LIMIT);
};
