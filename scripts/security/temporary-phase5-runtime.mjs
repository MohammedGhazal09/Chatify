import { readFile, writeFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const write = (path, content) => writeFile(path, content.endsWith('\n') ? content : `${content}\n`);

const replaceOnce = (source, search, replacement, label) => {
  const index = source.indexOf(search);
  if (index === -1) throw new Error(`Missing expected source for ${label}`);
  if (source.indexOf(search, index + search.length) !== -1) {
    throw new Error(`Expected one source occurrence for ${label}`);
  }
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
};

const replaceRegex = (source, pattern, replacement, label) => {
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`Expected one regex match for ${label}, found ${matches.length}`);
  return source.replace(pattern, replacement);
};

await write('Backend/Chatify/Utils/authIdentity.mjs', `import { CustomError } from './customError.mjs';

const CONTROL_CHARACTER_PATTERN = /[\\u0000-\\u001f\\u007f-\\u009f]/u;
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
      message: \\`Password must be at least \\${MIN_PASSWORD_CODE_POINTS} characters long\\`,
    };
  }

  if (codePointLength > MAX_PASSWORD_CODE_POINTS) {
    return {
      ok: false,
      code: 'password_too_long',
      message: \\`Password must be at most \\${MAX_PASSWORD_CODE_POINTS} characters long\\`,
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
`);

await write('Backend/Chatify/Utils/authToken.mjs', `import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_COOKIE = 'accessToken';
export const ACCESS_TOKEN_ISSUER = 'chatify-api';
export const ACCESS_TOKEN_AUDIENCE = 'chatify-web';

export const readAccessTokenFromCookieHeader = (cookieHeader = '') => {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;

  const tokenPair = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(\\`\\${ACCESS_TOKEN_COOKIE}=\\`));

  if (!tokenPair) return null;
  const token = tokenPair.slice(ACCESS_TOKEN_COOKIE.length + 1);

  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
};

export const readAccessTokenFromRequest = (req) => {
  const cookieToken = req.cookies?.[ACCESS_TOKEN_COOKIE];
  if (cookieToken) return cookieToken;

  const authorization = req.headers?.authorization;
  if (authorization?.startsWith('Bearer ')) return authorization.slice('Bearer '.length);
  return null;
};

export const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.SECRET_JWT_KEY, {
    algorithms: ['HS256'],
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
  });

  if (!decoded || typeof decoded !== 'object') throw new jwt.JsonWebTokenError('Invalid access token payload');
  if (decoded.type !== 'access') throw new jwt.JsonWebTokenError('Invalid token type');
  if (typeof decoded.userId !== 'string' || !decoded.userId) throw new jwt.JsonWebTokenError('Missing user id claim');
  if (typeof decoded.sub !== 'string' || decoded.sub !== decoded.userId) throw new jwt.JsonWebTokenError('Invalid subject claim');
  if (typeof decoded.sessionId !== 'string' || !decoded.sessionId) throw new jwt.JsonWebTokenError('Missing session id claim');
  if (typeof decoded.jti !== 'string' || !decoded.jti) throw new jwt.JsonWebTokenError('Missing JWT id claim');
  if (!Number.isFinite(decoded.iat) || !Number.isFinite(decoded.exp)) throw new jwt.JsonWebTokenError('Missing token time claims');

  return { userId: decoded.userId, sessionId: decoded.sessionId, decoded };
};
`);

await write('Backend/Chatify/Utils/sessionMetadata.mjs', `import { createHash, timingSafeEqual } from 'crypto';
import mongoose from 'mongoose';
import Session from '../Models/sessionModel.mjs';
import { CustomError } from './customError.mjs';

const UNKNOWN_DEVICE = 'Unknown device';

export const hashSessionMetadataValue = (value) => {
  if (!value || typeof value !== 'string') return null;
  return createHash('sha256').update(value).digest('base64url');
};

export const safeMetadataHashEqual = (left, right) => {
  if (left === null || left === undefined || right === null || right === undefined) {
    return (left === null || left === undefined) && (right === null || right === undefined);
  }
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const getRequestIp = (req) => {
  const forwardedFor = req?.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) return forwardedFor.split(',')[0].trim();
  return req?.ip || req?.socket?.remoteAddress || '';
};

const detectBrowser = (userAgent) => {
  if (/Edg\\//i.test(userAgent)) return 'Edge';
  if (/Chrome\\//i.test(userAgent) && !/Chromium/i.test(userAgent)) return 'Chrome';
  if (/Firefox\\//i.test(userAgent)) return 'Firefox';
  if (/Safari\\//i.test(userAgent) && !/Chrome\\//i.test(userAgent)) return 'Safari';
  if (/OPR\\//i.test(userAgent) || /Opera/i.test(userAgent)) return 'Opera';
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
  if (!userAgent || typeof userAgent !== 'string') return UNKNOWN_DEVICE;
  return \\`\\${detectBrowser(userAgent)} on \\${detectPlatform(userAgent)}\\`;
};

export const buildSessionMetadataFromRequest = (req) => {
  const userAgent = typeof req?.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : '';
  const ip = getRequestIp(req);
  return {
    deviceLabel: buildSafeDeviceLabel(userAgent),
    userAgentHash: hashSessionMetadataValue(userAgent),
    ipHash: hashSessionMetadataValue(ip),
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
  if (!sessionId || !mongoose.Types.ObjectId.isValid(sessionId)) return null;
  return Session.findOne({
    _id: sessionId,
    ...(userId ? { userId } : {}),
    revokedAt: null,
    expiresAt: { $gt: now },
  });
};

export const assertActiveSessionClaim = async ({ sessionId, userId }) => {
  if (!sessionId || !userId) throw new CustomError('Session expired, please login again', 401);
  const session = await findActiveSession({ sessionId, userId });
  if (!session) throw new CustomError('Session expired, please login again', 401);
  return { session };
};
`);

await write('Backend/Chatify/Utils/tokenCookieGenerator.mjs', `import jsonwebtoken from 'jsonwebtoken';
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
  const match = /^(\\d+)(ms|s|m|h|d)$/.exec(String(value ?? '').trim());
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
`);

await write('Backend/Chatify/Models/oauthHandoffModel.mjs', `import mongoose from 'mongoose';

const oauthHandoffSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
  provider: { type: String, enum: ['google', 'github', 'discord'], required: true },
  stateHash: { type: String, required: true },
  consumedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

oauthHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
oauthHandoffSchema.index({ userId: 1, consumedAt: 1, expiresAt: 1 });

const OAuthHandoff = mongoose.model('OAuthHandoffs', oauthHandoffSchema);
export default OAuthHandoff;
`);

await write('Backend/Chatify/Models/twoFactorChallengeModel.mjs', `import mongoose from 'mongoose';

const twoFactorChallengeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
  challengeTokenHash: { type: String, required: true, unique: true },
  rememberMe: { type: Boolean, default: false },
  userAgentHash: { type: String, default: null, select: false },
  ipHash: { type: String, default: null, select: false },
  attemptCount: { type: Number, default: 0, min: 0 },
  consumedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

twoFactorChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
twoFactorChallengeSchema.index({ userId: 1, consumedAt: 1, expiresAt: 1 });

const TwoFactorChallenge = mongoose.model('TwoFactorChallenges', twoFactorChallengeSchema);
export default TwoFactorChallenge;
`);

await write('Backend/Chatify/Config/passport.mjs', `import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import DiscordStrategy from './discordOAuthStrategy.mjs';
import User from '../Models/userModel.mjs';
import { normalizeEmail } from '../Utils/authIdentity.mjs';
import { resolveOAuthCallbackBaseURL } from '../Utils/oauthConfig.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const getFirstEmailValue = (profile) => Array.isArray(profile.emails)
  ? profile.emails.find((email) => typeof email?.value === 'string' && email.value)?.value
  : null;

const getVerifiedEmailEntry = (profile) => {
  if (!Array.isArray(profile.emails)) return null;
  return profile.emails.find((email) => email?.verified === true && email?.primary === true)
    ?? profile.emails.find((email) => email?.verified === true)
    ?? null;
};

const getProviderEmailInfo = (profile, provider) => {
  if (provider === 'google') {
    return {
      email: getFirstEmailValue(profile),
      verified: profile?._json?.email_verified === true || profile.emails?.[0]?.verified === true,
    };
  }
  if (provider === 'github') {
    const verifiedEmail = getVerifiedEmailEntry(profile);
    return { email: verifiedEmail?.value ?? getFirstEmailValue(profile), verified: Boolean(verifiedEmail) };
  }
  if (provider === 'discord') {
    return {
      email: profile.email,
      verified: profile?.verified === true || profile?._json?.verified === true,
    };
  }
  return { email: null, verified: false };
};

export const handleOAuthUser = async (profile, provider) => {
  try {
    const providerId = profile.id;
    const providerIdField = \\`\\${provider}Id\\`;
    const providerEmail = getProviderEmailInfo(profile, provider);
    const email = normalizeEmail(providerEmail.email);

    if (!providerId || !email) throw new Error('OAuth provider profile is missing required identity fields');
    if (providerEmail.verified !== true) throw new Error('OAuth provider did not supply a verified email');

    let userInfo;
    switch (provider) {
      case 'google':
        userInfo = {
          firstName: profile.name?.givenName || 'OAuth',
          lastName: profile.name?.familyName || '',
          email,
          providerProfilePic: profile.photos?.[0]?.value || '',
        };
        break;
      case 'github': {
        const fullName = profile.displayName || profile.username || '';
        const nameParts = fullName.split(' ');
        userInfo = {
          firstName: nameParts[0] || profile.username || 'OAuth',
          lastName: nameParts.slice(1).join(' ') || 'User',
          email,
          providerProfilePic: profile.photos?.[0]?.value || '',
        };
        break;
      }
      case 'discord': {
        const avatarUrl = profile.avatar
          ? \\`https://cdn.discordapp.com/avatars/\\${profile.id}/\\${profile.avatar}.png\\`
          : '';
        userInfo = {
          firstName: profile.username || profile.global_name || 'OAuth',
          lastName: '',
          email,
          providerProfilePic: avatarUrl,
        };
        break;
      }
      default:
        throw new Error('Unsupported OAuth provider');
    }

    const existingProviderUser = await User.findOne({
      [providerIdField]: providerId,
      authProvider: provider,
    }).select('+providerProfilePic +uploadedProfileImage');

    if (existingProviderUser) {
      existingProviderUser.providerProfilePic = userInfo.providerProfilePic;
      if (!existingProviderUser.hasUploadedProfileImage()) existingProviderUser.profilePic = userInfo.providerProfilePic || '';
      await existingProviderUser.save();
      return existingProviderUser;
    }

    const existingEmailUser = await User.findOne({ email });
    if (existingEmailUser) throw new Error('OAuth account linking requires existing user confirmation');

    return User.create({
      [providerIdField]: providerId,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      email,
      profilePic: userInfo.providerProfilePic,
      providerProfilePic: userInfo.providerProfilePic,
      authProvider: provider,
      isVerified: true,
    });
  } catch (error) {
    logger.error('oauth.user_handling_failed', { provider, error });
    throw error;
  }
};

const baseURL = resolveOAuthCallbackBaseURL();

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: \\`\\${baseURL}/api/auth/google/callback\\`,
}, async (accessToken, refreshToken, profile, done) => {
  try { return done(null, await handleOAuthUser(profile, 'google')); }
  catch (error) { return done(error, null); }
}));

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: \\`\\${baseURL}/api/auth/github/callback\\`,
}, async (accessToken, refreshToken, profile, done) => {
  try { return done(null, await handleOAuthUser(profile, 'github')); }
  catch (error) { return done(error, null); }
}));

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: \\`\\${baseURL}/api/auth/discord/callback\\`,
  scope: ['identify', 'email'],
}, async (accessToken, refreshToken, profile, done) => {
  try { return done(null, await handleOAuthUser(profile, 'discord')); }
  catch (error) { return done(error, null); }
}));

export default passport;
`);

let userModel = await read('Backend/Chatify/Models/userModel.mjs');
userModel = replaceOnce(
  userModel,
  "import {CustomError} from '../Utils/customError.mjs'\n",
  "import {CustomError} from '../Utils/customError.mjs'\nimport { normalizeEmail, validatePasswordPolicy } from '../Utils/authIdentity.mjs'\n",
  'user identity import',
);
userModel = replaceRegex(
  userModel,
  /    email: \{\n        type: String,\n        required: true,\n        unique: true,\n        trim: true,\n        validate: \[validator\.isEmail, 'Please provide a valid email address'\],\n    \},/,
  `    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        set: normalizeEmail,
        validate: [validator.isEmail, 'Please provide a valid email address'],
    },`,
  'canonical email schema',
);
userModel = replaceRegex(
  userModel,
  /    password: \{\n        type: String,\n        required: function\(\) \{\n          return this\.authProvider === 'local';\n        \},\n        minlength: \[8, 'Password must be at least 8 characters long'\],\n        trim: true,\n        maxlength: \[100, 'Password must be at most 100 characters long'\],\n        select: false,\n    \},/,
  `    password: {
        type: String,
        required: function() {
          return this.authProvider === 'local';
        },
        validate: {
          validator(value) {
            return !value || validatePasswordPolicy(value).ok;
          },
          message: 'Password must be 12-128 characters and contain no control characters',
        },
        select: false,
    },`,
  'password schema policy',
);
await write('Backend/Chatify/Models/userModel.mjs', userModel);

let authController = await read('Backend/Chatify/Controller/authController.mjs');
authController = replaceOnce(authController, "import jsonwebtoken from 'jsonwebtoken'\n", '', 'remove OAuth JWT import');
authController = replaceOnce(
  authController,
  "import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';",
  "import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';",
  'crypto imports',
);
authController = replaceOnce(
  authController,
  "  revokeRefreshSessionsForUser,\n  rotateSessionCookies,",
  "  revokeRefreshSessionsForUser,\n  revokeSessionById,\n  rotateSessionCookies,",
  'session revocation import',
);
authController = replaceOnce(
  authController,
  "import { readAccessTokenFromRequest, verifyAccessToken } from '../Utils/authToken.mjs';\n",
  "import { readAccessTokenFromRequest, verifyAccessToken } from '../Utils/authToken.mjs';\nimport { assertPasswordPolicy, normalizeEmail } from '../Utils/authIdentity.mjs';\n",
  'auth identity controller import',
);
authController = replaceRegex(
  authController,
  /const OAUTH_STATE_COOKIE = 'chatify_oauth_state';\nconst OAUTH_HANDOFF_PURPOSE = 'oauth_handoff';\nconst OAUTH_HANDOFF_TOKEN_TYPE = 'oauth_handoff';\nconst OAUTH_HANDOFF_EXPIRES_IN = '60s';\nconst OAUTH_HANDOFF_TTL_MS = 60 \* 1000;/,
  `const OAUTH_STATE_COOKIE = 'chatify_oauth_state';
const OAUTH_HANDOFF_COOKIE = 'chatify_oauth_handoff';
const OAUTH_HANDOFF_TTL_MS = 60 * 1000;`,
  'OAuth constants',
);
authController = replaceRegex(
  authController,
  /const hashOAuthState = \(state\) => createHash\('sha256'\)\.update\(state\)\.digest\('base64url'\);[\s\S]*?const redirectOAuthFailure = \(res\) => \{\n  clearOAuthStateCookie\(res\);\n  return res\.redirect\(buildFrontendUrl\('\/login', \{ error: 'auth_failed' \}\)\);\n\};/,
  `const hashOAuthState = (state) => createHash('sha256').update(String(state)).digest('base64url');
const hashOAuthHandoffToken = (token) => createHash('sha256').update(String(token)).digest('base64url');

const getOAuthStateCookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: 5 * 60 * 1000,
  path: '/api/auth',
});

const getOAuthHandoffCookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: OAUTH_HANDOFF_TTL_MS,
  path: '/api/auth/oauth/finalize',
});

const clearOAuthCookies = (res) => {
  res.clearCookie(OAUTH_STATE_COOKIE, { ...getOAuthStateCookieOptions(), maxAge: undefined });
  res.clearCookie(OAUTH_HANDOFF_COOKIE, { ...getOAuthHandoffCookieOptions(), maxAge: undefined });
};

const buildFrontendUrl = (pathname, params = {}) => {
  const url = new URL(pathname, FRONTEND_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });
  return url.toString();
};

const buildOAuthFinalizeUrl = () => new URL('/api/auth/oauth/finalize', resolveOAuthFinalizeBaseURL()).toString();
const generateOAuthState = () => randomBytes(32).toString('base64url');
const generateOAuthHandoffToken = () => randomBytes(32).toString('base64url');

const redirectOAuthFailure = (res) => {
  clearOAuthCookies(res);
  return res.redirect(buildFrontendUrl('/login', { error: 'auth_failed' }));
};`,
  'OAuth helper replacement',
);
authController = replaceOnce(
  authController,
  "  let { firstName, lastName, email, password, username } = req.body;\n\n  if (!firstName || !lastName || !email || !password || !username) {",
  "  let { firstName, lastName, email, password, username } = req.body;\n\n  if (!firstName || !lastName || !email || !password || !username) {",
  'signup anchor',
);
authController = replaceOnce(
  authController,
  "  const usernameValidation = validateUsername(username);",
  "  email = normalizeEmail(email);\n  assertPasswordPolicy(password);\n\n  const usernameValidation = validateUsername(username);",
  'signup normalization',
);
authController = replaceOnce(
  authController,
  "  const { email, password, rememberMe } = req.body;\n  if (!email || !password) {",
  "  const { password, rememberMe } = req.body;\n  const email = normalizeEmail(req.body.email);\n  if (!email || !password) {",
  'login normalization',
);
authController = replaceOnce(
  authController,
  "    const challenge = await createTwoFactorLoginChallenge({ user, rememberMe });",
  "    const challenge = await createTwoFactorLoginChallenge({ user, rememberMe, req });",
  'MFA request binding',
);
authController = replaceRegex(
  authController,
  /export const logout = asyncErrHandler\(async \(req, res, next\) => \{[\s\S]*?\n\}\)\n\nexport const refreshToken/,
  `export const logout = asyncErrHandler(async (req, res) => {
  let accessSessionRevoked = false;
  let refreshSessionRevoked = false;
  let userId = null;

  const accessToken = readAccessTokenFromRequest(req);
  if (accessToken) {
    try {
      const verified = verifyAccessToken(accessToken);
      userId = verified.userId;
      accessSessionRevoked = await revokeSessionById({
        sessionId: verified.sessionId,
        userId: verified.userId,
      });
    } catch {
      accessSessionRevoked = false;
    }
  }

  refreshSessionRevoked = await revokeRefreshSession(readRefreshTokenFromRequest(req));
  clearSessionCookies(res);
  logger.info('auth.logout_completed', {
    userId,
    accessSessionRevoked,
    refreshSessionRevoked,
  });

  return res.status(200).json({ status: 'success', message: 'Logged out successfully' });
});

export const refreshToken`,
  'logout independent revocation',
);
authController = replaceRegex(
  authController,
  /\/\/ Helper function for OAuth callbacks[\s\S]*?export const finalizeOAuth = asyncErrHandler\(async \(req, res\) => \{[\s\S]*?\n\}\);\n\n\/\/ OAuth authentication initiators/,
  `// Helper function for OAuth callbacks
const createOAuthCallback = (provider) => (req, res, next) => {
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const stateCookie = req.cookies?.[OAUTH_STATE_COOKIE];

  if (typeof stateCookie !== 'string' || !state || !safeHashEqual(hashOAuthState(state), hashOAuthState(stateCookie))) {
    return redirectOAuthFailure(res);
  }

  return passport.authenticate(provider, { session: false }, async (err, user) => {
    if (err || !user) return redirectOAuthFailure(res);

    try {
      const handoffToken = generateOAuthHandoffToken();
      await OAuthHandoff.create({
        tokenHash: hashOAuthHandoffToken(handoffToken),
        userId: user._id,
        provider,
        stateHash: hashOAuthState(state),
        expiresAt: new Date(Date.now() + OAUTH_HANDOFF_TTL_MS),
      });
      res.cookie(OAUTH_HANDOFF_COOKIE, handoffToken, getOAuthHandoffCookieOptions());
      return res.redirect(buildOAuthFinalizeUrl());
    } catch {
      return redirectOAuthFailure(res);
    }
  })(req, res, next);
};

export const finalizeOAuth = asyncErrHandler(async (req, res) => {
  const stateCookie = req.cookies?.[OAUTH_STATE_COOKIE];
  const handoffToken = req.cookies?.[OAUTH_HANDOFF_COOKIE];

  if (typeof stateCookie !== 'string' || !stateCookie || typeof handoffToken !== 'string' || !handoffToken) {
    return redirectOAuthFailure(res);
  }

  const now = new Date();
  const handoff = await OAuthHandoff.findOneAndUpdate(
    {
      tokenHash: hashOAuthHandoffToken(handoffToken),
      stateHash: hashOAuthState(stateCookie),
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } },
    { new: true },
  );

  if (!handoff) return redirectOAuthFailure(res);
  const user = await User.findById(handoff.userId);
  if (!user) return redirectOAuthFailure(res);

  await issueSessionCookies({ user, res, rememberMe: false, req });
  clearOAuthCookies(res);
  return res.redirect(buildFrontendUrl('/', { auth: 'success' }));
});

// OAuth authentication initiators`,
  'OAuth opaque exchange',
);
authController = replaceOnce(
  authController,
  "  const { email } = req.body;\n  if (!email) {",
  "  const email = normalizeEmail(req.body.email);\n  if (!email) {",
  'forgot email normalization',
);
authController = replaceOnce(
  authController,
  "    const { email, code} = req.body;\n    if (!email || !code) {",
  "    const email = normalizeEmail(req.body.email);\n    const { code } = req.body;\n    if (!email || !code) {",
  'verify reset normalization',
);
authController = replaceOnce(
  authController,
  "    const { email, code, newPassword } = req.body;\n    if (!email || !code || !newPassword) {",
  "    const email = normalizeEmail(req.body.email);\n    const { code, newPassword } = req.body;\n    if (!email || !code || !newPassword) {",
  'reset normalization',
);
authController = replaceOnce(
  authController,
  "    const resetToken = await findValidPasswordReset({ email, code });\n    \n    if (!resetToken) {\n      return next(new CustomError('Invalid or expired reset code', 400));\n    }\n\n    const user = await User.findById(resetToken.userId);",
  "    assertPasswordPolicy(newPassword);\n    const matchedResetToken = await findValidPasswordReset({ email, code });\n    if (!matchedResetToken) {\n      return next(new CustomError('Invalid or expired reset code', 400));\n    }\n\n    const resetToken = await PasswordReset.findOneAndDelete({\n      _id: matchedResetToken._id,\n      email,\n      tokenHash: matchedResetToken.tokenHash,\n      expiresAt: { $gt: new Date() },\n    });\n    if (!resetToken) {\n      return next(new CustomError('Invalid or expired reset code', 400));\n    }\n\n    const user = await User.findById(resetToken.userId);",
  'atomic reset consumption',
);
authController = replaceOnce(
  authController,
  "    await revokeRefreshSessionsForUser(user._id);\n    await PasswordReset.deleteOne({ _id: resetToken._id});",
  "    await revokeRefreshSessionsForUser(user._id);",
  'remove post-mutation reset delete',
);
await write('Backend/Chatify/Controller/authController.mjs', authController);

let twoFactor = await read('Backend/Chatify/Controller/twoFactorController.mjs');
twoFactor = replaceOnce(
  twoFactor,
  "import { issueSessionCookies } from '../Utils/tokenCookieGenerator.mjs';",
  "import { issueSessionCookies, revokeOtherSessionsForUser } from '../Utils/tokenCookieGenerator.mjs';\nimport { buildSessionMetadataFromRequest, safeMetadataHashEqual } from '../Utils/sessionMetadata.mjs';",
  'MFA session imports',
);
twoFactor = replaceOnce(
  twoFactor,
  "export const createTwoFactorLoginChallenge = async ({ user, rememberMe = false }) => {",
  "export const createTwoFactorLoginChallenge = async ({ user, rememberMe = false, req = null }) => {",
  'MFA challenge signature',
);
twoFactor = replaceOnce(
  twoFactor,
  "  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);",
  "  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);\n  const metadata = buildSessionMetadataFromRequest(req);",
  'MFA challenge metadata',
);
twoFactor = replaceOnce(
  twoFactor,
  "    rememberMe: Boolean(rememberMe),\n    attemptCount: 0,",
  "    rememberMe: Boolean(rememberMe),\n    userAgentHash: metadata.userAgentHash,\n    ipHash: metadata.ipHash,\n    attemptCount: 0,",
  'MFA challenge persistence',
);
twoFactor = replaceOnce(
  twoFactor,
  "  const challenge = await TwoFactorChallenge.findOne({\n    challengeTokenHash: hashTwoFactorChallengeToken(challengeToken),\n    consumedAt: null,\n    expiresAt: { $gt: now },\n  });",
  "  const challenge = await TwoFactorChallenge.findOne({\n    challengeTokenHash: hashTwoFactorChallengeToken(challengeToken),\n    consumedAt: null,\n    expiresAt: { $gt: now },\n  }).select('+userAgentHash +ipHash');",
  'MFA challenge sensitive fields',
);
twoFactor = replaceOnce(
  twoFactor,
  "  const user = await loadTwoFactorUser(challenge.userId);",
  "  const requestMetadata = buildSessionMetadataFromRequest(req);\n  if (\n    !safeMetadataHashEqual(challenge.userAgentHash, requestMetadata.userAgentHash) ||\n    !safeMetadataHashEqual(challenge.ipHash, requestMetadata.ipHash)\n  ) {\n    challenge.consumedAt = now;\n    await challenge.save();\n    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));\n  }\n\n  const user = await loadTwoFactorUser(challenge.userId);",
  'MFA metadata verification',
);
for (const [anchor, label] of [
  ["  clearPendingSetup(user);\n  await user.save();\n\n  return res.status(200).json({", 'confirm session containment'],
  ["  clearTwoFactor(user);\n  await user.save();\n\n  return res.status(200).json({", 'disable session containment'],
  ["  user.set('twoFactor.lastVerifiedAt', new Date());\n  await user.save();\n\n  return res.status(200).json({", 'backup session containment'],
]) {
  const replacement = anchor.replace(
    "  return res.status(200).json({",
    "  await revokeOtherSessionsForUser({ userId: user._id, currentSessionId: req.sessionId });\n\n  return res.status(200).json({",
  );
  twoFactor = replaceOnce(twoFactor, anchor, replacement, label);
}
await write('Backend/Chatify/Controller/twoFactorController.mjs', twoFactor);

await write('Frontend/Chatify/src/utils/validationSchemas.tsx', `import { z } from 'zod'
import { normalizeUsername, validateUsername } from './usernameValidation'

const canonicalEmailSchema = z.string()
  .transform((value) => value.normalize('NFKC').trim().toLocaleLowerCase('en-US'))
  .pipe(z.email('Please enter a valid email address').min(1, 'Email is required'))

export const usernameSchema = z.string()
  .transform(normalizeUsername)
  .superRefine((value, ctx) => {
    const validation = validateUsername(value);
    if (!validation.ok) ctx.addIssue({ code: 'custom', message: validation.message });
  })

export const loginSchema = z.object({
  email: canonicalEmailSchema,
  password: z.string().min(1, 'Password is required').max(128, 'Password must be at most 128 characters'),
  rememberMe: z.boolean().optional(),
})

export const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required').min(2, 'First name must be at least 2 characters').max(30, 'First name must be less than 30 characters'),
  lastName: z.string().min(1, 'Last name is required').min(2, 'Last name must be at least 2 characters').max(30, 'Last name must be less than 30 characters'),
  username: usernameSchema,
  email: canonicalEmailSchema,
  password: z.string()
    .min(1, 'Password is required')
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password must be at most 128 characters')
    .refine((value) => value.trim().length > 0, 'Password cannot contain only whitespace')
    .refine((value) => !/[\\u0000-\\u001f\\u007f-\\u009f]/u.test(value), 'Password cannot contain control characters'),
})

export const usernameSetupSchema = z.object({ username: usernameSchema })

export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type UsernameSetupFormData = z.infer<typeof usernameSetupSchema>
`);

let frontendTests = await read('Frontend/Chatify/src/utils/validationSchemas.test.ts');
frontendTests = replaceOnce(
  frontendTests,
  "  signupSchema,\n  usernameSchema,",
  "  loginSchema,\n  signupSchema,\n  usernameSchema,",
  'frontend login schema import',
);
frontendTests = replaceOnce(
  frontendTests,
  "  it('requires username for signup', () => {",
  `  it('canonicalizes authentication email and enforces the Phase 5 password policy', () => {
    expect(loginSchema.parse({
      email: '  Phase5.Identity@Example.TEST  ',
      password: 'correct horse battery staple',
    }).email).toBe('phase5.identity@example.test');

    const valid = signupSchema.safeParse({
      firstName: 'Phase',
      lastName: 'Five',
      username: 'phase.five',
      email: 'Phase5@Example.TEST',
      password: '  correct horse battery staple  ',
    });
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data.password).toBe('  correct horse battery staple  ');

    for (const password of ['Short123!', '            ', 'valid passphrase\\n']) {
      expect(signupSchema.safeParse({
        firstName: 'Phase',
        lastName: 'Five',
        username: 'phase.five',
        email: 'phase5@example.test',
        password,
      }).success).toBe(false);
    }
  });

  it('requires username for signup', () => {`,
  'frontend Phase 5 validation tests',
);
frontendTests = frontendTests.replace("password: 'password123',", "password: 'password1234',");
await write('Frontend/Chatify/src/utils/validationSchemas.test.ts', frontendTests);

let authLifecycle = await read('Backend/Chatify/test/auth/auth.lifecycle.test.mjs');
authLifecycle = replaceOnce(authLifecycle, "import jsonwebtoken from 'jsonwebtoken';\n", '', 'remove lifecycle JWT import');
authLifecycle = replaceOnce(
  authLifecycle,
  "import { createHash, randomUUID } from 'crypto';",
  "import { createHash, randomBytes } from 'crypto';",
  'lifecycle crypto import',
);
authLifecycle = replaceRegex(
  authLifecycle,
  /const createOAuthHandoff = async \(\{ user, state = 'oauth-state' \} = \{\}\) => \{[\s\S]*?return \{ state, targetUser, token \};\n\};/,
  `const createOAuthHandoff = async ({ user, state = 'oauth-state' } = {}) => {
  const targetUser = user ?? await createUser();
  const token = randomBytes(32).toString('base64url');

  await OAuthHandoff.create({
    tokenHash: createHash('sha256').update(token).digest('base64url'),
    userId: targetUser._id,
    provider: 'google',
    stateHash: hashOAuthState(state),
    expiresAt: new Date(Date.now() + 60 * 1000),
  });

  return { state, targetUser, token };
};`,
  'lifecycle opaque helper',
);
authLifecycle = replaceOnce(
  authLifecycle,
  ".set('Cookie', [`chatify_oauth_state=${state}`])\n      .query({ token })\n      .expect(302);",
  ".set('Cookie', [`chatify_oauth_state=${state}`, `chatify_oauth_handoff=${token}`])\n      .expect(302);",
  'valid OAuth finalization test',
);
authLifecycle = replaceRegex(
  authLifecycle,
  /  it\('rejects invalid OAuth handoff tokens without setting a cookie',[\s\S]*?\n  \}\);/,
  `  it('rejects invalid OAuth handoff tokens without setting a cookie', async () => {
    const app = await getTestApp();
    const state = 'invalid-handoff-state';
    const response = await request(app)
      .get('/api/auth/oauth/finalize')
      .set('Cookie', [\\`chatify_oauth_state=\\${state}\\`, 'chatify_oauth_handoff=invalid-token'])
      .expect(302);

    expect(response.headers.location).toBe('http://localhost:5173/login?error=auth_failed');
    expect(getAccessTokenCookie(response)).toBeUndefined();
  });`,
  'invalid opaque OAuth test',
);
authLifecycle = replaceOnce(
  authLifecycle,
  "    const { token } = await createOAuthHandoff({ state: 'expected-state' });",
  "    const { token } = await createOAuthHandoff({ state: 'expected-state' });",
  'mismatch helper anchor',
);
authLifecycle = replaceOnce(
  authLifecycle,
  ".set('Cookie', ['chatify_oauth_state=wrong-state'])\n      .query({ token })\n      .expect(302);",
  ".set('Cookie', ['chatify_oauth_state=wrong-state', `chatify_oauth_handoff=${token}`])\n      .expect(302);",
  'OAuth state mismatch test',
);
authLifecycle = replaceOnce(
  authLifecycle,
  ".set('Cookie', [`chatify_oauth_state=${state}`])\n      .query({ token })\n      .expect(302);",
  ".set('Cookie', [`chatify_oauth_state=${state}`, `chatify_oauth_handoff=${token}`])\n      .expect(302);",
  'OAuth replay first use',
);
authLifecycle = replaceOnce(
  authLifecycle,
  ".set('Cookie', [`chatify_oauth_state=${state}`])\n      .query({ token })\n      .expect(302);",
  ".set('Cookie', [`chatify_oauth_state=${state}`, `chatify_oauth_handoff=${token}`])\n      .expect(302);",
  'OAuth replay second use',
);
await write('Backend/Chatify/test/auth/auth.lifecycle.test.mjs', authLifecycle);

console.log('Applied Phase 5 runtime authentication and session hardening.');
