import { Router } from 'express';
import { requireChatMembership } from '../Middlewares/databaseAuthorization.mjs';
import { deleteChatWithUploads } from '../Controller/chatDeletionController.mjs';
import {
  acceptContactRequest,
  blockChatPeer,
  cancelContactRequest,
  createChat,
  createContactRequest,
  createGroupChat,
  declineContactRequest,
  getAllChats,
  getContactRequests,
  unblockChatPeer,
  updateChatOrganization,
} from '../Controller/chatController.mjs';

const router = Router();

const concealedChatOptions = Object.freeze({
  unauthorizedStatusCode: 404,
  unauthorizedMessage: 'Chat not found',
});

router.route('/create-new-chat').post(createChat);
router.route('/create-group-chat').post(createGroupChat);
router.route('/get-all-chats').get(getAllChats);
router.route('/contact-requests').get(getContactRequests).post(createContactRequest);
router.route('/contact-requests/:requestId/accept').post(acceptContactRequest);
router.route('/contact-requests/:requestId/decline').post(declineContactRequest);
router.route('/contact-requests/:requestId').delete(cancelContactRequest);
router.route('/:chatId/organization').patch(
  requireChatMembership('chatId', concealedChatOptions),
  updateChatOrganization
);
router.route('/:chatId/block').post(requireChatMembership('chatId'), blockChatPeer).delete(requireChatMembership('chatId'), unblockChatPeer);
router.route('/:chatId').delete(requireChatMembership('chatId'), deleteChatWithUploads);

export default router;
