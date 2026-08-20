import { Router } from 'express';
import {
  addSpaceMember,
  createSpace,
  createSpaceChannel,
  getSpace,
  getSpaceChannels,
  getSpaces,
  joinSpace,
  removeSpaceMember,
} from '../Controller/spaceController.mjs';
import { spaceJoinLimiter } from '../Middlewares/rateLimiters.mjs';

const router = Router();

router.route('/').get(getSpaces).post(createSpace);
router.route('/join').post(spaceJoinLimiter, joinSpace);
router.route('/:spaceId').get(getSpace);
router.route('/:spaceId/members').post(addSpaceMember);
router.route('/:spaceId/members/:memberId').delete(removeSpaceMember);
router.route('/:spaceId/channels').get(getSpaceChannels).post(createSpaceChannel);

export default router;
