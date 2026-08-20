import { Router } from "express";
import {
  signup, 
  login, 
  logout, 
  refreshToken, 
  isAuthenticated,
  listActiveSessions,
  revokeSession,
  revokeAllSessions,
  forgotPassword,
  resetPassword,
  verifyResetCode,
  finalizeOAuth
} from "../Controller/authController.mjs";
import {
  confirmTwoFactor,
  disableTwoFactor,
  getTwoFactorStatus,
  regenerateBackupCodes,
  setupTwoFactor,
  verifyTwoFactorLogin,
} from "../Controller/twoFactorController.mjs";
import { authLimiter, sessionCheckLimiter, refreshTokenLimiter } from "../Middlewares/rateLimiters.mjs";
import protect from "../Middlewares/protectRoutes.mjs";

const router = Router();

// Sensitive routes - strict rate limiting (10 req/15 min)
router.route("/signup").post(authLimiter, signup);
router.route("/login").post(authLimiter, login);
router.route("/2fa/challenge").post(authLimiter, verifyTwoFactorLogin);
router.route('/forgot-password').post(authLimiter, forgotPassword);
router.route("/verify-reset-code").post(authLimiter, verifyResetCode);
router.route("/reset-password").post(authLimiter, resetPassword);

// Session check - lenient rate limiting (60 req/min)
router.route("/is-authenticated").get(sessionCheckLimiter, isAuthenticated);

// OAuth handoff finalizes the first-party frontend cookie after provider callbacks.
router.route("/oauth/finalize").get(authLimiter, finalizeOAuth);

// Token refresh - moderate rate limiting (30 req/15 min)
router.route("/refresh-token").post(refreshTokenLimiter, refreshToken);

// Session management - protected by active session auth
router.route("/sessions").get(protect, listActiveSessions);
router.route("/sessions/revoke-all").post(protect, revokeAllSessions);
router.route("/sessions/:sessionId").delete(protect, revokeSession);

// Two-factor management - protected by active session auth and the /api/auth CSRF boundary.
router.route("/2fa/status").get(protect, getTwoFactorStatus);
router.route("/2fa/setup").post(protect, authLimiter, setupTwoFactor);
router.route("/2fa/confirm").post(protect, authLimiter, confirmTwoFactor);
router.route("/2fa/disable").post(protect, authLimiter, disableTwoFactor);
router.route("/2fa/backup-codes/regenerate").post(protect, authLimiter, regenerateBackupCodes);

// Logout - no rate limiting
router.route("/logout").post(logout);

export default router;
