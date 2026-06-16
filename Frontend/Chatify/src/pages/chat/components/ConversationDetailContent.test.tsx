import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makeUser } from '../../../test/chatFixtures';
import ConversationDetailContent from './ConversationDetailContent';

vi.mock('../../../api/apiOrigin', () => ({
  resolveApiBaseUrl: vi.fn(() => 'https://backend.test'),
}));

const renderDetailContent = (profilePic = '/api/user/user-2/profile-image?v=1') => {
  const otherMember = makeUser({
    _id: 'user-2',
    firstName: 'Grace',
    lastName: 'Hopper',
    profilePic,
  });
  const selectedChat = makeChat({
    members: [
      makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' }),
      otherMember,
    ],
  });

  render(
    <ConversationDetailContent
      selectedChat={selectedChat}
      currentUserId="user-1"
      otherMember={otherMember}
      otherMemberStatus={{ userId: 'user-2', isOnline: true }}
      pinnedMessages={[]}
      sharedFiles={[]}
      sharedMedia={[]}
      isPinnedLoading={false}
      isSharedFilesLoading={false}
      isSharedMediaLoading={false}
      isPinnedError={false}
      isSharedFilesError={false}
      isSharedMediaError={false}
      isAuthenticated
      isSocketConnected
      isReconnecting={false}
      isOffline={false}
      isConversationControlPending={false}
      onToggleFavorite={vi.fn()}
      onStartAudioCall={vi.fn()}
      onStartVideoCall={vi.fn()}
      onSearchMessages={vi.fn()}
      onOpenMoreMenu={vi.fn()}
      onOpenAttachmentPreview={vi.fn()}
      onUnblockUser={vi.fn()}
      onJumpToMessage={vi.fn()}
      onUnpinMessage={vi.fn()}
    />
  );
};

describe('ConversationDetailContent', () => {
  it('renders the other member profile image in the conversation details surface', () => {
    renderDetailContent();

    expect(screen.getByRole('img', { name: 'Grace Hopper profile picture' })).toHaveAttribute(
      'src',
      'https://backend.test/api/user/user-2/profile-image?v=1'
    );
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });

  it('falls back to abstract identity when the detail image fails to load', () => {
    renderDetailContent('/api/user/user-2/profile-image?v=broken');

    fireEvent.error(screen.getByRole('img', { name: 'Grace Hopper profile picture' }));

    expect(screen.getByRole('img', { name: 'Grace Hopper profile picture fallback' })).toBeInTheDocument();
  });
});
