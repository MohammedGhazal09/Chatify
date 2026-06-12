import { Router } from 'express';
import {createChat, getAllChats, deleteChat} from '../Controller/chatController.mjs';

const router = Router();

router.route('/create-new-chat').post(createChat);
router.route('/get-all-chats').get(getAllChats);
router.route('/:chatId').delete(deleteChat);

export default router;