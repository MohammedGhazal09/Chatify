import { createContext } from 'react';
import type { LocaleCode, LocaleDirection, LocaleMeta, TranslationKey } from './locales';

export interface TranslationOptions {
  values?: Record<string, string | number>;
}

export interface LocaleContextValue {
  locale: LocaleCode;
  direction: LocaleDirection;
  localeMeta: LocaleMeta;
  setLocale: (locale: LocaleCode) => void;
  t: (key: TranslationKey, options?: TranslationOptions) => string;
  formatDateTime: (value?: string | number | Date | null, options?: Intl.DateTimeFormatOptions) => string;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);
