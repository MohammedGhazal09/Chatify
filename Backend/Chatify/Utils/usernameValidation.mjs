export const USERNAME_ERROR_CODES = {
  REQUIRED: 'USERNAME_REQUIRED',
  INVALID: 'USERNAME_INVALID',
  RESERVED: 'USERNAME_RESERVED',
  TAKEN: 'USERNAME_TAKEN',
  ALREADY_SET: 'USERNAME_ALREADY_SET',
};

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

export const normalizeUsername = (value) => (
  typeof value === 'string'
    ? value.trim().toLocaleLowerCase('en-US')
    : ''
);

const fail = (code, message) => ({
  ok: false,
  code,
  message,
});

export const validateUsername = (value) => {
  const username = normalizeUsername(value);

  if (!username) {
    return fail(USERNAME_ERROR_CODES.REQUIRED, 'Username is required');
  }

  if (
    username.length < 3 ||
    username.length > 24 ||
    !USERNAME_PATTERN.test(username)
  ) {
    return fail(
      USERNAME_ERROR_CODES.INVALID,
      'Username must be 3-24 letters, numbers, dots, or underscores'
    );
  }

  if (RESERVED_USERNAMES.has(username)) {
    return fail(USERNAME_ERROR_CODES.RESERVED, 'Choose a different username');
  }

  return {
    ok: true,
    value: username,
  };
};

export const buildUsernameConflict = () => ({
  ok: false,
  code: USERNAME_ERROR_CODES.TAKEN,
  message: 'That username is taken. Try another one.',
});
