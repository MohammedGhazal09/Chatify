import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

export const MESSAGE_PREVIEW_MODES = Object.freeze({
  NONE: 'none',
});

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

export const normalizePushSubscriptionPayload = (payload) => {
  if (!isPlainObject(payload)) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Push subscription payload is invalid',
    };
  }

  const endpoint = typeof payload.endpoint === 'string' ? payload.endpoint.trim() : '';
  const keys = isPlainObject(payload.keys) ? payload.keys : {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh.trim() : '';
  const auth = typeof keys.auth === 'string' ? keys.auth.trim() : '';

  if (!/^https:\/\/.+/i.test(endpoint)) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Push endpoint is invalid',
    };
  }

  if (!p256dh || !auth || p256dh.length > 512 || auth.length > 256) {
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
