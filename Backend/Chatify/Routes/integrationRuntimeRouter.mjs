import { Router } from 'express';
import { getIntegrationRuntimeManifest } from '../Controller/integrationController.mjs';
import integrationRuntimeAuth from '../Middlewares/integrationRuntimeAuth.mjs';

const router = Router();

router.route('/manifest').get(integrationRuntimeAuth, getIntegrationRuntimeManifest);

export default router;
