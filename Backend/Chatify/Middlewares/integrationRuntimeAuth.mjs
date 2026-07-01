import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { CustomError } from '../Utils/customError.mjs';
import {
  loadIntegrationInstallationFromToken,
  readBearerIntegrationToken,
} from '../Utils/integrationPermissions.mjs';

const integrationRuntimeAuth = asyncErrHandler(async (req, res, next) => {
  const token = readBearerIntegrationToken(req);

  if (!token) {
    return next(new CustomError('Integration token required', 401));
  }

  req.integrationInstallation = await loadIntegrationInstallationFromToken(token);
  next();
});

export default integrationRuntimeAuth;
