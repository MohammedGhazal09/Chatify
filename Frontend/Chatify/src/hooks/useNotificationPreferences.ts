import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NotificationPreferences } from '../types/notifications';
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
    mutedChatIds: Array.isArray(stored.mutedChatIds)
      ? [...new Set(stored.mutedChatIds.filter((chatId): chatId is string => typeof chatId === 'string' && chatId.trim().length > 0))]
      : defaults.mutedChatIds,
  };
};

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

  const storageKey = useMemo(() => (
    userId ? getNotificationPreferencesStorageKey(userId) : null
  ), [userId]);

  useEffect(() => {
    setPreferences(readNotificationPreferences(userId));
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

  const muteChat = useCallback((chatId: string) => {
    updatePreferences((current) => ({
      ...current,
      mutedChatIds: current.mutedChatIds.includes(chatId)
        ? current.mutedChatIds
        : [...current.mutedChatIds, chatId],
    }));
  }, [updatePreferences]);

  const unmuteChat = useCallback((chatId: string) => {
    updatePreferences((current) => ({
      ...current,
      mutedChatIds: current.mutedChatIds.filter((mutedChatId) => mutedChatId !== chatId),
    }));
  }, [updatePreferences]);

  const isChatMuted = useCallback((chatId: string) => (
    preferences.mutedChatIds.includes(chatId)
  ), [preferences.mutedChatIds]);

  return {
    preferences,
    soundEnabled: preferences.soundEnabled,
    browserNotificationsEnabled: preferences.browserNotificationsEnabled,
    mutedChatIds: preferences.mutedChatIds,
    setSoundEnabled: setSoundPreference,
    setBrowserNotificationsEnabled,
    muteChat,
    unmuteChat,
    isChatMuted,
  };
};
