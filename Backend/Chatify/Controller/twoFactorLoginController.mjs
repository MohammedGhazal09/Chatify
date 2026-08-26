import { createHash, randomBytes } from 'node:crypto';
import TwoFactorChallenge from '../Models/twoFactorChallengeModel.mjs';
import User from '../Models/userModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { CustomError } from '../Utils/customError.mjs';
import { withDatabaseTransaction } from '../Utils/databaseSecurity.mjs';
import {
  buildSessionMetadataFromRequest,
  safeMetadataHashEqual,
} from '../Utils/sessionMetadata.mjs';
import { issueSessionCookies } from '../Utils/tokenCookieGenerator.mjs';
import {
  decryptTwoFactorSecret,
  findMatchingBackupCodeIndex,
  findMatchingTotpCounter,
  hashTwoFactorChallengeToken,
} from '../Utils/twoFactor.mjs';
import { consumeTotpCounter } from '../Services/twoFactorReplayService.mjs';
import { isTwoFactorEnabled } from './twoFactorController.mjs';

const MAX_CHALLENGE_ATTEMPTS = 5;
const CHALLENGE_CLAIM_TTL_MS = 30 * 1000;
const GENERIC_CHALLENGE_ERROR = 'Invalid or expired two-factor challenge';
const SENSITIVE_TWO_FACTOR_SELECT = [
  '+twoFactor.secretEncrypted',
  '+twoFactor.backupCodes',
  '+twoFactor.backupCodes.codeHash',
].join(' ');

const hashClaimToken = (token) => createHash('sha256')
  .update(String(token))
  .digest('base64url');

const loadTwoFactorUser = (userId) => User.findById(userId)
  .select(SENSITIVE_TWO_FACTOR_SELECT);

const verifySecondFactorCode = async (user, code, now) => {
  if (!isTwoFactorEnabled(user)) return { ok: false };

  const secret = decryptTwoFactorSecret(user.twoFactor.secretEncrypted);
  const totpCounter = findMatchingTotpCounter(secret, code, {
    now: now.getTime(),
  });

  if (totpCounter !== null) {
    return { ok: true, method: 'totp', totpCounter };
  }

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

const claimChallenge = async ({ challengeToken }) => {
  const now = new Date();
  const claimToken = randomBytes(32).toString('base64url');
  const claimTokenHash = hashClaimToken(claimToken);
  const claimExpiresAt = new Date(now.getTime() + CHALLENGE_CLAIM_TTL_MS);
  const challenge = await TwoFactorChallenge.findOneAndUpdate(
    {
      challengeTokenHash: hashTwoFactorChallengeToken(challengeToken),
      consumedAt: null,
      expiresAt: { $gt: now },
      attemptCount: { $lt: MAX_CHALLENGE_ATTEMPTS },
      $or: [
        { verificationClaimExpiresAt: { $exists: false } },
        { verificationClaimExpiresAt: null },
        { verificationClaimExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        verificationClaimTokenHash: claimTokenHash,
        verificationClaimExpiresAt: claimExpiresAt,
      },
    },
    { new: true }
  ).select('+userAgentHash +ipHash +verificationClaimTokenHash');

  return challenge
    ? { challenge, claimTokenHash, now }
    : null;
};

const consumeChallengeClaim = ({ challengeId, claimTokenHash, now = new Date() }) => (
  TwoFactorChallenge.findOneAndUpdate(
    {
      _id: challengeId,
      consumedAt: null,
      verificationClaimTokenHash: claimTokenHash,
    },
    {
      $set: { consumedAt: now },
      $unset: {
        verificationClaimTokenHash: '',
        verificationClaimExpiresAt: '',
      },
    },
    { new: true }
  )
);

const recordFailedClaim = async ({ challengeId, claimTokenHash, now = new Date() }) => {
  const updated = await TwoFactorChallenge.findOneAndUpdate(
    {
      _id: challengeId,
      consumedAt: null,
      verificationClaimTokenHash: claimTokenHash,
    },
    {
      $inc: { attemptCount: 1 },
      $unset: {
        verificationClaimTokenHash: '',
        verificationClaimExpiresAt: '',
      },
    },
    { new: true }
  );

  if (updated?.attemptCount >= MAX_CHALLENGE_ATTEMPTS) {
    await TwoFactorChallenge.updateOne(
      {
        _id: challengeId,
        consumedAt: null,
        attemptCount: { $gte: MAX_CHALLENGE_ATTEMPTS },
      },
      { $set: { consumedAt: now } }
    );
  }
};

const consumeSuccessfulVerification = async ({
  challenge,
  claimTokenHash,
  verification,
  now,
}) => withDatabaseTransaction(async (session) => {
  const consumedChallenge = await TwoFactorChallenge.findOneAndUpdate(
    {
      _id: challenge._id,
      consumedAt: null,
      expiresAt: { $gt: now },
      verificationClaimTokenHash: claimTokenHash,
    },
    {
      $set: { consumedAt: now },
      $unset: {
        verificationClaimTokenHash: '',
        verificationClaimExpiresAt: '',
      },
    },
    { new: true, session }
  );
  if (!consumedChallenge) {
    throw new CustomError(GENERIC_CHALLENGE_ERROR, 401);
  }

  let userUpdate;
  if (verification.method === 'backup_code') {
    const usedAtPath = `twoFactor.backupCodes.${verification.backupCodeIndex}.usedAt`;
    const hashPath = `twoFactor.backupCodes.${verification.backupCodeIndex}.codeHash`;
    userUpdate = await User.updateOne(
      {
        _id: challenge.userId,
        'twoFactor.enabled': true,
        [hashPath]: verification.backupCodeHash,
        [usedAtPath]: null,
      },
      {
        $set: {
          [usedAtPath]: now,
          'twoFactor.lastVerifiedAt': now,
        },
      },
      { session }
    );
  } else {
    await consumeTotpCounter({
      userId: challenge.userId,
      counter: verification.totpCounter,
      session,
    });
    userUpdate = await User.updateOne(
      {
        _id: challenge.userId,
        'twoFactor.enabled': true,
      },
      { $set: { 'twoFactor.lastVerifiedAt': now } },
      { session }
    );
  }

  if (userUpdate.modifiedCount !== 1) {
    throw new CustomError(GENERIC_CHALLENGE_ERROR, 401);
  }

  return {
    userId: challenge.userId,
    rememberMe: challenge.rememberMe,
  };
});

export const verifyTwoFactorLogin = asyncErrHandler(async (req, res, next) => {
  const { challengeToken, code } = req.body;
  if (!challengeToken || !code) {
    return next(new CustomError('Challenge token and code are required', 400));
  }

  const claim = await claimChallenge({ challengeToken });
  if (!claim) {
    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  }

  const { challenge, claimTokenHash, now } = claim;
  const requestMetadata = buildSessionMetadataFromRequest(req);
  if (
    !safeMetadataHashEqual(challenge.userAgentHash, requestMetadata.userAgentHash)
    || !safeMetadataHashEqual(challenge.ipHash, requestMetadata.ipHash)
  ) {
    await consumeChallengeClaim({
      challengeId: challenge._id,
      claimTokenHash,
      now,
    });
    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  }

  const user = await loadTwoFactorUser(challenge.userId);
  if (!user || !isTwoFactorEnabled(user)) {
    await consumeChallengeClaim({
      challengeId: challenge._id,
      claimTokenHash,
      now,
    });
    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  }

  const verification = await verifySecondFactorCode(user, code, now);
  if (!verification.ok) {
    await recordFailedClaim({
      challengeId: challenge._id,
      claimTokenHash,
      now,
    });
    return next(new CustomError('Invalid two-factor code', 401));
  }

  let verified;
  try {
    verified = await consumeSuccessfulVerification({
      challenge,
      claimTokenHash,
      verification,
      now,
    });
  } catch (error) {
    await consumeChallengeClaim({
      challengeId: challenge._id,
      claimTokenHash,
      now: new Date(),
    });
    return next(error);
  }

  const verifiedUser = await User.findById(verified.userId);
  if (!verifiedUser) {
    return next(new CustomError(GENERIC_CHALLENGE_ERROR, 401));
  }

  await issueSessionCookies({
    user: verifiedUser,
    res,
    rememberMe: verified.rememberMe,
    req,
  });

  return res.status(200).json({
    status: 'success',
    message: 'Logged in successfully!',
  });
});
