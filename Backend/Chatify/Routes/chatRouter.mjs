import { Router } from 'express';
import {
  blockChatPeer,
  createChat,
  deleteChat,
  getAllChats,
  unblockChatPeer,
} from '../Controller/chatController.mjs';

const router = Router();

router.route('/create-new-chat').post(createChat);
router.route('/get-all-chats').get(getAllChats);
router.route('/:chatId/block').post(blockChatPeer).delete(unblockChatPeer);
router.route('/:chatId').delete(deleteChat);

export default router;
