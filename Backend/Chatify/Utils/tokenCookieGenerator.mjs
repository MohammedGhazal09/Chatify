import jsonwebtoken from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'crypto';
import mongoose from 'mongoose';
import Session from '../Models/sessionModel.mjs';
import User from '../Models/userModel.mjs';
import { CustomError } from './customError.mjs';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from './authToken.mjs';
import { buildSessionMetadataFromRequest } from './sessionMetadata.mjs';

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REMEMBER_ME_REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const durationToMs = (value) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value * 1000;
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(String(value ?? '').trim());
  if (!match) throw new Error('ACCESS_TOKEN_EXPIRES_IN must be a positive duration such as 15m');
  const amount = Number(match[1]);
  const units = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const milliseconds = amount * units[match[2]];
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) throw new Error('ACCESS_TOKEN_EXPIRES_IN is outside the supported range');
  return milliseconds;
};

export const ACCESS_TOKEN_MAX_AGE_MS = durationToMs(ACCESS_TOKEN_EXPIRES_IN);

const getCookieOptions = (maxAge) => {
  const isProd = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', maxAge, path: '/' };
};

const getClearCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' };
};

export const hashRefreshToken = (token) => createHash('sha256').update(token).digest('base64url');

export const createAccessToken = (user, session) => {
  const userId = user?._id?.toString?.();
  const sessionId = session?._id?.toString?.();
  if (!userId || !sessionId) throw new CustomError('Cannot issue an access token without an active session', 500);

  return jsonwebtoken.sign(
    { userId, sessionId, type: 'access', jti: randomUUID() },
    process.env.SECRET_JWT_KEY,
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
      subject: userId,
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    },
  );
};

const createOpaqueRefreshToken = () => randomBytes(48).toString('base64url');
const getRefreshMaxAge = (rememberMe = false) => rememberMe
  ? REMEMBER_ME_REFRESH_TOKEN_MAX_AGE_MS
  : REFRESH_TOKEN_MAX_AGE_MS;

const setSessionCookies = (res, { accessToken, refreshToken, rememberMe }) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getCookieOptions(getRefreshMaxAge(rememberMe)));
};

export const clearSessionCookies = (res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, getClearCookieOptions());
  res.clearCookie(REFRESH_TOKEN_COOKIE, getClearCookieOptions());
};

export const readRefreshTokenFromRequest = (req) => req.cookies?.[REFRESH_TOKEN_COOKIE] ?? null;

const createRefreshSession = async ({ user, rememberMe = false, familyId = randomUUID(), metadata = {} }) => {
  const refreshToken = createOpaqueRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + getRefreshMaxAge(rememberMe));
  const session = await Session.create({
    userId: user._id,
    refreshTokenHash,
    familyId,
    rememberMe,
    deviceLabel: metadata.deviceLabel,
    userAgentHash: metadata.userAgentHash,
    ipHash: metadata.ipHash,
    expiresAt,
    lastUsedAt: new Date(),
  });
  return { refreshToken, refreshTokenHash, session };
};

export const issueSessionCookies = async ({ user, res, rememberMe = false, req = null }) => {
  const { refreshToken, session } = await createRefreshSession({
    user,
    rememberMe,
    metadata: buildSessionMetadataFromRequest(req),
  });
  const accessToken = createAccessToken(user, session);
  setSessionCookies(res, { accessToken, refreshToken, rememberMe });
  return { accessToken, refreshToken, session };
};

export const rotateSessionCookies = async ({ refreshToken, res, req = null }) => {
  if (!refreshToken) throw new CustomError('Refresh token required', 401);

  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const claimedSession = await Session.findOneAndUpdate(
    { refreshTokenHash: tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, lastUsedAt: now } },
    { new: false },
  );

  if (!claimedSession) {
    const existingSession = await Session.findOne({ refreshTokenHash: tokenHash });
    if (!existingSession) throw new CustomError('Invalid refresh token', 401);
    if (existingSession.revokedAt) {
      await Session.updateMany(
        { familyId: existingSession.familyId, revokedAt: null },
        { $set: { revokedAt: new Date(), lastUsedAt: new Date() } },
      );
      throw new CustomError('Refresh token already used', 401);
    }
    if (existingSession.expiresAt <= now) {
      await Session.updateOne(
        { _id: existingSession._id, revokedAt: null },
        { $set: { revokedAt: now, lastUsedAt: now } },
      );
      throw new CustomError('Refresh token expired', 401);
    }
    throw new CustomError('Invalid refresh token', 401);
  }

  const user = await User.findById(claimedSession.userId);
  if (!user) {
    await Session.updateMany(
      { familyId: claimedSession.familyId, revokedAt: null },
      { $set: { revokedAt: new Date(), lastUsedAt: new Date() } },
    );
    throw new CustomError('User not found', 404);
  }

  const requestMetadata = buildSessionMetadataFromRequest(req);
  const { refreshToken: nextRefreshToken, refreshTokenHash: nextRefreshTokenHash, session: nextSession } = await createRefreshSession({
    user,
    rememberMe: claimedSession.rememberMe,
    familyId: claimedSession.familyId,
    metadata: {
      deviceLabel: claimedSession.deviceLabel || requestMetadata.deviceLabel,
      userAgentHash: claimedSession.userAgentHash ?? requestMetadata.userAgentHash,
      ipHash: claimedSession.ipHash ?? requestMetadata.ipHash,
    },
  });
  const accessToken = createAccessToken(user, nextSession);

  await Session.updateOne({ _id: claimedSession._id }, { $set: { replacedByTokenHash: nextRefreshTokenHash } });
  setSessionCookies(res, { accessToken, refreshToken: nextRefreshToken, rememberMe: claimedSession.rememberMe });
  return { accessToken, refreshToken: nextRefreshToken, session: nextSession, user };
};

export const revokeRefreshSession = async (refreshToken) => {
  if (!refreshToken) return false;
  const result = await Session.findOneAndUpdate(
    { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date(), lastUsedAt: new Date() } },
  );
  return Boolean(result);
};

export const revokeSessionById = async ({ sessionId, userId = null }) => {
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) return false;
  const result = await Session.findOneAndUpdate(
    { _id: sessionId, ...(userId ? { userId } : {}), revokedAt: null },
    { $set: { revokedAt: new Date(), lastUsedAt: new Date() } },
  );
  return Boolean(result);
};

export const revokeOtherSessionsForUser = async ({ userId, currentSessionId = null }) => {
  if (!userId) return 0;
  const now = new Date();
  const result = await Session.updateMany(
    {
      userId,
      revokedAt: null,
      expiresAt: { $gt: now },
      ...(currentSessionId && mongoose.Types.ObjectId.isValid(currentSessionId)
        ? { _id: { $ne: currentSessionId } }
        : {}),
    },
    { $set: { revokedAt: now, lastUsedAt: now } },
  );
  return result.modifiedCount ?? 0;
};

export const revokeRefreshSessionsForUser = async (userId) => {
  if (!userId) return;
  const now = new Date();
  await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: now, lastUsedAt: now } },
  );
};

export const generateTokenAndSetCookie = async (user, res, rememberMe = false) => {
  const { accessToken } = await issueSessionCookies({ user, res, rememberMe });
  return accessToken;
};
