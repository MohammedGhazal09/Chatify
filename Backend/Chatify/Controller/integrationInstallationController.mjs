import IntegrationAuditLog, {
  INTEGRATION_AUDIT_ACTIONS,
  INTEGRATION_AUDIT_STATUSES,
} from '../Models/integrationAuditLogModel.mjs';
import IntegrationInstallation, {
  INTEGRATION_INSTALLATION_STATUSES,
} from '../Models/integrationInstallationModel.mjs';
import asyncErrHandler from '../Utils/asyncErrHandler.mjs';
import { CustomError } from '../Utils/customError.mjs';
import {
  assertCurrentIntegrationTargetAuthority,
  generateIntegrationToken,
  hashIntegrationToken,
} from '../Utils/integrationPermissions.mjs';

const toIdString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? '';
const serializeDate = (value) => value?.toISOString?.() ?? value ?? null;

const serializeInstallation = (installation) => ({
  _id: toIdString(installation),
  app: toIdString(installation.app),
  installedBy: toIdString(installation.installedBy),
  targetType: installation.targetType,
  targetId: toIdString(installation.targetId),
  scopes: installation.scopes ?? [],
  status: installation.status,
  tokenRotatedAt: serializeDate(installation.tokenRotatedAt),
  revokedAt: serializeDate(installation.revokedAt),
  createdAt: serializeDate(installation.createdAt),
  updatedAt: serializeDate(installation.updatedAt),
});

const loadOwnedInstallation = async ({ installationId, actorId }) => {
  const installation = await IntegrationInstallation.findById(installationId)
    .populate('app', 'owner name status allowedScopes');

  if (!installation || toIdString(installation.app?.owner) !== actorId) {
    throw new CustomError('Integration installation not found', 404);
  }
  return installation;
};

export const rotateIntegrationToken = asyncErrHandler(async (req, res, next) => {
  const actorId = req.userId?.toString();
  if (!actorId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  let installation;
  try {
    installation = await loadOwnedInstallation({
      installationId: req.params.installationId,
      actorId,
    });
    await assertCurrentIntegrationTargetAuthority(installation);
  } catch (error) {
    return next(error);
  }

  if (installation.status !== INTEGRATION_INSTALLATION_STATUSES.ACTIVE) {
    return next(new CustomError('Cannot rotate a revoked integration token', 400));
  }

  const token = generateIntegrationToken();
  const tokenRotatedAt = new Date();
  const rotated = await IntegrationInstallation.findOneAndUpdate(
    {
      _id: installation._id,
      status: INTEGRATION_INSTALLATION_STATUSES.ACTIVE,
    },
    {
      $set: {
        tokenHash: hashIntegrationToken(token),
        tokenRotatedAt,
      },
    },
    { new: true, runValidators: true }
  ).populate('app', 'owner name status allowedScopes');

  if (!rotated) {
    return next(new CustomError('Cannot rotate a revoked integration token', 400));
  }

  try {
    await assertCurrentIntegrationTargetAuthority(rotated);
  } catch (error) {
    return next(error);
  }

  await IntegrationAuditLog.create({
    app: rotated.app?._id,
    installation: rotated._id,
    actorUser: actorId,
    action: INTEGRATION_AUDIT_ACTIONS.TOKEN_ROTATED,
    status: INTEGRATION_AUDIT_STATUSES.SUCCESS,
    targetType: rotated.targetType,
    targetId: rotated.targetId,
    scopes: rotated.scopes,
    metadata: {},
  });

  res.status(200).json({
    status: 'success',
    data: {
      installation: serializeInstallation(rotated),
      runtimeToken: token,
    },
  });
});
