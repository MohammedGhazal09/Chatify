import { Router } from "express";
import {
  getLoggedUser,
  getAllUsers,
  getOnlineStatus,
  getOnlineUsers,
  getProfileImage,
  parseProfileImageUpload,
  removeProfileImage,
  setUsername,
  uploadProfileImage,
  updateIdentityMark,
  updatePrivacySettings,
} from "../Controller/userController.mjs";
import protect from "../Middlewares/protectRoutes.mjs";
import csrfProtection from "../Middlewares/csrfProtection.mjs";
import { profileImageUploadLimiter } from "../Middlewares/rateLimiters.mjs";

const router = Router();

router.route('/get-logged-user').get(protect, getLoggedUser)
router.route('/get-all-users').get(protect, getAllUsers)
router.route('/online-status/:userId').get(protect, getOnlineStatus)
router.route('/online-users').get(protect, getOnlineUsers)
router.route('/username').patch(protect, csrfProtection, setUsername)
router.route('/profile-image')
  .patch(protect, csrfProtection, profileImageUploadLimiter, parseProfileImageUpload, uploadProfileImage)
  .delete(protect, csrfProtection, removeProfileImage)
router.route('/:userId/profile-image').get(protect, getProfileImage)
router.route('/identity').patch(protect, csrfProtection, updateIdentityMark)
router.route('/privacy-settings').patch(protect, csrfProtection, updatePrivacySettings)

export default router;
