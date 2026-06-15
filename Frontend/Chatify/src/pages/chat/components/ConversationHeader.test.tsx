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
    const onToggleConversationMoreMenu = vi.fn();
    const onToggleConversationDetails = vi.fn();
    const onStartAudioCall = vi.fn();
    const onStartVideoCall = vi.fn();
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
        showConversationMoreMenu={false}
        showConversationDetails={false}
        searchButtonRef={createRef<HTMLButtonElement>()}
        moreButtonRef={createRef<HTMLButtonElement>()}
        onOpenSidebar={onOpenSidebar}
        onStartAudioCall={onStartAudioCall}
        onStartVideoCall={onStartVideoCall}
        onToggleConversationMoreMenu={onToggleConversationMoreMenu}
        onToggleConversationDetails={onToggleConversationDetails}
        onToggleMessageSearch={onToggleMessageSearch}
        onExportChat={vi.fn()}
      />
    );

    expect(screen.getByText('IN-8B21')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open conversations' }));
    await user.click(screen.getByRole('button', { name: 'Call' }));
    await user.click(screen.getByRole('button', { name: 'Video call' }));
    await user.click(screen.getByRole('button', { name: 'Search messages' }));
    await user.click(screen.getByRole('button', { name: 'More conversation actions' }));
    await user.click(screen.getByRole('button', { name: 'Open conversation details' }));

    expect(onOpenSidebar).toHaveBeenCalledTimes(1);
    expect(onStartAudioCall).toHaveBeenCalledTimes(1);
    expect(onStartVideoCall).toHaveBeenCalledTimes(1);
    expect(onToggleMessageSearch).toHaveBeenCalledTimes(1);
    expect(onToggleConversationMoreMenu).toHaveBeenCalledTimes(1);
    expect(onToggleConversationDetails).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Call' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Video call' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'More conversation actions' })).toBeEnabled();
    const headerButtons = screen.getAllByRole('button');
    expect(headerButtons[headerButtons.length - 1]).toBe(screen.getByRole('button', { name: 'Open conversation details' }));
  });

  it('shows the close state for the top-right detail toggle when details are open', () => {
    const chat = makeChat();

    render(
      <ConversationHeader
        selectedChat={chat}
        title="IN-8B21"
        otherMember={chat.members[1]}
        otherMemberStatus={{ userId: 'user-2', isOnline: true }}
        showMessageSearch={false}
        showConversationMoreMenu={false}
        showConversationDetails
        searchButtonRef={createRef<HTMLButtonElement>()}
        moreButtonRef={createRef<HTMLButtonElement>()}
        onOpenSidebar={vi.fn()}
        onStartAudioCall={vi.fn()}
        onStartVideoCall={vi.fn()}
        onToggleConversationMoreMenu={vi.fn()}
        onToggleConversationDetails={vi.fn()}
        onToggleMessageSearch={vi.fn()}
        onExportChat={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Close conversation details' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('explains disabled call actions', () => {
    const chat = makeChat();

    render(
      <ConversationHeader
        selectedChat={chat}
        title="IN-8B21"
        otherMember={chat.members[1]}
        otherMemberStatus={{ userId: 'user-2', isOnline: false }}
        showMessageSearch={false}
        showConversationMoreMenu={false}
        showConversationDetails={false}
        callDisabledReason="Both users must be online to call."
        videoCallDisabledReason="Camera access is unavailable."
        searchButtonRef={createRef<HTMLButtonElement>()}
        moreButtonRef={createRef<HTMLButtonElement>()}
        onOpenSidebar={vi.fn()}
        onStartAudioCall={vi.fn()}
        onStartVideoCall={vi.fn()}
        onToggleConversationMoreMenu={vi.fn()}
        onToggleConversationDetails={vi.fn()}
        onToggleMessageSearch={vi.fn()}
        onExportChat={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Call' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Call' })).toHaveAttribute('title', 'Both users must be online to call.');
    expect(screen.getByRole('button', { name: 'Video call' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Video call' })).toHaveAttribute('title', 'Camera access is unavailable.');
  });
});
