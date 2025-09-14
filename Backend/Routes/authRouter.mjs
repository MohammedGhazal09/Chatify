import { Router } from "express";
import {signup, login, logout, refreshToken, isAuthenticated } from "../Controller/authController.mjs";
const router = Router();


router.route("/signup").post( signup);
router.route("/login").post( login);
router.route("/logout").post( logout);
router.route("/refresh-token").post(refreshToken);
router.route("/is-authenticated").get(isAuthenticated)

export default router;