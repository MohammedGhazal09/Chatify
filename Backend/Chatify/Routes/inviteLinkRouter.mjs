import { Router } from 'express';
import {
  createGroupInviteLink,
  createSpaceInviteLink,
  joinInviteLink,
  listGroupInviteLinks,
  listSpaceInviteLinks,
  revokeInviteLink,
} from '../Controller/inviteLinkController.mjs';
import { spaceJoinLimiter } from '../Middlewares/rateLimiters.mjs';

const router = Router();

router.route('/group/:chatId').get(listGroupInviteLinks).post(createGroupInviteLink);
router.route('/space/:spaceId').get(listSpaceInviteLinks).post(createSpaceInviteLink);
router.route('/join').post(spaceJoinLimiter, joinInviteLink);
router.route('/join/:token').post(spaceJoinLimiter, joinInviteLink);
router.route('/:inviteId').delete(revokeInviteLink);

export default router;
