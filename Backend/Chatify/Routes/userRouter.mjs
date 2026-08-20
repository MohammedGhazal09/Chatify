import { Router } from "express";
import {
  getLoggedUser,
  getAllUsers,
  lookupUserByUsername,
  getOnlineStatus,
  getOnlineUsers,
  getProfileImage,
  getNotificationPreferences,
  parseProfileImageUpload,
  registerPushSubscription,
  removePushSubscription,
  removeProfileImage,
  setUsername,
  unsubscribeNotificationEmail,
  uploadProfileImage,
  updateProfile,
  updateIdentityMark,
  updateNotificationPreferences,
  updatePrivacySettings,
} from "../Controller/userController.mjs";
import {
  cancelAccountDeletion,
  exportAccountData,
  getPrivacySummary,
  requestAccountDeletion,
} from "../Controller/privacyController.mjs";
import protect from "../Middlewares/protectRoutes.mjs";
import csrfProtection from "../Middlewares/csrfProtection.mjs";
import { privacyRequestLimiter, profileImageUploadLimiter } from "../Middlewares/rateLimiters.mjs";

const router = Router();

router.route('/get-logged-user').get(protect, getLoggedUser)
router.route('/get-all-users').get(protect, getAllUsers)
router.route('/online-status/:userId').get(protect, getOnlineStatus)
router.route('/online-users').get(protect, getOnlineUsers)
router.route('/lookup/:username').get(protect, lookupUserByUsername)
router.route('/username').patch(protect, csrfProtection, setUsername)
router.route('/profile').patch(protect, csrfProtection, updateProfile)
router.route('/profile-image')
  .patch(protect, csrfProtection, profileImageUploadLimiter, parseProfileImageUpload, uploadProfileImage)
  .delete(protect, csrfProtection, removeProfileImage)
router.route('/:userId/profile-image').get(protect, getProfileImage)
router.route('/identity').patch(protect, csrfProtection, updateIdentityMark)
router.route('/privacy-settings').patch(protect, csrfProtection, updatePrivacySettings)
router.route('/privacy/summary').get(protect, getPrivacySummary)
router.route('/privacy/export').post(protect, csrfProtection, privacyRequestLimiter, exportAccountData)
router.route('/privacy/deletion-request').post(protect, csrfProtection, privacyRequestLimiter, requestAccountDeletion)
router.route('/privacy/deletion-request/cancel').post(protect, csrfProtection, privacyRequestLimiter, cancelAccountDeletion)
router.route('/notification-preferences')
  .get(protect, getNotificationPreferences)
  .patch(protect, csrfProtection, updateNotificationPreferences)
router.route('/notification-preferences/email-unsubscribe')
  .post(protect, csrfProtection, unsubscribeNotificationEmail)
router.route('/push-subscriptions')
  .post(protect, csrfProtection, registerPushSubscription)
  .delete(protect, csrfProtection, removePushSubscription)

export default router;
