import { Router } from 'express';
import {
  newMessage,
  getAllMessages,
  searchMessages,
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
router.route('/new-message').post(newMessage)
router.route('/get-all-messages/:id').get(getAllMessages)
router.route('/search/:chatId').get(searchMessages)
router.route('/batch/unread-counts').post(getBatchUnreadCounts)

// Parameterized routes after
router.route('/:messageId/read').patch(markMessageAsRead)
router.route('/:chatId/mark-read').patch(markMessagesAsRead)
router.route('/:chatId/unread-count').get(getUnreadCount)
router.route('/:messageId').delete(deleteMessage)
router.route('/:messageId/edit').patch(editMessage)
router.route('/:messageId/reaction').post(toggleReaction)

export default router
