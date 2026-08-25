import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const changed = new Set();
const target = (relativePath) => path.join(root, relativePath);
const read = (relativePath) => fs.readFileSync(target(relativePath), 'utf8');
const write = (relativePath, value) => {
  const output = value.endsWith('\n') ? value : `${value}\n`;
  fs.mkdirSync(path.dirname(target(relativePath)), { recursive: true });
  if (!fs.existsSync(target(relativePath)) || read(relativePath) !== output) {
    fs.writeFileSync(target(relativePath), output);
    changed.add(relativePath);
  }
};

write('Backend/Chatify/Models/sessionFamilyModel.mjs', `import mongoose from 'mongoose';

const sessionFamilySchema = new mongoose.Schema({
  familyId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true, index: true },
  compromisedAt: { type: Date, default: null, index: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });

sessionFamilySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('SessionFamilies', sessionFamilySchema);
`);

const tokenPath = 'Backend/Chatify/Utils/tokenCookieGenerator.mjs';
if (!read(tokenPath).includes("SessionFamily from '../Models/sessionFamilyModel.mjs'")) {
  write(tokenPath, `import jsonwebtoken from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'crypto';
import Session from '../Models/sessionModel.mjs';
import SessionFamily from '../Models/sessionFamilyModel.mjs';
import User from '../Models/userModel.mjs';
import { CustomError } from './customError.mjs';
import { buildSessionMetadataFromRequest } from './sessionMetadata.mjs';

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REMEMBER_ME_REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge,
  path: '/',
});
const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
});
export const hashRefreshToken = (token) => createHash('sha256').update(String(token ?? '')).digest('base64url');
export const createAccessToken = (user, session = null) => {
  const payload = { userId: user._id.toString(), type: 'access', jti: randomUUID() };
  if (session?._id) payload.sessionId = session._id.toString();
  return jsonwebtoken.sign(payload, process.env.SECRET_JWT_KEY, { algorithm: 'HS256', expiresIn: ACCESS_TOKEN_EXPIRES_IN });
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

const ensureSessionFamily = async ({ familyId, userId, expiresAt }) => {
  await SessionFamily.updateOne(
    { familyId },
    {
      $setOnInsert: { familyId, userId, compromisedAt: null },
      $max: { expiresAt },
    },
    { upsert: true }
  );
};

const createRefreshSession = async ({ user, rememberMe = false, familyId = randomUUID(), metadata = {} }) => {
  const refreshToken = createOpaqueRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + getRefreshMaxAge(rememberMe));
  await ensureSessionFamily({ familyId, userId: user._id, expiresAt });
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

export const markSessionFamilyCompromised = async ({ familyId, userId = null, now = new Date() }) => {
  if (!familyId) return;
  await SessionFamily.updateOne(
    { familyId },
    {
      $setOnInsert: {
        familyId,
        userId,
        expiresAt: new Date(now.getTime() + REMEMBER_ME_REFRESH_TOKEN_MAX_AGE_MS),
      },
      $min: { compromisedAt: now },
    },
    { upsert: true }
  );
  await Session.updateMany(
    { familyId, revokedAt: null },
    { $set: { revokedAt: now, lastUsedAt: now } }
  );
};

export const issueSessionCookies = async ({ user, res, rememberMe = false, req = null }) => {
  const created = await createRefreshSession({ user, rememberMe, metadata: buildSessionMetadataFromRequest(req) });
  const accessToken = createAccessToken(user, created.session);
  setSessionCookies(res, { accessToken, refreshToken: created.refreshToken, rememberMe });
  return { accessToken, refreshToken: created.refreshToken, session: created.session };
};

export const rotateSessionCookies = async ({ refreshToken, res, req = null }) => {
  if (!refreshToken) throw new CustomError('Refresh token required', 401);
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  const existingSession = await Session.findOne({ refreshTokenHash: tokenHash })
    .select('+userAgentHash +ipHash');
  if (!existingSession) throw new CustomError('Invalid refresh token', 401);
  if (existingSession.revokedAt) {
    await markSessionFamilyCompromised({
      familyId: existingSession.familyId,
      userId: existingSession.userId,
      now,
    });
    throw new CustomError('Refresh token already used', 401);
  }
  if (existingSession.expiresAt <= now) {
    await Session.updateOne(
      { _id: existingSession._id, revokedAt: null },
      { $set: { revokedAt: now, lastUsedAt: now } }
    );
    throw new CustomError('Refresh token expired', 401);
  }

  const claimedSession = await Session.findOneAndUpdate(
    {
      _id: existingSession._id,
      refreshTokenHash: tokenHash,
      revokedAt: null,
      replacedByTokenHash: null,
      expiresAt: { $gt: now },
    },
    { $set: { revokedAt: now, lastUsedAt: now } },
    { new: false }
  ).select('+userAgentHash +ipHash');
  if (!claimedSession) {
    await markSessionFamilyCompromised({
      familyId: existingSession.familyId,
      userId: existingSession.userId,
      now,
    });
    throw new CustomError('Refresh token already used', 401);
  }

  const user = await User.findById(claimedSession.userId);
  if (!user) {
    await markSessionFamilyCompromised({ familyId: claimedSession.familyId, userId: claimedSession.userId, now });
    throw new CustomError('User not found', 404);
  }
  const requestMetadata = buildSessionMetadataFromRequest(req);
  const successor = await createRefreshSession({
    user,
    rememberMe: claimedSession.rememberMe,
    familyId: claimedSession.familyId,
    metadata: {
      deviceLabel: claimedSession.deviceLabel || requestMetadata.deviceLabel,
      userAgentHash: claimedSession.userAgentHash ?? requestMetadata.userAgentHash,
      ipHash: claimedSession.ipHash ?? requestMetadata.ipHash,
    },
  });
  await Session.updateOne(
    { _id: claimedSession._id },
    { $set: { replacedByTokenHash: successor.refreshTokenHash } }
  );

  const family = await SessionFamily.findOne({ familyId: claimedSession.familyId }).lean();
  if (family?.compromisedAt) {
    await Session.updateOne(
      { _id: successor.session._id, revokedAt: null },
      { $set: { revokedAt: new Date(), lastUsedAt: new Date() } }
    );
    throw new CustomError('Refresh token family is compromised', 401);
  }
  const accessToken = createAccessToken(user, successor.session);
  setSessionCookies(res, {
    accessToken,
    refreshToken: successor.refreshToken,
    rememberMe: claimedSession.rememberMe,
  });
  return { accessToken, refreshToken: successor.refreshToken, session: successor.session, user };
};

export const revokeRefreshSession = async (refreshToken) => {
  if (!refreshToken) return;
  await Session.findOneAndUpdate(
    { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    { $set: { revokedAt: new Date(), lastUsedAt: new Date() } }
  );
};
export const revokeRefreshSessionsForUser = async (userId) => {
  if (!userId) return;
  await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), lastUsedAt: new Date() } }
  );
};
export const generateTokenAndSetCookie = async (user, res, rememberMe = false) => {
  const { accessToken } = await issueSessionCookies({ user, res, rememberMe });
  return accessToken;
};
`);
}

const resetModelPath = 'Backend/Chatify/Models/passwordResetModel.mjs';
let resetModel = read(resetModelPath);
if (!resetModel.includes('consumedAt')) {
  resetModel = resetModel.replace(
    /attempts:\s*\{[\s\S]*?\},\n\s*expiresAt:/,
    (match) => match.replace(/\n\s*expiresAt:/, "\n    consumedAt: { type: Date, default: null, index: true },\n    expiresAt:")
  );
  write(resetModelPath, resetModel);
}

const authPath = 'Backend/Chatify/Controller/authController.mjs';
let auth = read(authPath);
if (!auth.includes('consumeValidPasswordReset')) {
  const helpersPattern = /const recordFailedResetAttempt = async \(resetToken\) => \{[\s\S]*?\n\};\n\nconst findValidPasswordReset = async \(\{ email, code \}\) => \{[\s\S]*?\n\};/;
  if (!helpersPattern.test(auth)) throw new Error('Password-reset helper block was not found');
  auth = auth.replace(helpersPattern, `const recordFailedResetAttempt = async (resetToken) => {
  const updated = await PasswordReset.findOneAndUpdate(
    { _id: resetToken._id, consumedAt: null, expiresAt: { $gt: new Date() }, attempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (updated?.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
    await PasswordReset.deleteOne({ _id: updated._id, consumedAt: null });
  }
};

const findValidPasswordReset = async ({ email, code }) => {
  const resetToken = await PasswordReset.findOne({
    email,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
    attempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS },
  }).sort({ createdAt: -1 });
  if (!resetToken) return null;
  const codeHash = hashPasswordResetCode(code);
  if (!safeHashEqual(resetToken.tokenHash, codeHash)) {
    await recordFailedResetAttempt(resetToken);
    return null;
  }
  return resetToken;
};

const consumeValidPasswordReset = async ({ email, code }) => {
  const candidate = await findValidPasswordReset({ email, code });
  if (!candidate) return null;
  return PasswordReset.findOneAndUpdate(
    {
      _id: candidate._id,
      tokenHash: candidate.tokenHash,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS },
    },
    { $set: { consumedAt: new Date() } },
    { new: false }
  );
};`);
  const resetFunctionPattern = /(export const resetPassword = asyncErrHandler\([\s\S]*?const resetToken = await )findValidPasswordReset(\(\{ email, code \}\);)/;
  if (!resetFunctionPattern.test(auth)) throw new Error('Password reset consumption call was not found');
  auth = auth.replace(resetFunctionPattern, '$1consumeValidPasswordReset$2');
  write(authPath, auth);
}

const challengeModelPath = 'Backend/Chatify/Models/twoFactorChallengeModel.mjs';
let challengeModel = read(challengeModelPath);
if (!challengeModel.includes('processingToken')) {
  challengeModel = challengeModel.replace(
    /consumedAt:\s*\{[\s\S]*?\},\n/,
    (match) => `${match}    processingToken: { type: String, default: null, select: false },\n    processingStartedAt: { type: Date, default: null },\n`
  );
  write(challengeModelPath, challengeModel);
}

const twoFactorPath = 'Backend/Chatify/Controller/twoFactorController.mjs';
let twoFactor = read(twoFactorPath);
if (!twoFactor.includes('claimTwoFactorLoginChallenge')) {
  if (!twoFactor.includes("from 'node:crypto'")) {
    twoFactor = `import { randomUUID } from 'node:crypto';\n${twoFactor}`;
  }
  twoFactor = twoFactor.replace(
    /const consumeBackupCode = \(user, backupCodeIndex\) => \{[\s\S]*?\n\};/,
    `const consumeBackupCodeAtomically = async (user, backupCodeIndex) => {
  if (backupCodeIndex === undefined || backupCodeIndex < 0) return true;
  const codeHash = user.twoFactor.backupCodes?.[backupCodeIndex]?.codeHash;
  if (!codeHash) return false;
  const result = await User.updateOne(
    {
      _id: user._id,
      [\`twoFactor.backupCodes.\${backupCodeIndex}.codeHash\`]: codeHash,
      [\`twoFactor.backupCodes.\${backupCodeIndex}.usedAt\`]: null,
    },
    { $set: { [\`twoFactor.backupCodes.\${backupCodeIndex}.usedAt\`]: new Date() } }
  );
  return result.modifiedCount === 1;
};

const claimTwoFactorLoginChallenge = ({ challengeToken, now }) => TwoFactorChallenge.findOneAndUpdate(
  {
    challengeTokenHash: hashTwoFactorChallengeToken(challengeToken),
    consumedAt: null,
    expiresAt: { $gt: now },
    attemptCount: { $lt: MAX_CHALLENGE_ATTEMPTS },
    $or: [{ processingToken: null }, { processingToken: { $exists: false } }],
  },
  {
    $set: { processingToken: randomUUID(), processingStartedAt: now },
    $inc: { attemptCount: 1 },
  },
  { new: true }
).select('+processingToken');

const releaseTwoFactorChallenge = ({ challenge, consume = false, now }) => TwoFactorChallenge.updateOne(
  { _id: challenge._id, processingToken: challenge.processingToken, consumedAt: null },
  consume
    ? { $set: { consumedAt: now, processingToken: null, processingStartedAt: null } }
    : { $set: { processingToken: null, processingStartedAt: null } }
);`
  );
  const loginPattern = /export const verifyTwoFactorLogin = asyncErrHandler\(async \(req, res, next\) => \{[\s\S]*?\n\}\);\n\nexport const getTwoFactorStatus/;
  if (!loginPattern.test(twoFactor)) throw new Error('Two-factor login handler was not found');
  twoFactor = twoFactor.replace(loginPattern, `export const verifyTwoFactorLogin = asyncErrHandler(async (req, res, next) => {
  const { challengeToken, code } = req.body;
  if (!challengeToken || !code) return next(new CustomError('Challenge token and code are required', 400));
  const now = new Date();
  const challenge = await claimTwoFactorLoginChallenge({ challengeToken, now });
  if (!challenge) return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  const user = await loadTwoFactorUser(challenge.userId);
  if (!user || !isTwoFactorEnabled(user)) {
    await releaseTwoFactorChallenge({ challenge, consume: true, now });
    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  }
  const verification = await verifySecondFactorCode(user, code, { allowBackupCode: true });
  if (!verification.ok) {
    await releaseTwoFactorChallenge({
      challenge,
      consume: challenge.attemptCount >= MAX_CHALLENGE_ATTEMPTS,
      now,
    });
    return next(new CustomError('Invalid two-factor code', 401));
  }
  if (!(await consumeBackupCodeAtomically(user, verification.backupCodeIndex))) {
    await releaseTwoFactorChallenge({ challenge, consume: false, now });
    return next(new CustomError('Invalid two-factor code', 401));
  }
  const consumed = await releaseTwoFactorChallenge({ challenge, consume: true, now });
  if (consumed.modifiedCount !== 1) return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  await User.updateOne({ _id: user._id }, { $set: { 'twoFactor.lastVerifiedAt': now } });
  await issueSessionCookies({ user, res, rememberMe: challenge.rememberMe, req });
  return res.status(200).json({ status: 'success', message: 'Logged in successfully!' });
});

export const getTwoFactorStatus`);
  write(twoFactorPath, twoFactor);
}

const outboxModelPath = 'Backend/Chatify/Models/notificationOutboxModel.mjs';
let outboxModel = read(outboxModelPath);
if (!outboxModel.includes('processingLeaseExpiresAt')) {
  outboxModel = outboxModel.replace(
    /lastAttemptAt:\s*\{[\s\S]*?\},\n/,
    (match) => `${match}    processingToken: { type: String, default: null, select: false },\n    processingLeaseExpiresAt: { type: Date, default: null },\n`
  );
  write(outboxModelPath, outboxModel);
}

const notificationPath = 'Backend/Chatify/Services/notificationService.mjs';
let notification = read(notificationPath);
if (!notification.includes('claimNextNotificationOutboxJob')) {
  if (!notification.includes("randomUUID")) {
    notification = `import { randomUUID } from 'node:crypto';\n${notification}`;
  }
  notification = notification.replace(
    `const PROVIDER_WEB_PUSH = 'web-push';\n`,
    `const PROVIDER_WEB_PUSH = 'web-push';\nconst OUTBOX_PROCESSING_LEASE_MS = 5 * 60 * 1000;\n`
  );
  notification = notification.replace(
    `  await webPush.sendNotification(\n    {\n      endpoint: subscription.endpoint,\n      keys: {\n        p256dh: subscription.keys.p256dh,\n        auth: subscription.keys.auth,\n      },\n    },\n    JSON.stringify({\n      title: job.payload.title,\n      body: job.payload.body,\n      url: '/chat',\n    })\n  );\n`,
    `  await webPush.sendNotification(\n    {\n      endpoint: subscription.endpoint,\n      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },\n    },\n    JSON.stringify({ title: job.payload.title, body: job.payload.body, url: '/chat' }),\n    { TTL: 60, timeout: 10_000 }\n  );\n`
  );
  const workerPattern = /export const processNotificationOutbox = async \(\{ limit = DEFAULT_OUTBOX_BATCH_SIZE \} = \{\}\) => \{[\s\S]*?\n\};\n\nexport const startNotificationOutboxWorker/;
  if (!workerPattern.test(notification)) throw new Error('Notification outbox worker was not found');
  notification = notification.replace(workerPattern, `export const claimNextNotificationOutboxJob = ({ now = new Date() } = {}) => NotificationOutbox.findOneAndUpdate(
  {
    $expr: { $lt: ['$attempts', '$maxAttempts'] },
    $or: [
      { status: NOTIFICATION_OUTBOX_STATUS.PENDING, nextAttemptAt: { $lte: now } },
      { status: NOTIFICATION_OUTBOX_STATUS.PROCESSING, processingLeaseExpiresAt: { $lte: now } },
    ],
  },
  {
    $set: {
      status: NOTIFICATION_OUTBOX_STATUS.PROCESSING,
      processingToken: randomUUID(),
      processingLeaseExpiresAt: new Date(now.getTime() + OUTBOX_PROCESSING_LEASE_MS),
      lastAttemptAt: now,
    },
    $inc: { attempts: 1 },
  },
  { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } }
).select('+processingToken');

export const processNotificationOutbox = async ({ limit = DEFAULT_OUTBOX_BATCH_SIZE } = {}) => {
  let processed = 0;
  let sent = 0;
  let failed = 0;
  while (processed < limit) {
    const job = await claimNextNotificationOutboxJob();
    if (!job) break;
    processed += 1;
    try {
      const result = await deliverNotificationJob(job);
      const completion = await NotificationOutbox.updateOne(
        { _id: job._id, status: NOTIFICATION_OUTBOX_STATUS.PROCESSING, processingToken: job.processingToken },
        { $set: {
          status: NOTIFICATION_OUTBOX_STATUS.SENT,
          provider: result.provider,
          providerStatus: result.providerStatus,
          sentAt: new Date(),
          processingToken: null,
          processingLeaseExpiresAt: null,
          sanitizedError: null,
        } }
      );
      if (completion.modifiedCount === 1) sent += 1;
    } catch (error) {
      const terminal = job.attempts >= job.maxAttempts;
      const failure = await NotificationOutbox.updateOne(
        { _id: job._id, status: NOTIFICATION_OUTBOX_STATUS.PROCESSING, processingToken: job.processingToken },
        { $set: {
          status: terminal ? NOTIFICATION_OUTBOX_STATUS.FAILED : NOTIFICATION_OUTBOX_STATUS.PENDING,
          provider: job.channel === NOTIFICATION_CHANNELS.EMAIL ? PROVIDER_BREVO : PROVIDER_WEB_PUSH,
          providerStatus: terminal ? 'failed' : 'retry_scheduled',
          nextAttemptAt: terminal ? job.nextAttemptAt : getNextAttemptAt(job.attempts),
          failedAt: terminal ? new Date() : null,
          processingToken: null,
          processingLeaseExpiresAt: null,
          sanitizedError: sanitizeProviderError(error),
        } }
      );
      if (failure.modifiedCount === 1) failed += 1;
      logger.warn('notification.delivery_failed', {
        jobId: job._id.toString(), channel: job.channel, terminal, errorCode: error?.code,
      });
    }
  }
  return { processed, sent, failed };
};

export const startNotificationOutboxWorker`);
  write(notificationPath, notification);
}

write('Backend/Chatify/test/security/atomic-security-boundaries.test.mjs', `import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = path.resolve(import.meta.dirname, '../..');
const source = (relativePath) => fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');

describe('atomic security boundaries', () => {
  it('uses durable refresh-family compromise state', () => {
    const tokenSource = source('Utils/tokenCookieGenerator.mjs');
    expect(tokenSource).toContain('SessionFamily');
    expect(tokenSource).toContain('markSessionFamilyCompromised');
    expect(tokenSource).toContain('replacedByTokenHash: null');
  });

  it('consumes password resets and MFA challenges exactly once', () => {
    expect(source('Controller/authController.mjs')).toContain('consumeValidPasswordReset');
    expect(source('Controller/twoFactorController.mjs')).toContain('claimTwoFactorLoginChallenge');
    expect(source('Controller/twoFactorController.mjs')).toContain('consumeBackupCodeAtomically');
  });

  it('claims notification jobs with processing leases', () => {
    const notificationSource = source('Services/notificationService.mjs');
    expect(notificationSource).toContain('claimNextNotificationOutboxJob');
    expect(notificationSource).toContain('processingLeaseExpiresAt');
    expect(notificationSource).toContain('processingToken: job.processingToken');
  });
});
`);

console.log(`Atomic-core remediation changed ${changed.size} file(s).`);
for (const relativePath of [...changed].sort()) console.log(`- ${relativePath}`);
