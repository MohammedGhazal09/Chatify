import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { CustomError } from '../Utils/customError.mjs';

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const isProd = () => process.env.NODE_ENV === 'production';

const getCsrfSecret = () => process.env.CSRF_SECRET || process.env.SECRET_JWT_KEY;

const signCsrfValue = (value) => createHmac('sha256', getCsrfSecret())
  .update(value)
  .digest('base64url');

export const createCsrfToken = () => {
  const value = randomBytes(32).toString('base64url');
  return `${value}.${signCsrfValue(value)}`;
};

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

const isValidSignedToken = (token) => {
  const [value, signature, extra] = token.split('.');

  if (!value || !signature || extra !== undefined || !getCsrfSecret()) {
    return false;
  }

  return constantTimeEqual(signature, signCsrfValue(value));
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
    !isValidSignedToken(cookieToken) ||
    !constantTimeEqual(cookieToken, headerToken)
  ) {
    next(new CustomError('CSRF token invalid or missing', 403));
    return;
  }

  next();
};

export default csrfProtection;
