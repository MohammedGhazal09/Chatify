import { createRef } from 'react';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { makeChat, makeMessage, makeUser } from '../../../test/chatFixtures';
import ChatSidebar from './ChatSidebar';

type ChatSidebarProps = ComponentProps<typeof ChatSidebar>;

const makeSidebarProps = (overrides: Partial<ChatSidebarProps> = {}): ChatSidebarProps => ({
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
});

const renderSidebar = (overrides: Partial<ChatSidebarProps> = {}) => {
  const props = makeSidebarProps(overrides);
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
    expect(screen.getByRole('textbox', { name: 'Search conversations' })).toBeInTheDocument();
    expect(screen.getByText('Authenticated private chat')).toBeInTheDocument();
    expect(screen.queryByText('End-to-end encrypted')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close conversations' }));
    expect(onCloseSidebar).toHaveBeenCalledTimes(1);
  });

  it('renders stable skeleton rows while loading chats', () => {
    renderSidebar({ isLoading: true });

    expect(screen.getByLabelText('Loading chats')).toBeInTheDocument();
    expect(screen.queryByText('No conversations yet')).not.toBeInTheDocument();
  });

  it('renders a compact logout button and triggers logout', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    renderSidebar({ onLogout });

    const logoutButton = screen.getByRole('button', { name: 'Logout' });

    expect(logoutButton).toHaveClass('chat-logout-button');

    await user.click(logoutButton);

    expect(onLogout).toHaveBeenCalledTimes(1);
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

  it('filters conversations by title and latest visible snippet without matching member email', () => {
    const launchChat = makeChat({
      _id: 'chat-launch',
      latestMessage: makeMessage({ _id: 'message-launch', text: 'Launch plan is ready' }),
    });
    const privateEmailOnlyChat = makeChat({
      _id: 'chat-private',
      members: [
        makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }),
        makeUser({
          _id: 'user-3',
          firstName: 'Nora',
          lastName: 'Stone',
          email: 'private-alias@example.com',
        }),
      ],
      latestMessage: makeMessage({ _id: 'message-private', text: 'Ordinary update' }),
    });

    const props = makeSidebarProps({
      chats: [launchChat, privateEmailOnlyChat],
      searchQuery: 'launch',
    });
    const { rerender } = render(<ChatSidebar {...props} />);

    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.queryByText('Nora Stone')).not.toBeInTheDocument();

    rerender(
      <ChatSidebar {...props} searchQuery="private-alias@example.com" />
    );

    expect(screen.queryByText('Nora Stone')).not.toBeInTheDocument();
    expect(screen.getByText('No matching conversations')).toBeInTheDocument();
    expect(screen.getByText('Try a different name or latest message, or use New chat to start by email.')).toBeInTheDocument();
  });
});
