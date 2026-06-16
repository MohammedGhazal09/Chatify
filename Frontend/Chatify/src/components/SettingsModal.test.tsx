import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileImageMutation } from '../hooks/useProfileImageMutation';
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

const renderSettings = () => render(
  <SettingsModal
    isOpen
    onClose={vi.fn()}
  />
);

describe('SettingsModal profile picture workflow', () => {
  beforeEach(() => {
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
    mockUseProfileImageMutation.mockReturnValue({
      uploadProfileImage,
      removeProfileImage,
      isPending: false,
    } as unknown as ReturnType<typeof useProfileImageMutation>);
    useAuthStore.setState({
      user: makeUser({ profilePic: '' }),
      isAuthenticated: true,
      isLoading: false,
    });
    vi.clearAllMocks();
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
});
