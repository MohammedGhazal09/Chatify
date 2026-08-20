import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';

export const MAX_PROFILE_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

export const PROFILE_IMAGE_ERROR_CODES = Object.freeze({
  REQUIRED: 'PROFILE_IMAGE_REQUIRED',
  EMPTY_FILE: 'PROFILE_IMAGE_EMPTY',
  SIZE_EXCEEDED: 'PROFILE_IMAGE_SIZE_EXCEEDED',
  UNSUPPORTED_TYPE: 'PROFILE_IMAGE_TYPE_UNSUPPORTED',
  INVALID_FILENAME: 'PROFILE_IMAGE_FILENAME_INVALID',
});

const ALLOWED_PROFILE_IMAGE_TYPES = Object.freeze({
  '.png': { mimeTypes: ['image/png'], extension: 'png' },
  '.jpg': { mimeTypes: ['image/jpeg'], extension: 'jpg' },
  '.jpeg': { mimeTypes: ['image/jpeg'], extension: 'jpeg' },
  '.webp': { mimeTypes: ['image/webp'], extension: 'webp' },
});

const CONTROL_CHARS_REGEX = /[\u0000-\u001f\u007f]/g;

export const buildProfileImageError = (code, message, statusCode = 400) => ({
  ok: false,
  code,
  message,
  statusCode,
});

export const sanitizeProfileImageDisplayName = (value) => {
  const rawName = typeof value === 'string' ? value : 'profile-image';
  const baseName = path.basename(rawName).replace(CONTROL_CHARS_REGEX, '').trim();
  const normalizedName = baseName
    .replace(/[\\/]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w .()\-]/g, '_')
    .trim();

  if (!normalizedName || normalizedName === '.' || normalizedName === '..') {
    return null;
  }

  if (normalizedName.length <= 120) {
    return normalizedName;
  }

  const extension = path.extname(normalizedName);
  const stemLength = Math.max(1, 120 - extension.length);
  return `${normalizedName.slice(0, stemLength)}${extension}`;
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

  if (!file.buffer?.length || file.size <= 0) {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.EMPTY_FILE,
      'Profile image is empty'
    );
  }

  if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
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

  let detectedType;
  try {
    detectedType = await fileTypeFromBuffer(file.buffer);
  } catch {
    detectedType = undefined;
  }

  const declaredMimeType = file.mimetype ?? '';

  if (
    !detectedType ||
    !allowedType.mimeTypes.includes(detectedType.mime) ||
    (declaredMimeType && !allowedType.mimeTypes.includes(declaredMimeType))
  ) {
    return buildProfileImageError(
      PROFILE_IMAGE_ERROR_CODES.UNSUPPORTED_TYPE,
      'Profile image does not match its allowed file type'
    );
  }

  return {
    ok: true,
    profileImage: {
      displayName,
      originalExtension: allowedType.extension,
      mimeType: detectedType.mime,
      size: file.size,
      buffer: file.buffer,
    },
  };
};
