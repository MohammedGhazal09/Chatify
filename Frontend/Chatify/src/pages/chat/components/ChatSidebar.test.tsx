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
    newChatUsername: '',
    createChatError: null,
    isCreatingChat: false,
    isCreatingGroupChat: false,
    unreadCounts: new Map(),
    onlineUsers: new Map(),
    newChatButtonRef: createRef<HTMLButtonElement>(),
    onSearchChange: vi.fn(),
    onSelectChat: vi.fn(),
    onCloseSidebar: vi.fn(),
    onOpenSettings: vi.fn(),
    onLogout: vi.fn(),
    onToggleNewChat: vi.fn(),
    onNewChatUsernameChange: vi.fn(),
    onCreateChatSubmit: vi.fn(),
    onCreateGroupSubmit: vi.fn(),
    onClearCreateChatError: vi.fn(),
    onRefetchChats: vi.fn(),
    ...overrides,
});

const renderSidebar = (overrides: Partial<ChatSidebarProps> = {}) => {
  const props = makeSidebarProps(overrides);
  render(<ChatSidebar {...props} />);
  return props;
};

describe('ChatSidebar', () => {
  it('renders the current account profile image in the sidebar header', () => {
    renderSidebar({
      user: makeUser({ profilePic: '/api/user/user-1/profile-image?v=account' }),
    });

    expect(screen.getByRole('img', { name: 'Current account profile picture' })).toHaveAttribute(
      'src',
      expect.stringContaining('/api/user/user-1/profile-image?v=account')
    );
  });

  it('renders the empty sidebar state and close control', async () => {
    const user = userEvent.setup();
    const onCloseSidebar = vi.fn();
    const onToggleNewChat = vi.fn();

    renderSidebar({ onCloseSidebar, onToggleNewChat });

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.getByText('Start a direct chat by username when you are ready to message.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search conversations' })).toBeInTheDocument();
    expect(screen.getByText('Authenticated private chat')).toBeInTheDocument();
    expect(screen.queryByText('End-to-end encrypted')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    expect(onToggleNewChat).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Close conversations' }));
    expect(onCloseSidebar).toHaveBeenCalledTimes(1);
  });

  it('renders stable skeleton rows while loading chats', () => {
    renderSidebar({ isLoading: true });

    expect(screen.getByLabelText('Loading chats')).toBeInTheDocument();
    expect(screen.queryByText('No conversations yet')).not.toBeInTheDocument();
  });

  it('renders a recoverable chat-list error state', async () => {
    const user = userEvent.setup();
    const onRefetchChats = vi.fn();

    renderSidebar({ isError: true, onRefetchChats });

    expect(screen.getByRole('alert')).toHaveTextContent('Conversations unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load your private chat list.');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRefetchChats).toHaveBeenCalledTimes(1);
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

  it('passes muted conversations through to the visible chat row', () => {
    const chat = makeChat({
      latestMessage: makeMessage({ text: 'Visible latest message' }),
    });

    renderSidebar({
      chats: [chat],
      mutedChatIds: [chat._id],
      unreadCounts: new Map([[chat._id, 2]]),
    });

    expect(screen.getByLabelText('Conversation muted')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
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
    expect(screen.getByText('Try another name or message preview, or clear search to see every conversation.')).toBeInTheDocument();
  });

  it('clears conversation search from the no-results state', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    renderSidebar({ searchQuery: 'not-found', onSearchChange });

    await user.click(screen.getByRole('button', { name: 'Clear conversation search' }));

    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
