import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makeUser } from '../../../test/chatFixtures';
import ChatListItem from './ChatListItem';

vi.mock('../../../api/apiOrigin', () => ({
  resolveApiBaseUrl: vi.fn(() => 'https://backend.test'),
}));

describe('ChatListItem', () => {
  it('renders a member profile image and preserves row selection behavior', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ChatListItem
        chat={makeChat()}
        title="Grace Hopper"
        avatarUser={makeUser({
          _id: 'user-2',
          firstName: 'Grace',
          lastName: 'Hopper',
          profilePic: '/api/user/user-2/profile-image?v=1',
        })}
        isActive={false}
        isOnline
        unreadCount={2}
        onSelect={onSelect}
      />
    );

    expect(screen.getByRole('img', { name: 'Grace Hopper profile picture' })).toHaveAttribute(
      'src',
      'https://backend.test/api/user/user-2/profile-image?v=1'
    );
    expect(screen.getByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Grace Hopper/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('keeps the abstract fallback when the member image cannot load', () => {
    render(
      <ChatListItem
        chat={makeChat()}
        title="Grace Hopper"
        avatarUser={makeUser({
          _id: 'user-2',
          firstName: 'Grace',
          lastName: 'Hopper',
          profilePic: '/api/user/user-2/profile-image?v=broken',
        })}
        isActive={false}
        isOnline={false}
        unreadCount={0}
        onSelect={vi.fn()}
      />
    );

    fireEvent.error(screen.getByRole('img', { name: 'Grace Hopper profile picture' }));

    expect(screen.getByRole('img', { name: 'Grace Hopper profile picture fallback' })).toBeInTheDocument();
  });

  it('shows a muted conversation indicator without hiding unread counts', () => {
    render(
      <ChatListItem
        chat={makeChat()}
        title="Grace Hopper"
        avatarUser={makeUser({ _id: 'user-2', firstName: 'Grace', lastName: 'Hopper' })}
        isActive={false}
        isOnline={false}
        isMuted
        unreadCount={4}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Conversation muted')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
