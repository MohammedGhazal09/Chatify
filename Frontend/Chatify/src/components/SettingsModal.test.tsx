import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userApi } from '../api/userApi';
import { useActiveSessions, useRevokeAllSessions, useRevokeSession } from '../hooks/useAuthQuery';
import { useMyModerationEnforcements, useSubmitModerationAppeal } from '../hooks/useModerationReports';
import { useProfileImageMutation } from '../hooks/useProfileImageMutation';
import { getNotificationPreferencesStorageKey } from '../hooks/useNotificationPreferences';
import { LOCALE_STORAGE_KEY, LocaleProvider } from '../i18n';
import { useAuthStore } from '../store/authstore';
import { makeUser } from '../test/chatFixtures';
import type { ActiveSession } from '../types/auth';
import SettingsModal from './SettingsModal';

vi.mock('../hooks/useProfileImageMutation', () => ({
  useProfileImageMutation: vi.fn(),
}));

vi.mock('../hooks/useAuthQuery', () => ({
  useActiveSessions: vi.fn(),
  useRevokeSession: vi.fn(),
  useRevokeAllSessions: vi.fn(),
}));

vi.mock('../hooks/useModerationReports', () => ({
  useMyModerationEnforcements: vi.fn(),
  useSubmitModerationAppeal: vi.fn(),
}));

vi.mock('../api/apiOrigin', () => ({
  resolveApiBaseUrl: vi.fn(() => 'https://backend.test'),
}));

vi.mock('../api/userApi', () => ({
  userApi: {
    getPrivacySummary: vi.fn(),
    exportAccountData: vi.fn(),
    requestAccountDeletion: vi.fn(),
    cancelAccountDeletion: vi.fn(),
    getNotificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),
    registerPushSubscription: vi.fn(),
    removePushSubscription: vi.fn(),
  },
}));

const mockUseProfileImageMutation = vi.mocked(useProfileImageMutation);
const mockUseActiveSessions = vi.mocked(useActiveSessions);
const mockUseRevokeSession = vi.mocked(useRevokeSession);
const mockUseRevokeAllSessions = vi.mocked(useRevokeAllSessions);
const mockUseMyModerationEnforcements = vi.mocked(useMyModerationEnforcements);
const mockUseSubmitModerationAppeal = vi.mocked(useSubmitModerationAppeal);
const mockUserApi = vi.mocked(userApi);

const uploadProfileImage = {
  mutateAsync: vi.fn(),
  isPending: false,
};

const removeProfileImage = {
  mutateAsync: vi.fn(),
  isPending: false,
};

const updateIdentityMark = {
  mutateAsync: vi.fn(),
  isPending: false,
};

const updateProfile = {
  mutateAsync: vi.fn(),
  isPending: false,
};

const updatePrivacySettings = {
  mutateAsync: vi.fn(),
  isPending: false,
};

const revokeSession = {
  mutateAsync: vi.fn(),
  isPending: false,
};

const revokeAllSessions = {
  mutateAsync: vi.fn(),
  isPending: false,
};

const submitModerationAppeal = {
  mutateAsync: vi.fn(),
  isPending: false,
};

const activeSessionsQuery = {
  data: [] as ActiveSession[],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

const renderSettings = ({ onClose = vi.fn() }: { onClose?: () => void } = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <SettingsModal
          isOpen
          onClose={onClose}
        />
      </LocaleProvider>
    </QueryClientProvider>
  );
};

const originalNotification = window.Notification;

const installNotificationMock = (
  permission: NotificationPermission,
  requestPermission = vi.fn<() => Promise<NotificationPermission>>()
) => {
  const NotificationMock = {
    permission,
    requestPermission,
  } as unknown as typeof Notification;

  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: NotificationMock,
  });

  return requestPermission;
};

const makeServerPreferences = (overrides = {}) => ({
  pushEnabled: false,
  emailNotificationsEnabled: false,
  messagePreviewMode: 'none' as const,
  emailUnsubscribed: false,
  pushSubscriptionCount: 0,
  mutedChatIds: [],
  ...overrides,
});

describe('SettingsModal profile picture workflow', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:profile-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    uploadProfileImage.mutateAsync.mockResolvedValue(makeUser({ profilePic: '/api/user/user-1/profile-image?v=2' }));
    uploadProfileImage.isPending = false;
    removeProfileImage.mutateAsync.mockResolvedValue(makeUser({ profilePic: '' }));
    removeProfileImage.isPending = false;
    updateIdentityMark.mutateAsync.mockResolvedValue(makeUser({
      identityMark: {
        source: 'custom',
        label: 'Relay Grid',
        initials: 'RG',
        paletteId: 'teal',
        patternId: 'rings',
        accentId: 'mint',
        updatedAt: '2026-06-17T05:00:00.000Z',
      },
    }));
    updateIdentityMark.isPending = false;
    updateProfile.mutateAsync.mockResolvedValue(makeUser({
      profileBio: 'Building reliable chat tools.',
      profileStatus: 'Available for focused work',
    }));
    updateProfile.isPending = false;
    updatePrivacySettings.mutateAsync.mockResolvedValue({
      showOnlineStatus: false,
      showLastSeen: true,
      showProfileStatus: true,
    });
    updatePrivacySettings.isPending = false;
    revokeSession.mutateAsync.mockResolvedValue({});
    revokeSession.isPending = false;
    revokeAllSessions.mutateAsync.mockResolvedValue({});
    revokeAllSessions.isPending = false;
    submitModerationAppeal.mutateAsync.mockResolvedValue({});
    submitModerationAppeal.isPending = false;
    activeSessionsQuery.data = [];
    activeSessionsQuery.isLoading = false;
    activeSessionsQuery.isError = false;
    activeSessionsQuery.refetch.mockResolvedValue({});
    mockUseProfileImageMutation.mockReturnValue({
      uploadProfileImage,
      removeProfileImage,
      updateIdentityMark,
      updateProfile,
      updatePrivacySettings,
      isPending: false,
    } as unknown as ReturnType<typeof useProfileImageMutation>);
    mockUseActiveSessions.mockReturnValue(activeSessionsQuery as unknown as ReturnType<typeof useActiveSessions>);
    mockUseRevokeSession.mockReturnValue(revokeSession as unknown as ReturnType<typeof useRevokeSession>);
    mockUseRevokeAllSessions.mockReturnValue(revokeAllSessions as unknown as ReturnType<typeof useRevokeAllSessions>);
    mockUseMyModerationEnforcements.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useMyModerationEnforcements>);
    mockUseSubmitModerationAppeal.mockReturnValue(
      submitModerationAppeal as unknown as ReturnType<typeof useSubmitModerationAppeal>
    );
    mockUserApi.getNotificationPreferences.mockResolvedValue({
      data: {
        data: {
          preferences: makeServerPreferences(),
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.getNotificationPreferences>>);
    mockUserApi.updateNotificationPreferences.mockImplementation(async (patch) => ({
      data: {
        data: {
          preferences: makeServerPreferences(patch),
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.updateNotificationPreferences>>));
    mockUserApi.registerPushSubscription.mockResolvedValue({
      data: {
        data: {
          preferences: makeServerPreferences({ pushEnabled: true, pushSubscriptionCount: 1 }),
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.registerPushSubscription>>);
    mockUserApi.getPrivacySummary.mockResolvedValue({
      data: {
        data: {
          exportVersion: '2026-06-21',
          deletionRequest: null,
          retentionSummary: {
            moderation: 'Abuse and security records may be retained.',
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.getPrivacySummary>>);
    mockUserApi.exportAccountData.mockResolvedValue({
      data: {
        data: {
          export: {
            exportVersion: '2026-06-21',
            account: { username: 'test.user' },
          },
          audit: {
            _id: 'privacy-export-1',
            type: 'account_export',
            status: 'completed',
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.exportAccountData>>);
    mockUserApi.requestAccountDeletion.mockResolvedValue({
      data: {
        data: {
          deletionRequest: {
            _id: 'deletion-1',
            type: 'account_deletion',
            status: 'pending',
            requestedAt: '2026-06-21T00:00:00.000Z',
            scheduledFor: '2026-07-05T00:00:00.000Z',
            retentionSummary: {
              moderation: 'Abuse and security records may be retained.',
            },
          },
          retentionSummary: {
            moderation: 'Abuse and security records may be retained.',
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.requestAccountDeletion>>);
    mockUserApi.cancelAccountDeletion.mockResolvedValue({
      data: {
        data: {
          deletionRequest: {
            _id: 'deletion-1',
            type: 'account_deletion',
            status: 'canceled',
            requestedAt: '2026-06-21T00:00:00.000Z',
            canceledAt: '2026-06-21T01:00:00.000Z',
          },
          retentionSummary: {
            moderation: 'Abuse and security records may be retained.',
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.cancelAccountDeletion>>);
    useAuthStore.setState({
      user: makeUser({ profilePic: '' }),
      isAuthenticated: true,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.localStorage.removeItem(LOCALE_STORAGE_KEY);
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: originalNotification,
    });
  });

  it('previews a selected image before upload and saves it through the profile image mutation', async () => {
    const user = userEvent.setup();
    renderSettings();

    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Choose image'), file);

    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(screen.getByAltText('Selected profile picture preview for Ada Lovelace')).toHaveAttribute('src', 'blob:profile-preview');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(uploadProfileImage.mutateAsync).toHaveBeenCalledWith(file);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Profile picture updated.');
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile-preview');
  });

  it('shows the current account display name, username, and email', () => {
    useAuthStore.setState({
      user: makeUser({
        firstName: 'Grace',
        lastName: 'Hopper',
        username: 'grace.hopper',
        email: 'grace@example.com',
      }),
      isAuthenticated: true,
      isLoading: false,
    });

    renderSettings();

    expect(screen.getByRole('heading', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('grace.hopper')).toBeInTheDocument();
    expect(screen.getByText('grace@example.com')).toBeInTheDocument();
  });

  it('switches Settings language to Arabic and applies RTL document direction', async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Language' })).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Arabic/ }));

    expect(screen.getByRole('heading', { name: 'الإعدادات' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'اللغة' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'الإشعارات' })).toBeInTheDocument();
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ar');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
  });

  it('saves profile bio and status without moving account email into public profile copy', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      user: makeUser({
        profileBio: 'Existing bio',
        profileStatus: 'Existing status',
        email: 'ada@example.com',
      }),
      isAuthenticated: true,
      isLoading: false,
    });

    renderSettings();

    await user.clear(screen.getByLabelText('Bio'));
    await user.type(screen.getByLabelText('Bio'), 'Building reliable chat tools.');
    await user.clear(screen.getByLabelText('Status'));
    await user.type(screen.getByLabelText('Status'), 'Available for focused work');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(updateProfile.mutateAsync).toHaveBeenCalledWith({
      profileBio: 'Building reliable chat tools.',
      profileStatus: 'Available for focused work',
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Profile updated.');
    });
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Bio and status appear on contact-card surfaces. Your email stays private.')).toBeInTheDocument();
  });

  it('toggles presence privacy from Settings', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      user: makeUser({
        showOnlineStatus: true,
        showLastSeen: true,
        showProfileStatus: true,
      }),
      isAuthenticated: true,
      isLoading: false,
    });

    renderSettings();

    await user.click(screen.getByRole('button', { name: 'Toggle online status visibility' }));

    expect(updatePrivacySettings.mutateAsync).toHaveBeenCalledWith({
      showOnlineStatus: false,
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Privacy settings updated.');
    });
  });

  it('uses account identity fallbacks when username or email is missing', () => {
    useAuthStore.setState({
      user: makeUser({
        username: undefined,
        email: undefined,
      }),
      isAuthenticated: true,
      isLoading: false,
    });

    renderSettings();

    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getByText('Not available')).toBeInTheDocument();
  });

  it('renders active sessions without raw device metadata and revokes a non-current session', async () => {
    const user = userEvent.setup();
    activeSessionsQuery.data = [
      {
        id: 'session-current',
        current: true,
        deviceLabel: 'Chrome on Windows',
        rememberMe: true,
        createdAt: '2026-06-19T08:00:00.000Z',
        lastUsedAt: '2026-06-20T09:15:00.000Z',
        expiresAt: '2026-06-27T09:15:00.000Z',
      },
      {
        id: 'session-remote',
        current: false,
        deviceLabel: 'Safari on iOS',
        rememberMe: false,
        createdAt: '2026-06-18T08:00:00.000Z',
        lastUsedAt: '2026-06-19T12:30:00.000Z',
        expiresAt: '2026-06-20T12:30:00.000Z',
      },
    ];

    renderSettings();

    expect(screen.getByRole('heading', { name: 'Account security' })).toBeInTheDocument();
    expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
    expect(screen.getByText('Safari on iOS')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.queryByText(/Mozilla|192\.168|hash/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(revokeSession.mutateAsync).toHaveBeenCalledWith('session-remote');
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Session revoked.');
    });
  });

  it('logs out everywhere and closes the settings modal after the revoke-all action succeeds', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    activeSessionsQuery.data = [
      {
        id: 'session-current',
        current: true,
        deviceLabel: 'Chrome on Windows',
        rememberMe: true,
        createdAt: '2026-06-19T08:00:00.000Z',
        lastUsedAt: '2026-06-20T09:15:00.000Z',
        expiresAt: '2026-06-27T09:15:00.000Z',
      },
    ];

    renderSettings({ onClose });

    await user.click(screen.getByRole('button', { name: 'Log out everywhere' }));

    expect(revokeAllSessions.mutateAsync).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the file chooser focus ring on the visible control for keyboard users', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Close settings' })).toHaveFocus();

    const chooserInput = screen.getByLabelText('Choose image');
    for (let tabIndex = 0; tabIndex < 20 && document.activeElement !== chooserInput; tabIndex += 1) {
      await user.tab();
    }

    expect(chooserInput).toHaveFocus();
    expect(chooserInput.closest('label')).toHaveClass('focus-within:ring-2');
  });

  it('blocks unsupported files before calling the upload mutation', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderSettings();

    await user.upload(
      screen.getByLabelText('Choose image'),
      new File(['bad'], 'avatar.gif', { type: 'image/gif' })
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Choose a PNG, JPG, or WebP image.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(uploadProfileImage.mutateAsync).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('blocks files larger than two megabytes before calling the upload mutation', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.upload(
      screen.getByLabelText('Choose image'),
      new File([new Uint8Array((2 * 1024 * 1024) + 1)], 'large.png', { type: 'image/png' })
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Choose an image smaller than 2 MB.');
    expect(uploadProfileImage.mutateAsync).not.toHaveBeenCalled();
  });

  it('shows backend upload errors without discarding the selected preview', async () => {
    const user = userEvent.setup();
    uploadProfileImage.mutateAsync.mockRejectedValueOnce({
      response: {
        data: {
          message: 'Profile image is invalid.',
        },
      },
    });
    renderSettings();

    await user.upload(
      screen.getByLabelText('Choose image'),
      new File(['image'], 'avatar.webp', { type: 'image/webp' })
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Profile image is invalid.');
    expect(screen.getByAltText('Selected profile picture preview for Ada Lovelace')).toHaveAttribute('src', 'blob:profile-preview');
  });

  it('removes an uploaded profile image and resolves app-relative image URLs against the backend origin', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      user: makeUser({ profilePic: '/api/user/user-1/profile-image?v=1' }),
      isAuthenticated: true,
      isLoading: false,
    });
    renderSettings();

    expect(screen.getByAltText('Current profile picture for Ada Lovelace')).toHaveAttribute(
      'src',
      'https://backend.test/api/user/user-1/profile-image?v=1'
    );

    await user.click(screen.getByRole('button', { name: /remove/i }));

    expect(removeProfileImage.mutateAsync).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Profile picture removed.');
    });
  });

  it('resets selected files, validation errors, and local preview URLs', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderSettings();

    await user.upload(
      screen.getByLabelText('Choose image'),
      new File(['bad'], 'avatar.gif', { type: 'image/gif' })
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    const file = new File(['image'], 'avatar.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Choose image'), file);
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.queryByAltText('Selected profile picture preview for Ada Lovelace')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile-preview');
  });

  it('opens the identity editor and saves a custom abstract identity mark', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.clear(screen.getByLabelText('Identity label'));
    await user.type(screen.getByLabelText('Identity label'), 'Relay Grid');
    await user.clear(screen.getByLabelText('Initials'));
    await user.type(screen.getByLabelText('Initials'), 'rg');
    await user.click(screen.getByRole('button', { name: 'Rings' }));
    await user.click(screen.getByRole('button', { name: 'Mint' }));
    await user.click(screen.getByRole('button', { name: /save identity/i }));

    expect(updateIdentityMark.mutateAsync).toHaveBeenCalledWith({
      label: 'Relay Grid',
      initials: 'RG',
      paletteId: 'teal',
      patternId: 'rings',
      accentId: 'mint',
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Identity updated');
    });
  });

  it('rejects unsafe identity labels before calling the mutation', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.clear(screen.getByLabelText('Identity label'));
    await user.type(screen.getByLabelText('Identity label'), 'Cat face');
    await user.click(screen.getByRole('button', { name: /save identity/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Identity label cannot use URLs or living-being avatar concepts.');
    expect(updateIdentityMark.mutateAsync).not.toHaveBeenCalled();
  });

  it('shows browser notification permission without prompting on render', () => {
    const requestPermission = installNotificationMock('default');

    renderSettings();

    expect(screen.getByText('Permission: Ask first')).toBeInTheDocument();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('requests browser notification permission from the explicit enable action', async () => {
    const user = userEvent.setup();
    const requestPermission = installNotificationMock(
      'default',
      vi.fn(async () => 'granted' as NotificationPermission)
    );

    renderSettings();

    await user.click(screen.getByRole('button', { name: 'Enable' }));

    await waitFor(() => {
      expect(screen.getByText('Permission: Allowed')).toBeInTheDocument();
    });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Disable' })).toHaveAttribute('aria-pressed', 'true');

    const storedPreferences = JSON.parse(
      window.localStorage.getItem(getNotificationPreferencesStorageKey('user-1')) ?? '{}'
    ) as { browserNotificationsEnabled?: boolean };
    expect(storedPreferences.browserNotificationsEnabled).toBe(true);
  });

  it('shows blocked browser notification guidance without prompting', () => {
    const requestPermission = installNotificationMock('denied');

    renderSettings();

    expect(screen.getByText('Permission: Blocked')).toBeInTheDocument();
    expect(screen.getByText('Browser alerts are blocked in site permissions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable' })).toBeDisabled();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('allows disabling browser alerts when site permission becomes blocked', async () => {
    const user = userEvent.setup();
    installNotificationMock('denied');
    window.localStorage.setItem(
      getNotificationPreferencesStorageKey('user-1'),
      JSON.stringify({
        version: 1,
        soundEnabled: true,
        browserNotificationsEnabled: true,
        mutedChatIds: [],
      })
    );

    renderSettings();

    const disableButton = screen.getByRole('button', { name: 'Disable' });
    expect(disableButton).toBeEnabled();

    await user.click(disableButton);

    expect(screen.getByRole('button', { name: 'Enable' })).toBeDisabled();
    const storedPreferences = JSON.parse(
      window.localStorage.getItem(getNotificationPreferencesStorageKey('user-1')) ?? '{}'
    ) as { browserNotificationsEnabled?: boolean };
    expect(storedPreferences.browserNotificationsEnabled).toBe(false);
  });

  it('renders server-backed email and push notification controls', async () => {
    const user = userEvent.setup();
    installNotificationMock('granted');

    renderSettings();

    expect(await screen.findByText('Email notifications')).toBeInTheDocument();
    expect(screen.getByText('Push notifications')).toBeInTheDocument();
    expect(screen.getByText(/Push notifications are not available|Push delivery is not configured/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable push' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Enable email' }));

    await waitFor(() => {
      expect(mockUserApi.updateNotificationPreferences).toHaveBeenCalledWith({
        emailNotificationsEnabled: true,
      });
    });
  });

  it('exports account data from the privacy and portability controls', async () => {
    const user = userEvent.setup();
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    try {
      renderSettings();

      await user.click(await screen.findByRole('button', { name: 'Export data' }));

      await waitFor(() => {
        expect(mockUserApi.exportAccountData).toHaveBeenCalledTimes(1);
      });
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(appendChildSpy).toHaveBeenCalledWith(expect.objectContaining({
        download: expect.stringMatching(/^chatify-account-export-\d{4}-\d{2}-\d{2}\.json$/),
      }));
      expect(await screen.findByText(/Export ready:/)).toBeInTheDocument();
      expect(screen.queryByText(/@example\.test/)).not.toBeInTheDocument();
    } finally {
      appendChildSpy.mockRestore();
      anchorClickSpy.mockRestore();
    }
  });

  it('submits an appeal for an eligible moderation enforcement', async () => {
    const user = userEvent.setup();
    mockUseMyModerationEnforcements.mockReturnValue({
      data: [{
        _id: 'report-1',
        targetType: 'message',
        reason: 'privacy',
        status: 'action_taken',
        moderationAction: 'restricted',
        enforcement: {
          action: 'restricted',
          targetType: 'user',
          targetId: 'user-1',
          summary: 'Messaging temporarily restricted',
        },
        reviewedAt: '2026-06-21T00:00:00.000Z',
        createdAt: '2026-06-20T00:00:00.000Z',
        appeal: null,
        canAppeal: true,
      }],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useMyModerationEnforcements>);

    renderSettings();

    expect(screen.getByRole('heading', { name: 'Account safety' })).toBeInTheDocument();
    expect(screen.getByText('Messaging temporarily restricted')).toBeInTheDocument();
    expect(screen.queryByText(/reporter/i)).not.toBeInTheDocument();

    await user.type(
      screen.getByLabelText('Appeal reason for messaging restriction'),
      'Please review this restriction.'
    );
    await user.click(screen.getByRole('button', { name: 'Submit appeal' }));

    expect(submitModerationAppeal.mutateAsync).toHaveBeenCalledWith({
      reportId: 'report-1',
      payload: { reason: 'Please review this restriction.' },
    });
    expect(await screen.findByText('Appeal submitted.')).toBeInTheDocument();
  });

  it('requests and cancels a pending account deletion request without immediate-delete copy', async () => {
    const user = userEvent.setup();

    const initialView = renderSettings();

    await user.click(await screen.findByRole('button', { name: 'Request deletion' }));

    await waitFor(() => {
      expect(mockUserApi.requestAccountDeletion).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/Deletion request scheduled/)).toBeInTheDocument();
    expect(screen.queryByText(/delete account now/i)).not.toBeInTheDocument();
    initialView.unmount();

    mockUserApi.getPrivacySummary.mockResolvedValueOnce({
      data: {
        data: {
          exportVersion: '2026-06-21',
          deletionRequest: {
            _id: 'deletion-1',
            type: 'account_deletion',
            status: 'pending',
            requestedAt: '2026-06-21T00:00:00.000Z',
            scheduledFor: '2026-07-05T00:00:00.000Z',
            retentionSummary: {
              moderation: 'Abuse and security records may be retained.',
            },
          },
          retentionSummary: {
            moderation: 'Abuse and security records may be retained.',
          },
        },
      },
    } as unknown as Awaited<ReturnType<typeof userApi.getPrivacySummary>>);

    renderSettings();
    await user.click(await screen.findByRole('button', { name: 'Cancel request' }));

    await waitFor(() => {
      expect(mockUserApi.cancelAccountDeletion).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('Deletion request canceled.')).toBeInTheDocument();
  });
});
