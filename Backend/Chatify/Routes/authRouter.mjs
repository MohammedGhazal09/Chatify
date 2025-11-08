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
const router = Router();


router.route("/signup").post( signup);
router.route("/login").post( login);
router.route("/logout").post( logout);
router.route("/refresh-token").post(refreshToken);
router.route("/is-authenticated").get(isAuthenticated)
router.route('/forgot-password').post(forgotPassword)
router.route("/verify-reset-code").post(verifyResetCode);
router.route("/reset-password").post(resetPassword);

export default router;