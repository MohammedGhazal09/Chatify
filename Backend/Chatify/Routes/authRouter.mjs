import { Router } from "express";
import {
  signup, 
  login, 
  logout, 
  refreshToken, 
  isAuthenticated,
  forgotPassword,
  resetPassword,
  verifyResetCode
} from "../Controller/authController.mjs";
import { authLimiter, sessionCheckLimiter, refreshTokenLimiter } from "../Middlewares/rateLimiters.mjs";

const router = Router();

// Sensitive routes - strict rate limiting (10 req/15 min)
router.route("/signup").post(authLimiter, signup);
router.route("/login").post(authLimiter, login);
router.route('/forgot-password').post(authLimiter, forgotPassword);
router.route("/verify-reset-code").post(authLimiter, verifyResetCode);
router.route("/reset-password").post(authLimiter, resetPassword);

// Session check - lenient rate limiting (60 req/min)
router.route("/is-authenticated").get(sessionCheckLimiter, isAuthenticated);

// Token refresh - moderate rate limiting (30 req/15 min)
router.route("/refresh-token").post(refreshTokenLimiter, refreshToken);

// Logout - no rate limiting
router.route("/logout").post(logout);

export default router;