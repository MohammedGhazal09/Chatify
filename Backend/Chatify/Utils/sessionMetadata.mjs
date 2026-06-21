import { createHash } from 'crypto';
import mongoose from 'mongoose';
import Session from '../Models/sessionModel.mjs';
import { CustomError } from './customError.mjs';

const UNKNOWN_DEVICE = 'Unknown device';

const hashValue = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  return createHash('sha256').update(value).digest('base64url');
};

const getRequestIp = (req) => {
  const forwardedFor = req?.headers?.['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req?.ip || req?.socket?.remoteAddress || '';
};

const detectBrowser = (userAgent) => {
  if (/Edg\//i.test(userAgent)) return 'Edge';
  if (/Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)) return 'Chrome';
  if (/Firefox\//i.test(userAgent)) return 'Firefox';
  if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'Safari';
  if (/OPR\//i.test(userAgent) || /Opera/i.test(userAgent)) return 'Opera';
  return 'Browser';
};

const detectPlatform = (userAgent) => {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'device';
};

export const buildSafeDeviceLabel = (userAgent = '') => {
  if (!userAgent || typeof userAgent !== 'string') {
    return UNKNOWN_DEVICE;
  }

  return `${detectBrowser(userAgent)} on ${detectPlatform(userAgent)}`;
};

export const buildSessionMetadataFromRequest = (req) => {
  const userAgent = typeof req?.headers?.['user-agent'] === 'string'
    ? req.headers['user-agent']
    : '';
  const ip = getRequestIp(req);

  return {
    deviceLabel: buildSafeDeviceLabel(userAgent),
    userAgentHash: hashValue(userAgent),
    ipHash: hashValue(ip),
  };
};

export const serializeSessionForUser = (session, currentSessionId = null) => {
  const sessionId = session?._id?.toString?.() ?? null;

  return {
    id: sessionId,
    current: Boolean(currentSessionId && sessionId === currentSessionId),
    deviceLabel: session?.deviceLabel || UNKNOWN_DEVICE,
    rememberMe: session?.rememberMe === true,
    createdAt: session?.createdAt?.toISOString?.() ?? null,
    lastUsedAt: session?.lastUsedAt?.toISOString?.() ?? null,
    expiresAt: session?.expiresAt?.toISOString?.() ?? null,
  };
};

export const findActiveSession = async ({ sessionId, userId = null, now = new Date() }) => {
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) {
    return null;
  }

  return Session.findOne({
    _id: sessionId,
    ...(userId ? { userId } : {}),
    revokedAt: null,
    expiresAt: { $gt: now },
  });
};

export const assertActiveSessionClaim = async ({ sessionId, userId }) => {
  if (!sessionId) {
    return { legacy: true, session: null };
  }

  const session = await findActiveSession({ sessionId, userId });

  if (!session) {
    throw new CustomError('Session expired, please login again', 401);
  }

  return { legacy: false, session };
};
