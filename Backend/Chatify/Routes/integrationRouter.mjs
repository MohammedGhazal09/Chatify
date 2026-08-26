import { Router } from 'express';
import {
  createIntegrationApp,
  installIntegrationApp,
  listIntegrationApps,
  listIntegrationInstallations,
  revokeIntegrationInstallation,
} from '../Controller/integrationController.mjs';
import { rotateIntegrationToken } from '../Controller/integrationInstallationController.mjs';

const router = Router();

router.route('/apps').get(listIntegrationApps).post(createIntegrationApp);
router.route('/apps/:appId/installations').post(installIntegrationApp);
router.route('/installations').get(listIntegrationInstallations);
router.route('/installations/:installationId/revoke').post(revokeIntegrationInstallation);
router.route('/installations/:installationId/rotate-token').post(rotateIntegrationToken);

export default router;
