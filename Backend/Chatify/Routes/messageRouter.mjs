import { Router } from 'express';
import {
  newMessage,
  getAllMessages,
  markMessageAsRead,
  markMessagesAsRead,
  getUnreadCount,
} from '../Controller/messageController.mjs';

const router = Router();
router.route('/new-message').post(newMessage)
router.route('/get-all-messages/:id').get(getAllMessages)
router.route('/:messageId/read').patch(markMessageAsRead)
router.route('/:chatId/mark-read').patch(markMessagesAsRead)
router.route('/:chatId/unread-count').get(getUnreadCount)

export default router