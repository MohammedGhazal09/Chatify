import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makePinnedMessage, makeSharedAsset } from '../../../test/chatFixtures';
import ConversationDetailDrawer from './ConversationDetailDrawer';

const baseProps = {
  selectedChat: makeChat(),
  currentUserId: 'user-1',
  otherMember: makeChat().members[1],
  otherMemberStatus: { userId: 'user-2', isOnline: true },
  pinnedMessages: [makePinnedMessage({ messageId: 'message-pin', text: 'Pinned retry note' })],
  sharedFiles: [makeSharedAsset({ attachmentId: 'file-1', messageId: 'message-file', displayName: 'delivery-matrix.xlsx' })],
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
  onSearchMessages: vi.fn(),
  onJumpToMessage: vi.fn(),
  onUnpinMessage: vi.fn(),
};

describe('ConversationDetailDrawer', () => {
  it('renders server-backed detail state and wires drawer actions', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSearchMessages = vi.fn();
    const onJumpToMessage = vi.fn();

    render(
      <ConversationDetailDrawer
        {...baseProps}
        isOpen
        onClose={onClose}
        onSearchMessages={onSearchMessages}
        onJumpToMessage={onJumpToMessage}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Conversation details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close conversation details' })).toHaveFocus();
    expect(screen.getByText('Pinned retry note')).toBeInTheDocument();
    expect(screen.getByText('delivery-matrix.xlsx')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'diagram.png' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Search messages' }));
    await user.click(screen.getByRole('button', { name: 'Pinned retry note' }));
    await user.keyboard('{Escape}');

    expect(onSearchMessages).toHaveBeenCalledTimes(1);
    expect(onJumpToMessage).toHaveBeenCalledWith('message-pin');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when closed', () => {
    render(<ConversationDetailDrawer {...baseProps} isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog', { name: 'Conversation details' })).not.toBeInTheDocument();
  });
});
