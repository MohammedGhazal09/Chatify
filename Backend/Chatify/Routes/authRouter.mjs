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
import { authLimiter, sessionCheckLimiter, refreshTokenLimiter } from "../Middlewares/rateLimiters.mjs";
import protect from "../Middlewares/protectRoutes.mjs";

const router = Router();

// Sensitive routes - strict rate limiting (10 req/15 min)
router.route("/signup").post(authLimiter, signup);
router.route("/login").post(authLimiter, login);
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

// Logout - no rate limiting
router.route("/logout").post(logout);

export default router;
