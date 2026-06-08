import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makeMessage, makeUser } from '../../../test/chatFixtures';
import ChatSidebar from './ChatSidebar';

type ChatSidebarProps = ComponentProps<typeof ChatSidebar>;

const renderSidebar = (overrides: Partial<ChatSidebarProps> = {}) => {
  const props: ChatSidebarProps = {
    user: makeUser(),
    chats: [],
    selectedChatId: null,
    isOpen: true,
    isLoading: false,
    isError: false,
    searchQuery: '',
    isNewChatOpen: false,
    newChatEmail: '',
    createChatError: null,
    isCreatingChat: false,
    unreadCounts: new Map(),
    onlineUsers: new Map(),
    newChatButtonRef: createRef<HTMLButtonElement>(),
    onSearchChange: vi.fn(),
    onSelectChat: vi.fn(),
    onCloseSidebar: vi.fn(),
    onOpenSettings: vi.fn(),
    onLogout: vi.fn(),
    onToggleNewChat: vi.fn(),
    onNewChatEmailChange: vi.fn(),
    onCreateChatSubmit: vi.fn(),
    onRefetchChats: vi.fn(),
    ...overrides,
  };

  render(<ChatSidebar {...props} />);
  return props;
};

describe('ChatSidebar', () => {
  it('renders the empty sidebar state and close control', async () => {
    const user = userEvent.setup();
    const onCloseSidebar = vi.fn();

    renderSidebar({ onCloseSidebar });

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.getByText('Start a chat to begin messaging.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close conversations' }));
    expect(onCloseSidebar).toHaveBeenCalledTimes(1);
  });

  it('shows unread counts and selects a conversation', async () => {
    const user = userEvent.setup();
    const onSelectChat = vi.fn();
    const chat = makeChat({
      latestMessage: makeMessage({ text: 'Latest visible message' }),
      updatedAt: '2026-06-08T10:05:00.000Z',
    });

    renderSidebar({
      chats: [chat],
      unreadCounts: new Map([[chat._id, 3]]),
      onSelectChat,
    });

    expect(screen.getByText('3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Grace Hopper/ }));
    expect(onSelectChat).toHaveBeenCalledWith('chat-1');
  });
});
