import { Router } from 'express';
import { attachmentUploadLimiter } from '../Middlewares/rateLimiters.mjs';
import {
  buildMessageMembershipGuard,
  requireAttachmentMembership,
  requireBodyChatMembership,
  requireChatMembership,
  requireMessageMembership,
} from '../Middlewares/databaseAuthorization.mjs';
import { secureMessageAttachmentUpload } from '../Middlewares/secureUpload.mjs';
import { enforceSecureUploadDelivery } from '../Middlewares/uploadDeliverySecurity.mjs';
import {
  newMessage,
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

const privateChatSearchOptions = Object.freeze({
  unauthorizedStatusCode: 403,
  unauthorizedMessage: 'Forbidden or not found',
});

const requirePrivateMessageMembership = buildMessageMembershipGuard({
  invalidStatusCode: 404,
  invalidMessage: 'Message not found',
  missingStatusCode: 404,
  missingMessage: 'Message not found',
  unauthorizedStatusCode: 404,
  unauthorizedMessage: 'Message not found',
  concealUnauthorized: true,
});

// Static routes first
router.route('/new-message').post(
  attachmentUploadLimiter,
  secureMessageAttachmentUpload,
  requireBodyChatMembership('chatId', { statusCode: 403 }),
  newMessage
);
router.route('/get-all-messages/:id').get(requireChatMembership('id', { statusCode: 403 }), getAllMessages);
router.route('/search/:chatId').get(
  requireChatMembership('chatId', privateChatSearchOptions),
  searchMessages
);
router.route('/context/:chatId/:messageId').get(
  requireChatMembership('chatId', privateChatSearchOptions),
  requireMessageMembership,
  getMessageContext
);
router.route('/batch/unread-counts').post(getBatchUnreadCounts);
router.route('/attachments/:attachmentId/preview').get(
  requireAttachmentMembership,
  enforceSecureUploadDelivery('preview'),
  previewAttachment
);
router.route('/attachments/:attachmentId/download').get(
  requireAttachmentMembership,
  enforceSecureUploadDelivery('download'),
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
router.route('/:messageId/save')
  .post(requirePrivateMessageMembership, saveMessage)
  .delete(requirePrivateMessageMembership, unsaveMessage);

export default router;
