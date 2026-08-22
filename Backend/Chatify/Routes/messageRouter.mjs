import { Router } from 'express';
import { attachmentUploadLimiter } from '../Middlewares/rateLimiters.mjs';
import privateFileResponse from '../Middlewares/privateFileResponse.mjs';
import {
  requireAttachmentMembership,
  requireBodyChatMembership,
  requireChatMembership,
  requireMessageMembership,
} from '../Middlewares/databaseAuthorization.mjs';
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
router.route('/new-message').post(
  attachmentUploadLimiter,
  parseMessageAttachments,
  requireBodyChatMembership('chatId', { statusCode: 403 }),
  newMessage
);
router.route('/get-all-messages/:id').get(requireChatMembership('id', { statusCode: 403 }), getAllMessages);
router.route('/search/:chatId').get(requireChatMembership('chatId'), searchMessages);
router.route('/context/:chatId/:messageId').get(
  requireChatMembership('chatId'),
  requireMessageMembership,
  getMessageContext
);
router.route('/batch/unread-counts').post(getBatchUnreadCounts);
router.route('/attachments/:attachmentId/preview').get(
  requireAttachmentMembership,
  privateFileResponse,
  previewAttachment
);
router.route('/attachments/:attachmentId/download').get(
  requireAttachmentMembership,
  privateFileResponse,
  downloadAttachment
);
router.route('/saved').get(listSavedMessages);
router.route('/:chatId/shared-assets').get(requireChatMembership('chatId'), listSharedAssets);
router.route('/:chatId/pinned').get(requireChatMembership('chatId'), listPinnedMessages);

// Parameterized routes after
router.route('/:messageId/read').patch(requireMessageMembership, markMessageAsRead);
router.route('/:chatId/mark-read').patch(requireChatMembership('chatId'), markMessagesAsRead);
router.route('/:chatId/unread-count').get(requireChatMembership('chatId'), getUnreadCount);
router.route('/:messageId').delete(requireMessageMembership, deleteMessage);
router.route('/:messageId/edit').patch(requireMessageMembership, editMessage);
router.route('/:messageId/reaction').post(requireMessageMembership, toggleReaction);
router.route('/:messageId/pin').post(requireMessageMembership, pinMessage).delete(requireMessageMembership, unpinMessage);
router.route('/:messageId/save').post(requireMessageMembership, saveMessage).delete(requireMessageMembership, unsaveMessage);

export default router;
