import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit login/signup attempts
  message: { status: 'error', message: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Lenient limiter for session checks (is-authenticated)
export const sessionCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 checks per minute
  message: { status: 'error', message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate limiter for refresh-token
export const refreshTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 refresh attempts per 15 min
  message: { status: 'error', message: 'Too many token refresh attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
