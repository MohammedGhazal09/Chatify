import { Router } from "express";
import {
  getLoggedUser,
  getAllUsers,
  getOnlineStatus,
  getOnlineUsers,
  updatePrivacySettings,
} from "../Controller/userController.mjs";
import protect from "../Middlewares/protectRoutes.mjs";

const router = Router();

router.route('/get-logged-user').get(protect, getLoggedUser)
router.route('/get-all-users').get(protect, getAllUsers)
router.route('/online-status/:userId').get(protect, getOnlineStatus)
router.route('/online-users').get(protect, getOnlineUsers)
router.route('/privacy-settings').patch(protect, updatePrivacySettings)

export default router;