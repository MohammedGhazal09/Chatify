import { Router } from 'express';
import {newMessage, getAllMessages } from '../Controller/messageController.mjs';

const router = Router();
router.route('/new-message').post(newMessage)
router.route('/get-all-messages/:id').get(getAllMessages)

export default router