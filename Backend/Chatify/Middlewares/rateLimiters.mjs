import rateLimit from 'express-rate-limit';

const skipInTests = () => process.env.NODE_ENV === 'test';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit login/signup attempts
  skip: skipInTests,
  message: { status: 'error', message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Lenient limiter for session checks (is-authenticated)
export const sessionCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 checks per minute
  skip: skipInTests,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate limiter for refresh-token
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 refresh attempts per 15 min
  skip: skipInTests,
  message: { status: 'error', message: 'Too many token refresh attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const attachmentUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  skip: skipInTests,
  message: { status: 'error', message: 'Uploading attachments too fast, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
