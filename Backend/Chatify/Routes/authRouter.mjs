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
import {csrfProtection} from "../app.mjs";
const router = Router();


router.route("/signup").post(csrfProtection, signup);
router.route("/login").post(csrfProtection, login);
router.route("/logout").post(logout);
router.route("/refresh-token").post(refreshToken);
router.route("/is-authenticated").get(isAuthenticated);
router.route('/forgot-password').post(csrfProtection, forgotPassword);
router.route("/verify-reset-code").post(csrfProtection, verifyResetCode);
router.route("/reset-password").post(csrfProtection, resetPassword);

export default router;