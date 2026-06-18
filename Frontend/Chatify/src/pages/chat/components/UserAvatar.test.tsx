import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeUser } from '../../../test/chatFixtures';
import UserAvatar from './UserAvatar';

vi.mock('../../../api/apiOrigin', () => ({
  resolveApiBaseUrl: vi.fn(() => 'https://backend.test'),
}));

describe('UserAvatar', () => {
  it('renders an uploaded profile image from an app-relative backend URL', () => {
    render(
      <UserAvatar
        user={makeUser({ profilePic: '/api/user/user-1/profile-image?v=2' })}
        label="Ada Lovelace"
        className="h-11 w-11"
      />
    );

    expect(screen.getByRole('img', { name: 'Ada Lovelace profile picture' })).toHaveAttribute(
      'src',
      'https://backend.test/api/user/user-1/profile-image?v=2'
    );
    expect(screen.getByTestId('user-avatar')).toHaveClass('h-11', 'w-11');
  });

  it('falls back to the deterministic abstract identity tile when no image exists', () => {
    render(<UserAvatar user={makeUser({ profilePic: '' })} label="Ada Lovelace" />);

    expect(screen.getByRole('img', { name: 'Ada Lovelace profile picture fallback' })).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });

  it('uses a custom abstract identity mark instead of a profile image after customization', () => {
    render(
      <UserAvatar
        user={makeUser({
          profilePic: '/api/user/user-1/profile-image?v=2',
          identityMark: {
            source: 'custom',
            label: 'Relay Grid',
            initials: 'RG',
            paletteId: 'teal',
            patternId: 'rings',
            accentId: 'mint',
            updatedAt: '2026-06-17T05:00:00.000Z',
          },
        })}
        label="Ada Lovelace"
      />
    );

    expect(document.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ada Lovelace profile picture fallback' })).toBeInTheDocument();
    expect(screen.getByText('RG')).toBeInTheDocument();
  });

  it('keeps profile images for users with fallback identity metadata', () => {
    render(
      <UserAvatar
        user={makeUser({
          profilePic: '/api/user/user-1/profile-image?v=2',
          identityMark: {
            source: 'fallback',
            label: 'Ada Lovelace',
            initials: 'AL',
            paletteId: 'slate',
            patternId: 'grid',
            accentId: 'graphite',
            updatedAt: null,
          },
        })}
        label="Ada Lovelace"
      />
    );

    expect(screen.getByRole('img', { name: 'Ada Lovelace profile picture' })).toHaveAttribute(
      'src',
      'https://backend.test/api/user/user-1/profile-image?v=2'
    );
  });

  it('falls back after a failed image load without retrying the broken source', () => {
    render(
      <UserAvatar
        user={makeUser({ profilePic: '/api/user/user-1/profile-image?v=broken' })}
        label="Ada Lovelace"
      />
    );

    fireEvent.error(screen.getByRole('img', { name: 'Ada Lovelace profile picture' }));

    expect(screen.getByRole('img', { name: 'Ada Lovelace profile picture fallback' })).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });

  it('leaves trusted absolute and local preview URLs unchanged', () => {
    const { rerender } = render(
      <UserAvatar
        user={makeUser({ profilePic: 'https://cdn.example.test/avatar.webp' })}
        label="Ada Lovelace"
      />
    );

    expect(screen.getByRole('img', { name: 'Ada Lovelace profile picture' })).toHaveAttribute(
      'src',
      'https://cdn.example.test/avatar.webp'
    );

    rerender(
      <UserAvatar
        user={makeUser({ profilePic: 'blob:local-preview' })}
        label="Ada Lovelace"
      />
    );

    expect(screen.getByRole('img', { name: 'Ada Lovelace profile picture' })).toHaveAttribute(
      'src',
      'blob:local-preview'
    );
  });
});
