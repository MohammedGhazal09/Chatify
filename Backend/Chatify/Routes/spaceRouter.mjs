import { Router } from 'express';
import {
  addSpaceMember,
  createSpace,
  createSpaceChannel,
  getSpace,
  getSpaceChannels,
  getSpaces,
  removeSpaceMember,
} from '../Controller/spaceController.mjs';

const router = Router();

router.route('/').get(getSpaces).post(createSpace);
router.route('/:spaceId').get(getSpace);
router.route('/:spaceId/members').post(addSpaceMember);
router.route('/:spaceId/members/:memberId').delete(removeSpaceMember);
router.route('/:spaceId/channels').get(getSpaceChannels).post(createSpaceChannel);

export default router;
