import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LOCALE_STORAGE_KEY,
  LocaleProvider,
  resolveLocale,
  useLocale,
} from './index';

const sampleDate = new Date('2026-06-21T10:30:00.000Z');

const LocaleHarness = () => {
  const { direction, formatDateTime, locale, setLocale, t } = useLocale();

  return (
    <div>
      <p>{locale}</p>
      <p>{direction}</p>
      <p>{t('settings.title')}</p>
      <p>{formatDateTime(sampleDate, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })}</p>
      <button type="button" onClick={() => setLocale('ar')}>Arabic</button>
      <button type="button" onClick={() => setLocale('en')}>English</button>
    </div>
  );
};

const renderLocaleHarness = () => render(
  <LocaleProvider>
    <LocaleHarness />
  </LocaleProvider>
);

describe('i18n runtime', () => {
  afterEach(() => {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('uses English as the default locale and updates document metadata', () => {
    renderLocaleHarness();

    expect(screen.getByText('en')).toBeInTheDocument();
    expect(screen.getByText('ltr')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  it('switches to Arabic, persists the preference, and applies RTL direction', async () => {
    const user = userEvent.setup();
    renderLocaleHarness();

    await user.click(screen.getByRole('button', { name: 'Arabic' }));

    expect(screen.getByText('ar')).toBeInTheDocument();
    expect(screen.getByText('rtl')).toBeInTheDocument();
    expect(screen.getByText('الإعدادات')).toBeInTheDocument();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('loads a persisted Arabic preference on provider startup', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'ar');

    renderLocaleHarness();

    expect(screen.getByText('ar')).toBeInTheDocument();
    expect(screen.getByText('الإعدادات')).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('formats dates through the selected locale', async () => {
    const user = userEvent.setup();
    const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' };
    renderLocaleHarness();

    expect(screen.getByText(new Intl.DateTimeFormat('en-US', options).format(sampleDate))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Arabic' }));

    expect(screen.getByText(new Intl.DateTimeFormat('ar', options).format(sampleDate))).toBeInTheDocument();
  });

  it('falls back to English for unsupported locale values', () => {
    expect(resolveLocale('fr')).toBe('en');
    expect(resolveLocale(null)).toBe('en');
  });
});
