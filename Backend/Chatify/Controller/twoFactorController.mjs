import User from '../Models/userModel.mjs';
import TwoFactorChallenge from '../Models/twoFactorChallengeModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { CustomError } from '../Utils/customError.mjs';
import { withDatabaseTransaction } from '../Utils/databaseSecurity.mjs';
import { revokeOtherSessionsForUser } from '../Utils/tokenCookieGenerator.mjs';
import { buildSessionMetadataFromRequest } from '../Utils/sessionMetadata.mjs';
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
} from '../Utils/twoFactor.mjs';
import {
  clearTotpReplayState,
  consumeTotpCounter,
} from '../Services/twoFactorReplayService.mjs';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const PENDING_SETUP_TTL_MS = 10 * 60 * 1000;
const SENSITIVE_TWO_FACTOR_SELECT = [
  '+password',
  '+twoFactor.secretEncrypted',
  '+twoFactor.pendingSecretEncrypted',
  '+twoFactor.pendingCreatedAt',
  '+twoFactor.backupCodes',
  '+twoFactor.backupCodes.codeHash',
].join(' ');

export const isTwoFactorEnabled = (user) => Boolean(
  user?.twoFactor?.enabled
  && user.twoFactor?.secretEncrypted?.ciphertext
);

const isPendingSetupFresh = (user, now = new Date()) => {
  const pendingCreatedAt = user?.twoFactor?.pendingCreatedAt;

  return Boolean(
    user?.twoFactor?.pendingSecretEncrypted?.ciphertext
    && pendingCreatedAt instanceof Date
    && now.getTime() - pendingCreatedAt.getTime() <= PENDING_SETUP_TTL_MS
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

const loadTwoFactorUser = (userId) => User.findById(userId)
  .select(SENSITIVE_TWO_FACTOR_SELECT);

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

const verifySecondFactorCode = async (
  user,
  code,
  { allowBackupCode = true, now = new Date() } = {}
) => {
  if (!isTwoFactorEnabled(user)) return { ok: false };

  const secret = decryptTwoFactorSecret(user.twoFactor.secretEncrypted);
  const totpCounter = findMatchingTotpCounter(secret, code, {
    now: now.getTime(),
  });

  if (totpCounter !== null) {
    return { ok: true, method: 'totp', totpCounter };
  }

  if (!allowBackupCode) return { ok: false };

  const backupCodeIndex = await findMatchingBackupCodeIndex(
    user.twoFactor.backupCodes,
    code
  );
  if (backupCodeIndex < 0) return { ok: false };

  return {
    ok: true,
    method: 'backup_code',
    backupCodeIndex,
    backupCodeHash: user.twoFactor.backupCodes[backupCodeIndex]?.codeHash,
  };
};

const buildBackupCodeFilter = (verification) => {
  if (verification.method !== 'backup_code') return {};

  const usedAtPath = `twoFactor.backupCodes.${verification.backupCodeIndex}.usedAt`;
  const hashPath = `twoFactor.backupCodes.${verification.backupCodeIndex}.codeHash`;
  return {
    [hashPath]: verification.backupCodeHash,
    [usedAtPath]: null,
  };
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
    { $set: { consumedAt: now } }
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

  return { challengeToken, expiresAt };
};

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
  const matchingCounter = findMatchingTotpCounter(pendingSecret, code, {
    now: now.getTime(),
  });

  if (matchingCounter === null) {
    return next(new CustomError('Invalid two-factor code', 400));
  }

  const backupCodeSet = await createBackupCodeSet();
  const updated = await withDatabaseTransaction(async (session) => {
    await clearTotpReplayState({ userId: user._id, session });

    return User.updateOne(
      {
        _id: user._id,
        'twoFactor.enabled': { $ne: true },
        'twoFactor.pendingCreatedAt': user.twoFactor.pendingCreatedAt,
        'twoFactor.pendingSecretEncrypted.ciphertext': user.twoFactor.pendingSecretEncrypted.ciphertext,
      },
      {
        $set: {
          'twoFactor.enabled': true,
          'twoFactor.secretEncrypted': user.twoFactor.pendingSecretEncrypted,
          'twoFactor.backupCodes': backupCodeSet.records,
          'twoFactor.enabledAt': now,
          'twoFactor.lastVerifiedAt': now,
        },
        $unset: {
          'twoFactor.pendingSecretEncrypted': '',
          'twoFactor.pendingCreatedAt': '',
        },
      },
      { session }
    );
  });

  if (updated.modifiedCount !== 1) {
    return next(new CustomError('Two-factor setup changed. Start setup again.', 409));
  }

  await revokeOtherSessionsForUser({
    userId: user._id,
    currentSessionId: req.sessionId,
  });
  const refreshedUser = await loadTwoFactorUser(user._id);

  return res.status(200).json({
    status: 'success',
    data: {
      backupCodes: backupCodeSet.codes,
      twoFactor: serializeTwoFactorStatus(refreshedUser),
    },
  });
});

export const disableTwoFactor = asyncErrHandler(async (req, res, next) => {
  const { currentPassword, code } = req.body;
  const now = new Date();
  const user = await loadTwoFactorUser(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  await requireCurrentPassword(user, currentPassword);

  if (!isTwoFactorEnabled(user)) {
    return next(new CustomError('Two-factor authentication is not enabled', 400));
  }

  const verification = await verifySecondFactorCode(user, code, {
    allowBackupCode: true,
    now,
  });

  if (!verification.ok) {
    return next(new CustomError('Invalid two-factor code', 401));
  }

  const updated = await withDatabaseTransaction(async (session) => {
    if (verification.method === 'totp') {
      await consumeTotpCounter({
        userId: user._id,
        counter: verification.totpCounter,
        session,
      });
    }

    const result = await User.updateOne(
      {
        _id: user._id,
        'twoFactor.enabled': true,
        ...buildBackupCodeFilter(verification),
      },
      {
        $set: { 'twoFactor.enabled': false },
        $unset: {
          'twoFactor.secretEncrypted': '',
          'twoFactor.pendingSecretEncrypted': '',
          'twoFactor.pendingCreatedAt': '',
          'twoFactor.backupCodes': '',
          'twoFactor.enabledAt': '',
          'twoFactor.lastVerifiedAt': '',
        },
      },
      { session }
    );

    if (result.modifiedCount !== 1) {
      throw new CustomError('Invalid or already used two-factor code', 401);
    }

    await clearTotpReplayState({ userId: user._id, session });
    return result;
  });

  if (updated.modifiedCount !== 1) {
    return next(new CustomError('Invalid or already used two-factor code', 401));
  }

  await revokeOtherSessionsForUser({
    userId: user._id,
    currentSessionId: req.sessionId,
  });
  const refreshedUser = await loadTwoFactorUser(user._id);

  return res.status(200).json({
    status: 'success',
    data: {
      twoFactor: serializeTwoFactorStatus(refreshedUser),
    },
  });
});

export const regenerateBackupCodes = asyncErrHandler(async (req, res, next) => {
  const { currentPassword, code } = req.body;
  const now = new Date();
  const user = await loadTwoFactorUser(req.userId);

  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  await requireCurrentPassword(user, currentPassword);

  if (!isTwoFactorEnabled(user)) {
    return next(new CustomError('Two-factor authentication is not enabled', 400));
  }

  const verification = await verifySecondFactorCode(user, code, {
    allowBackupCode: false,
    now,
  });

  if (!verification.ok) {
    return next(new CustomError('Invalid two-factor code', 401));
  }

  const backupCodeSet = await createBackupCodeSet();
  const updated = await withDatabaseTransaction(async (session) => {
    await consumeTotpCounter({
      userId: user._id,
      counter: verification.totpCounter,
      session,
    });

    const result = await User.updateOne(
      {
        _id: user._id,
        'twoFactor.enabled': true,
      },
      {
        $set: {
          'twoFactor.backupCodes': backupCodeSet.records,
          'twoFactor.lastVerifiedAt': now,
        },
      },
      { session }
    );

    if (result.modifiedCount !== 1) {
      throw new CustomError('Invalid or already used two-factor code', 401);
    }

    return result;
  });

  if (updated.modifiedCount !== 1) {
    return next(new CustomError('Invalid or already used two-factor code', 401));
  }

  await revokeOtherSessionsForUser({
    userId: user._id,
    currentSessionId: req.sessionId,
  });
  const refreshedUser = await loadTwoFactorUser(user._id);

  return res.status(200).json({
    status: 'success',
    data: {
      backupCodes: backupCodeSet.codes,
      twoFactor: serializeTwoFactorStatus(refreshedUser),
    },
  });
});
