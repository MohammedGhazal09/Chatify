import { Router } from 'express';
import {createChat, getAllChats} from '../Controller/chatController.mjs';

const router = Router();

router.route('/create-new-chat').post(createChat);
router.route('/get-all-chats').get(getAllChats);

export default router;