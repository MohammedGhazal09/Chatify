import { Router } from 'express';
import {newMessage, getAllMessages } from '../Controller/messageController.mjs';

const router = Router();
router.route('/new-message').post(newMessage)
router.route('/get-all-messages').get(getAllMessages)

export default router