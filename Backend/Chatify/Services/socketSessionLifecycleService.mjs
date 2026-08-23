import {
  readAccessTokenFromCookieHeader,
  verifyAccessToken,
} from '../Utils/authToken.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

let installedServers = new WeakSet();
const sessionSockets = new Map();
const userSockets = new Map();
const socketMetadata = new Map();
const accessTokenExpiryTimers = new Map();

const normalizeId = (value) => value?.toString?.() ?? '';

const addSocket = (index, key, socket) => {
  if (!index.has(key)) {
    index.set(key, new Set());
  }

  index.get(key).add(socket);
};

const removeSocket = (index, key, socket) => {
  const sockets = index.get(key);
  if (!sockets) return;

  sockets.delete(socket);
  if (sockets.size === 0) {
    index.delete(key);
  }
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
      !normalizedUserId ||
      !normalizedSessionId ||
      normalizedUserId !== socketUserId ||
      normalizedSessionId !== socketSessionId
    ) {
      revokeSocket(socket, 'session_identity_mismatch');
      return;
    }

    const metadata = {
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

export const installSocketSessionLifecycle = (io) => {
  if (!io || installedServers.has(io)) {
    return io;
  }

  installedServers.add(io);
  io.on('connection', registerAuthenticatedSocket);
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
});

export const resetSocketSessionLifecycleForTests = () => {
  accessTokenExpiryTimers.forEach((timer) => clearTimeout(timer));
  accessTokenExpiryTimers.clear();
  sessionSockets.clear();
  userSockets.clear();
  socketMetadata.clear();
  installedServers = new WeakSet();
};
