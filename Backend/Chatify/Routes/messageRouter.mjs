import { Router } from 'express';
import { attachmentUploadLimiter } from '../Middlewares/rateLimiters.mjs';
import {
  newMessage,
  parseMessageAttachments,
  getAllMessages,
  searchMessages,
  getMessageContext,
  previewAttachment,
  downloadAttachment,
  listSharedAssets,
  listPinnedMessages,
  listSavedMessages,
  pinMessage,
  saveMessage,
  unsaveMessage,
  unpinMessage,
  markMessageAsRead,
  markMessagesAsRead,
  getUnreadCount,
  getBatchUnreadCounts,
  deleteMessage,
  editMessage,
  toggleReaction,
} from '../Controller/messageController.mjs';

const router = Router();

// Static routes first
router.route('/new-message').post(attachmentUploadLimiter, parseMessageAttachments, newMessage)
router.route('/get-all-messages/:id').get(getAllMessages)
router.route('/search/:chatId').get(searchMessages)
router.route('/context/:chatId/:messageId').get(getMessageContext)
router.route('/batch/unread-counts').post(getBatchUnreadCounts)
router.route('/attachments/:attachmentId/preview').get(previewAttachment)
router.route('/attachments/:attachmentId/download').get(downloadAttachment)
router.route('/saved').get(listSavedMessages)
router.route('/:chatId/shared-assets').get(listSharedAssets)
router.route('/:chatId/pinned').get(listPinnedMessages)

// Parameterized routes after
router.route('/:messageId/read').patch(markMessageAsRead)
router.route('/:chatId/mark-read').patch(markMessagesAsRead)
router.route('/:chatId/unread-count').get(getUnreadCount)
router.route('/:messageId').delete(deleteMessage)
router.route('/:messageId/edit').patch(editMessage)
router.route('/:messageId/reaction').post(toggleReaction)
router.route('/:messageId/pin').post(pinMessage).delete(unpinMessage)
router.route('/:messageId/save').post(saveMessage).delete(unsaveMessage)

export default router
