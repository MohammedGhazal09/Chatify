import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

export const MESSAGE_PREVIEW_MODES = Object.freeze({
  NONE: 'none',
});

const DEFAULT_PUSH_ENDPOINT_HOSTS = Object.freeze([
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);

export const getDefaultNotificationPreferences = () => ({
  pushEnabled: false,
  emailNotificationsEnabled: false,
  messagePreviewMode: MESSAGE_PREVIEW_MODES.NONE,
  mutedChatIds: [],
  emailUnsubscribed: false,
  pushSubscriptionCount: 0,
});

const isPlainObject = (value) => (
  Boolean(value) &&
  typeof value === 'object' &&
  !Array.isArray(value)
);

const toPreferenceObject = (userOrPreferences) => (
  userOrPreferences?.notificationPreferences ?? userOrPreferences ?? {}
);

export const serializeNotificationPreferences = (userOrPreferences) => {
  const preferences = toPreferenceObject(userOrPreferences);

  return {
    pushEnabled: Boolean(preferences.pushEnabled),
    emailNotificationsEnabled: Boolean(preferences.emailNotificationsEnabled),
    messagePreviewMode: preferences.messagePreviewMode === MESSAGE_PREVIEW_MODES.NONE
      ? preferences.messagePreviewMode
      : MESSAGE_PREVIEW_MODES.NONE,
    mutedChatIds: (preferences.mutedChatIds ?? [])
      .map((chatId) => chatId?.toString?.() ?? '')
      .filter(Boolean),
    emailUnsubscribed: Boolean(preferences.emailUnsubscribedAt),
    pushSubscriptionCount: Array.isArray(preferences.pushSubscriptions)
      ? preferences.pushSubscriptions.length
      : 0,
  };
};

const normalizeMutedChatIds = (value) => {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      statusCode: 400,
      message: 'mutedChatIds must be an array',
    };
  }

  const uniqueIds = [];
  const seen = new Set();

  for (const rawChatId of value) {
    const chatId = typeof rawChatId === 'string' ? rawChatId.trim() : rawChatId?.toString?.();

    if (!chatId || !mongoose.Types.ObjectId.isValid(chatId)) {
      return {
        ok: false,
        statusCode: 400,
        message: 'mutedChatIds contains an invalid chat id',
      };
    }

    if (!seen.has(chatId)) {
      seen.add(chatId);
      uniqueIds.push(new mongoose.Types.ObjectId(chatId));
    }
  }

  return {
    ok: true,
    mutedChatIds: uniqueIds,
  };
};

export const normalizeNotificationPreferencePatch = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Notification preferences payload is invalid',
    };
  }

  const set = {};

  if ('pushEnabled' in payload) {
    if (typeof payload.pushEnabled !== 'boolean') {
      return {
        ok: false,
        statusCode: 400,
        message: 'pushEnabled must be a boolean',
      };
    }

    set['notificationPreferences.pushEnabled'] = payload.pushEnabled;
  }

  if ('emailNotificationsEnabled' in payload) {
    if (typeof payload.emailNotificationsEnabled !== 'boolean') {
      return {
        ok: false,
        statusCode: 400,
        message: 'emailNotificationsEnabled must be a boolean',
      };
    }

    set['notificationPreferences.emailNotificationsEnabled'] = payload.emailNotificationsEnabled;
  }

  if ('messagePreviewMode' in payload) {
    if (payload.messagePreviewMode !== MESSAGE_PREVIEW_MODES.NONE) {
      return {
        ok: false,
        statusCode: 400,
        message: 'messagePreviewMode must be none',
      };
    }

    set['notificationPreferences.messagePreviewMode'] = MESSAGE_PREVIEW_MODES.NONE;
  }

  if ('mutedChatIds' in payload) {
    const mutedChatIds = normalizeMutedChatIds(payload.mutedChatIds);

    if (!mutedChatIds.ok) {
      return mutedChatIds;
    }

    set['notificationPreferences.mutedChatIds'] = mutedChatIds.mutedChatIds;
  }

  return {
    ok: true,
    set,
  };
};

export const hashPushEndpoint = (endpoint) => createHash('sha256')
  .update(endpoint)
  .digest('base64url');

const getAllowedPushHosts = () => new Set([
  ...DEFAULT_PUSH_ENDPOINT_HOSTS,
  ...String(process.env.PUSH_ENDPOINT_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
]);

const isAllowedPushHostname = (hostname) => {
  const normalizedHostname = hostname.toLowerCase();
  const allowedHosts = getAllowedPushHosts();

  if (allowedHosts.has(normalizedHostname)) {
    return true;
  }

  return normalizedHostname.endsWith('.notify.windows.com');
};

const decodeBase64Url = (value) => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  try {
    return Buffer.from(value, 'base64url');
  } catch {
    return null;
  }
};

const normalizePushEndpoint = (value) => {
  let endpointUrl;

  try {
    endpointUrl = new URL(value);
  } catch {
    return null;
  }

  if (
    endpointUrl.protocol !== 'https:' ||
    endpointUrl.username ||
    endpointUrl.password ||
    endpointUrl.hash ||
    (endpointUrl.port && endpointUrl.port !== '443') ||
    !isAllowedPushHostname(endpointUrl.hostname)
  ) {
    return null;
  }

  endpointUrl.port = '';
  return endpointUrl.toString();
};

export const normalizePushSubscriptionPayload = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Push subscription payload is invalid',
    };
  }

  const rawEndpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  const endpoint = normalizePushEndpoint(rawEndpoint);
  const keys = isPlainObject(payload.keys) ? payload.keys : {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : '';
  const auth = typeof keys.auth === 'string' ? keys.auth.trim() : '';
  const decodedP256dh = decodeBase64Url(p256dh);
  const decodedAuth = decodeBase64Url(auth);

  if (!endpoint) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Push endpoint is invalid',
    };
  }

  if (decodedP256dh?.length !== 65 || decodedAuth?.length !== 16) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Push subscription keys are invalid',
    };
  }

  return {
    ok: true,
    subscription: {
      endpoint,
      endpointHash: hashPushEndpoint(endpoint),
      keys: {
        p256dh,
        auth,
      },
      updatedAt: new Date(),
    },
  };
};

export const isChatMutedForPreferences = (preferences, chatId) => {
  const chatIdString = chatId?.toString?.();

  if (!chatIdString) {
    return false;
  }

  return (preferences?.mutedChatIds ?? [])
    .some((mutedChatId) => mutedChatId?.toString?.() === chatIdString);
};
