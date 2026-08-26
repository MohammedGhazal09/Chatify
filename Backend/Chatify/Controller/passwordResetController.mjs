import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import PasswordReset from '../Models/passwordResetModel.mjs';
import User from '../Models/userModel.mjs';
import { sendPasswordResetEmail } from '../Services/emailService.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { assertPasswordPolicy, normalizeEmail } from '../Utils/authIdentity.mjs';
import { CustomError } from '../Utils/customError.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';
import {
  clearSessionCookies,
  revokeRefreshSessionsForUser,
} from '../Utils/tokenCookieGenerator.mjs';

const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const RESET_RESPONSE_MESSAGE = 'If an account with that email exists, a reset code has been sent';

const generateResetCode = () => randomInt(100000, 1000000).toString();

const getPasswordResetSecret = () => {
  const secret = process.env.PASSWORD_RESET_SECRET;
  if (!secret) {
    throw new CustomError('Password reset is temporarily unavailable', 500);
  }
  return secret;
};

const hashPasswordResetCode = (code) => createHmac('sha256', getPasswordResetSecret())
  .update(String(code))
  .digest('base64url');

const safeHashEqual = (left, right) => {
  const leftBuffer = Buffer.from(left ?? '');
  const rightBuffer = Buffer.from(right ?? '');
  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer);
};

const recordFailedResetAttempt = async ({ resetId, now = new Date() }) => {
  const updated = await PasswordReset.findOneAndUpdate(
    {
      _id: resetId,
      expiresAt: { $gt: now },
      attempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS },
    },
    { $inc: { attempts: 1 } },
    { new: true }
  );

  if (updated?.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
    await PasswordReset.deleteOne({
      _id: updated._id,
      attempts: { $gte: PASSWORD_RESET_MAX_ATTEMPTS },
    });
  }
};

const findValidPasswordReset = async ({ email, code }) => {
  const now = new Date();
  const resetToken = await PasswordReset
    .findOne({
      email,
      expiresAt: { $gt: now },
      attempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS },
    })
    .sort({ createdAt: -1 });

  if (!resetToken) return null;

  const codeHash = hashPasswordResetCode(code);
  if (!safeHashEqual(resetToken.tokenHash, codeHash)) {
    await recordFailedResetAttempt({ resetId: resetToken._id, now });
    return null;
  }

  return resetToken;
};

export const forgotPassword = asyncErrHandler(async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  if (!email) {
    return next(new CustomError('Please provide your email', 400));
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(200).json({
      status: 'success',
      message: RESET_RESPONSE_MESSAGE,
    });
  }

  await PasswordReset.deleteMany({ userId: user._id });
  const resetCode = generateResetCode();
  await PasswordReset.create({
    userId: user._id,
    email: user.email,
    tokenHash: hashPasswordResetCode(resetCode),
    attempts: 0,
  });

  try {
    await sendPasswordResetEmail(user.email, resetCode);
  } catch (error) {
    logger.error('auth.password_reset_notification_failed', {
      userId: user._id.toString(),
      code: error?.code,
      status: error?.response?.status,
      error,
    });
    return next(new CustomError('Failed to send reset email. Please try again.', 500));
  }

  return res.status(200).json({
    status: 'success',
    message: RESET_RESPONSE_MESSAGE,
  });
});

export const verifyResetCode = asyncErrHandler(async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  const { code } = req.body;
  if (!email || !code) {
    return next(new CustomError('Please provide email and reset code', 400));
  }

  const resetToken = await findValidPasswordReset({ email, code });
  if (!resetToken) {
    return next(new CustomError('Invalid or expired reset code', 400));
  }

  return res.status(200).json({
    status: 'success',
    message: 'Code verified successfully',
  });
});

export const resetPassword = asyncErrHandler(async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  const { code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return next(new CustomError('Please provide email, reset code and new password', 400));
  }

  assertPasswordPolicy(newPassword);
  const matchedResetToken = await findValidPasswordReset({ email, code });
  if (!matchedResetToken) {
    return next(new CustomError('Invalid or expired reset code', 400));
  }

  const resetToken = await PasswordReset.findOneAndDelete({
    _id: matchedResetToken._id,
    email,
    tokenHash: matchedResetToken.tokenHash,
    attempts: { $lt: PASSWORD_RESET_MAX_ATTEMPTS },
    expiresAt: { $gt: new Date() },
  });
  if (!resetToken) {
    return next(new CustomError('Invalid or expired reset code', 400));
  }

  const user = await User.findById(resetToken.userId);
  if (!user) {
    return next(new CustomError('User not found', 404));
  }

  user.password = newPassword;
  await user.save();
  await revokeRefreshSessionsForUser(user._id);
  clearSessionCookies(res);

  return res.status(200).json({
    status: 'success',
    message: 'Password reset successfully',
  });
});
