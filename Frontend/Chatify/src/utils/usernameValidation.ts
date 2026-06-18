export const USERNAME_ERROR_CODES = {
  REQUIRED: 'USERNAME_REQUIRED',
  INVALID: 'USERNAME_INVALID',
  RESERVED: 'USERNAME_RESERVED',
  TAKEN: 'USERNAME_TAKEN',
  ALREADY_SET: 'USERNAME_ALREADY_SET',
} as const;

export const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'auth',
  'chatify',
  'login',
  'settings',
  'signup',
  'support',
]);

const USERNAME_PATTERN = /^[a-z0-9](?!.*[._]{2})[a-z0-9._]*[a-z0-9]$/;

export const normalizeUsername = (value: unknown) => (
  typeof value === 'string'
    ? value.trim().toLocaleLowerCase('en-US')
    : ''
);

export const validateUsername = (value: unknown) => {
  const username = normalizeUsername(value);

  if (!username) {
    return {
      ok: false as const,
      code: USERNAME_ERROR_CODES.REQUIRED,
      message: 'Enter a username.',
    };
  }

  if (
    username.length < 3 ||
    username.length > 24 ||
    !USERNAME_PATTERN.test(username)
  ) {
    return {
      ok: false as const,
      code: USERNAME_ERROR_CODES.INVALID,
      message: 'Use 3-24 letters, numbers, dots, or underscores.',
    };
  }

  if (RESERVED_USERNAMES.has(username)) {
    return {
      ok: false as const,
      code: USERNAME_ERROR_CODES.RESERVED,
      message: 'Choose a different username.',
    };
  }

  return {
    ok: true as const,
    value: username,
  };
};
