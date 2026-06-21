import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLocaleMeta,
  resolveLocale,
  translate,
} from './locales';
import { LocaleContext } from './localeContext';
import type { LocaleContextValue } from './localeContext';
import type { LocaleCode } from './locales';

const defaultDateTimeOptions: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

const readStoredLocale = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_LOCALE;
  }

  return resolveLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
};

export const LocaleProvider = ({ children }: PropsWithChildren) => {
  const [locale, setLocaleState] = useState<LocaleCode>(() => readStoredLocale());
  const localeMeta = useMemo(() => getLocaleMeta(locale), [locale]);

  const setLocale = useCallback((nextLocale: LocaleCode) => {
    const resolvedLocale = resolveLocale(nextLocale);
    setLocaleState(resolvedLocale);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, resolvedLocale);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = localeMeta.code;
    document.documentElement.dir = localeMeta.direction;
  }, [localeMeta.code, localeMeta.direction]);

  const t = useCallback<LocaleContextValue['t']>((key, options) => (
    translate(locale, key, options?.values)
  ), [locale]);

  const formatDateTime = useCallback<LocaleContextValue['formatDateTime']>((value, options) => {
    if (!value) {
      return translate(locale, 'date.unknown');
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return translate(locale, 'date.unknown');
    }

    return new Intl.DateTimeFormat(
      localeMeta.dateLocale,
      options ?? defaultDateTimeOptions
    ).format(date);
  }, [locale, localeMeta.dateLocale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    direction: localeMeta.direction,
    localeMeta,
    setLocale,
    t,
    formatDateTime,
  }), [formatDateTime, locale, localeMeta, setLocale, t]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
};
