import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makePinnedMessage, makeSharedAsset, makeUser } from '../../../test/chatFixtures';
import ChatContextRail from './ChatContextRail';

describe('ChatContextRail', () => {
  const renderRail = (overrides = {}) => {
    const chat = makeChat({
      members: [
        makeUser({ _id: 'user-1', firstName: 'AX', lastName: '7F3C' }),
        makeUser({ _id: 'user-2', firstName: 'IN', lastName: '8B21', profilePic: 'https://example.com/avatar.png' }),
      ],
    });

    const props = {
      isOpen: true,
      onClose: vi.fn(),
      selectedChat: chat,
      currentUserId: 'user-1',
      otherMember: chat.members[1],
      otherMemberStatus: { userId: 'user-2', isOnline: true },
      pinnedMessages: [makePinnedMessage({ messageId: 'message-pin', text: 'Retry logic note' })],
      sharedFiles: [makeSharedAsset({ attachmentId: 'file-1', messageId: 'message-file', displayName: 'message-states-spec.pdf' })],
      sharedMedia: [makeSharedAsset({ attachmentId: 'media-1', messageId: 'message-media', displayName: 'diagram.png', mimeType: 'image/png', kind: 'media' })],
      isPinnedLoading: false,
      isSharedFilesLoading: false,
      isSharedMediaLoading: false,
      isPinnedError: false,
      isSharedFilesError: false,
      isSharedMediaError: false,
      isAuthenticated: true,
      isSocketConnected: true,
      isReconnecting: false,
      isOffline: false,
      onStartAudioCall: vi.fn(),
      onStartVideoCall: vi.fn(),
      onSearchMessages: vi.fn(),
      onOpenMoreMenu: vi.fn(),
      onJumpToMessage: vi.fn(),
      onUnpinMessage: vi.fn(),
      ...overrides,
    };

    render(<ChatContextRail {...props} />);

    return props;
  };

  it('renders server-backed sections and wires actions', async () => {
    const user = userEvent.setup();
    const onSearchMessages = vi.fn();
    const onOpenMoreMenu = vi.fn();
    const onJumpToMessage = vi.fn();
    const onUnpinMessage = vi.fn();
    const onStartAudioCall = vi.fn();
    const onStartVideoCall = vi.fn();
    renderRail({ onSearchMessages, onOpenMoreMenu, onJumpToMessage, onUnpinMessage, onStartAudioCall, onStartVideoCall });

    expect(screen.getByRole('complementary', { name: 'Conversation details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close conversation details' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Call' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Video call' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'More conversation actions' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Favorite conversation unavailable in this phase' })).toBeDisabled();
    expect(screen.getByText('Pinned messages')).toBeInTheDocument();
    expect(screen.getByText('Shared files')).toBeInTheDocument();
    expect(screen.getByText('Shared media')).toBeInTheDocument();
    expect(screen.getByText('Conversation security')).toBeInTheDocument();
    expect(screen.getByText('Retry logic note')).toBeInTheDocument();
    expect(screen.getByText('message-states-spec.pdf')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'diagram.png' })).toBeInTheDocument();
    expect(screen.queryByText('Pinning is not available in this phase.')).not.toBeInTheDocument();
    expect(screen.queryByText('File sharing is planned for Phase 08.')).not.toBeInTheDocument();
    expect(screen.queryByText('Media sharing is planned for Phase 08.')).not.toBeInTheDocument();
    expect(screen.queryByText('delivery-metrics.xlsx')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Abstract shared media')).not.toBeInTheDocument();
    expect(screen.getByText('Authenticated session')).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(3);
    expect(screen.getByText('Member-only room')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Realtime connection')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Protected file access')).toBeInTheDocument();
    expect(screen.getByText('Conversation controls')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Call' }));
    await user.click(screen.getByRole('button', { name: 'Video call' }));
    await user.click(screen.getByRole('button', { name: 'Search messages' }));
    await user.click(screen.getByRole('button', { name: 'More conversation actions' }));
    await user.click(screen.getByRole('button', { name: 'Retry logic note' }));
    await user.click(screen.getByRole('button', { name: 'Unpin Retry logic note' }));
    expect(onStartAudioCall).toHaveBeenCalledTimes(1);
    expect(onStartVideoCall).toHaveBeenCalledTimes(1);
    expect(onSearchMessages).toHaveBeenCalledTimes(1);
    expect(onOpenMoreMenu).toHaveBeenCalledTimes(1);
    expect(onJumpToMessage).toHaveBeenCalledWith('message-pin');
    expect(onUnpinMessage).toHaveBeenCalledWith('message-pin');
  });

  it('does not render when the rail is closed', () => {
    renderRail({ isOpen: false });

    expect(screen.queryByRole('complementary', { name: 'Conversation details' })).not.toBeInTheDocument();
  });

  it('closes from the close button and Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderRail({ onClose });

    await user.click(screen.getByRole('button', { name: 'Close conversation details' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    screen.getByRole('button', { name: 'Search messages' }).focus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('downgrades security rows when auth, membership, or socket state is unavailable', () => {
    const chat = makeChat({
      members: [
        makeUser({ _id: 'user-2', firstName: 'IN', lastName: '8B21' }),
      ],
    });

    render(
      <ChatContextRail
        isOpen
        onClose={vi.fn()}
        selectedChat={chat}
        currentUserId="user-1"
        otherMember={chat.members[0]}
        otherMemberStatus={null}
        pinnedMessages={[]}
        sharedFiles={[]}
        sharedMedia={[]}
        isPinnedLoading={false}
        isSharedFilesLoading={false}
        isSharedMediaLoading={false}
        isPinnedError={false}
        isSharedFilesError={false}
        isSharedMediaError={false}
        isAuthenticated={false}
        isSocketConnected={false}
        isReconnecting={false}
        isOffline
        callDisabledReason="Realtime connection is unavailable."
        videoCallDisabledReason="Realtime connection is unavailable."
        onStartAudioCall={vi.fn()}
        onStartVideoCall={vi.fn()}
        onSearchMessages={vi.fn()}
        onOpenMoreMenu={vi.fn()}
        onJumpToMessage={vi.fn()}
        onUnpinMessage={vi.fn()}
      />
    );

    expect(screen.getByText('No pinned messages')).toBeInTheDocument();
    expect(screen.getByText('No shared files')).toBeInTheDocument();
    expect(screen.getByText('No shared media')).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.getAllByText('Offline').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    expect(screen.queryByText('Secure')).not.toBeInTheDocument();
  });
});
