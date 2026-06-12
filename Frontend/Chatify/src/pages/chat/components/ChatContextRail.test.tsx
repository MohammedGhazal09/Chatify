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
        onSearchMessages={onSearchMessages}
      />
    );

    expect(screen.getByRole('complementary', { name: 'Conversation details' })).toBeInTheDocument();
    expect(screen.getByText('Pinned messages')).toBeInTheDocument();
    expect(screen.getByText('Shared files')).toBeInTheDocument();
    expect(screen.getByText('Shared media')).toBeInTheDocument();
    expect(screen.getByText('Conversation security')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Search messages' }));
    expect(onSearchMessages).toHaveBeenCalledTimes(1);
  });
});
