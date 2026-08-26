import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const changed = new Set();
const file = (relativePath) => path.join(root, relativePath);
const read = (relativePath) => fs.readFileSync(file(relativePath), 'utf8');
const write = (relativePath, content) => {
  const target = file(relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const normalized = content.endsWith('\n') ? content : `${content}\n`;
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== normalized) {
    fs.writeFileSync(target, normalized);
    changed.add(relativePath);
  }
};
const replaceOnce = (relativePath, oldValue, newValue, marker = newValue) => {
  let content = read(relativePath);
  if (typeof marker === 'string' && content.includes(marker)) return;
  if (!content.includes(oldValue)) {
    throw new Error(`Expected remediation anchor was not found in ${relativePath}`);
  }
  content = content.replace(oldValue, newValue);
  write(relativePath, content);
};
const replaceRegexOnce = (relativePath, expression, replacement, marker) => {
  let content = read(relativePath);
  if (marker && content.includes(marker)) return;
  if (!expression.test(content)) {
    throw new Error(`Expected remediation pattern was not found in ${relativePath}`);
  }
  content = content.replace(expression, replacement);
  write(relativePath, content);
};
const ensureImport = (relativePath, importLine, anchor) => {
  let content = read(relativePath);
  if (content.includes(importLine)) return;
  if (!content.includes(anchor)) throw new Error(`Import anchor missing in ${relativePath}`);
  content = content.replace(anchor, `${anchor}${importLine}\n`);
  write(relativePath, content);
};

write('Backend/Chatify/Utils/callIceConfig.mjs', `import { createHmac } from 'node:crypto';

const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];
const DEFAULT_TURN_CREDENTIAL_TTL_SECONDS = 10 * 60;
const MIN_TURN_CREDENTIAL_TTL_SECONDS = 60;
const MAX_TURN_CREDENTIAL_TTL_SECONDS = 60 * 60;

const splitEnvList = (value) => (typeof value === 'string'
  ? value.split(',').map((item) => item.trim()).filter(Boolean)
  : []);

const parseStunServers = (env) => {
  const stunUrls = splitEnvList(env.CALL_STUN_URLS);
  const urls = stunUrls.length > 0 ? stunUrls : DEFAULT_STUN_URLS;
  return urls.map((url) => ({ urls: url }));
};

const parseTurnCredentialTtlSeconds = (env) => {
  const parsed = Number.parseInt(env.CALL_TURN_CREDENTIAL_TTL_SECONDS ?? '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_TURN_CREDENTIAL_TTL_SECONDS;
  return Math.min(Math.max(parsed, MIN_TURN_CREDENTIAL_TTL_SECONDS), MAX_TURN_CREDENTIAL_TTL_SECONDS);
};

const normalizeCredentialToken = (value, fallback) => {
  const normalized = String(value ?? '').trim().replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 96);
  return normalized || fallback;
};

const buildEphemeralTurnCredential = ({ env, subject, callId, now }) => {
  const secret = String(env.CALL_TURN_SECRET ?? '').trim();
  if (!secret) return null;
  const nowMs = now instanceof Date ? now.getTime() : Number(now ?? Date.now());
  const expiresAtSeconds = Math.floor(nowMs / 1000) + parseTurnCredentialTtlSeconds(env);
  const username = [
    expiresAtSeconds,
    normalizeCredentialToken(subject, 'participant'),
    normalizeCredentialToken(callId, 'call'),
  ].join(':');
  return {
    username,
    credential: createHmac('sha1', secret).update(username, 'utf8').digest('base64'),
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
};

const buildDevelopmentStaticCredential = (env) => {
  if (env.NODE_ENV === 'production') return null;
  const username = String(env.CALL_TURN_USERNAME ?? '').trim();
  const credential = String(env.CALL_TURN_CREDENTIAL ?? '').trim();
  return username && credential ? { username, credential, expiresAt: null } : null;
};

const looksLikeEnvironment = (value) => Boolean(
  value && typeof value === 'object' &&
  ('NODE_ENV' in value || 'CALL_STUN_URLS' in value || 'CALL_TURN_URLS' in value ||
    'CALL_TURN_SECRET' in value || 'CALL_TURN_USERNAME' in value || 'CALL_TURN_CREDENTIAL' in value) &&
  !('includeCredentials' in value) && !('subject' in value) && !('callId' in value) && !('now' in value)
);

const normalizeArguments = (optionsOrEnv, explicitEnv) => {
  if (looksLikeEnvironment(optionsOrEnv) && explicitEnv === undefined) {
    return { options: {}, env: optionsOrEnv };
  }
  return {
    options: optionsOrEnv && typeof optionsOrEnv === 'object' ? optionsOrEnv : {},
    env: explicitEnv ?? process.env,
  };
};

export const getCallIceConfig = (optionsOrEnv = {}, explicitEnv) => {
  const { options, env } = normalizeArguments(optionsOrEnv, explicitEnv);
  const stunServers = parseStunServers(env);
  const turnUrls = splitEnvList(env.CALL_TURN_URLS);
  const includeCredentials = options.includeCredentials === true || Boolean(options.subject || options.callId);
  const hasEphemeralCredentialConfig = Boolean(turnUrls.length && String(env.CALL_TURN_SECRET ?? '').trim());
  const hasDevelopmentStaticConfig = Boolean(
    env.NODE_ENV !== 'production' && turnUrls.length &&
    String(env.CALL_TURN_USERNAME ?? '').trim() && String(env.CALL_TURN_CREDENTIAL ?? '').trim()
  );
  const turnReady = hasEphemeralCredentialConfig || hasDevelopmentStaticConfig;
  const productionReady = env.NODE_ENV !== 'production' || hasEphemeralCredentialConfig;
  const warnings = [];
  let credentialExpiresAt = null;
  let turnServers = [];

  if (turnUrls.length === 0) {
    warnings.push('TURN server URLs are not configured. Calls may fail across restrictive networks.');
  } else if (!turnReady) {
    warnings.push(env.NODE_ENV === 'production'
      ? 'TURN REST credentials are not configured. Set CALL_TURN_SECRET for production calling.'
      : 'TURN credentials are not configured. Development STUN fallback remains available.');
  }

  if (includeCredentials && turnUrls.length > 0) {
    const credential = buildEphemeralTurnCredential({
      env,
      subject: options.subject,
      callId: options.callId,
      now: options.now,
    }) ?? buildDevelopmentStaticCredential(env);
    if (credential) {
      credentialExpiresAt = credential.expiresAt;
      turnServers = turnUrls.map((url) => ({
        urls: url,
        username: credential.username,
        credential: credential.credential,
      }));
    }
  }

  return {
    iceServers: [...stunServers, ...turnServers],
    turnReady,
    productionReady,
    credentialExpiresAt,
    warnings,
  };
};
`);

replaceOnce(
  'Backend/Chatify/Controller/messageController.mjs',
  `  res.setHeader('Content-Type', attachment.mimeType);\n  res.setHeader('Content-Length', String(attachment.size));\n  res.setHeader('Content-Disposition', \`inline; filename="\${safeFilename}"\`);\n  res.setHeader('Cache-Control', 'private, no-store');\n`,
  `  const isInlinePreviewAllowed = (\n    attachment.kind === 'media' &&\n    typeof attachment.mimeType === 'string' &&\n    attachment.mimeType.startsWith('image/')\n  );\n\n  if (!isInlinePreviewAllowed) {\n    res.status(415).json({\n      status: 'fail',\n      message: 'Inline preview is unavailable for this attachment type',\n    });\n    return;\n  }\n\n  res.setHeader('Content-Type', attachment.mimeType);\n  res.setHeader('Content-Length', String(attachment.size));\n  res.setHeader('Content-Disposition', \`inline; filename="\${safeFilename}"\`);\n  res.setHeader('Cache-Control', 'private, no-store');\n  res.setHeader('X-Content-Type-Options', 'nosniff');\n  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");\n`,
  'Inline preview is unavailable for this attachment type'
);
replaceOnce(
  'Backend/Chatify/Controller/messageController.mjs',
  `  res.setHeader('Content-Type', attachment.mimeType);\n  res.setHeader('Content-Length', String(attachment.size));\n  res.setHeader('Content-Disposition', \`attachment; filename="\${safeFilename}"\`);\n  res.setHeader('Cache-Control', 'private, no-store');\n`,
  `  res.setHeader('Content-Type', attachment.mimeType);\n  res.setHeader('Content-Length', String(attachment.size));\n  res.setHeader('Content-Disposition', \`attachment; filename="\${safeFilename}"\`);\n  res.setHeader('Cache-Control', 'private, no-store');\n  res.setHeader('X-Content-Type-Options', 'nosniff');\n  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");\n`,
  `res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");`
);

let modal = read('Frontend/Chatify/src/pages/chat/components/AttachmentPreviewModal.tsx');
if (modal.includes("const isPdf = attachment.mimeType === 'application/pdf';")) {
  modal = modal.replace("  const isPdf = attachment.mimeType === 'application/pdf';\n", '');
}
modal = modal.replace(/\s*:\s*previewUrl\s*&&\s*isPdf\s*\?\s*\(\s*<iframe[\s\S]*?<\/iframe>\s*\)\s*:\s*\(/m, ' : (');
write('Frontend/Chatify/src/pages/chat/components/AttachmentPreviewModal.tsx', modal);

write('Backend/Chatify/Config/DBConfig.mjs', `import mongoose from 'mongoose';
import { logger } from '../Utils/observabilityLogger.mjs';

const boundedInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
};

export const validateMongoConnectionUrl = (value, env = process.env) => {
  const url = typeof value === 'string' ? value.trim() : '';
  if (!url) throw new Error('MONGODB_URL is required');
  if (!/^mongodb(?:\\+srv)?:\\/\\//i.test(url)) {
    throw new Error('MONGODB_URL must use the mongodb or mongodb+srv protocol');
  }
  if (env.NODE_ENV === 'production') {
    const parsed = new URL(url);
    const tlsValue = parsed.searchParams.get('tls') ?? parsed.searchParams.get('ssl');
    if (tlsValue && /^(?:false|0)$/i.test(tlsValue)) {
      throw new Error('Production MongoDB connections must not disable TLS');
    }
  }
  return url;
};

export const buildMongoConnectionOptions = (env = process.env) => ({
  serverSelectionTimeoutMS: boundedInteger(env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10_000, 1_000, 60_000),
  connectTimeoutMS: boundedInteger(env.MONGODB_CONNECT_TIMEOUT_MS, 10_000, 1_000, 60_000),
  socketTimeoutMS: boundedInteger(env.MONGODB_SOCKET_TIMEOUT_MS, 30_000, 5_000, 120_000),
  waitQueueTimeoutMS: boundedInteger(env.MONGODB_WAIT_QUEUE_TIMEOUT_MS, 5_000, 500, 60_000),
  maxPoolSize: boundedInteger(env.MONGODB_MAX_POOL_SIZE, 20, 1, 100),
  minPoolSize: boundedInteger(env.MONGODB_MIN_POOL_SIZE, 1, 0, 20),
  maxIdleTimeMS: 60_000,
  retryWrites: true,
  ...(env.NODE_ENV === 'production' ? { tls: true } : {}),
});

export const initializeDatabaseIndexes = async () => {
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
};

export const connectDatabase = async (env = process.env) => {
  const options = buildMongoConnectionOptions(env);
  await mongoose.connect(validateMongoConnectionUrl(env.MONGODB_URL, env), options);
  await mongoose.connection.db.command({ ping: 1 });
  await initializeDatabaseIndexes();
  logger.info('database.connected', {
    readyState: mongoose.connection.readyState,
    modelCount: Object.keys(mongoose.models).length,
    maxPoolSize: options.maxPoolSize,
  });
  return mongoose.connection;
};

export const disconnectDatabase = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};

const db = mongoose.connection;
db.on('error', (error) => logger.error('database.connection_error', { readyState: db.readyState, error }));
db.on('disconnected', () => logger.warn('database.disconnected', { readyState: db.readyState }));
export default db;
`);

const serverPath = 'Backend/Chatify/server.mjs';
let server = read(serverPath);
if (!server.includes('await connectDatabase()')) {
  server = `import 'dotenv/config';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import app from './app.mjs';
import { connectDatabase, disconnectDatabase } from './Config/DBConfig.mjs';
import { initSocket, closeSocketServer } from './Config/socket.mjs';
import { startNotificationOutboxWorker, stopNotificationOutboxWorker } from './Services/notificationService.mjs';
import { startPrivacyOperationsWorker, stopPrivacyOperationsWorker } from './Services/privacyOperationsService.mjs';
import { startAttachmentCleanupWorker, stopAttachmentCleanupWorker } from './Services/attachmentCleanupService.mjs';
import { logger } from './Utils/observabilityLogger.mjs';

const PORT = Number.parseInt(process.env.PORT || process.env.PORT_NUMBER || '5000', 10);
let httpServer = null;
let io = null;
let shutdownPromise = null;

const listen = (serverInstance, port) => new Promise((resolve, reject) => {
  const onError = (error) => { serverInstance.off('listening', onListening); reject(error); };
  const onListening = () => { serverInstance.off('error', onError); resolve(); };
  serverInstance.once('error', onError);
  serverInstance.once('listening', onListening);
  serverInstance.listen(port);
});

export const startServer = async () => {
  if (httpServer?.listening) return { io, server: httpServer };
  await connectDatabase();
  httpServer = createServer(app);
  io = initSocket(httpServer);
  try {
    await listen(httpServer, PORT);
  } catch (error) {
    await closeSocketServer();
    await disconnectDatabase();
    httpServer = null;
    io = null;
    throw error;
  }
  startNotificationOutboxWorker();
  startPrivacyOperationsWorker();
  startAttachmentCleanupWorker();
  logger.info('server.listening', { port: PORT });
  return { io, server: httpServer };
};

export const stopServer = async () => {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    stopNotificationOutboxWorker();
    stopPrivacyOperationsWorker();
    stopAttachmentCleanupWorker();
    await closeSocketServer();
    if (httpServer?.listening) {
      await new Promise((resolve) => httpServer.close(() => resolve()));
    }
    await disconnectDatabase();
    httpServer = null;
    io = null;
  })().finally(() => { shutdownPromise = null; });
  return shutdownPromise;
};

const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isEntrypoint) {
  startServer().catch((error) => {
    logger.error('server.start_failed', { error });
    process.exitCode = 1;
  });
}
export { io, httpServer as server };
`;
  write(serverPath, server);
}

const callModelPath = 'Backend/Chatify/Models/callSessionModel.mjs';
let callModel = read(callModelPath);
if (!callModel.includes('activeParticipantKeys')) {
  callModel = callModel.replace(
    `    participantIds: [{\n      type: mongoose.Schema.Types.ObjectId,\n      ref: 'Users',\n    }],\n`,
    `    participantIds: [{\n      type: mongoose.Schema.Types.ObjectId,\n      ref: 'Users',\n    }],\n    activeParticipantKeys: [{\n      type: String,\n      trim: true,\n      select: false,\n    }],\n`
  );
  callModel = callModel.replace(
    `callSessionSchema.index({ chatId: 1, status: 1, createdAt: -1 });\n`,
    `callSessionSchema.index({ chatId: 1, status: 1, createdAt: -1 });\ncallSessionSchema.index(\n  { activeParticipantKeys: 1 },\n  { unique: true, partialFilterExpression: { activeParticipantKeys: { $type: 'string' } } }\n);\n`
  );
  write(callModelPath, callModel);
}

const callStatePath = 'Backend/Chatify/Utils/callSessionState.mjs';
let callState = read(callStatePath);
if (!callState.includes('activeParticipantKeys: []')) {
  callState = callState.replace(
    `  const patch = {\n    status,\n    endedAt: now,\n    endedReason: reason,\n  };\n`,
    `  const patch = {\n    status,\n    endedAt: now,\n    endedReason: reason,\n    activeParticipantKeys: [],\n  };\n`
  );
  callState = callState.replace(
    `    participantIds: uniqueObjectIds([callerObjectId, ...normalizedRecipientIds]),\n    isGroupCall,\n`,
    `    participantIds: uniqueObjectIds([callerObjectId, ...normalizedRecipientIds]),\n    activeParticipantKeys: uniqueObjectIds([callerObjectId, ...normalizedRecipientIds])\n      .map((participantId) => participantId.toString()),\n    isGroupCall,\n`
  );
  callState = callState.replace(
    `        participantIds: uniqueObjectIds([session.callerId, actorObjectId]),\n        ...(session.isGroupCall ? { calleeId: actorObjectId } : {}),\n`,
    `        participantIds: uniqueObjectIds([session.callerId, actorObjectId]),\n        activeParticipantKeys: uniqueObjectIds([session.callerId, actorObjectId])\n          .map((participantId) => participantId.toString()),\n        ...(session.isGroupCall ? { calleeId: actorObjectId } : {}),\n`
  );
  callState = callState.replace(
    `  return CallSession.create({\n    callId: randomUUID(),\n`,
    `  try {\n    return await CallSession.create({\n    callId: randomUUID(),\n`
  );
  callState = callState.replace(
    `    deliveredTo: deliveredTo.map((userId) => normalizeParticipantId(userId)),\n  });\n};\n\nexport const loadCallSessionForAction`,
    `    deliveredTo: deliveredTo.map((userId) => normalizeParticipantId(userId)),\n    });\n  } catch (error) {\n    if (error?.code === 11000 && error?.keyPattern?.activeParticipantKeys) {\n      throw new CallSessionError('call_busy', 'A participant is already in a call', 409);\n    }\n    throw error;\n  }\n};\n\nexport const loadCallSessionForAction`
  );
  write(callStatePath, callState);
}

const integrationPath = 'Backend/Chatify/Utils/integrationPermissions.mjs';
let integration = read(integrationPath);
if (!integration.includes('assertIntegrationRuntimeAuthority')) {
  const anchor = `export const loadIntegrationInstallationFromToken = async (token) => {`;
  const helper = `const revokeInstallationForAuthorityLoss = async (installation, reason) => {\n  const now = new Date();\n  await IntegrationInstallation.updateOne(\n    { _id: installation._id, status: INTEGRATION_INSTALLATION_STATUSES.ACTIVE },\n    { $set: { status: INTEGRATION_INSTALLATION_STATUSES.REVOKED, revokedAt: now } }\n  );\n  await createIntegrationAuditLog({\n    app: installation.app?._id,\n    installation: installation._id,\n    actorUser: installation.installedBy,\n    action: INTEGRATION_AUDIT_ACTIONS.RUNTIME_DENIED,\n    status: INTEGRATION_AUDIT_STATUSES.DENIED,\n    targetType: installation.targetType,\n    targetId: installation.targetId,\n    scopes: installation.scopes,\n    metadata: { reason },\n  });\n  throw new CustomError('Integration installation revoked', 403);\n};\n\nexport const assertIntegrationRuntimeAuthority = async (installation) => {\n  const installerId = toIdString(installation.installedBy);\n  const targetId = toIdString(installation.targetId);\n  const allowedScopes = new Set(installation.app?.allowedScopes ?? []);\n  if (!installerId || !targetId) return revokeInstallationForAuthorityLoss(installation, 'authority_context_missing');\n  if ((installation.scopes ?? []).some((scope) => !allowedScopes.has(scope))) {\n    return revokeInstallationForAuthorityLoss(installation, 'scope_authority_reduced');\n  }\n  if (installation.targetType === INTEGRATION_INSTALLATION_TARGETS.SPACE) {\n    const space = await Spaces.findById(targetId).select('members');\n    const member = (space?.members ?? []).find((entry) => toIdString(entry.user) === installerId);\n    if (member?.role !== SPACE_ROLES.OWNER && member?.role !== SPACE_ROLES.ADMIN) {\n      return revokeInstallationForAuthorityLoss(installation, 'target_authority_lost');\n    }\n    return installation;\n  }\n  if (installation.targetType === INTEGRATION_INSTALLATION_TARGETS.CHAT) {\n    const chat = await Chats.findById(targetId).select('isGroupChat isSpaceChannel groupAdmin');\n    if (!chat?.isGroupChat || chat.isSpaceChannel || toIdString(chat.groupAdmin) !== installerId) {\n      return revokeInstallationForAuthorityLoss(installation, 'target_authority_lost');\n    }\n    return installation;\n  }\n  return revokeInstallationForAuthorityLoss(installation, 'target_unsupported');\n};\n\n`;
  if (!integration.includes(anchor)) throw new Error('Integration runtime anchor missing');
  integration = integration.replace(anchor, `${helper}${anchor}`);
  const lastReturn = integration.lastIndexOf('  return installation;\n};');
  if (lastReturn < 0) throw new Error('Integration runtime return missing');
  integration = `${integration.slice(0, lastReturn)}  await assertIntegrationRuntimeAuthority(installation);\n\n${integration.slice(lastReturn)}`;
  write(integrationPath, integration);
}

write('Backend/Chatify/Models/attachmentCleanupJobModel.mjs', `import mongoose from 'mongoose';
export const ATTACHMENT_CLEANUP_STATUS = Object.freeze({ PENDING: 'pending', PROCESSING: 'processing', FAILED: 'failed' });
const schema = new mongoose.Schema({
  storageFileId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  attachmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachments', default: null },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Messages', default: null },
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chats', default: null },
  reason: { type: String, trim: true, maxlength: 80, required: true },
  status: { type: String, enum: Object.values(ATTACHMENT_CLEANUP_STATUS), default: ATTACHMENT_CLEANUP_STATUS.PENDING },
  attempts: { type: Number, default: 0, min: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  processingToken: { type: String, default: null, select: false },
  processingLeaseExpiresAt: { type: Date, default: null },
  sanitizedError: { type: String, maxlength: 500, default: null },
}, { timestamps: true, versionKey: false });
schema.index({ status: 1, nextAttemptAt: 1, processingLeaseExpiresAt: 1, createdAt: 1 });
export default mongoose.model('AttachmentCleanupJobs', schema);
`);

write('Backend/Chatify/Services/attachmentCleanupService.mjs', `import { randomUUID } from 'node:crypto';
import AttachmentCleanupJob, { ATTACHMENT_CLEANUP_STATUS } from '../Models/attachmentCleanupJobModel.mjs';
import { deleteAttachmentFile } from './attachmentStorageService.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';
const LEASE_MS = 5 * 60 * 1000;
const RETRY_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
const MAX_ATTEMPTS = 8;
const toId = (value) => value?._id ?? value ?? null;
const retryAt = (attempts) => new Date(Date.now() + RETRY_MS[Math.min(Math.max((attempts ?? 1) - 1, 0), RETRY_MS.length - 1)]);
export const enqueueAttachmentCleanup = async ({ attachments = [], reason }) => {
  const jobs = attachments.filter((item) => item?.storageFileId).map((item) => ({
    storageFileId: toId(item.storageFileId), attachmentId: toId(item._id ?? item.attachmentId),
    messageId: toId(item.messageId), chatId: toId(item.chatId), reason,
  }));
  if (!jobs.length) return 0;
  await AttachmentCleanupJob.bulkWrite(jobs.map((job) => ({ updateOne: {
    filter: { storageFileId: job.storageFileId },
    update: { $setOnInsert: { ...job, status: ATTACHMENT_CLEANUP_STATUS.PENDING, attempts: 0, nextAttemptAt: new Date() } },
    upsert: true,
  } })), { ordered: false });
  return jobs.length;
};
export const claimNextAttachmentCleanupJob = ({ now = new Date() } = {}) => AttachmentCleanupJob.findOneAndUpdate(
  { attempts: { $lt: MAX_ATTEMPTS }, nextAttemptAt: { $lte: now }, $or: [
    { status: ATTACHMENT_CLEANUP_STATUS.PENDING },
    { status: ATTACHMENT_CLEANUP_STATUS.PROCESSING, processingLeaseExpiresAt: { $lte: now } },
  ] },
  { $set: { status: ATTACHMENT_CLEANUP_STATUS.PROCESSING, processingToken: randomUUID(),
    processingLeaseExpiresAt: new Date(now.getTime() + LEASE_MS), sanitizedError: null }, $inc: { attempts: 1 } },
  { new: true, sort: { nextAttemptAt: 1, createdAt: 1 } }
).select('+processingToken');
export const processAttachmentCleanup = async ({ limit = 25 } = {}) => {
  let processed = 0; let deleted = 0;
  while (processed < limit) {
    const job = await claimNextAttachmentCleanupJob();
    if (!job) break;
    processed += 1;
    try {
      await deleteAttachmentFile(job.storageFileId);
      await AttachmentCleanupJob.deleteOne({ _id: job._id, processingToken: job.processingToken });
      deleted += 1;
    } catch (error) {
      const terminal = job.attempts >= MAX_ATTEMPTS;
      await AttachmentCleanupJob.updateOne({ _id: job._id, processingToken: job.processingToken }, { $set: {
        status: terminal ? ATTACHMENT_CLEANUP_STATUS.FAILED : ATTACHMENT_CLEANUP_STATUS.PENDING,
        processingToken: null, processingLeaseExpiresAt: null, nextAttemptAt: retryAt(job.attempts),
        sanitizedError: String(error?.message ?? 'Attachment cleanup failed').replace(/[\\r\\n]+/g, ' ').slice(0, 500),
      } });
      logger.warn('attachment.cleanup_failed', { cleanupJobId: job._id.toString(), terminal, error });
    }
  }
  return { processed, deleted, failed: processed - deleted };
};
export const deleteAttachmentFilesDurably = async ({ attachments = [], reason }) => {
  await enqueueAttachmentCleanup({ attachments, reason });
  const eligible = attachments.filter((item) => item?.storageFileId);
  const results = await Promise.allSettled(eligible.map((item) => deleteAttachmentFile(item.storageFileId)));
  const deletedIds = eligible.filter((_, index) => results[index]?.status === 'fulfilled').map((item) => item.storageFileId);
  if (deletedIds.length) await AttachmentCleanupJob.deleteMany({ storageFileId: { $in: deletedIds } });
  return { attempted: results.length, deleted: deletedIds.length, queued: results.length - deletedIds.length };
};
let timer = null;
export const startAttachmentCleanupWorker = () => {
  if (process.env.NODE_ENV === 'test' || process.env.ATTACHMENT_CLEANUP_WORKER_ENABLED === '0' || timer) return null;
  const parsed = Number.parseInt(process.env.ATTACHMENT_CLEANUP_WORKER_INTERVAL_MS ?? '60000', 10);
  const interval = Number.isFinite(parsed) && parsed >= 5000 ? parsed : 60000;
  timer = setInterval(() => processAttachmentCleanup().catch((error) => logger.error('attachment.cleanup_worker_failed', { error })), interval);
  return timer;
};
export const stopAttachmentCleanupWorker = () => { if (timer) clearInterval(timer); timer = null; };
`);

ensureImport('Backend/Chatify/Controller/messageController.mjs', "import { deleteAttachmentFilesDurably } from '../Services/attachmentCleanupService.mjs';", "import { logger } from '../Utils/observabilityLogger.mjs';\n");
let messages = read('Backend/Chatify/Controller/messageController.mjs');
if (!messages.includes("reason: 'message_deleted_for_everyone'")) {
  messages = messages.replace(
    `      await Attachment.updateMany(\n        { messageId: message._id },\n        { $set: { status: 'deleted' } }\n      );\n\n      try {\n`,
    `      const deletedAttachments = await Attachment.find({ messageId: message._id })\n        .select('_id storageFileId messageId chatId')\n        .lean();\n      await Attachment.updateMany(\n        { messageId: message._id },\n        { $set: { status: 'deleted' } }\n      );\n      await deleteAttachmentFilesDurably({\n        attachments: deletedAttachments,\n        reason: 'message_deleted_for_everyone',\n      });\n\n      try {\n`
  );
  write('Backend/Chatify/Controller/messageController.mjs', messages);
}

const chatPath = 'Backend/Chatify/Controller/chatController.mjs';
ensureImport(chatPath, "import Message from '../Models/messageModel.mjs';", "import Chats from '../Models/chatModel.mjs';\n");
ensureImport(chatPath, "import Attachment from '../Models/attachmentModel.mjs';", "import Chats from '../Models/chatModel.mjs';\n");
ensureImport(chatPath, "import SavedMessage from '../Models/savedMessageModel.mjs';", "import Chats from '../Models/chatModel.mjs';\n");
ensureImport(chatPath, "import { deleteAttachmentFilesDurably } from '../Services/attachmentCleanupService.mjs';", "import Chats from '../Models/chatModel.mjs';\n");
let chats = read(chatPath);
if (!chats.includes("reason: 'chat_deleted'")) {
  chats = chats.replace(
    `  // Delete the chat\n  await Chats.findByIdAndDelete(chatId);\n\n  // Notify all members about the deleted chat via socket\n`,
    `  const attachments = await Attachment.find({ chatId: chat._id })\n    .select('_id storageFileId messageId chatId').lean();\n  await deleteAttachmentFilesDurably({ attachments, reason: 'chat_deleted' });\n  const messageIds = await Message.find({ chatId: chat._id }).distinct('_id');\n  await Promise.all([\n    SavedMessage.deleteMany({ $or: [{ chat: chat._id }, { message: { $in: messageIds } }] }),\n    Attachment.deleteMany({ chatId: chat._id }),\n    Message.deleteMany({ chatId: chat._id }),\n    Chats.deleteOne({ _id: chat._id }),\n  ]);\n\n  // Notify all members about the deleted chat via socket\n`
  );
  write(chatPath, chats);
}

const privacyModelPath = 'Backend/Chatify/Models/privacyRequestModel.mjs';
let privacyModel = read(privacyModelPath);
if (!privacyModel.includes('processingLeaseExpiresAt')) {
  privacyModel = privacyModel.replace(
    `  retentionSummary: {\n    type: mongoose.Schema.Types.Mixed,\n    default: {},\n  },\n  events: {\n`,
    `  retentionSummary: {\n    type: mongoose.Schema.Types.Mixed,\n    default: {},\n  },\n  processingToken: { type: String, default: null, select: false },\n  processingStartedAt: { type: Date, default: null },\n  processingLeaseExpiresAt: { type: Date, default: null },\n  processingAttempts: { type: Number, default: 0, min: 0 },\n  nextAttemptAt: { type: Date, default: null },\n  lastProcessingError: { type: String, maxlength: 500, default: null },\n  events: {\n`
  );
  write(privacyModelPath, privacyModel);
}

const privacyServicePath = 'Backend/Chatify/Services/privacyOperationsService.mjs';
let privacy = read(privacyServicePath);
if (!privacy.includes('claimNextPrivacyDeletionRequest')) {
  if (!privacy.startsWith("import { randomUUID }")) privacy = `import { randomUUID } from 'node:crypto';\n${privacy}`;
  privacy = privacy.replace(
    `const DEFAULT_WORKER_INTERVAL_MS = 5 * 60 * 1000;\n`,
    `const DEFAULT_WORKER_INTERVAL_MS = 5 * 60 * 1000;\nconst PRIVACY_PROCESSING_LEASE_MS = 5 * 60 * 1000;\nconst PRIVACY_RETRY_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];\n`
  );
  privacy = privacy.replace(
    `  if (user) {\n    try {\n      counts.profileImagesDeleted = await deleteUploadedProfileImage(user);\n    } catch (error) {\n      logger.warn('privacy.profile_image_delete_failed', {\n        userId: user._id.toString(),\n        error,\n      });\n    }\n\n    await anonymizeUserAccount({ user, now });\n`,
    `  if (user) {\n    counts.profileImagesDeleted = await deleteUploadedProfileImage(user);\n    await anonymizeUserAccount({ user, now });\n`
  );
  privacy = privacy.replace(
    `  request.completedAt = now;\n`,
    `  request.completedAt = now;\n  request.processingToken = null;\n  request.processingStartedAt = null;\n  request.processingLeaseExpiresAt = null;\n  request.nextAttemptAt = null;\n  request.lastProcessingError = null;\n`
  );
  const oldDue = `const getDueDeletionRequests = ({ now, limit }) => PrivacyRequest.find({\n  type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION,\n  status: PRIVACY_REQUEST_STATUSES.PENDING,\n  scheduledFor: { $lte: now },\n})\n  .sort({ scheduledFor: 1, requestedAt: 1, _id: 1 })\n  .limit(limit);\n\n`;
  const claim = `const retryPrivacyAt = (attempts, now) => new Date(now.getTime() + PRIVACY_RETRY_BACKOFF_MS[\n  Math.min(Math.max((attempts ?? 1) - 1, 0), PRIVACY_RETRY_BACKOFF_MS.length - 1)\n]);\nexport const claimNextPrivacyDeletionRequest = ({ now = new Date() } = {}) => PrivacyRequest.findOneAndUpdate(\n  { type: PRIVACY_REQUEST_TYPES.ACCOUNT_DELETION, status: PRIVACY_REQUEST_STATUSES.PENDING,\n    scheduledFor: { $lte: now }, $and: [\n      { $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }] },\n      { $or: [{ processingLeaseExpiresAt: null }, { processingLeaseExpiresAt: { $exists: false } },\n        { processingLeaseExpiresAt: { $lte: now } }] },\n    ] },\n  { $set: { processingToken: randomUUID(), processingStartedAt: now,\n    processingLeaseExpiresAt: new Date(now.getTime() + PRIVACY_PROCESSING_LEASE_MS), lastProcessingError: null },\n    $inc: { processingAttempts: 1 } },\n  { new: true, sort: { scheduledFor: 1, requestedAt: 1, _id: 1 } }\n).select('+processingToken');\nconst releasePrivacyDeletionClaim = ({ request, error, now }) => PrivacyRequest.updateOne(\n  { _id: request._id, status: PRIVACY_REQUEST_STATUSES.PENDING, processingToken: request.processingToken },\n  { $set: { processingToken: null, processingStartedAt: null, processingLeaseExpiresAt: null,\n    nextAttemptAt: retryPrivacyAt(request.processingAttempts, now),\n    lastProcessingError: String(error?.message ?? 'Privacy deletion processing failed').replace(/[\\r\\n]+/g, ' ').slice(0, 500) } }\n);\n\n`;
  if (!privacy.includes(oldDue)) throw new Error('Privacy due-request anchor missing');
  privacy = privacy.replace(oldDue, claim);
  const oldLoop = `  const counts = createEmptyCounts();\n  const dueRequests = await getDueDeletionRequests({ now, limit });\n\n  for (const request of dueRequests) {\n    try {\n      addCounts(counts, await processDeletionRequest({ request, now }));\n    } catch (error) {\n      counts.errors += 1;\n      logger.error('privacy.deletion_process_failed', {\n        requestId: request._id.toString(),\n        error,\n      });\n    }\n  }\n\n`;
  const newLoop = `  const counts = createEmptyCounts();\n  for (let processed = 0; processed < limit; processed += 1) {\n    const request = await claimNextPrivacyDeletionRequest({ now });\n    if (!request) break;\n    try {\n      addCounts(counts, await processDeletionRequest({ request, now }));\n    } catch (error) {\n      counts.errors += 1;\n      await releasePrivacyDeletionClaim({ request, error, now });\n      logger.error('privacy.deletion_process_failed', { requestId: request._id.toString(), error });\n    }\n  }\n\n`;
  if (!privacy.includes(oldLoop)) throw new Error('Privacy processing loop anchor missing');
  privacy = privacy.replace(oldLoop, newLoop);
  write(privacyServicePath, privacy);
}

const encryptedPath = 'Frontend/Chatify/src/utils/encryptedMessages.ts';
let encrypted = read(encryptedPath);
if (encrypted.includes("const CONVERSATION_SECRET_PREFIX = 'chatify:e2ee:v1:conversation-secret:';")) {
  encrypted = encrypted.replace(
    "const CONVERSATION_SECRET_PREFIX = 'chatify:e2ee:v1:conversation-secret:';\n",
    "const ENCRYPTION_KEYRING_DB = 'chatify-e2ee-keyring-v1';\nconst ENCRYPTION_KEYRING_DB_VERSION = 1;\nconst ENCRYPTION_KEYRING_STORE = 'conversation-secrets';\nconst ENCRYPTION_DEVICE_KEY_STORE = 'device-keys';\nconst ENCRYPTION_DEVICE_KEY_ID = 'device-wrapping-key';\n"
  );
  encrypted = encrypted.replace(
    `const getSecretStorageKey = (chatId: string) => \`\${CONVERSATION_SECRET_PREFIX}\${chatId}\`;\n`,
    `type WrappedSecret = { id: string; accountId: string; chatId: string; iv: string; ciphertext: string };\nlet activeEncryptionAccountId: string | null = null;\nlet cacheMarker: string | null = null;\nconst secretCache = new Map<string, string>();\nconst hasIndexedDb = () => typeof indexedDB !== 'undefined';\nconst requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {\n  request.onsuccess = () => resolve(request.result);\n  request.onerror = () => reject(request.error ?? new Error('Encrypted key storage failed'));\n});\nconst transactionComplete = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {\n  transaction.oncomplete = () => resolve();\n  transaction.onerror = () => reject(transaction.error ?? new Error('Encrypted key transaction failed'));\n  transaction.onabort = () => reject(transaction.error ?? new Error('Encrypted key transaction aborted'));\n});\nconst openKeyring = async () => {\n  if (!hasIndexedDb()) return null;\n  const request = indexedDB.open(ENCRYPTION_KEYRING_DB, ENCRYPTION_KEYRING_DB_VERSION);\n  request.onupgradeneeded = () => {\n    const db = request.result;\n    if (!db.objectStoreNames.contains(ENCRYPTION_KEYRING_STORE)) {\n      const store = db.createObjectStore(ENCRYPTION_KEYRING_STORE, { keyPath: 'id' });\n      store.createIndex('accountId', 'accountId', { unique: false });\n    }\n    if (!db.objectStoreNames.contains(ENCRYPTION_DEVICE_KEY_STORE)) {\n      db.createObjectStore(ENCRYPTION_DEVICE_KEY_STORE, { keyPath: 'id' });\n    }\n  };\n  return requestResult(request);\n};\nconst getWrappingKey = async (db: IDBDatabase) => {\n  const readTx = db.transaction(ENCRYPTION_DEVICE_KEY_STORE, 'readonly');\n  const existing = await requestResult<{ id: string; key: CryptoKey } | undefined>(\n    readTx.objectStore(ENCRYPTION_DEVICE_KEY_STORE).get(ENCRYPTION_DEVICE_KEY_ID)\n  );\n  await transactionComplete(readTx);\n  if (existing?.key) return existing.key;\n  const key = await getCrypto().subtle.generateKey({ name: ENCRYPTION_ALGORITHM, length: 256 }, false, ['encrypt', 'decrypt']);\n  const writeTx = db.transaction(ENCRYPTION_DEVICE_KEY_STORE, 'readwrite');\n  writeTx.objectStore(ENCRYPTION_DEVICE_KEY_STORE).put({ id: ENCRYPTION_DEVICE_KEY_ID, key });\n  await transactionComplete(writeTx);\n  return key;\n};\nconst persistSecret = async (accountId: string, chatId: string, secret: string) => {\n  const db = await openKeyring(); if (!db) return;\n  try {\n    const key = await getWrappingKey(db); const iv = new Uint8Array(AES_GCM_IV_BYTES); getCrypto().getRandomValues(iv);\n    const ciphertext = await getCrypto().subtle.encrypt({ name: ENCRYPTION_ALGORITHM, iv }, key, new TextEncoder().encode(secret));\n    const tx = db.transaction(ENCRYPTION_KEYRING_STORE, 'readwrite');\n    tx.objectStore(ENCRYPTION_KEYRING_STORE).put({ id: \`\${accountId}:\${chatId}\`, accountId, chatId,\n      iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) } satisfies WrappedSecret);\n    await transactionComplete(tx);\n  } finally { db.close(); }\n};\nconst synchronizeCacheMarker = () => {\n  if (!hasStorage()) return;\n  const current = window.localStorage.getItem('chatify:e2ee:keyring-session');\n  if (cacheMarker && current !== cacheMarker) secretCache.clear();\n  cacheMarker = current;\n};\n`
  );
  const oldStorage = `export const saveConversationSecret = (chatId: string, secret: string) => {\n  if (!chatId || !secret || !hasStorage()) {\n    return;\n  }\n\n  window.localStorage.setItem(getSecretStorageKey(chatId), secret);\n};\n\nexport const ensureConversationSecret = (chatId: string) => {\n  const existingSecret = getConversationSecret(chatId);\n\n  if (existingSecret) {\n    return existingSecret;\n  }\n\n  const secret = generateConversationSecret();\n  saveConversationSecret(chatId, secret);\n  return secret;\n};\n\nexport const getConversationSecret = (chatId: string) => {\n  if (!chatId || !hasStorage()) {\n    return null;\n  }\n\n  return window.localStorage.getItem(getSecretStorageKey(chatId));\n};\n\nexport const hasConversationSecret = (chatId?: string | null) => (\n  Boolean(chatId && getConversationSecret(chatId))\n);\n\nexport const clearConversationSecret = (chatId: string) => {\n  if (!chatId || !hasStorage()) {\n    return;\n  }\n\n  window.localStorage.removeItem(getSecretStorageKey(chatId));\n};\n`;
  const newStorage = `export const lockConversationSecrets = () => {\n  activeEncryptionAccountId = null; secretCache.clear(); cacheMarker = null;\n  if (hasStorage()) window.localStorage.removeItem('chatify:e2ee:keyring-session');\n};\nexport const configureConversationSecretAccount = async (accountId: string) => {\n  lockConversationSecrets(); activeEncryptionAccountId = String(accountId ?? '').trim() || null;\n  if (!activeEncryptionAccountId || !hasIndexedDb()) return;\n  cacheMarker = crypto.randomUUID();\n  if (hasStorage()) window.localStorage.setItem('chatify:e2ee:keyring-session', cacheMarker);\n  const account = activeEncryptionAccountId; const db = await openKeyring(); if (!db) return;\n  try {\n    const key = await getWrappingKey(db); const tx = db.transaction(ENCRYPTION_KEYRING_STORE, 'readonly');\n    const records = await requestResult<WrappedSecret[]>(tx.objectStore(ENCRYPTION_KEYRING_STORE).index('accountId').getAll(account));\n    await transactionComplete(tx);\n    for (const record of records) {\n      try {\n        const plaintext = await getCrypto().subtle.decrypt({ name: ENCRYPTION_ALGORITHM, iv: base64ToBytes(record.iv) }, key, base64ToBytes(record.ciphertext));\n        if (activeEncryptionAccountId === account) secretCache.set(record.chatId, new TextDecoder().decode(plaintext));\n      } catch { /* corrupted records remain unavailable */ }\n    }\n  } finally { db.close(); }\n};\nexport const saveConversationSecret = (chatId: string, secret: string) => {\n  if (!chatId || !secret) return; synchronizeCacheMarker(); secretCache.set(chatId, secret);\n  if (activeEncryptionAccountId) void persistSecret(activeEncryptionAccountId, chatId, secret);\n};\nexport const ensureConversationSecret = (chatId: string) => {\n  const existing = getConversationSecret(chatId); if (existing) return existing;\n  const secret = generateConversationSecret(); saveConversationSecret(chatId, secret); return secret;\n};\nexport const getConversationSecret = (chatId: string) => {\n  if (!chatId) return null; synchronizeCacheMarker(); return secretCache.get(chatId) ?? null;\n};\nexport const hasConversationSecret = (chatId?: string | null) => Boolean(chatId && getConversationSecret(chatId));\nexport const clearConversationSecret = (chatId: string) => { secretCache.delete(chatId); };\n`;
  if (!encrypted.includes(oldStorage)) throw new Error('Encrypted localStorage API anchor missing');
  encrypted = encrypted.replace(oldStorage, newStorage);
  write(encryptedPath, encrypted);
}

const authHookPath = 'Frontend/Chatify/src/hooks/useAuthQuery.ts';
let authHook = read(authHookPath);
if (!authHook.includes('configureConversationSecretAccount')) {
  authHook = authHook.replace(
    "import { useEffect } from 'react'\n",
    "import { useEffect } from 'react'\nimport { configureConversationSecretAccount, lockConversationSecrets } from '../utils/encryptedMessages'\n"
  );
  authHook = authHook.replace(
    `  useEffect(() => {\n    setUser(user || null)\n  }, [user, setUser])\n`,
    `  useEffect(() => {\n    setUser(user || null)\n    if (user?._id) void configureConversationSecretAccount(user._id)\n    else lockConversationSecrets()\n  }, [user, setUser])\n`
  );
  authHook = authHook.replaceAll(`      clearPresenceState()\n      logout()`, `      clearPresenceState()\n      lockConversationSecrets()\n      logout()`);
  write(authHookPath, authHook);
}

write('Frontend/Chatify/vercel.json', `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Content-Security-Policy", "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; media-src 'self' blob: https:; worker-src 'self' blob:; manifest-src 'self'; upgrade-insecure-requests" },
      { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
      { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
      { "key": "Cross-Origin-Resource-Policy", "value": "same-site" }
    ]
  }],
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
`);

const apiOriginPath = 'Frontend/Chatify/src/api/apiOrigin.ts';
write(apiOriginPath, `const normalizeOrigin = (value: string) => {
  const parsed = new URL(value);
  if (parsed.username || parsed.password || parsed.hash || parsed.search || !['/', ''].includes(parsed.pathname)) {
    throw new Error('VITE_API_BASE_URL must be an origin without credentials, path, query, or fragment');
  }
  if (import.meta.env.PROD && parsed.protocol !== 'https:') {
    throw new Error('VITE_API_BASE_URL must use HTTPS in production');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('VITE_API_BASE_URL must use HTTP or HTTPS');
  }
  return parsed.origin;
};
export const resolveApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return normalizeOrigin(configured);
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'http://localhost:5000';
};
export const resolveSocketBaseUrl = () => resolveApiBaseUrl();
`);

console.log(`Remediation transformed ${changed.size} file(s):`);
for (const relativePath of [...changed].sort()) console.log(`- ${relativePath}`);
