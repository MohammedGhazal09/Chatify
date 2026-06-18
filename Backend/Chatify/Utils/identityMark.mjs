export const IDENTITY_MARK_ERROR_CODE = 'IDENTITY_MARK_INVALID';

export const IDENTITY_MARK_PALETTE_IDS = [
  'teal',
  'indigo',
  'amber',
  'slate',
  'rose',
];

export const IDENTITY_MARK_PATTERN_IDS = [
  'rings',
  'grid',
  'diagonal',
  'orbit',
  'mono',
];

export const IDENTITY_MARK_ACCENT_IDS = [
  'mint',
  'sky',
  'gold',
  'coral',
  'graphite',
];

export const IDENTITY_MARK_LABEL_MAX_LENGTH = 32;
export const IDENTITY_MARK_INITIALS_MAX_LENGTH = 3;

const URL_LIKE_PATTERN = /(https?:\/\/|data:|blob:|www\.|\/api\/|\\api\\)/i;
const LIVING_BEING_PATTERN = /\b(human|person|people|face|avatar|portrait|body|bodies|silhouette|mascot|animal|cat|dog|bird|fish|horse|plant|tree|flower|leaf|leaves)\b/i;
const SAFE_LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u;
const SAFE_INITIALS_PATTERN = /^[\p{L}\p{N}]{1,3}$/u;

const normalizeString = (value) => (
  typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ')
    : ''
);

const toPlainObject = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value.toObject === 'function') {
    return value.toObject({ depopulate: true });
  }

  return value;
};

const fail = (message) => ({
  ok: false,
  statusCode: 400,
  code: IDENTITY_MARK_ERROR_CODE,
  message,
});

const stableIndex = (seed, length) => {
  const text = String(seed || 'chatify');
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) % length;
};

const includesBlockedIdentityText = (value) => (
  URL_LIKE_PATTERN.test(value) || LIVING_BEING_PATTERN.test(value)
);

const ensureAllowedPreset = (value, allowedValues, fieldName) => {
  const normalized = normalizeString(value).toLowerCase();

  if (!normalized) {
    return {
      ok: false,
      message: `${fieldName} is required`,
    };
  }

  if (includesBlockedIdentityText(normalized) || !allowedValues.includes(normalized)) {
    return {
      ok: false,
      message: `${fieldName} is not supported`,
    };
  }

  return {
    ok: true,
    value: normalized,
  };
};

export const getIdentityDisplayLabel = (user) => {
  const firstName = normalizeString(user?.firstName);
  const lastName = normalizeString(user?.lastName);
  const emailName = normalizeString(user?.email?.split?.('@')?.[0]);
  const displayName = `${firstName} ${lastName}`.trim();

  return displayName || emailName || 'Chatify User';
};

export const getIdentityInitials = (value) => {
  const normalized = normalizeString(value);
  const initials = normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, IDENTITY_MARK_INITIALS_MAX_LENGTH)
    .map((word) => word.charAt(0))
    .join('')
    .toLocaleUpperCase('en-US');

  return initials || 'CU';
};

export const buildFallbackIdentityMark = (user) => {
  const label = getIdentityDisplayLabel(user);
  const seed = user?._id?.toString?.() || user?.id?.toString?.() || user?.email || label;
  const paletteIndex = stableIndex(seed, IDENTITY_MARK_PALETTE_IDS.length);
  const patternIndex = stableIndex(`${seed}:pattern`, IDENTITY_MARK_PATTERN_IDS.length);
  const accentIndex = stableIndex(`${seed}:accent`, IDENTITY_MARK_ACCENT_IDS.length);

  return {
    source: 'fallback',
    label,
    initials: getIdentityInitials(label),
    paletteId: IDENTITY_MARK_PALETTE_IDS[paletteIndex],
    patternId: IDENTITY_MARK_PATTERN_IDS[patternIndex],
    accentId: IDENTITY_MARK_ACCENT_IDS[accentIndex],
    updatedAt: user?.identityMarkUpdatedAt ?? null,
  };
};

export const serializeIdentityMark = (user) => {
  const identityMark = toPlainObject(user?.identityMark);

  if (
    identityMark?.label &&
    identityMark?.initials &&
    identityMark?.paletteId &&
    identityMark?.patternId &&
    identityMark?.accentId
  ) {
    return {
      source: 'custom',
      label: identityMark.label,
      initials: identityMark.initials,
      paletteId: identityMark.paletteId,
      patternId: identityMark.patternId,
      accentId: identityMark.accentId,
      updatedAt: identityMark.updatedAt ?? user?.identityMarkUpdatedAt ?? null,
    };
  }

  return buildFallbackIdentityMark(user);
};

export const attachSerializedIdentityMark = (user) => {
  if (!user || typeof user !== 'object') {
    return user;
  }

  const identityMark = serializeIdentityMark(user);
  user.identityMark = identityMark;
  user.identityMarkUpdatedAt = identityMark.updatedAt ?? null;
  return user;
};

export const serializeIdentityUser = (user) => {
  const serialized = typeof user?.toJSON === 'function'
    ? user.toJSON()
    : { ...(toPlainObject(user) ?? {}) };

  return attachSerializedIdentityMark(serialized);
};

export const validateIdentityMarkPayload = (payload, fallbackUser) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return fail('Identity mark payload is required');
  }

  const label = normalizeString(payload.label);
  const requestedInitials = normalizeString(payload.initials);

  if (!label || label.length > IDENTITY_MARK_LABEL_MAX_LENGTH || !SAFE_LABEL_PATTERN.test(label)) {
    return fail('Identity label must be 1-32 letters, numbers, spaces, hyphens, underscores, or periods');
  }

  if (includesBlockedIdentityText(label)) {
    return fail('Identity label cannot reference URLs or living-being avatar concepts');
  }

  const initials = (requestedInitials || getIdentityInitials(label)).toLocaleUpperCase('en-US');

  if (
    !initials ||
    initials.length > IDENTITY_MARK_INITIALS_MAX_LENGTH ||
    !SAFE_INITIALS_PATTERN.test(initials) ||
    includesBlockedIdentityText(initials)
  ) {
    return fail('Identity initials must be 1-3 letters or numbers');
  }

  const palette = ensureAllowedPreset(payload.paletteId, IDENTITY_MARK_PALETTE_IDS, 'paletteId');
  if (!palette.ok) {
    return fail(palette.message);
  }

  const pattern = ensureAllowedPreset(payload.patternId, IDENTITY_MARK_PATTERN_IDS, 'patternId');
  if (!pattern.ok) {
    return fail(pattern.message);
  }

  const accent = ensureAllowedPreset(payload.accentId, IDENTITY_MARK_ACCENT_IDS, 'accentId');
  if (!accent.ok) {
    return fail(accent.message);
  }

  return {
    ok: true,
    value: {
      label,
      initials,
      paletteId: palette.value,
      patternId: pattern.value,
      accentId: accent.value,
      updatedAt: new Date(),
    },
    fallback: buildFallbackIdentityMark(fallbackUser),
  };
};
