import Session from '../Models/sessionModel.mjs';
import {
  readAccessTokenFromCookieHeader,
  verifyAccessToken,
} from '../Utils/authToken.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const DEFAULT_SESSION_REVALIDATION_MS = 15_000;
const MIN_SESSION_REVALIDATION_MS = 1_000;
const MAX_SESSION_REVALIDATION_MS = 60_000;

let installedServers = new WeakSet();
const sessionSockets = new Map();
const userSockets = new Map();
const socketMetadata = new Map();
const accessTokenExpiryTimers = new Map();
let sessionRevalidationTimer = null;
let sessionRevalidationPromise = null;

const normalizeId = (value) => value?.toString?.() ?? '';

const getSessionRevalidationMs = (env = process.env) => {
  const configured = Number.parseInt(env.SOCKET_SESSION_REVALIDATION_MS ?? '', 10);
  if (!Number.isSafeInteger(configured) || configured < MIN_SESSION_REVALIDATION_MS) {
    return DEFAULT_SESSION_REVALIDATION_MS;
  }
  return Math.min(configured, MAX_SESSION_REVALIDATION_MS);
};

const addSocket = (index, key, socket) => {
  if (!index.has(key)) index.set(key, new Set());
  index.get(key).add(socket);
};

const removeSocket = (index, key, socket) => {
  const sockets = index.get(key);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) index.delete(key);
};

const clearAccessTokenExpiryTimer = (socketId) => {
  const timer = accessTokenExpiryTimers.get(socketId);
  if (!timer) return;
  clearTimeout(timer);
  accessTokenExpiryTimers.delete(socketId);
};

const unregisterAuthenticatedSocket = (socket) => {
  const metadata = socketMetadata.get(socket.id);
  clearAccessTokenExpiryTimer(socket.id);
  if (!metadata) return;

  socketMetadata.delete(socket.id);
  removeSocket(sessionSockets, metadata.sessionId, socket);
  removeSocket(userSockets, metadata.userId, socket);
};

const revokeSocket = (socket, reason) => {
  if (!socket?.connected) {
    unregisterAuthenticatedSocket(socket);
    return false;
  }

  socket.emit('auth:revoked', { reason });
  socket.disconnect(true);
  return true;
};

const scheduleAccessTokenExpiry = (socket, expiresAtMs) => {
  const revokeExpiredSocket = () => {
    accessTokenExpiryTimers.delete(socket.id);
    revokeSocket(socket, 'access_token_expired');
  };
  const delayMs = expiresAtMs - Date.now();

  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    queueMicrotask(revokeExpiredSocket);
    return;
  }

  const timer = setTimeout(revokeExpiredSocket, delayMs);
  timer.unref?.();
  accessTokenExpiryTimers.set(socket.id, timer);
};

const registerAuthenticatedSocket = (socket) => {
  const token = readAccessTokenFromCookieHeader(socket.handshake.headers.cookie);

  try {
    const { userId, sessionId, decoded } = verifyAccessToken(token);
    const normalizedUserId = normalizeId(userId);
    const normalizedSessionId = normalizeId(sessionId);
    const socketUserId = normalizeId(socket.data.userId);
    const socketSessionId = normalizeId(socket.data.sessionId);

    if (
      !normalizedUserId
      || !normalizedSessionId
      || normalizedUserId !== socketUserId
      || normalizedSessionId !== socketSessionId
    ) {
      revokeSocket(socket, 'session_identity_mismatch');
      return;
    }

    const metadata = {
      socket,
      userId: normalizedUserId,
      sessionId: normalizedSessionId,
      expiresAtMs: Number(decoded.exp) * 1000,
    };

    socketMetadata.set(socket.id, metadata);
    addSocket(sessionSockets, metadata.sessionId, socket);
    addSocket(userSockets, metadata.userId, socket);
    socket.once('disconnect', () => unregisterAuthenticatedSocket(socket));
    scheduleAccessTokenExpiry(socket, metadata.expiresAtMs);
  } catch (error) {
    logger.warn('socket.session_lifecycle_registration_failed', {
      socketId: socket.id,
      code: error?.code ?? error?.name,
    });
    revokeSocket(socket, 'session_invalid');
  }
};

const performSessionRevalidation = async () => {
  const metadataRows = [...socketMetadata.values()];
  if (metadataRows.length === 0) return 0;

  const sessionIds = [...new Set(metadataRows.map((metadata) => metadata.sessionId))];
  const now = new Date();
  const activeSessions = await Session.find({
    _id: { $in: sessionIds },
    revokedAt: null,
    expiresAt: { $gt: now },
  }).select('_id userId').lean();
  const activeById = new Map(activeSessions.map((session) => [
    normalizeId(session._id),
    normalizeId(session.userId),
  ]));
  let disconnected = 0;

  for (const metadata of metadataRows) {
    const activeUserId = activeById.get(metadata.sessionId);
    if (activeUserId === metadata.userId) continue;
    disconnected += revokeSocket(metadata.socket, 'session_revoked_remote') ? 1 : 0;
  }

  return disconnected;
};

export const revalidateSocketSessions = async () => {
  if (sessionRevalidationPromise) return sessionRevalidationPromise;

  sessionRevalidationPromise = performSessionRevalidation()
    .catch((error) => {
      logger.error('socket.session_revalidation_failed', {
        connectedSockets: socketMetadata.size,
        error,
      });
      return 0;
    })
    .finally(() => {
      sessionRevalidationPromise = null;
    });

  return sessionRevalidationPromise;
};

const startSessionRevalidation = () => {
  if (sessionRevalidationTimer) return;
  sessionRevalidationTimer = setInterval(() => {
    void revalidateSocketSessions();
  }, getSessionRevalidationMs());
  sessionRevalidationTimer.unref?.();
};

export const installSocketSessionLifecycle = (io) => {
  if (!io || installedServers.has(io)) return io;

  installedServers.add(io);
  io.on('connection', registerAuthenticatedSocket);
  startSessionRevalidation();
  return io;
};

export const disconnectSessionSockets = (sessionId, reason = 'session_revoked') => {
  const normalizedSessionId = normalizeId(sessionId);
  const sockets = [...(sessionSockets.get(normalizedSessionId) ?? [])];

  return sockets.reduce(
    (count, socket) => count + (revokeSocket(socket, reason) ? 1 : 0),
    0
  );
};

export const disconnectUserSessionSockets = (userId, reason = 'all_sessions_revoked') => {
  const normalizedUserId = normalizeId(userId);
  const sockets = [...(userSockets.get(normalizedUserId) ?? [])];

  return sockets.reduce(
    (count, socket) => count + (revokeSocket(socket, reason) ? 1 : 0),
    0
  );
};

export const getSocketSessionLifecycleStatus = () => ({
  connectedUsers: userSockets.size,
  connectedSessions: sessionSockets.size,
  connectedSockets: socketMetadata.size,
  pendingAccessTokenExpiryTimers: accessTokenExpiryTimers.size,
  databaseRevalidation: {
    enabled: Boolean(sessionRevalidationTimer),
    intervalMs: getSessionRevalidationMs(),
    inProgress: Boolean(sessionRevalidationPromise),
  },
});

export const resetSocketSessionLifecycleForTests = () => {
  accessTokenExpiryTimers.forEach((timer) => clearTimeout(timer));
  accessTokenExpiryTimers.clear();
  if (sessionRevalidationTimer) clearInterval(sessionRevalidationTimer);
  sessionRevalidationTimer = null;
  sessionRevalidationPromise = null;
  sessionSockets.clear();
  userSockets.clear();
  socketMetadata.clear();
  installedServers = new WeakSet();
};
