export {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLocaleMeta,
  isLocaleCode,
  resolveLocale,
  supportedLocales,
  translate,
} from './locales';
export type { LocaleCode, LocaleDirection, LocaleMeta, TranslationKey } from './locales';
export { LocaleProvider } from './LocaleProvider';
export { useLocale } from './useLocale';
