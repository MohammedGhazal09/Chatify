export const PROFILE_FIELD_LIMITS = Object.freeze({
  bio: 160,
  status: 80,
});

const UNSAFE_PROFILE_TEXT_PATTERN = /(https?:\/\/|www\.|data:|javascript:|<|>|&lt;|&gt;)/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

const normalizeProfileText = (value) => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return '';
  }

  return String(value).trim().replace(/\s+/g, ' ');
};

const validateProfileText = ({ value, label, maxLength }) => {
  const normalized = normalizeProfileText(value);

  if (normalized === undefined) {
    return { ok: true, value: undefined };
  }

  if (normalized.length > maxLength) {
    return {
      ok: false,
      statusCode: 400,
      code: 'PROFILE_FIELD_TOO_LONG',
      message: `${label} must be ${maxLength} characters or fewer.`,
    };
  }

  if (CONTROL_CHARACTER_PATTERN.test(normalized) || UNSAFE_PROFILE_TEXT_PATTERN.test(normalized)) {
    return {
      ok: false,
      statusCode: 400,
      code: 'PROFILE_FIELD_INVALID',
      message: `${label} must be plain text without links or unsafe characters.`,
    };
  }

  return { ok: true, value: normalized };
};

export const normalizeProfilePatch = (payload = {}) => {
  const bio = validateProfileText({
    value: payload.profileBio,
    label: 'Profile bio',
    maxLength: PROFILE_FIELD_LIMITS.bio,
  });

  if (!bio.ok) {
    return bio;
  }

  const status = validateProfileText({
    value: payload.profileStatus,
    label: 'Profile status',
    maxLength: PROFILE_FIELD_LIMITS.status,
  });

  if (!status.ok) {
    return status;
  }

  const value = {};

  if (bio.value !== undefined) {
    value.profileBio = bio.value;
  }

  if (status.value !== undefined) {
    value.profileStatus = status.value;
  }

  return {
    ok: true,
    value,
  };
};
