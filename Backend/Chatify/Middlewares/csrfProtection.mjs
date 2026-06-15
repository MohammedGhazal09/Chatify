import { timingSafeEqual, randomBytes } from 'crypto';
import { CustomError } from '../Utils/customError.mjs';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const isProd = () => process.env.NODE_ENV === 'production';

export const createCsrfToken = () => randomBytes(32).toString('base64url');

export const getCsrfCookieOptions = () => ({
  httpOnly: false,
  sameSite: isProd() ? 'none' : 'lax',
  secure: isProd(),
  path: '/',
});

const constantTimeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER) || req.get('x-xsrf-token');

  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    !cookieToken ||
    !headerToken ||
    !constantTimeEqual(cookieToken, headerToken)
  ) {
    next(new CustomError('CSRF token invalid or missing', 403));
    return;
  }

  next();
};

export default csrfProtection;
