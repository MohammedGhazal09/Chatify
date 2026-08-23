import Session from '../Models/sessionModel.mjs';
import User from '../Models/userModel.mjs';
import { normalizeEmail } from '../Utils/authIdentity.mjs';
import {
  readAccessTokenFromRequest,
  verifyAccessToken,
} from '../Utils/authToken.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';
import {
  hashRefreshToken,
  readRefreshTokenFromRequest,
} from '../Utils/tokenCookieGenerator.mjs';
import {
  disconnectSessionSockets,
  disconnectUserSessionSockets,
} from '../Services/socketSessionLifecycleService.mjs';

const isSuccessfulMutation = (statusCode) => statusCode >= 200 && statusCode < 300;
const normalizeId = (value) => value?.toString?.() ?? '';

const attachSuccessfulInvalidation = ({
  res,
  reason,
  sessionIds = [],
  userIds = [],
}) => {
  const uniqueSessionIds = [...new Set(sessionIds.map(normalizeId).filter(Boolean))];
  const uniqueUserIds = [...new Set(userIds.map(normalizeId).filter(Boolean))];

  res.once('finish', () => {
    if (!isSuccessfulMutation(res.statusCode)) {
      return;
    }

    try {
      const sessionSocketCount = uniqueSessionIds.reduce(
        (count, sessionId) => count + disconnectSessionSockets(sessionId, reason),
        0
      );
      const userSocketCount = uniqueUserIds.reduce(
        (count, userId) => count + disconnectUserSessionSockets(userId, reason),
        0
      );

      logger.info('socket.session_invalidation_applied', {
        reason,
        sessionCount: uniqueSessionIds.length,
        userCount: uniqueUserIds.length,
        disconnectedSockets: sessionSocketCount + userSocketCount,
      });
    } catch (error) {
      logger.error('socket.session_invalidation_failed', {
        reason,
        error,
      });
    }
  });
};

const readVerifiedAccessSessionId = (req) => {
  const accessToken = readAccessTokenFromRequest(req);
  if (!accessToken) return null;

  try {
    return verifyAccessToken(accessToken).sessionId;
  } catch {
    return null;
  }
};

const findRefreshSession = async (req) => {
  const refreshToken = readRefreshTokenFromRequest(req);
  if (!refreshToken) return null;

  return Session.findOne({ refreshTokenHash: hashRefreshToken(refreshToken) })
    .select('_id userId')
    .lean();
};

export const captureLogoutSocketInvalidation = async (req, res, next) => {
  try {
    const accessSessionId = readVerifiedAccessSessionId(req);
    const refreshSession = await findRefreshSession(req);

    attachSuccessfulInvalidation({
      res,
      reason: 'session_logout',
      sessionIds: [accessSessionId, refreshSession?._id],
    });
    next();
  } catch (error) {
    next(error);
  }
};

export const captureRefreshSocketInvalidation = async (req, res, next) => {
  try {
    const refreshSession = await findRefreshSession(req);

    attachSuccessfulInvalidation({
      res,
      reason: 'session_rotated',
      sessionIds: [refreshSession?._id],
    });
    next();
  } catch (error) {
    next(error);
  }
};

export const captureTargetSessionSocketInvalidation = (req, res, next) => {
  attachSuccessfulInvalidation({
    res,
    reason: 'session_revoked',
    sessionIds: [req.params.sessionId],
  });
  next();
};

export const captureAllSessionSocketInvalidation = (req, res, next) => {
  attachSuccessfulInvalidation({
    res,
    reason: 'all_sessions_revoked',
    userIds: [req.userId],
  });
  next();
};

export const capturePasswordResetSocketInvalidation = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const user = email
      ? await User.findOne({ email }).select('_id').lean()
      : null;

    attachSuccessfulInvalidation({
      res,
      reason: 'password_reset',
      userIds: [user?._id],
    });
    next();
  } catch (error) {
    next(error);
  }
};
