import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getChatThemeStorageKey, readChatThemeSnapshot, useChatTheme } from './useChatTheme';

const setLocationSearch = (search: string) => {
  window.history.replaceState(null, '', `/${search}`);
};

describe('useChatTheme', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  it('uses URL theme override before stored user preference', () => {
    window.localStorage.setItem(getChatThemeStorageKey('user-1'), JSON.stringify('dark'));
    setLocationSearch('?chatTheme=light');

    expect(readChatThemeSnapshot('user-1')).toMatchObject({
      theme: 'light',
      preference: 'dark',
      isForced: true,
    });
  });

  it('persists a per-user theme preference', () => {
    const { result } = renderHook(() => useChatTheme('user-1'));

    act(() => {
      result.current.setPreference('light');
    });

    expect(window.localStorage.getItem(getChatThemeStorageKey('user-1'))).toBe(JSON.stringify('light'));
    expect(result.current.theme).toBe('light');
    expect(result.current.preference).toBe('light');
  });

  it('falls back to system preference when no explicit preference exists', () => {
    const { result } = renderHook(() => useChatTheme('user-1'));

    expect(result.current.theme).toBe('dark');
    expect(result.current.preference).toBe('system');
  });
});
