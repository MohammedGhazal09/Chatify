import IntegrationApp, {
  INTEGRATION_APP_STATUSES,
  INTEGRATION_APP_TYPES,
} from '../Models/integrationAppModel.mjs';
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
  assertIntegrationTargetInstallAllowed,
  assertScopesAllowed,
  assertValidIntegrationScopes,
  createIntegrationAuditLog,
  generateIntegrationToken,
  hashIntegrationToken,
  normalizeIntegrationScopes,
} from '../Utils/integrationPermissions.mjs';

const toIdString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? '';

const serializeDate = (value) => value?.toISOString?.() ?? value ?? null;

const serializeApp = (app) => ({
  _id: toIdString(app),
  name: app.name,
  description: app.description ?? '',
  type: app.type,
  status: app.status,
  allowedScopes: app.allowedScopes ?? [],
  owner: toIdString(app.owner),
  createdAt: serializeDate(app.createdAt),
  updatedAt: serializeDate(app.updatedAt),
});

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

const buildRuntimeManifest = (installation) => ({
  installationId: toIdString(installation),
  app: {
    _id: toIdString(installation.app),
    name: installation.app?.name ?? '',
    type: installation.app?.type ?? INTEGRATION_APP_TYPES.INTEGRATION,
  },
  target: {
    type: installation.targetType,
    id: toIdString(installation.targetId),
  },
  scopes: installation.scopes ?? [],
  status: installation.status,
  tokenRotatedAt: serializeDate(installation.tokenRotatedAt),
});

export const createIntegrationApp = asyncErrHandler(async (req, res, next) => {
  const ownerId = req.userId?.toString();

  if (!ownerId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const type = Object.values(INTEGRATION_APP_TYPES).includes(req.body?.type)
    ? req.body.type
    : INTEGRATION_APP_TYPES.INTEGRATION;
  const allowedScopes = normalizeIntegrationScopes(req.body?.allowedScopes);

  if (!name || name.length < 2 || name.length > 80) {
    return next(new CustomError('Integration name must be 2 to 80 characters', 400));
  }

  try {
    assertValidIntegrationScopes(allowedScopes);
  } catch (error) {
    return next(error);
  }

  const app = await IntegrationApp.create({
    owner: ownerId,
    name,
    description,
    type,
    status: INTEGRATION_APP_STATUSES.ACTIVE,
    allowedScopes,
  });

  await createIntegrationAuditLog({
    app: app._id,
    actorUser: ownerId,
    action: INTEGRATION_AUDIT_ACTIONS.APP_CREATED,
    status: INTEGRATION_AUDIT_STATUSES.SUCCESS,
    scopes: allowedScopes,
  });

  res.status(201).json({
    status: 'success',
    data: {
      app: serializeApp(app),
    },
  });
});

export const listIntegrationApps = asyncErrHandler(async (req, res, next) => {
  const ownerId = req.userId?.toString();

  if (!ownerId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const apps = await IntegrationApp.find({ owner: ownerId })
    .sort({ createdAt: -1, _id: -1 });

  res.status(200).json({
    status: 'success',
    data: {
      apps: apps.map(serializeApp),
    },
  });
});

export const installIntegrationApp = asyncErrHandler(async (req, res, next) => {
  const actorId = req.userId?.toString();

  if (!actorId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const app = await IntegrationApp.findOne({
    _id: req.params.appId,
    owner: actorId,
    status: INTEGRATION_APP_STATUSES.ACTIVE,
  });

  if (!app) {
    return next(new CustomError('Integration app not found', 404));
  }

  const scopes = normalizeIntegrationScopes(req.body?.scopes);

  try {
    assertValidIntegrationScopes(scopes);
    assertScopesAllowed({ requestedScopes: scopes, allowedScopes: app.allowedScopes });
  } catch (error) {
    return next(error);
  }

  const target = await assertIntegrationTargetInstallAllowed({
    targetType: req.body?.targetType,
    targetId: req.body?.targetId,
    userId: actorId,
  });
  const token = generateIntegrationToken();
  const installation = await IntegrationInstallation.create({
    app: app._id,
    installedBy: actorId,
    targetType: target.targetType,
    targetId: target.targetId,
    scopes,
    status: INTEGRATION_INSTALLATION_STATUSES.ACTIVE,
    tokenHash: hashIntegrationToken(token),
    tokenRotatedAt: new Date(),
  });

  await createIntegrationAuditLog({
    app: app._id,
    installation: installation._id,
    actorUser: actorId,
    action: INTEGRATION_AUDIT_ACTIONS.INSTALLED,
    status: INTEGRATION_AUDIT_STATUSES.SUCCESS,
    targetType: target.targetType,
    targetId: target.targetId,
    scopes,
  });

  res.status(201).json({
    status: 'success',
    data: {
      installation: serializeInstallation(installation),
      runtimeToken: token,
    },
  });
});

export const listIntegrationInstallations = asyncErrHandler(async (req, res, next) => {
  const actorId = req.userId?.toString();

  if (!actorId) {
    return next(new CustomError('Not authorized to access this route', 401));
  }

  const apps = await IntegrationApp.find({ owner: actorId }).select('_id');
  const appIds = apps.map((app) => app._id);
  const installations = await IntegrationInstallation.find({ app: { $in: appIds } })
    .sort({ updatedAt: -1, _id: -1 });

  res.status(200).json({
    status: 'success',
    data: {
      installations: installations.map(serializeInstallation),
    },
  });
});

const loadOwnedInstallation = async ({ installationId, actorId }) => {
  const installation = await IntegrationInstallation.findById(installationId)
    .populate('app', 'owner name status allowedScopes');

  if (!installation || toIdString(installation.app?.owner) !== actorId) {
    throw new CustomError('Integration installation not found', 404);
  }

  return installation;
};

export const revokeIntegrationInstallation = asyncErrHandler(async (req, res, next) => {
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
  } catch (error) {
    return next(error);
  }

  installation.status = INTEGRATION_INSTALLATION_STATUSES.REVOKED;
  installation.revokedAt = new Date();
  await installation.save();

  await createIntegrationAuditLog({
    app: installation.app?._id,
    installation: installation._id,
    actorUser: actorId,
    action: INTEGRATION_AUDIT_ACTIONS.REVOKED,
    status: INTEGRATION_AUDIT_STATUSES.SUCCESS,
    targetType: installation.targetType,
    targetId: installation.targetId,
    scopes: installation.scopes,
  });

  res.status(200).json({
    status: 'success',
    data: {
      installation: serializeInstallation(installation),
    },
  });
});

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
  } catch (error) {
    return next(error);
  }

  if (installation.status !== INTEGRATION_INSTALLATION_STATUSES.ACTIVE) {
    return next(new CustomError('Cannot rotate a revoked integration token', 400));
  }

  const token = generateIntegrationToken();
  installation.tokenHash = hashIntegrationToken(token);
  installation.tokenRotatedAt = new Date();
  await installation.save();

  await createIntegrationAuditLog({
    app: installation.app?._id,
    installation: installation._id,
    actorUser: actorId,
    action: INTEGRATION_AUDIT_ACTIONS.TOKEN_ROTATED,
    status: INTEGRATION_AUDIT_STATUSES.SUCCESS,
    targetType: installation.targetType,
    targetId: installation.targetId,
    scopes: installation.scopes,
  });

  res.status(200).json({
    status: 'success',
    data: {
      installation: serializeInstallation(installation),
      runtimeToken: token,
    },
  });
});

export const getIntegrationRuntimeManifest = asyncErrHandler(async (req, res) => {
  const installation = req.integrationInstallation;

  await createIntegrationAuditLog({
    app: installation.app?._id,
    installation: installation._id,
    action: INTEGRATION_AUDIT_ACTIONS.RUNTIME_MANIFEST_READ,
    status: INTEGRATION_AUDIT_STATUSES.SUCCESS,
    targetType: installation.targetType,
    targetId: installation.targetId,
    scopes: installation.scopes,
  });

  res.status(200).json({
    status: 'success',
    data: {
      manifest: buildRuntimeManifest(installation),
    },
  });
});

export const buildIntegrationDiagnosticsPayload = async ({ now = new Date() } = {}) => {
  const [
    totalApps,
    activeApps,
    activeInstallations,
    revokedInstallations,
    runtimeReads,
    deniedRuntimeAccess,
    scopeRows,
    latestAudit,
  ] = await Promise.all([
    IntegrationApp.countDocuments({}),
    IntegrationApp.countDocuments({ status: INTEGRATION_APP_STATUSES.ACTIVE }),
    IntegrationInstallation.countDocuments({ status: INTEGRATION_INSTALLATION_STATUSES.ACTIVE }),
    IntegrationInstallation.countDocuments({ status: INTEGRATION_INSTALLATION_STATUSES.REVOKED }),
    IntegrationAuditLog.countDocuments({ action: INTEGRATION_AUDIT_ACTIONS.RUNTIME_MANIFEST_READ }),
    IntegrationAuditLog.countDocuments({ action: INTEGRATION_AUDIT_ACTIONS.RUNTIME_DENIED }),
    IntegrationInstallation.aggregate([
      { $match: { status: INTEGRATION_INSTALLATION_STATUSES.ACTIVE } },
      { $unwind: '$scopes' },
      { $group: { _id: '$scopes', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    IntegrationAuditLog.findOne({}).sort({ createdAt: -1, _id: -1 }).lean(),
  ]);
  const scopeCounts = Object.fromEntries(scopeRows.map((row) => [row._id, row.count]));
  const status = deniedRuntimeAccess > 0 ? 'attention' : 'ok';

  return {
    generatedAt: serializeDate(now),
    status,
    apps: {
      total: totalApps,
      active: activeApps,
    },
    installations: {
      active: activeInstallations,
      revoked: revokedInstallations,
    },
    runtime: {
      manifestReads: runtimeReads,
      deniedAccess: deniedRuntimeAccess,
    },
    scopes: scopeCounts,
    latestAuditAt: serializeDate(latestAudit?.createdAt),
  };
};
