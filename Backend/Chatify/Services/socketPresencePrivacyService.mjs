import User from '../Models/userModel.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';
import {
  getPresencePrivacyPolicy,
  serializeSocketPresence,
  shouldDeliverSocketPresenceTransition,
} from '../Utils/presencePrivacy.mjs';

const PRESENCE_STATUS_EVENT = 'user:status-change';
const PRESENCE_SNAPSHOT_EVENTS = new Set(['socket:ready', 'user:connected']);
const MUTATION_CONTEXT_TTL_MS = 30_000;
const patchedSockets = new WeakSet();
const readyPayloadPromises = new WeakMap();
const privacyMutations = new Map();
let installedServers = new WeakSet();

const toIdString = (value) => value?._id?.toString?.() ?? value?.toString?.() ?? '';

const loadPresenceUsers = (userIds) => User.find({
  _id: { $in: [...new Set(userIds.filter(Boolean))] },
})
  .select('_id isOnline lastSeen showOnlineStatus showLastSeen showProfileStatus')
  .lean();

const getMutationContext = (userId) => {
  const normalizedUserId = toIdString(userId);
  const context = privacyMutations.get(normalizedUserId);

  if (!context) return null;
  if (context.expiresAt <= Date.now()) {
    privacyMutations.delete(normalizedUserId);
    return null;
  }

  return context;
};

export const beginPresencePrivacyMutation = (user) => {
  const userId = toIdString(user?._id);
  if (!userId) return () => {};

  const token = Symbol(userId);
  privacyMutations.set(userId, {
    token,
    previousPolicy: getPresencePrivacyPolicy(user),
    expiresAt: Date.now() + MUTATION_CONTEXT_TTL_MS,
  });

  return () => {
    const current = privacyMutations.get(userId);
    if (current?.token === token) {
      privacyMutations.delete(userId);
    }
  };
};

const sanitizeStatusPayload = async ({ payload, mutationContext }) => {
  const userId = toIdString(payload?.userId);
  if (!userId) return null;

  const user = await User.findById(userId)
    .select('_id isOnline lastSeen showOnlineStatus showLastSeen showProfileStatus')
    .lean();

  if (!user || !shouldDeliverSocketPresenceTransition({
    entry: payload,
    user,
    previousPolicy: mutationContext?.previousPolicy,
  })) {
    return null;
  }

  return serializeSocketPresence(payload, user);
};

const sanitizeReadyPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return Promise.resolve({ presence: [] });
  }

  const cached = readyPayloadPromises.get(payload);
  if (cached) return cached;

  const promise = (async () => {
    const presence = Array.isArray(payload.presence) ? payload.presence : [];
    const userIds = presence.map((entry) => toIdString(entry?.userId));
    const users = await loadPresenceUsers(userIds);
    const usersById = new Map(users.map((user) => [toIdString(user._id), user]));
    const sanitizedPresence = presence
      .map((entry) => serializeSocketPresence(
        entry,
        usersById.get(toIdString(entry?.userId))
      ))
      .filter(Boolean);

    return {
      ...payload,
      presence: sanitizedPresence,
    };
  })();

  readyPayloadPromises.set(payload, promise);
  return promise;
};

const safelyEmitAsync = ({
  socket,
  originalEmit,
  eventName,
  remainingArgs,
  sanitizer,
  fallbackPayload,
}) => {
  void sanitizer()
    .catch((error) => {
      logger.error('socket.presence_privacy_filter_failed', {
        event: eventName,
        socketId: socket.id,
        error,
      });
      return fallbackPayload;
    })
    .then((safePayload) => {
      if (!safePayload || !socket.connected) return;
      originalEmit(eventName, safePayload, ...remainingArgs);
    });

  return socket;
};

const patchSocketEmit = (socket) => {
  if (patchedSockets.has(socket)) return;
  patchedSockets.add(socket);

  const originalEmit = socket.emit.bind(socket);

  socket.emit = (eventName, ...args) => {
    const [payload, ...remainingArgs] = args;

    if (eventName === PRESENCE_STATUS_EVENT) {
      const mutationContext = getMutationContext(payload?.userId);
      return safelyEmitAsync({
        socket,
        originalEmit,
        eventName,
        remainingArgs,
        sanitizer: () => sanitizeStatusPayload({ payload, mutationContext }),
        fallbackPayload: null,
      });
    }

    if (PRESENCE_SNAPSHOT_EVENTS.has(eventName)) {
      return safelyEmitAsync({
        socket,
        originalEmit,
        eventName,
        remainingArgs,
        sanitizer: () => sanitizeReadyPayload(payload),
        fallbackPayload: {
          ...(payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}),
          presence: [],
        },
      });
    }

    return originalEmit(eventName, ...args);
  };
};

export const installSocketPresencePrivacy = (io) => {
  if (!io || installedServers.has(io)) return io;

  installedServers.add(io);
  const listener = (socket) => patchSocketEmit(socket);

  if (typeof io.prependListener === 'function') {
    io.prependListener('connection', listener);
  } else {
    io.on('connection', listener);
  }

  return io;
};

export const resetSocketPresencePrivacyForTests = () => {
  privacyMutations.clear();
  installedServers = new WeakSet();
};
