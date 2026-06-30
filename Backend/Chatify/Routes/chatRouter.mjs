import { Router } from 'express';
import {
  acceptContactRequest,
  blockChatPeer,
  cancelContactRequest,
  createChat,
  createContactRequest,
  createGroupChat,
  deleteChat,
  declineContactRequest,
  getAllChats,
  getContactRequests,
  unblockChatPeer,
  updateChatOrganization,
} from '../Controller/chatController.mjs';

const router = Router();

router.route('/create-new-chat').post(createChat);
router.route('/create-group-chat').post(createGroupChat);
router.route('/get-all-chats').get(getAllChats);
router.route('/contact-requests').get(getContactRequests).post(createContactRequest);
router.route('/contact-requests/:requestId/accept').post(acceptContactRequest);
router.route('/contact-requests/:requestId/decline').post(declineContactRequest);
router.route('/contact-requests/:requestId').delete(cancelContactRequest);
router.route('/:chatId/organization').patch(updateChatOrganization);
router.route('/:chatId/block').post(blockChatPeer).delete(unblockChatPeer);
router.route('/:chatId').delete(deleteChat);

export default router;
