import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makePinnedMessage, makeSharedAsset, makeUser } from '../../../test/chatFixtures';
import ChatContextRail from './ChatContextRail';

describe('ChatContextRail', () => {
  it('renders server-backed sections and wires actions', async () => {
    const user = userEvent.setup();
    const onSearchMessages = vi.fn();
    const onJumpToMessage = vi.fn();
    const onUnpinMessage = vi.fn();
    const chat = makeChat({
      members: [
        makeUser({ _id: 'user-1', firstName: 'AX', lastName: '7F3C' }),
        makeUser({ _id: 'user-2', firstName: 'IN', lastName: '8B21', profilePic: 'https://example.com/avatar.png' }),
      ],
    });

    render(
      <ChatContextRail
        selectedChat={chat}
        currentUserId="user-1"
        otherMember={chat.members[1]}
        otherMemberStatus={{ userId: 'user-2', isOnline: true }}
        pinnedMessages={[makePinnedMessage({ messageId: 'message-pin', text: 'Retry logic note' })]}
        sharedFiles={[makeSharedAsset({ attachmentId: 'file-1', messageId: 'message-file', displayName: 'message-states-spec.pdf' })]}
        sharedMedia={[makeSharedAsset({ attachmentId: 'media-1', messageId: 'message-media', displayName: 'diagram.png', mimeType: 'image/png', kind: 'media' })]}
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
        onSearchMessages={onSearchMessages}
        onJumpToMessage={onJumpToMessage}
        onUnpinMessage={onUnpinMessage}
      />
    );

    expect(screen.getByRole('complementary', { name: 'Conversation details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Call' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Video call' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More conversation actions' })).toBeDisabled();
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
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText('Member-only room')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Realtime connection')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Protected file access')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Search messages' }));
    await user.click(screen.getByRole('button', { name: 'Retry logic note' }));
    await user.click(screen.getByRole('button', { name: 'Unpin Retry logic note' }));
    expect(onSearchMessages).toHaveBeenCalledTimes(1);
    expect(onJumpToMessage).toHaveBeenCalledWith('message-pin');
    expect(onUnpinMessage).toHaveBeenCalledWith('message-pin');
  });

  it('downgrades security rows when auth, membership, or socket state is unavailable', () => {
    const chat = makeChat({
      members: [
        makeUser({ _id: 'user-2', firstName: 'IN', lastName: '8B21' }),
      ],
    });

    render(
      <ChatContextRail
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
        onSearchMessages={vi.fn()}
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
