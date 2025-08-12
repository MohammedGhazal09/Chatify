import { Router } from "express";
import csurf from "csurf";
import {signup, login, logout } from "../Controller/authController.mjs";
const router = Router();
const isProd = process.env.NODE_ENV === 'production';
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  },
});

router.route("/signup").post(csrfProtection, signup);
router.route("/login").post(csrfProtection, login);
router.route("/logout").post(csrfProtection, logout);

export default router;