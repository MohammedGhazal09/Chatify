import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import {
  inspectImageUpload,
  isDeceptiveUploadFilename,
  sanitizeUploadFilename,
} from './uploadSecurity.mjs';

export const MAX_PROFILE_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

export const PROFILE_IMAGE_ERROR_CODES = Object.freeze({
  REQUIRED: 'PROFILE_IMAGE_REQUIRED',
  EMPTY_FILE: 'PROFILE_IMAGE_EMPTY',
  SIZE_EXCEEDED: 'PROFILE_IMAGE_SIZE_EXCEEDED',
  UNSUPPORTED_TYPE: 'PROFILE_IMAGE_TYPE_UNSUPPORTED',
  INVALID_FILENAME: 'PROFILE_IMAGE_FILENAME_INVALID',
  CONTENT_MALFORMED: 'PROFILE_IMAGE_CONTENT_MALFORMED',
  POLYGLOT_REJECTED: 'PROFILE_IMAGE_POLYGLOT_REJECTED',
  DIMENSIONS_EXCEEDED: 'PROFILE_IMAGE_DIMENSIONS_EXCEEDED',
});

const ALLOWED_PROFILE_IMAGE_TYPES = Object.freeze({
  '.png': { mimeTypes: ['image/png'], extension: 'png' },
  '.jpg': { mimeTypes: ['image/jpeg'], extension: 'jpg' },
  '.jpeg': { mimeTypes: ['image/jpeg'], extension: 'jpeg' },
  '.webp': { mimeTypes: ['image/webp'], extension: 'webp' },
});

export const buildProfileImageError = (code, message, statusCode = 400) => ({
  ok: false,
  code,
  message,
  statusCode,
});

export const sanitizeProfileImageDisplayName = (value) => {
  if (isDeceptiveUploadFilename(value)) return null;
  const displayName = sanitizeUploadFilename(value, 'profile-image').slice(0, 120);
  return displayName && displayName !== '.' && displayName !== '..'
    ? displayName
    : null;
};

const mapImageInspectionFailure = (result) => {
  if (result.reason === 'polyglot') {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.POLYGLOT_REJECTED,
      'Profile image contains trailing or polyglot content'
    );
  }

  if (result.reason === 'dimensions') {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.DIMENSIONS_EXCEEDED,
      'Profile image exceeds the safe image dimension limit'
    );
  }

  return buildProfileImageError(
    PROFILE_IMAGE_ERROR_CODES.CONTENT_MALFORMED,
    'Profile image is malformed or truncated'
  );
};

export const validateIncomingProfileImage = async (file) => {
  if (!file) {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.REQUIRED,
      'Profile image file is required'
    );
  }

  const displayName = sanitizeProfileImageDisplayName(file.originalname);
  if (!displayName) {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.INVALID_FILENAME,
      'Profile image filename is invalid'
    );
  }

  const originalBuffer = Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.alloc(0);
  const actualSize = originalBuffer.length;

  if (actualSize <= 0) {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.EMPTY_FILE,
      'Profile image is empty'
    );
  }

  if (actualSize > MAX_PROFILE_IMAGE_SIZE_BYTES) {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.SIZE_EXCEEDED,
      'Profile image exceeds the 2 MB limit'
    );
  }

  const extension = path.extname(displayName).toLowerCase();
  const allowedType = ALLOWED_PROFILE_IMAGE_TYPES[extension];
  if (!allowedType) {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.UNSUPPORTED_TYPE,
      'Profile image must be a PNG, JPEG, or WebP file'
    );
  }

  const declaredMimeType = typeof file.mimetype === 'string'
    ? file.mimetype.split(';')[0].trim().toLowerCase()
    : '';

  if (declaredMimeType && !allowedType.mimeTypes.includes(declaredMimeType)) {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.UNSUPPORTED_TYPE,
      'Profile image does not match its allowed file type'
    );
  }

  let detectedType;
  try {
    detectedType = await fileTypeFromBuffer(originalBuffer);
  } catch {
    detectedType = undefined;
  }

  if (!detectedType || !allowedType.mimeTypes.includes(detectedType.mime)) {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.UNSUPPORTED_TYPE,
      'Profile image does not match its allowed file type'
    );
  }

  const inspection = inspectImageUpload({
    buffer: originalBuffer,
    mimeType: allowedType.mimeTypes[0],
  });
  if (!inspection.ok) return mapImageInspectionFailure(inspection);

  return {
    ok: true,
    profileImage: {
      displayName,
      originalExtension: allowedType.extension,
      mimeType: inspection.mimeType,
      size: inspection.buffer.length,
      buffer: inspection.buffer,
      width: inspection.width,
      height: inspection.height,
      metadataRemoved: inspection.metadataRemoved === true,
    },
  };
};
