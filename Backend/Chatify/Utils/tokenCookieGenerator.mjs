import jsonwebtoken from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'crypto';
import Session from '../Models/sessionModel.mjs';
import User from '../Models/userModel.mjs';
import { CustomError } from './customError.mjs';
import { buildSessionMetadataFromRequest } from './sessionMetadata.mjs';

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REMEMBER_ME_REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_USED_REFRESH_TOKEN_HASHES = 50;

const getCookieOptions = (maxAge) => {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge,
    path: '/',
  };
};

const getClearCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };
};

export const hashRefreshToken = (token) => (
  createHash('sha256').update(token).digest('base64url')
);

export const createAccessToken = (user, session = null) => {
  const payload = {
    userId: user._id.toString(),
    type: 'access',
    jti: randomUUID(),
  };

  if (session?._id) {
    payload.sessionId = session._id.toString();
  }

  return jsonwebtoken.sign(
    payload,
    process.env.SECRET_JWT_KEY,
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    }
  );
};

const createOpaqueRefreshToken = () => randomBytes(48).toString('base64url');

const getRefreshMaxAge = (rememberMe = false) => (
  rememberMe ? REMEMBER_ME_REFRESH_TOKEN_MAX_AGE_MS : REFRESH_TOKEN_MAX_AGE_MS
);

const setSessionCookies = (res, { accessToken, refreshToken, rememberMe }) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, getCookieOptions(getRefreshMaxAge(rememberMe)));
};

export const clearSessionCookies = (res) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE, getClearCookieOptions());
  res.clearCookie(REFRESH_TOKEN_COOKIE, getClearCookieOptions());
};

export const readRefreshTokenFromRequest = (req) => req.cookies?.[REFRESH_TOKEN_COOKIE] ?? null;

const createRefreshSession = async ({
  user,
  rememberMe = false,
  familyId = randomUUID(),
  metadata = {},
}) => {
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
  if (!refreshToken) {
    throw new CustomError('Refresh token required', 401);
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const nextRefreshToken = createOpaqueRefreshToken();
  const nextRefreshTokenHash = hashRefreshToken(nextRefreshToken);
  const now = new Date();
  const metadata = buildSessionMetadataFromRequest(req);
  const rotatedSession = await Session.findOneAndUpdate(
    {
      refreshTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        refreshTokenHash: nextRefreshTokenHash,
        expiresAt: new Date(now.getTime() + REMEMBER_ME_REFRESH_TOKEN_MAX_AGE_MS),
        lastUsedAt: now,
        deviceLabel: metadata.deviceLabel,
        userAgentHash: metadata.userAgentHash,
        ipHash: metadata.ipHash,
        replacedByTokenHash: nextRefreshTokenHash,
      },
      $push: {
        usedRefreshTokenHashes: {
          $each: [{ hash: tokenHash, usedAt: now }],
          $slice: -MAX_USED_REFRESH_TOKEN_HASHES,
        },
      },
    },
    { new: true }
  );

  if (!rotatedSession) {
    const replayedSession = await Session.findOne({
      'usedRefreshTokenHashes.hash': tokenHash,
    }).select('+usedRefreshTokenHashes');

    if (replayedSession) {
      await Session.updateOne(
        { _id: replayedSession._id, revokedAt: null },
        { $set: { revokedAt: now, lastUsedAt: now } }
      );
      throw new CustomError('Refresh token already used', 401);
    }

    const existingSession = await Session.findOne({ refreshTokenHash: tokenHash });
    if (existingSession?.expiresAt <= now) {
      await Session.updateOne(
        { _id: existingSession._id, revokedAt: null },
        { $set: { revokedAt: now, lastUsedAt: now } }
      );
      throw new CustomError('Refresh token expired', 401);
    }

    throw new CustomError('Invalid refresh token', 401);
  }

  const user = await User.findById(rotatedSession.userId);

  if (!user) {
    await Session.updateOne(
      { _id: rotatedSession._id },
      { $set: { revokedAt: new Date(), lastUsedAt: new Date() } }
    );
    throw new CustomError('User not found', 404);
  }

  const refreshMaxAge = getRefreshMaxAge(rotatedSession.rememberMe);
  if (rotatedSession.expiresAt.getTime() !== now.getTime() + refreshMaxAge) {
    rotatedSession.expiresAt = new Date(now.getTime() + refreshMaxAge);
    await rotatedSession.save();
  }

  const accessToken = createAccessToken(user, rotatedSession);

  setSessionCookies(res, {
    accessToken,
    refreshToken: nextRefreshToken,
    rememberMe: rotatedSession.rememberMe,
  });

  return { accessToken, refreshToken: nextRefreshToken, session: rotatedSession, user };
};

export const revokeRefreshSession = async (refreshToken) => {
  if (!refreshToken) {
    return null;
  }

  return Session.findOneAndUpdate(
    {
      refreshTokenHash: hashRefreshToken(refreshToken),
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      },
    },
    { new: true }
  );
};

export const revokeRefreshSessionsForUser = async (userId) => {
  if (!userId) {
    return { modifiedCount: 0 };
  }

  return Session.updateMany(
    {
      userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        lastUsedAt: new Date(),
      },
    }
  );
};

export const generateTokenAndSetCookie = async (user, res, rememberMe = false) => {
  const { accessToken } = await issueSessionCookies({ user, res, rememberMe });
  return accessToken;
};
