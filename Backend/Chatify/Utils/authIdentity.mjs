import { CustomError } from './customError.mjs';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;
const MIN_PASSWORD_CODE_POINTS = 12;
const MAX_PASSWORD_CODE_POINTS = 128;

export const normalizeEmail = (value) => String(value ?? '')
  .normalize('NFKC')
  .trim()
  .toLocaleLowerCase('en-US');

export const validatePasswordPolicy = (password) => {
  if (typeof password !== 'string') {
    return { ok: false, code: 'password_type_invalid', message: 'Password must be a string' };
  }

  const codePointLength = Array.from(password).length;
  if (codePointLength < MIN_PASSWORD_CODE_POINTS) {
    return {
      ok: false,
      code: 'password_too_short',
      message: `Password must be at least ${MIN_PASSWORD_CODE_POINTS} characters long`,
    };
  }

  if (codePointLength > MAX_PASSWORD_CODE_POINTS) {
    return {
      ok: false,
      code: 'password_too_long',
      message: `Password must be at most ${MAX_PASSWORD_CODE_POINTS} characters long`,
    };
  }

  if (!password.trim()) {
    return { ok: false, code: 'password_whitespace_only', message: 'Password cannot contain only whitespace' };
  }

  if (CONTROL_CHARACTER_PATTERN.test(password)) {
    return { ok: false, code: 'password_control_character', message: 'Password cannot contain control characters' };
  }

  return { ok: true };
};

export const assertPasswordPolicy = (password) => {
  const result = validatePasswordPolicy(password);
  if (!result.ok) throw new CustomError(result.message, 400);
  return password;
};

export const PASSWORD_POLICY = Object.freeze({
  minCodePoints: MIN_PASSWORD_CODE_POINTS,
  maxCodePoints: MAX_PASSWORD_CODE_POINTS,
});
