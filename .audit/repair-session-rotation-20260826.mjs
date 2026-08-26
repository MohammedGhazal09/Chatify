import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const write = (relativePath, content) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content.endsWith('\n') ? content : `${content}\n`);
};

write('Backend/Chatify/Models/sessionFamilyModel.mjs', `import mongoose from 'mongoose';

const sessionFamilySchema = new mongoose.Schema({
  familyId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
  compromisedAt: { type: Date, default: null, index: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

sessionFamilySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SessionFamily = mongoose.model('SessionFamilies', sessionFamilySchema);
export default SessionFamily;
`);

write('Backend/Chatify/Utils/tokenCookieGenerator.mjs', `import jsonwebtoken from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'crypto';
import mongoose from 'mongoose';
import Session from '../Models/sessionModel.mjs';
import SessionFamily from '../Models/sessionFamilyModel.mjs';
import User from '../Models/userModel.mjs';
import { disconnectSessionSockets, disconnectUserSessionSockets } from '../Services/socketSessionLifecycleService.mjs';
import { CustomError } from './customError.mjs';
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from './authToken.mjs';
import { withDatabaseTransaction } from './databaseSecurity.mjs';
import { buildSessionMetadataFromRequest } from './sessionMetadata.mjs';

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REMEMBER_ME_REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const durationToMs = (value) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value * 1000;
  const match = /^(\\d+)(ms|s|m|h|d)$/.exec(String(value ?? '').trim());
  if (!match) throw new Error('ACCESS_TOKEN_EXPIRES_IN must be a positive duration such as 15m');
  const amount = Number(match[1]);
  const units = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const milliseconds = amount * units[match[2]];
  if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
    throw new Error('ACCESS_TOKEN_EXPIRES_IN is outside the supported range');
  }
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

export const hashRefreshToken = (token) => createHash('sha256')
  .update(String(token ?? ''))
  .digest('base64url');

export const createAccessToken = (user, session) => {
  const userId = user?._id?.toString?.();
  const sessionId = session?._id?.toString?.();
  if (!userId || !sessionId) {
    throw new CustomError('Cannot issue an access token without an active session', 500);
  }

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

const buildSessionDocument = ({ user, rememberMe, familyId, metadata, refreshTokenHash, expiresAt }) => ({
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

const createRefreshSession = async ({
  user,
  rememberMe = false,
  familyId = randomUUID(),
  metadata = {},
  session = null,
  createFamily = true,
}) => {
  const refreshToken = createOpaqueRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + getRefreshMaxAge(rememberMe));

  if (createFamily) {
    await SessionFamily.updateOne(
      { familyId },
      {
        $setOnInsert: { familyId, userId: user._id, compromisedAt: null },
        $max: { expiresAt },
      },
      { upsert: true, ...(session ? { session } : {}) },
    );
  }

  const documents = await Session.create([
    buildSessionDocument({
      user,
      rememberMe,
      familyId,
      metadata,
      refreshTokenHash,
      expiresAt,
    }),
  ], session ? { session } : undefined);

  return { refreshToken, refreshTokenHash, session: documents[0] };
};

const compromiseFamilyInTransaction = async ({ familyId, userId, now, session }) => {
  await SessionFamily.updateOne(
    { familyId },
    {
      $set: { compromisedAt: now },
      $setOnInsert: {
        familyId,
        userId,
        expiresAt: new Date(now.getTime() + REMEMBER_ME_REFRESH_TOKEN_MAX_AGE_MS),
      },
    },
    { upsert: true, session },
  );
  await Session.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: now, lastUsedAt: now } },
    { session },
  );
};

export const markSessionFamilyCompromised = async ({ familyId, userId = null, now = new Date() }) => {
  if (!familyId) return 0;
  const result = await withDatabaseTransaction(async (session) => {
    await compromiseFamilyInTransaction({ familyId, userId, now, session });
    return Session.find({ familyId }).select('_id').session(session).lean();
  });
  result.forEach((entry) => disconnectSessionSockets(entry._id, 'refresh_token_reuse'));
  return result.length;
};

export const issueSessionCookies = async ({ user, res, rememberMe = false, req = null }) => {
  const created = await withDatabaseTransaction(async (session) => createRefreshSession({
    user,
    rememberMe,
    metadata: buildSessionMetadataFromRequest(req),
    session,
    createFamily: true,
  }));
  const accessToken = createAccessToken(user, created.session);
  setSessionCookies(res, { accessToken, refreshToken: created.refreshToken, rememberMe });
  return { accessToken, refreshToken: created.refreshToken, session: created.session };
};

export const rotateSessionCookies = async ({ refreshToken, res, req = null }) => {
  if (!refreshToken) throw new CustomError('Refresh token required', 401);
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();

  const rotation = await withDatabaseTransaction(async (session) => {
    const existing = await Session.findOne({ refreshTokenHash: tokenHash })
      .select('+userAgentHash +ipHash')
      .session(session);

    if (!existing) throw new CustomError('Invalid refresh token', 401);

    const family = await SessionFamily.findOne({ familyId: existing.familyId }).session(session);
    if (!family || family.compromisedAt || existing.revokedAt || existing.replacedByTokenHash) {
      await compromiseFamilyInTransaction({
        familyId: existing.familyId,
        userId: existing.userId,
        now,
        session,
      });
      throw new CustomError('Refresh token already used', 401);
    }

    if (existing.expiresAt <= now) {
      await Session.updateOne(
        { _id: existing._id, revokedAt: null },
        { $set: { revokedAt: now, lastUsedAt: now } },
        { session },
      );
      throw new CustomError('Refresh token expired', 401);
    }

    const claimed = await Session.findOneAndUpdate(
      {
        _id: existing._id,
        refreshTokenHash: tokenHash,
        revokedAt: null,
        replacedByTokenHash: null,
        expiresAt: { $gt: now },
      },
      { $set: { revokedAt: now, lastUsedAt: now } },
      { new: false, session },
    ).select('+userAgentHash +ipHash');

    if (!claimed) {
      await compromiseFamilyInTransaction({
        familyId: existing.familyId,
        userId: existing.userId,
        now,
        session,
      });
      throw new CustomError('Refresh token already used', 401);
    }

    const user = await User.findById(claimed.userId).session(session);
    if (!user) {
      await compromiseFamilyInTransaction({
        familyId: claimed.familyId,
        userId: claimed.userId,
        now,
        session,
      });
      throw new CustomError('User not found', 404);
    }

    const requestMetadata = buildSessionMetadataFromRequest(req);
    const successor = await createRefreshSession({
      user,
      rememberMe: claimed.rememberMe,
      familyId: claimed.familyId,
      metadata: {
        deviceLabel: claimed.deviceLabel || requestMetadata.deviceLabel,
        userAgentHash: claimed.userAgentHash ?? requestMetadata.userAgentHash,
        ipHash: claimed.ipHash ?? requestMetadata.ipHash,
      },
      session,
      createFamily: false,
    });

    await Session.updateOne(
      { _id: claimed._id, replacedByTokenHash: null },
      { $set: { replacedByTokenHash: successor.refreshTokenHash } },
      { session },
    );
    await SessionFamily.updateOne(
      { familyId: claimed.familyId, compromisedAt: null },
      { $max: { expiresAt: successor.session.expiresAt } },
      { session },
    );

    return { user, predecessorId: claimed._id, ...successor };
  });

  disconnectSessionSockets(rotation.predecessorId, 'session_rotated');
  const accessToken = createAccessToken(rotation.user, rotation.session);
  setSessionCookies(res, {
    accessToken,
    refreshToken: rotation.refreshToken,
    rememberMe: rotation.session.rememberMe,
  });
  return {
    accessToken,
    refreshToken: rotation.refreshToken,
    session: rotation.session,
    user: rotation.user,
  };
};

export const revokeRefreshSession = async (refreshToken) => {
  if (!refreshToken) return false;
  const result = await Session.findOneAndUpdate(
    { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date(), lastUsedAt: new Date() } },
    { new: false },
  );
  if (result) disconnectSessionSockets(result._id, 'session_logout');
  return Boolean(result);
};

export const revokeSessionById = async ({ sessionId, userId = null }) => {
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) return false;
  const result = await Session.findOneAndUpdate(
    { _id: sessionId, ...(userId ? { userId } : {}), revokedAt: null },
    { $set: { revokedAt: new Date(), lastUsedAt: new Date() } },
    { new: false },
  );
  if (result) disconnectSessionSockets(result._id, 'session_revoked');
  return Boolean(result);
};

export const revokeOtherSessionsForUser = async ({ userId, currentSessionId = null }) => {
  if (!userId) return 0;
  const now = new Date();
  const filter = {
    userId,
    revokedAt: null,
    expiresAt: { $gt: now },
    ...(currentSessionId && mongoose.Types.ObjectId.isValid(currentSessionId)
      ? { _id: { $ne: currentSessionId } }
      : {}),
  };
  const sessions = await Session.find(filter).select('_id').lean();
  const result = await Session.updateMany(filter, { $set: { revokedAt: now, lastUsedAt: now } });
  sessions.forEach((entry) => disconnectSessionSockets(entry._id, 'other_sessions_revoked'));
  return result.modifiedCount ?? 0;
};

export const revokeRefreshSessionsForUser = async (userId) => {
  if (!userId) return 0;
  const now = new Date();
  const result = await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: now, lastUsedAt: now } },
  );
  disconnectUserSessionSockets(userId, 'password_reset');
  return result.modifiedCount ?? 0;
};

export const generateTokenAndSetCookie = async (user, res, rememberMe = false) => {
  const { accessToken } = await issueSessionCookies({ user, res, rememberMe });
  return accessToken;
};
`);

const indexPath = path.join(root, 'Backend/Chatify/Utils/databaseIndexPolicy.mjs');
let indexPolicy = fs.readFileSync(indexPath, 'utf8');
if (!indexPolicy.includes("sessionFamilyModel.mjs")) {
  indexPolicy = indexPolicy.replace(
    "import Session from '../Models/sessionModel.mjs';\n",
    "import Session from '../Models/sessionModel.mjs';\nimport SessionFamily from '../Models/sessionFamilyModel.mjs';\n",
  );
}
if (!indexPolicy.includes('session-families.expiry.ttl')) {
  indexPolicy = indexPolicy.replace(
    "  requirement('sessions.expiry.ttl', Session, { expiresAt: 1 }, { expireAfterSeconds: 0 }),\n",
    "  requirement('sessions.expiry.ttl', Session, { expiresAt: 1 }, { expireAfterSeconds: 0 }),\n  requirement('session-families.family.unique', SessionFamily, { familyId: 1 }, { unique: true }),\n  requirement('session-families.expiry.ttl', SessionFamily, { expiresAt: 1 }, { expireAfterSeconds: 0 }),\n",
  );
}
fs.writeFileSync(indexPath, indexPolicy);

const privacyPath = path.join(root, 'Backend/Chatify/Services/privacyOperationsService.mjs');
let privacy = fs.readFileSync(privacyPath, 'utf8');
if (!privacy.includes("SessionFamily from '../Models/sessionFamilyModel.mjs'")) {
  privacy = privacy.replace(
    "import Session from '../Models/sessionModel.mjs';\n",
    "import Session from '../Models/sessionModel.mjs';\nimport SessionFamily from '../Models/sessionFamilyModel.mjs';\n",
  );
}
privacy = privacy.replace(
  /const sessions = await Session\.deleteMany\(\{ userId: user\._id \}, \{ session \}\);\n\s*const passwordResets =/,
  "const sessions = await Session.deleteMany({ userId: user._id }, { session });\n      const sessionFamilies = await SessionFamily.deleteMany({ userId: user._id }, { session });\n      const passwordResets =",
);
privacy = privacy.replace(
  /counts\.sessionsRemoved = sessions\.deletedCount \?\? 0;/,
  "counts.sessionsRemoved = (sessions.deletedCount ?? 0) + (sessionFamilies?.deletedCount ?? 0);",
);
fs.writeFileSync(privacyPath, privacy);

console.log('Repaired session-family rotation while preserving JWT and revocation contracts.');
