import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makeMessage, makeUser } from '../../../test/chatFixtures';
import ChatContextRail from './ChatContextRail';

describe('ChatContextRail', () => {
  it('renders presentational sections and wires search to existing message search', async () => {
    const user = userEvent.setup();
    const onSearchMessages = vi.fn();
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
        messages={[makeMessage({ _id: 'message-1', text: 'Retry logic note' })]}
        isAuthenticated
        isSocketConnected
        isReconnecting={false}
        isOffline={false}
        onSearchMessages={onSearchMessages}
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
    expect(screen.getByText('Pinning is not available in this phase.')).toBeInTheDocument();
    expect(screen.getByText('File sharing is planned for Phase 08.')).toBeInTheDocument();
    expect(screen.getByText('Media sharing is planned for Phase 08.')).toBeInTheDocument();
    expect(screen.queryByText('Retry logic note')).not.toBeInTheDocument();
    expect(screen.queryByText('message-states-spec.pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('delivery-metrics.xlsx')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Abstract shared media')).not.toBeInTheDocument();
    expect(screen.getByText('Authenticated session')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Member-only room')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Realtime connection')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Search messages' }));
    expect(onSearchMessages).toHaveBeenCalledTimes(1);
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
        messages={[]}
        isAuthenticated={false}
        isSocketConnected={false}
        isReconnecting={false}
        isOffline
        onSearchMessages={vi.fn()}
      />
    );

    expect(screen.getAllByText('Unavailable')).toHaveLength(2);
    expect(screen.getAllByText('Offline').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
    expect(screen.queryByText('Secure')).not.toBeInTheDocument();
  });
});
