import crypto from 'node:crypto';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import {
  inspectDocumentUpload,
  inspectImageUpload,
  inspectPdfUpload,
  inspectTextUpload,
  inspectVoiceUpload,
  isDeceptiveUploadFilename,
  sanitizeUploadFilename,
} from './uploadSecurity.mjs';

export const MAX_ATTACHMENTS_PER_MESSAGE = 5;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_BATCH_SIZE_BYTES = 20 * 1024 * 1024;
export const MIN_VOICE_DURATION_SECONDS = 1;
export const MAX_VOICE_DURATION_SECONDS = 120;
export const DEFAULT_SHARED_ASSET_LIMIT = 12;
export const MAX_SHARED_ASSET_LIMIT = 50;

export const ATTACHMENT_ERROR_CODES = Object.freeze({
  COUNT_EXCEEDED: 'ATTACHMENT_COUNT_EXCEEDED',
  BATCH_SIZE_EXCEEDED: 'ATTACHMENT_BATCH_SIZE_EXCEEDED',
  EMPTY_FILE: 'ATTACHMENT_EMPTY',
  SIZE_EXCEEDED: 'ATTACHMENT_SIZE_EXCEEDED',
  UNSUPPORTED_TYPE: 'ATTACHMENT_TYPE_UNSUPPORTED',
  INVALID_FILENAME: 'ATTACHMENT_FILENAME_INVALID',
  DECEPTIVE_FILENAME: 'ATTACHMENT_FILENAME_DECEPTIVE',
  CONTENT_MALFORMED: 'ATTACHMENT_CONTENT_MALFORMED',
  ACTIVE_CONTENT: 'ATTACHMENT_ACTIVE_CONTENT',
  POLYGLOT_REJECTED: 'ATTACHMENT_POLYGLOT_REJECTED',
  IMAGE_DIMENSIONS_EXCEEDED: 'ATTACHMENT_IMAGE_DIMENSIONS_EXCEEDED',
  TEXT_INVALID: 'ATTACHMENT_TEXT_INVALID',
  CONTAINER_INVALID: 'ATTACHMENT_CONTAINER_INVALID',
  VOICE_DURATION_INVALID: 'VOICE_DURATION_INVALID',
  VOICE_DURATION_EXCEEDED: 'VOICE_DURATION_EXCEEDED',
});

const ALLOWED_ATTACHMENT_TYPES = Object.freeze({
  '.png': { mimeTypes: ['image/png'], kind: 'media', inspection: 'image' },
  '.jpg': { mimeTypes: ['image/jpeg'], kind: 'media', inspection: 'image' },
  '.jpeg': { mimeTypes: ['image/jpeg'], kind: 'media', inspection: 'image' },
  '.gif': { mimeTypes: ['image/gif'], kind: 'media', inspection: 'image' },
  '.webp': { mimeTypes: ['image/webp'], kind: 'media', inspection: 'image' },
  '.pdf': { mimeTypes: ['application/pdf'], kind: 'file', inspection: 'pdf' },
  '.txt': { mimeTypes: ['text/plain'], kind: 'file', inspection: 'text' },
  '.csv': { mimeTypes: ['text/csv', 'application/csv', 'text/plain'], kind: 'file', inspection: 'text' },
  '.webm': { mimeTypes: ['audio/webm'], kind: 'voice', inspection: 'voice' },
  '.ogg': { mimeTypes: ['audio/ogg', 'audio/opus'], kind: 'voice', inspection: 'voice' },
  '.opus': { mimeTypes: ['audio/ogg', 'audio/opus'], kind: 'voice', inspection: 'voice' },
  '.docx': {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    kind: 'file',
    inspection: 'document',
  },
  '.xlsx': {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    kind: 'file',
    inspection: 'document',
  },
});

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
  if (isDeceptiveUploadFilename(value)) return null;
  const displayName = sanitizeUploadFilename(value, 'attachment').slice(0, 140);
  return displayName && displayName !== '.' && displayName !== '..'
    ? displayName
    : null;
};

const getAllowedType = (displayName) => {
  const extension = path.extname(displayName).toLowerCase();
  return {
    extension,
    allowedType: ALLOWED_ATTACHMENT_TYPES[extension] ?? null,
  };
};

const normalizeMimeType = (mimeType) => {
  if (typeof mimeType !== 'string') return '';
  return mimeType.split(';')[0].trim().toLowerCase();
};

const matchesAllowedMime = (mimeType, allowedType) => (
  Boolean(mimeType) && allowedType.mimeTypes.includes(normalizeMimeType(mimeType))
);

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

const mapInspectionFailure = ({ result, displayName, inspection }) => {
  if (result.reason === 'active') {
    return buildAttachmentError(
      ATTACHMENT_ERROR_CODES.ACTIVE_CONTENT,
      `${displayName} contains active content that is not allowed`
    );
  }

  if (result.reason === 'polyglot') {
    return buildAttachmentError(
      ATTACHMENT_ERROR_CODES.POLYGLOT_REJECTED,
      `${displayName} contains trailing or polyglot content`
    );
  }

  if (result.reason === 'dimensions') {
    return buildAttachmentError(
      ATTACHMENT_ERROR_CODES.IMAGE_DIMENSIONS_EXCEEDED,
      `${displayName} exceeds the safe image dimension limit`
    );
  }

  if (result.reason === 'text') {
    return buildAttachmentError(
      ATTACHMENT_ERROR_CODES.TEXT_INVALID,
      `${displayName} is not valid UTF-8 text`
    );
  }

  if (result.reason === 'container') {
    return buildAttachmentError(
      ATTACHMENT_ERROR_CODES.CONTAINER_INVALID,
      `${displayName} does not contain a valid ${inspection} container`
    );
  }

  return buildAttachmentError(
    ATTACHMENT_ERROR_CODES.CONTENT_MALFORMED,
    `${displayName} is malformed or truncated`
  );
};

const inspectAttachment = ({ buffer, extension, allowedType, declaredMimeType }) => {
  const bareExtension = extension.slice(1);

  if (allowedType.inspection === 'image') {
    return inspectImageUpload({ buffer, mimeType: allowedType.mimeTypes[0] });
  }

  if (allowedType.inspection === 'pdf') return inspectPdfUpload(buffer);
  if (allowedType.inspection === 'text') return inspectTextUpload(buffer);
  if (allowedType.inspection === 'voice') return inspectVoiceUpload({ buffer, extension: bareExtension });
  if (allowedType.inspection === 'document') {
    return inspectDocumentUpload({ buffer, extension: bareExtension });
  }

  return declaredMimeType ? { ok: true, buffer } : { ok: false, reason: 'malformed' };
};

const resolveStoredMimeType = ({
  extension,
  allowedType,
  declaredMimeType,
  detectedMimeType,
  inspection,
}) => {
  if (allowedType.inspection === 'image') return inspection.mimeType;
  if (allowedType.inspection === 'pdf') return 'application/pdf';
  if (allowedType.inspection === 'text') {
    return normalizeTextLikeMime(declaredMimeType || detectedMimeType, extension);
  }
  if (allowedType.inspection === 'voice') return declaredMimeType;
  if (allowedType.inspection === 'document') return declaredMimeType;
  return detectedMimeType || declaredMimeType;
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

  const aggregateSize = files.reduce((total, file) => (
    total + (Buffer.isBuffer(file?.buffer) ? file.buffer.length : Number(file?.size) || 0)
  ), 0);

  if (aggregateSize > MAX_ATTACHMENT_BATCH_SIZE_BYTES) {
    return buildAttachmentError(
      ATTACHMENT_ERROR_CODES.BATCH_SIZE_EXCEEDED,
      'Attachments exceed the 20 MB aggregate upload limit'
    );
  }

  const attachments = [];
  const metadata = Array.isArray(options.metadata) ? options.metadata : [];

  for (const [index, file] of files.entries()) {
    if (isDeceptiveUploadFilename(file?.originalname)) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.DECEPTIVE_FILENAME,
        'Attachment filename contains deceptive or unsafe characters'
      );
    }

    const displayName = sanitizeAttachmentDisplayName(file?.originalname);
    if (!displayName) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.INVALID_FILENAME,
        'Attachment filename is invalid'
      );
    }

    const originalBuffer = Buffer.isBuffer(file?.buffer) ? file.buffer : Buffer.alloc(0);
    const actualSize = originalBuffer.length;

    if (actualSize <= 0) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.EMPTY_FILE,
        `${displayName} is empty`
      );
    }

    if (actualSize > MAX_ATTACHMENT_SIZE_BYTES) {
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

    const declaredMimeType = normalizeMimeType(file?.mimetype ?? '');
    if (!matchesAllowedMime(declaredMimeType, allowedType)) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.UNSUPPORTED_TYPE,
        `${displayName} has an unsupported declared content type`
      );
    }

    let detectedType;
    try {
      detectedType = await fileTypeFromBuffer(originalBuffer);
    } catch {
      detectedType = undefined;
    }
    const detectedMimeType = normalizeMimeType(detectedType?.mime ?? '');
    const inspection = inspectAttachment({
      buffer: originalBuffer,
      extension,
      allowedType,
      declaredMimeType,
    });

    if (!inspection.ok) {
      return mapInspectionFailure({
        result: inspection,
        displayName,
        inspection: allowedType.inspection,
      });
    }

    if (
      detectedMimeType
      && allowedType.inspection === 'image'
      && !matchesAllowedMime(detectedMimeType, allowedType)
    ) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.UNSUPPORTED_TYPE,
        `${displayName} does not match its allowed file type`
      );
    }

    if (
      detectedMimeType
      && allowedType.inspection === 'pdf'
      && detectedMimeType !== 'application/pdf'
    ) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.UNSUPPORTED_TYPE,
        `${displayName} does not match its allowed file type`
      );
    }

    if (
      detectedMimeType
      && allowedType.inspection === 'voice'
      && !['audio/ogg', 'audio/opus', 'audio/webm', 'video/webm'].includes(detectedMimeType)
    ) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.CONTAINER_INVALID,
        `${displayName} does not contain a valid voice container`
      );
    }

    const sanitizedBuffer = inspection.buffer ?? originalBuffer;
    const mimeType = resolveStoredMimeType({
      extension,
      allowedType,
      declaredMimeType,
      detectedMimeType,
      inspection,
    });

    if (!matchesAllowedMime(mimeType, allowedType)) {
      return buildAttachmentError(
        ATTACHMENT_ERROR_CODES.UNSUPPORTED_TYPE,
        `${displayName} has an unsupported content type`
      );
    }

    const attachment = {
      displayName,
      originalExtension: extension.slice(1),
      mimeType,
      size: sanitizedBuffer.length,
      kind: allowedType.kind,
      hash: hashBuffer(sanitizedBuffer),
      buffer: sanitizedBuffer,
      metadataRemoved: inspection.metadataRemoved === true,
    };

    if (allowedType.kind === 'voice') {
      const durationResult = normalizeVoiceDurationSeconds(metadata[index]);
      if (!durationResult.ok) return durationResult;
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
