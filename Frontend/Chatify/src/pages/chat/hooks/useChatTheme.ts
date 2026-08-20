import { useCallback, useEffect, useMemo, useState } from 'react';

export type ChatTheme = 'light' | 'dark';
export type ChatThemePreference = ChatTheme | 'system';

const CHAT_THEME_OVERRIDE_STORAGE_KEY = 'chatify_chat_theme_override';

export const getChatThemeStorageKey = (userId?: string | null) => (
  `chatify_chat_theme:${userId ?? 'guest'}`
);

const isChatTheme = (value: string | null): value is ChatTheme => value === 'light' || value === 'dark';

const isThemePreference = (value: string | null): value is ChatThemePreference => (
  value === 'light' || value === 'dark' || value === 'system'
);

const readJsonString = (key: string) => {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawValue = window.localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return typeof parsedValue === 'string' ? parsedValue : null;
  } catch {
    return rawValue;
  }
};

const getUrlThemeOverride = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const theme = new URLSearchParams(window.location.search).get('chatTheme');
  return isChatTheme(theme) ? theme : null;
};

const getStoredThemeOverride = () => {
  const theme = readJsonString(CHAT_THEME_OVERRIDE_STORAGE_KEY);
  return isChatTheme(theme) ? theme : null;
};

const getSystemTheme = (): ChatTheme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getStoredPreference = (storageKey: string): ChatThemePreference => {
  const preference = readJsonString(storageKey);
  return isThemePreference(preference) ? preference : 'system';
};

const resolveTheme = (preference: ChatThemePreference, forcedTheme: ChatTheme | null): ChatTheme => {
  if (forcedTheme) {
    return forcedTheme;
  }

  return preference === 'system' ? getSystemTheme() : preference;
};

export const readChatThemeSnapshot = (userId?: string | null) => {
  const storageKey = getChatThemeStorageKey(userId);
  const forcedTheme = getUrlThemeOverride() ?? getStoredThemeOverride();
  const preference = getStoredPreference(storageKey);

  return {
    theme: resolveTheme(preference, forcedTheme),
    preference,
    isForced: Boolean(forcedTheme),
    storageKey,
  };
};

export const useChatTheme = (userId?: string | null) => {
  const storageKey = useMemo(() => getChatThemeStorageKey(userId), [userId]);
  const [snapshot, setSnapshot] = useState(() => readChatThemeSnapshot(userId));

  const refreshSnapshot = useCallback(() => {
    setSnapshot(readChatThemeSnapshot(userId));
  }, [userId]);

  const setPreference = useCallback((preference: ChatThemePreference) => {
    if (typeof window === 'undefined') {
      setSnapshot((currentSnapshot) => ({
        ...currentSnapshot,
        preference,
        theme: resolveTheme(preference, currentSnapshot.isForced ? currentSnapshot.theme : null),
      }));
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(preference));
    window.dispatchEvent(new StorageEvent('storage', {
      key: storageKey,
      newValue: JSON.stringify(preference),
    }));
    refreshSnapshot();
  }, [refreshSnapshot, storageKey]);

  useEffect(() => {
    refreshSnapshot();
  }, [refreshSnapshot]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    const handleChange = (event: StorageEvent | MediaQueryListEvent) => {
      if ('key' in event && event.key !== storageKey && event.key !== CHAT_THEME_OVERRIDE_STORAGE_KEY) {
        return;
      }
      refreshSnapshot();
    };

    window.addEventListener('storage', handleChange);
    mediaQuery?.addEventListener('change', handleChange);

    return () => {
      window.removeEventListener('storage', handleChange);
      mediaQuery?.removeEventListener('change', handleChange);
    };
  }, [refreshSnapshot, storageKey]);

  return {
    ...snapshot,
    setPreference,
  };
};
