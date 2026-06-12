import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makeUser } from '../../../test/chatFixtures';
import ConversationHeader from './ConversationHeader';

describe('ConversationHeader', () => {
  it('uses abstract identity and accessible reference actions', async () => {
    const user = userEvent.setup();
    const onOpenSidebar = vi.fn();
    const onToggleMessageSearch = vi.fn();
    const chat = makeChat({
      members: [
        makeUser({ _id: 'user-1', firstName: 'AX', lastName: '7F3C' }),
        makeUser({ _id: 'user-2', firstName: 'IN', lastName: '8B21', profilePic: 'https://example.com/avatar.png' }),
      ],
    });

    render(
      <ConversationHeader
        selectedChat={chat}
        title="IN-8B21"
        otherMember={chat.members[1]}
        otherMemberStatus={{ userId: 'user-2', isOnline: true }}
        showMessageSearch={false}
        searchButtonRef={createRef<HTMLButtonElement>()}
        onOpenSidebar={onOpenSidebar}
        onToggleMessageSearch={onToggleMessageSearch}
        onExportChat={vi.fn()}
      />
    );

    expect(screen.getByText('IN-8B21')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open conversations' }));
    await user.click(screen.getByRole('button', { name: 'Search messages' }));

    expect(onOpenSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleMessageSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Call' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Video call' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More conversation actions' })).toBeDisabled();
  });
});
