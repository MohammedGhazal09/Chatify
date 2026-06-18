import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileImageMutation } from '../hooks/useProfileImageMutation';
import { getNotificationPreferencesStorageKey } from '../hooks/useNotificationPreferences';
import { useAuthStore } from '../store/authstore';
import { makeUser } from '../test/chatFixtures';
import SettingsModal from './SettingsModal';

vi.mock('../hooks/useProfileImageMutation', () => ({
  useProfileImageMutation: vi.fn(),
}));

vi.mock('../api/apiOrigin', () => ({
  resolveApiBaseUrl: vi.fn(() => 'https://backend.test'),
}));

const mockUseProfileImageMutation = vi.mocked(useProfileImageMutation);

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

const renderSettings = () => render(
  <SettingsModal
    isOpen
    onClose={vi.fn()}
  />
);

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
    mockUseProfileImageMutation.mockReturnValue({
      uploadProfileImage,
      removeProfileImage,
      updateIdentityMark,
      isPending: false,
    } as unknown as ReturnType<typeof useProfileImageMutation>);
    useAuthStore.setState({
      user: makeUser({ profilePic: '' }),
      isAuthenticated: true,
      isLoading: false,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
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

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(uploadProfileImage.mutateAsync).toHaveBeenCalledWith(file);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Profile picture updated.');
    });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:profile-preview');
  });

  it('keeps the file chooser focus ring on the visible control for keyboard users', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Close settings' })).toHaveFocus();

    await user.tab();
    const chooserInput = screen.getByLabelText('Choose image');

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
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
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
    await user.click(screen.getByRole('button', { name: /save/i }));

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

    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    const file = new File(['image'], 'avatar.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Choose image'), file);
    await user.click(screen.getByRole('button', { name: /reset/i }));

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
});
