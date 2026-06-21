import { useCallback, useEffect, useMemo, useState } from 'react';
import { userApi } from '../api/userApi';
import type {
  NotificationPreferencePatch,
  NotificationPreferences,
  PushSubscriptionPayload,
} from '../types/notifications';
import { isSoundEnabled } from '../utils/sounds';

const STORAGE_KEY_PREFIX = 'chatify_notification_preferences';
const STORAGE_VERSION = 1;

type StoredNotificationPreferences = Partial<NotificationPreferences> & {
  version?: number;
};

export const getNotificationPreferencesStorageKey = (userId: string) => (
  `${STORAGE_KEY_PREFIX}_${encodeURIComponent(userId)}`
);

export const getDefaultNotificationPreferences = (): NotificationPreferences => ({
  soundEnabled: isSoundEnabled(),
  browserNotificationsEnabled: false,
  pushEnabled: false,
  emailNotificationsEnabled: false,
  messagePreviewMode: 'none',
  emailUnsubscribed: false,
  pushSubscriptionCount: 0,
  mutedChatIds: [],
});

const normalizePreferences = (stored: StoredNotificationPreferences | null): NotificationPreferences => {
  const defaults = getDefaultNotificationPreferences();

  if (!stored || typeof stored !== 'object') {
    return defaults;
  }

  return {
    soundEnabled: typeof stored.soundEnabled === 'boolean' ? stored.soundEnabled : defaults.soundEnabled,
    browserNotificationsEnabled:
      typeof stored.browserNotificationsEnabled === 'boolean'
        ? stored.browserNotificationsEnabled
        : defaults.browserNotificationsEnabled,
    pushEnabled: typeof stored.pushEnabled === 'boolean' ? stored.pushEnabled : defaults.pushEnabled,
    emailNotificationsEnabled:
      typeof stored.emailNotificationsEnabled === 'boolean'
        ? stored.emailNotificationsEnabled
        : defaults.emailNotificationsEnabled,
    messagePreviewMode: stored.messagePreviewMode === 'none' ? stored.messagePreviewMode : defaults.messagePreviewMode,
    emailUnsubscribed: typeof stored.emailUnsubscribed === 'boolean' ? stored.emailUnsubscribed : defaults.emailUnsubscribed,
    pushSubscriptionCount:
      typeof stored.pushSubscriptionCount === 'number' && Number.isFinite(stored.pushSubscriptionCount)
        ? stored.pushSubscriptionCount
        : defaults.pushSubscriptionCount,
    mutedChatIds: Array.isArray(stored.mutedChatIds)
      ? [...new Set(stored.mutedChatIds.filter((chatId): chatId is string => typeof chatId === 'string' && chatId.trim().length > 0))]
      : defaults.mutedChatIds,
  };
};

const mergeServerPreferences = (
  current: NotificationPreferences,
  serverPreferences: Omit<NotificationPreferences, 'soundEnabled' | 'browserNotificationsEnabled'>
): NotificationPreferences => ({
  ...current,
  pushEnabled: serverPreferences.pushEnabled,
  emailNotificationsEnabled: serverPreferences.emailNotificationsEnabled,
  messagePreviewMode: serverPreferences.messagePreviewMode,
  emailUnsubscribed: serverPreferences.emailUnsubscribed,
  pushSubscriptionCount: serverPreferences.pushSubscriptionCount,
  mutedChatIds: serverPreferences.mutedChatIds,
});

export const readNotificationPreferences = (userId?: string | null): NotificationPreferences => {
  if (!userId || typeof window === 'undefined') {
    return getDefaultNotificationPreferences();
  }

  try {
    const rawValue = window.localStorage.getItem(getNotificationPreferencesStorageKey(userId));

    if (!rawValue) {
      return getDefaultNotificationPreferences();
    }

    return normalizePreferences(JSON.parse(rawValue) as StoredNotificationPreferences);
  } catch {
    return getDefaultNotificationPreferences();
  }
};

const writeNotificationPreferences = (
  userId: string | null | undefined,
  preferences: NotificationPreferences
) => {
  if (!userId || typeof window === 'undefined') {
    return;
  }

  const storageKey = getNotificationPreferencesStorageKey(userId);
  const nextValue = JSON.stringify({
    version: STORAGE_VERSION,
    ...preferences,
  });

  try {
    window.localStorage.setItem(storageKey, nextValue);
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: nextValue }));
  } catch {
    // Preference changes still apply in memory when localStorage is unavailable.
  }
};

export const useNotificationPreferences = (userId?: string | null) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => (
    readNotificationPreferences(userId)
  ));
  const [isLoadingServerPreferences, setIsLoadingServerPreferences] = useState(false);
  const [isSavingServerPreferences, setIsSavingServerPreferences] = useState(false);
  const [serverPreferenceError, setServerPreferenceError] = useState<string | null>(null);

  const storageKey = useMemo(() => (
    userId ? getNotificationPreferencesStorageKey(userId) : null
  ), [userId]);

  useEffect(() => {
    setPreferences(readNotificationPreferences(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setIsLoadingServerPreferences(false);
      setServerPreferenceError(null);
      return undefined;
    }

    let isActive = true;
    setIsLoadingServerPreferences(true);

    userApi.getNotificationPreferences()
      .then((response) => {
        if (!isActive) {
          return;
        }

        setServerPreferenceError(null);
        setPreferences((current) => {
          const next = mergeServerPreferences(current, response.data.data.preferences);
          writeNotificationPreferences(userId, next);
          return next;
        });
      })
      .catch(() => {
        if (isActive) {
          setServerPreferenceError('Notification preferences are using local fallback.');
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingServerPreferences(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!storageKey) {
      return undefined;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        setPreferences(readNotificationPreferences(userId));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [storageKey, userId]);

  const updatePreferences = useCallback((
    updater: (current: NotificationPreferences) => NotificationPreferences
  ) => {
    setPreferences((current) => {
      const next = updater(current);
      writeNotificationPreferences(userId, next);
      return next;
    });
  }, [userId]);

  const setSoundPreference = useCallback((enabled: boolean) => {
    updatePreferences((current) => ({ ...current, soundEnabled: enabled }));
  }, [updatePreferences]);

  const setBrowserNotificationsEnabled = useCallback((enabled: boolean) => {
    updatePreferences((current) => ({ ...current, browserNotificationsEnabled: enabled }));
  }, [updatePreferences]);

  const updateServerPreferences = useCallback(async (patch: NotificationPreferencePatch) => {
    if (!userId) {
      updatePreferences((current) => ({ ...current, ...patch }));
      return;
    }

    const previous = preferences;
    setServerPreferenceError(null);
    setIsSavingServerPreferences(true);
    updatePreferences((current) => ({ ...current, ...patch }));

    try {
      const response = await userApi.updateNotificationPreferences(patch);
      setPreferences((current) => {
        const next = mergeServerPreferences(current, response.data.data.preferences);
        writeNotificationPreferences(userId, next);
        return next;
      });
    } catch {
      setPreferences(previous);
      writeNotificationPreferences(userId, previous);
      setServerPreferenceError('Notification preferences could not be saved.');
      throw new Error('Notification preferences could not be saved.');
    } finally {
      setIsSavingServerPreferences(false);
    }
  }, [preferences, updatePreferences, userId]);

  const setPushNotificationsEnabled = useCallback((enabled: boolean) => (
    updateServerPreferences({ pushEnabled: enabled })
  ), [updateServerPreferences]);

  const setEmailNotificationsEnabled = useCallback((enabled: boolean) => (
    updateServerPreferences({ emailNotificationsEnabled: enabled })
  ), [updateServerPreferences]);

  const registerPushSubscription = useCallback(async (subscription: PushSubscriptionPayload) => {
    if (!userId) {
      return;
    }

    setServerPreferenceError(null);
    setIsSavingServerPreferences(true);

    try {
      const response = await userApi.registerPushSubscription(subscription);
      setPreferences((current) => {
        const next = mergeServerPreferences(current, response.data.data.preferences);
        writeNotificationPreferences(userId, next);
        return next;
      });
    } catch {
      setServerPreferenceError('Push notifications could not be enabled.');
      throw new Error('Push notifications could not be enabled.');
    } finally {
      setIsSavingServerPreferences(false);
    }
  }, [userId]);

  const muteChat = useCallback((chatId: string) => {
    updatePreferences((current) => ({
      ...current,
      mutedChatIds: current.mutedChatIds.includes(chatId)
        ? current.mutedChatIds
        : [...current.mutedChatIds, chatId],
    }));

    if (userId) {
      const nextMutedChatIds = preferences.mutedChatIds.includes(chatId)
        ? preferences.mutedChatIds
        : [...preferences.mutedChatIds, chatId];
      userApi.updateNotificationPreferences({ mutedChatIds: nextMutedChatIds })
        .then((response) => {
          setPreferences((current) => {
            const next = mergeServerPreferences(current, response.data.data.preferences);
            writeNotificationPreferences(userId, next);
            return next;
          });
        })
        .catch(() => {
          setServerPreferenceError('Notification mute could not be saved to the server.');
        });
    }
  }, [preferences.mutedChatIds, updatePreferences, userId]);

  const unmuteChat = useCallback((chatId: string) => {
    updatePreferences((current) => ({
      ...current,
      mutedChatIds: current.mutedChatIds.filter((mutedChatId) => mutedChatId !== chatId),
    }));

    if (userId) {
      userApi.updateNotificationPreferences({
        mutedChatIds: preferences.mutedChatIds.filter((mutedChatId) => mutedChatId !== chatId),
      })
        .then((response) => {
          setPreferences((current) => {
            const next = mergeServerPreferences(current, response.data.data.preferences);
            writeNotificationPreferences(userId, next);
            return next;
          });
        })
        .catch(() => {
          setServerPreferenceError('Notification mute could not be saved to the server.');
        });
    }
  }, [preferences.mutedChatIds, updatePreferences, userId]);

  const isChatMuted = useCallback((chatId: string) => (
    preferences.mutedChatIds.includes(chatId)
  ), [preferences.mutedChatIds]);

  return {
    preferences,
    soundEnabled: preferences.soundEnabled,
    browserNotificationsEnabled: preferences.browserNotificationsEnabled,
    pushEnabled: preferences.pushEnabled,
    emailNotificationsEnabled: preferences.emailNotificationsEnabled,
    messagePreviewMode: preferences.messagePreviewMode,
    emailUnsubscribed: preferences.emailUnsubscribed,
    pushSubscriptionCount: preferences.pushSubscriptionCount,
    mutedChatIds: preferences.mutedChatIds,
    isLoadingServerPreferences,
    isSavingServerPreferences,
    serverPreferenceError,
    setSoundEnabled: setSoundPreference,
    setBrowserNotificationsEnabled,
    setPushNotificationsEnabled,
    setEmailNotificationsEnabled,
    registerPushSubscription,
    muteChat,
    unmuteChat,
    isChatMuted,
  };
};
