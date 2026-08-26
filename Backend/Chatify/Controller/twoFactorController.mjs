import User from '../Models/userModel.mjs';
import TwoFactorChallenge from '../Models/twoFactorChallengeModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { CustomError } from '../Utils/customError.mjs';
import { issueSessionCookies, revokeOtherSessionsForUser } from '../Utils/tokenCookieGenerator.mjs';
import { buildSessionMetadataFromRequest, safeMetadataHashEqual } from '../Utils/sessionMetadata.mjs';
import {
  claimTotpCounter,
  clearTotpCounterState,
} from '../Services/twoFactorCounterService.mjs';
import {
  buildOtpAuthUrl,
  createBackupCodeSet,
  createTwoFactorChallengeToken,
  decryptTwoFactorSecret,
  encryptTwoFactorSecret,
  findMatchingBackupCodeIndex,
  findMatchingTotpCounter,
  generateTwoFactorSecret,
  hashTwoFactorChallengeToken,
  normalizeTotpCode,
  verifyTotpCode,
} from '../Utils/twoFactor.mjs';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const CHALLENGE_CLAIM_TTL_MS = 30 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 5;
const PENDING_SETUP_TTL_MS = 10 * 60 * 1000;
const GENERIC_CHALLENGE_ERROR = 'Invalid or expired two-factor challenge';
const SENSITIVE_TWO_FACTOR_SELECT = [
  '+password',
  '+twoFactor.secretEncrypted',
  '+twoFactor.pendingSecretEncrypted',
  '+twoFactor.pendingCreatedAt',
  '+twoFactor.backupCodes',
  '+twoFactor.backupCodes.codeHash',
].join(' ');

export const isTwoFactorEnabled = (user) => Boolean(
  user?.twoFactor?.enabled &&
  user.twoFactor?.secretEncrypted?.ciphertext
);

const isPendingSetupFresh = (user, now = new Date()) => {
  const pendingCreatedAt = user?.twoFactor?.pendingCreatedAt;

  return Boolean(
    user?.twoFactor?.pendingSecretEncrypted?.ciphertext &&
    pendingCreatedAt instanceof Date &&
    now.getTime() - pendingCreatedAt.getTime() <= PENDING_SETUP_TTL_MS
  );
};

const getBackupCodesRemaining = (user) => (
  user?.twoFactor?.backupCodes ?? []
).filter((backupCode) => !backupCode.usedAt).length;

const serializeTwoFactorStatus = (user) => ({
  enabled: Boolean(user?.twoFactor?.enabled),
  available: user?.authProvider === 'local',
  backupCodesRemaining: user?.twoFactor?.enabled ? getBackupCodesRemaining(user) : 0,
  pendingSetup: isPendingSetupFresh(user),
});

const loadTwoFactorUser = async (userId) => User.findById(userId).select(SENSITIVE_TWO_FACTOR_SELECT);

const requireCurrentPassword = async (user, currentPassword) => {
  if (user.authProvider !== 'local') {
    throw new CustomError('Two-factor authentication is available for password accounts only', 400);
  }

  if (!currentPassword) {
    throw new CustomError('Current password is required', 400);
  }

  if (!(await user.checkPassword(currentPassword))) {
    throw new CustomError('Current password is incorrect', 401);
  }
};

const clearPendingSetup = (user) => {
  user.set('twoFactor.pendingSecretEncrypted', undefined);
  user.set('twoFactor.pendingCreatedAt', undefined);
};

const clearTwoFactor = (user) => {
  user.set('twoFactor.enabled', false);
  user.set('twoFactor.secretEncrypted', undefined);
  user.set('twoFactor.pendingSecretEncrypted', undefined);
  user.set('twoFactor.pendingCreatedAt', undefined);
  user.set('twoFactor.backupCodes', undefined);
  user.set('twoFactor.enabledAt', undefined);
  user.set('twoFactor.lastVerifiedAt', undefined);
};

const verifySecondFactorCode = async (user, code, { allowBackupCode = true } = {}) => {
  if (!isTwoFactorEnabled(user)) {
    return { ok: false };
  }

  const secret = decryptTwoFactorSecret(user.twoFactor.secretEncrypted);
  const totpCounter = findMatchingTotpCounter(secret, normalizeTotpCode(code));

  if (totpCounter !== null) {
    return { ok: true, method: 'totp', totpCounter };
  }

  if (!allowBackupCode) {
    return { ok: false };
  }

  const backupCodeIndex = await findMatchingBackupCodeIndex(user.twoFactor.backupCodes, code);

  if (backupCodeIndex >= 0) {
    return { ok: true, method: 'backup_code', backupCodeIndex };
  }

  return { ok: false };
};

const claimLoginChallenge = async ({ challengeToken, now }) => {
  const verificationClaimToken = createTwoFactorChallengeToken();
  const verificationClaimTokenHash = hashTwoFactorChallengeToken(verificationClaimToken);
  const challenge = await TwoFactorChallenge.findOneAndUpdate(
    {
      challengeTokenHash: hashTwoFactorChallengeToken(challengeToken),
      consumedAt: null,
      expiresAt: { $gt: now },
      attemptCount: { $lt: MAX_CHALLENGE_ATTEMPTS },
      $or: [
        { verificationClaimExpiresAt: null },
        { verificationClaimExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        verificationClaimTokenHash,
        verificationClaimExpiresAt: new Date(now.getTime() + CHALLENGE_CLAIM_TTL_MS),
      },
    },
    { new: true }
  ).select('+userAgentHash +ipHash');

  return { challenge, verificationClaimTokenHash };
};

const consumeChallengeClaim = ({ challengeId, verificationClaimTokenHash, now }) => (
  TwoFactorChallenge.findOneAndUpdate(
    {
      _id: challengeId,
      consumedAt: null,
      verificationClaimTokenHash,
      verificationClaimExpiresAt: { $gt: now },
    },
    {
      $set: {
        consumedAt: now,
        verificationClaimTokenHash: null,
        verificationClaimExpiresAt: null,
      },
    },
    { new: true }
  )
);

const recordInvalidChallengeClaim = async ({ challengeId, verificationClaimTokenHash, now }) => {
  const challenge = await TwoFactorChallenge.findOneAndUpdate(
    {
      _id: challengeId,
      consumedAt: null,
      verificationClaimTokenHash,
      verificationClaimExpiresAt: { $gt: now },
    },
    {
      $inc: { attemptCount: 1 },
      $set: {
        verificationClaimTokenHash: null,
        verificationClaimExpiresAt: null,
      },
    },
    { new: true }
  );

  if (challenge?.attemptCount >= MAX_CHALLENGE_ATTEMPTS) {
    await TwoFactorChallenge.updateOne(
      { _id: challenge._id, consumedAt: null },
      { $set: { consumedAt: now } }
    );
  }
};

const currentSecretFilter = (user) => ({
  _id: user._id,
  'twoFactor.enabled': true,
  'twoFactor.secretEncrypted.ciphertext': user.twoFactor.secretEncrypted.ciphertext,
});

const consumeLoginFactor = async ({ user, verification, now }) => {
  if (verification.method === 'totp') {
    const counterClaimed = await claimTotpCounter({
      userId: user._id,
      counter: verification.totpCounter,
    });

    if (!counterClaimed) return null;

    return User.findOneAndUpdate(
      currentSecretFilter(user),
      { $set: { 'twoFactor.lastVerifiedAt': now } },
      { new: true }
    ).select(SENSITIVE_TWO_FACTOR_SELECT);
  }

  const index = verification.backupCodeIndex;
  const backupCode = user.twoFactor.backupCodes?.[index];
  if (!backupCode?.codeHash || backupCode.usedAt) return null;

  const usedAtPath = `twoFactor.backupCodes.${index}.usedAt`;
  const codeHashPath = `twoFactor.backupCodes.${index}.codeHash`;

  return User.findOneAndUpdate(
    {
      ...currentSecretFilter(user),
      [usedAtPath]: null,
      [codeHashPath]: backupCode.codeHash,
    },
    {
      $set: {
        [usedAtPath]: now,
        'twoFactor.lastVerifiedAt': now,
      },
    },
    { new: true }
  ).select(SENSITIVE_TWO_FACTOR_SELECT);
};

export const createTwoFactorLoginChallenge = async ({ user, rememberMe = false, req = null }) => {
  const now = new Date();
  const challengeToken = createTwoFactorChallengeToken();
  const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_MS);
  const metadata = buildSessionMetadataFromRequest(req);

  await TwoFactorChallenge.updateMany(
    {
      userId: user._id,
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        consumedAt: now,
        verificationClaimTokenHash: null,
        verificationClaimExpiresAt: null,
      },
    }
  );

  await TwoFactorChallenge.create({
    userId: user._id,
    challengeTokenHash: hashTwoFactorChallengeToken(challengeToken),
    rememberMe: Boolean(rememberMe),
    userAgentHash: metadata.userAgentHash,
    ipHash: metadata.ipHash,
    attemptCount: 0,
    expiresAt,
  });

  return {
    challengeToken,
    expiresAt,
  };
};

export const verifyTwoFactorLogin = asyncErrHandler(async (req, res, next) => {
  const { challengeToken, code } = req.body;

  if (!challengeToken || !code) {
    return next(new CustomError('Challenge token and code are required', 400));
  }

  const now = new Date();
  const {
    challenge,
    verificationClaimTokenHash,
  } = await claimLoginChallenge({ challengeToken, now });

  if (!challenge) {
    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  }

  const requestMetadata = buildSessionMetadataFromRequest(req);
  if (
    !safeMetadataHashEqual(challenge.userAgentHash, requestMetadata.userAgentHash) ||
    !safeMetadataHashEqual(challenge.ipHash, requestMetadata.ipHash)
  ) {
    await consumeChallengeClaim({
      challengeId: challenge._id,
      verificationClaimTokenHash,
      now,
    });
    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  }

  const user = await loadTwoFactorUser(challenge.userId);

  if (!user || !isTwoFactorEnabled(user)) {
    await consumeChallengeClaim({
      challengeId: challenge._id,
      verificationClaimTokenHash,
      now,
    });
    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  }

  const verification = await verifySecondFactorCode(user, code, { allowBackupCode: true });

  if (!verification.ok) {
    await recordInvalidChallengeClaim({
      challengeId: challenge._id,
      verificationClaimTokenHash,
      now,
    });
    return next(new CustomError('Invalid two-factor code', 401));
  }

  // Claim the one-time challenge before consuming the factor or issuing a session. A
  // parallel request may verify the same code in memory, but only one can cross this
  // atomic database boundary.
  const consumedChallenge = await consumeChallengeClaim({
    challengeId: challenge._id,
    verificationClaimTokenHash,
    now,
  });
  if (!consumedChallenge) {
    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  }

  const updatedUser = await consumeLoginFactor({ user, verification, now });
  if (!updatedUser) {
    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  }

  await issueSessionCookies({
    user: updatedUser,
    res,
    rememberMe: consumedChallenge.rememberMe,
    req,
  });

  return res.status(200).json({
    status: 'success',
    message: 'Logged in successfully!',
  });
});

export const getTwoFactorStatus = asyncErrHandler(async (req, res, next) => {
  const user = await loadTwoFactorUser(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  return res.status(200).json({
    status: 'success',
    data: {
      twoFactor: serializeTwoFactorStatus(user),
    },
  });
});

export const setupTwoFactor = asyncErrHandler(async (req, res, next) => {
  const { currentPassword } = req.body;
  const user = await loadTwoFactorUser(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  await requireCurrentPassword(user, currentPassword);

  if (isTwoFactorEnabled(user)) {
    return next(new CustomError('Two-factor authentication is already enabled', 409));
  }

  const secret = generateTwoFactorSecret();
  const pendingCreatedAt = new Date();

  user.set('twoFactor.pendingSecretEncrypted', encryptTwoFactorSecret(secret));
  user.set('twoFactor.pendingCreatedAt', pendingCreatedAt);
  await user.save();

  return res.status(200).json({
    status: 'success',
    data: {
      setup: {
        secret,
        otpauthUrl: buildOtpAuthUrl({ email: user.email, secret }),
        expiresAt: new Date(pendingCreatedAt.getTime() + PENDING_SETUP_TTL_MS).toISOString(),
      },
      twoFactor: serializeTwoFactorStatus(user),
    },
  });
});

export const confirmTwoFactor = asyncErrHandler(async (req, res, next) => {
  const { code } = req.body;
  const now = new Date();
  const user = await loadTwoFactorUser(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  if (isTwoFactorEnabled(user)) {
    return next(new CustomError('Two-factor authentication is already enabled', 409));
  }

  if (!isPendingSetupFresh(user, now)) {
    clearPendingSetup(user);
    await user.save();
    return next(new CustomError('Two-factor setup has expired. Start setup again.', 400));
  }

  const pendingSecret = decryptTwoFactorSecret(user.twoFactor.pendingSecretEncrypted);

  if (!verifyTotpCode(pendingSecret, code)) {
    return next(new CustomError('Invalid two-factor code', 400));
  }

  const backupCodeSet = await createBackupCodeSet();

  user.set('twoFactor.enabled', true);
  user.set('twoFactor.secretEncrypted', user.twoFactor.pendingSecretEncrypted);
  user.set('twoFactor.backupCodes', backupCodeSet.records);
  user.set('twoFactor.enabledAt', now);
  user.set('twoFactor.lastVerifiedAt', now);
  clearPendingSetup(user);
  await user.save();
  await clearTotpCounterState(user._id);

  await revokeOtherSessionsForUser({ userId: user._id, currentSessionId: req.sessionId });

  return res.status(200).json({
    status: 'success',
    data: {
      backupCodes: backupCodeSet.codes,
      twoFactor: serializeTwoFactorStatus(user),
    },
  });
});

export const disableTwoFactor = asyncErrHandler(async (req, res, next) => {
  const { currentPassword, code } = req.body;
  const user = await loadTwoFactorUser(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  await requireCurrentPassword(user, currentPassword);

  if (!isTwoFactorEnabled(user)) {
    return next(new CustomError('Two-factor authentication is not enabled', 400));
  }

  const verification = await verifySecondFactorCode(user, code, { allowBackupCode: true });

  if (!verification.ok) {
    return next(new CustomError('Invalid two-factor code', 401));
  }

  if (
    verification.method === 'totp' &&
    !(await claimTotpCounter({ userId: user._id, counter: verification.totpCounter }))
  ) {
    return next(new CustomError('Invalid two-factor code', 401));
  }

  clearTwoFactor(user);
  await user.save();
  await clearTotpCounterState(user._id);

  await revokeOtherSessionsForUser({ userId: user._id, currentSessionId: req.sessionId });

  return res.status(200).json({
    status: 'success',
    data: {
      twoFactor: serializeTwoFactorStatus(user),
    },
  });
});

export const regenerateBackupCodes = asyncErrHandler(async (req, res, next) => {
  const { currentPassword, code } = req.body;
  const user = await loadTwoFactorUser(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  await requireCurrentPassword(user, currentPassword);

  if (!isTwoFactorEnabled(user)) {
    return next(new CustomError('Two-factor authentication is not enabled', 400));
  }

  const verification = await verifySecondFactorCode(user, code, { allowBackupCode: false });

  if (
    !verification.ok ||
    !(await claimTotpCounter({ userId: user._id, counter: verification.totpCounter }))
  ) {
    return next(new CustomError('Invalid two-factor code', 401));
  }

  const backupCodeSet = await createBackupCodeSet();

  user.set('twoFactor.backupCodes', backupCodeSet.records);
  user.set('twoFactor.lastVerifiedAt', new Date());
  await user.save();

  await revokeOtherSessionsForUser({ userId: user._id, currentSessionId: req.sessionId });

  return res.status(200).json({
    status: 'success',
    data: {
      backupCodes: backupCodeSet.codes,
      twoFactor: serializeTwoFactorStatus(user),
    },
  });
});
