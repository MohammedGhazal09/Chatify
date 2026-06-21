import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userApi } from '../api/userApi';
import { LEGACY_SOUND_STORAGE_KEY } from '../utils/sounds';
import {
  getNotificationPreferencesStorageKey,
  readNotificationPreferences,
  useNotificationPreferences,
} from './useNotificationPreferences';

vi.mock('../api/userApi', () => ({
  userApi: {
    getNotificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),
    registerPushSubscription: vi.fn(),
    removePushSubscription: vi.fn(),
  },
}));

const mockUserApi = vi.mocked(userApi);

const makeServerPreferences = (overrides = {}) => ({
  pushEnabled: false,
  emailNotificationsEnabled: false,
  messagePreviewMode: 'none' as const,
  emailUnsubscribed: false,
  pushSubscriptionCount: 0,
  mutedChatIds: [],
  ...overrides,
});

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockUserApi.getNotificationPreferences.mockRejectedValue(new Error('offline'));
    mockUserApi.updateNotificationPreferences.mockImplementation(async (patch) => ({
      data: {
        data: {
          preferences: makeServerPreferences(patch),
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.updateNotificationPreferences>>));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('isolates notification preferences per authenticated user', async () => {
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string }) => useNotificationPreferences(userId),
      { initialProps: { userId: 'user-1' } }
    );

    act(() => {
      result.current.setBrowserNotificationsEnabled(true);
      result.current.muteChat('chat-1');
    });

    await waitFor(() => {
      expect(result.current.browserNotificationsEnabled).toBe(true);
      expect(result.current.isChatMuted('chat-1')).toBe(true);
    });

    rerender({ userId: 'user-2' });

    await waitFor(() => {
      expect(result.current.browserNotificationsEnabled).toBe(false);
      expect(result.current.isChatMuted('chat-1')).toBe(false);
    });

    expect(readNotificationPreferences('user-1')).toEqual(
      expect.objectContaining({
        browserNotificationsEnabled: true,
        mutedChatIds: ['chat-1'],
      })
    );
    expect(readNotificationPreferences('user-2')).toEqual(
      expect.objectContaining({
        browserNotificationsEnabled: false,
        mutedChatIds: [],
      })
    );
  });

  it('seeds new per-user sound preferences from the legacy sound toggle without mutating it', async () => {
    window.localStorage.setItem(LEGACY_SOUND_STORAGE_KEY, 'false');

    const { result } = renderHook(() => useNotificationPreferences('user-1'));

    expect(result.current.soundEnabled).toBe(false);

    act(() => {
      result.current.setSoundEnabled(true);
    });

    await waitFor(() => {
      expect(result.current.soundEnabled).toBe(true);
    });
    expect(window.localStorage.getItem(LEGACY_SOUND_STORAGE_KEY)).toBe('false');
    expect(readNotificationPreferences('user-1').soundEnabled).toBe(true);
  });

  it('deduplicates muted chat ids and unmutes without changing unread data contracts', async () => {
    const { result } = renderHook(() => useNotificationPreferences('user-1'));

    act(() => {
      result.current.muteChat('chat-1');
      result.current.muteChat('chat-1');
      result.current.muteChat('chat-2');
    });

    await waitFor(() => {
      expect(result.current.mutedChatIds).toEqual(['chat-1', 'chat-2']);
    });

    act(() => {
      result.current.unmuteChat('chat-1');
    });

    await waitFor(() => {
      expect(result.current.mutedChatIds).toEqual(['chat-2']);
      expect(result.current.isChatMuted('chat-1')).toBe(false);
      expect(result.current.isChatMuted('chat-2')).toBe(true);
    });
  });

  it('normalizes malformed stored preferences to safe defaults', () => {
    window.localStorage.setItem(
      getNotificationPreferencesStorageKey('user-1'),
      JSON.stringify({
        soundEnabled: 'yes',
        browserNotificationsEnabled: 'no',
        mutedChatIds: ['chat-1', 'chat-1', '', 123],
      })
    );

    expect(readNotificationPreferences('user-1')).toEqual({
      soundEnabled: true,
      browserNotificationsEnabled: false,
      pushEnabled: false,
      emailNotificationsEnabled: false,
      messagePreviewMode: 'none',
      emailUnsubscribed: false,
      pushSubscriptionCount: 0,
      mutedChatIds: ['chat-1'],
    });
  });

  it('keeps in-memory preference updates when localStorage writes fail', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { result } = renderHook(() => useNotificationPreferences('user-1'));

    act(() => {
      result.current.setBrowserNotificationsEnabled(true);
      result.current.muteChat('chat-1');
    });

    await waitFor(() => {
      expect(result.current.browserNotificationsEnabled).toBe(true);
      expect(result.current.isChatMuted('chat-1')).toBe(true);
    });
  });

  it('falls back to defaults when localStorage reads fail', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    const { result } = renderHook(() => useNotificationPreferences('user-1'));

    expect(result.current.preferences).toEqual({
      soundEnabled: true,
      browserNotificationsEnabled: false,
      pushEnabled: false,
      emailNotificationsEnabled: false,
      messagePreviewMode: 'none',
      emailUnsubscribed: false,
      pushSubscriptionCount: 0,
      mutedChatIds: [],
    });
  });

  it('hydrates server-owned push and email preferences when available', async () => {
    mockUserApi.getNotificationPreferences.mockResolvedValueOnce({
      data: {
        data: {
          preferences: makeServerPreferences({
            pushEnabled: true,
            emailNotificationsEnabled: true,
            pushSubscriptionCount: 1,
            mutedChatIds: ['chat-server'],
          }),
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.getNotificationPreferences>>);

    const { result } = renderHook(() => useNotificationPreferences('user-1'));

    await waitFor(() => {
      expect(result.current.pushEnabled).toBe(true);
      expect(result.current.emailNotificationsEnabled).toBe(true);
      expect(result.current.pushSubscriptionCount).toBe(1);
      expect(result.current.mutedChatIds).toEqual(['chat-server']);
    });
  });

  it('saves server-owned email notification preferences', async () => {
    const { result } = renderHook(() => useNotificationPreferences('user-1'));

    await act(async () => {
      await result.current.setEmailNotificationsEnabled(true);
    });

    expect(mockUserApi.updateNotificationPreferences).toHaveBeenCalledWith({
      emailNotificationsEnabled: true,
    });
    expect(result.current.emailNotificationsEnabled).toBe(true);
  });
});
