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
    activeFilter: 'all',
    isNewChatOpen: false,
    newChatUsername: '',
    createChatError: null,
    isCreatingChat: false,
    isCreatingGroupChat: false,
    draftsByChatId: {},
    unreadCounts: new Map(),
    onlineUsers: new Map(),
    newChatButtonRef: createRef<HTMLButtonElement>(),
    workspaceMode: 'conversations',
    spacesPanel: <div>Spaces panel</div>,
    onSearchChange: vi.fn(),
    onFilterChange: vi.fn(),
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
    onWorkspaceModeChange: vi.fn(),
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

  it('opens settings from the current account profile picture', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();

    renderSidebar({ onOpenSettings });

    await user.click(screen.getByRole('button', { name: 'Open account settings' }));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it('opens saved messages from the footer shortcut when wired', async () => {
    const user = userEvent.setup();
    const onOpenSavedMessages = vi.fn();

    const { rerender } = render(<ChatSidebar {...makeSidebarProps()} />);

    expect(screen.getByRole('button', { name: 'Open saved messages' })).toBeDisabled();

    rerender(<ChatSidebar {...makeSidebarProps({ onOpenSavedMessages })} />);

    await user.click(screen.getByRole('button', { name: 'Open saved messages' }));

    expect(onOpenSavedMessages).toHaveBeenCalledTimes(1);
  });

  it('renders the empty sidebar state and close control', async () => {
    const user = userEvent.setup();
    const onCloseSidebar = vi.fn();
    const onToggleNewChat = vi.fn();

    renderSidebar({ onCloseSidebar, onToggleNewChat });

    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.getByText('Start a direct chat by username when you are ready to message.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search conversations' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conversations' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Spaces' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Authenticated private chat')).toBeInTheDocument();
    expect(screen.queryByText('End-to-end encrypted')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    expect(onToggleNewChat).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Close conversations' }));
    expect(onCloseSidebar).toHaveBeenCalledTimes(1);
  });

  it('switches to the spaces workspace without rendering conversation controls', async () => {
    const user = userEvent.setup();
    const onWorkspaceModeChange = vi.fn();
    const { rerender } = render(
      <ChatSidebar
        {...makeSidebarProps({
          onWorkspaceModeChange,
        })}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Spaces' }));

    expect(onWorkspaceModeChange).toHaveBeenCalledWith('spaces');

    rerender(
      <ChatSidebar
        {...makeSidebarProps({
          workspaceMode: 'spaces',
          spacesPanel: <div>Authorized spaces</div>,
        })}
      />
    );

    expect(screen.getByText('Authorized spaces')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Search conversations' })).not.toBeInTheDocument();
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

  it('shows the admin operations shortcut only for admins', () => {
    const { rerender } = render(<ChatSidebar {...makeSidebarProps({ user: makeUser({ role: 'user' }) })} />);

    expect(screen.queryByRole('link', { name: 'Open admin operations' })).not.toBeInTheDocument();

    rerender(<ChatSidebar {...makeSidebarProps({ user: makeUser({ role: 'admin' }) })} />);

    expect(screen.getByRole('link', { name: 'Open admin operations' })).toHaveAttribute('href', '/admin');
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

  it('shows a bounded standard draft preview and matches draft text in search', () => {
    const chat = makeChat({
      latestMessage: makeMessage({ text: 'Older persisted message' }),
    });

    renderSidebar({
      chats: [chat],
      searchQuery: 'flight plan',
      draftsByChatId: {
        [chat._id]: '   Finish   the flight plan  ',
      },
    });

    expect(screen.getByText('Draft:')).toBeInTheDocument();
    expect(screen.getByText('Finish the flight plan')).toHaveAttribute('dir', 'auto');
    expect(screen.queryByText('Older persisted message')).not.toBeInTheDocument();
  });

  it('uses generic sidebar copy for encrypted conversation drafts', () => {
    const chat = makeChat({
      encryptionMode: 'e2ee_v1',
      latestMessage: makeMessage({ text: 'Encrypted latest message' }),
    });

    renderSidebar({
      chats: [chat],
      draftsByChatId: {
        [chat._id]: 'secret encrypted draft',
      },
    });

    expect(screen.getByText('Draft:')).toBeInTheDocument();
    expect(screen.getByText('Draft saved on this device')).toBeInTheDocument();
    expect(screen.queryByText('secret encrypted draft')).not.toBeInTheDocument();
  });

  it('does not match encrypted draft plaintext from sidebar search', () => {
    const chat = makeChat({
      encryptionMode: 'e2ee_v1',
      latestMessage: makeMessage({ text: 'Encrypted latest message' }),
    });

    renderSidebar({
      chats: [chat],
      searchQuery: 'hidden phrase',
      draftsByChatId: {
        [chat._id]: 'hidden phrase',
      },
    });

    expect(screen.queryByText('Draft saved on this device')).not.toBeInTheDocument();
    expect(screen.getByText('No matching conversations')).toBeInTheDocument();
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

  it('renders organization filters and switches focus views', async () => {
    const user = userEvent.setup();
    const onFilterChange = vi.fn();
    const directChat = makeChat({
      _id: 'chat-direct',
      latestMessage: makeMessage({ text: 'Direct update' }),
    });
    const groupChat = makeChat({
      _id: 'chat-group',
      chatName: 'Launch Group',
      isGroupChat: true,
      latestMessage: makeMessage({ text: 'Group update' }),
    });

    renderSidebar({
      chats: [directChat, groupChat],
      activeFilter: 'direct',
      onFilterChange,
    });

    expect(screen.getByRole('button', { name: 'Direct' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.queryByText('Launch Group')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Groups' }));
    expect(onFilterChange).toHaveBeenCalledWith('group');
  });

  it('orders pinned conversations first and shows starred and archived indicators', () => {
    const pinnedChat = makeChat({
      _id: 'chat-pinned',
      latestMessage: makeMessage({ text: 'Pinned note' }),
      updatedAt: '2026-06-08T08:00:00.000Z',
      organizationState: {
        muted: false,
        archived: false,
        pinned: true,
        favorite: true,
      },
    });
    const newerChat = makeChat({
      _id: 'chat-newer',
      members: [
        makeUser({ _id: 'user-1', firstName: 'Ada', lastName: 'Lovelace' }),
        makeUser({ _id: 'user-3', firstName: 'Nora', lastName: 'Stone' }),
      ],
      latestMessage: makeMessage({ text: 'Newer note' }),
      updatedAt: '2026-06-08T11:00:00.000Z',
    });
    const archivedChat = makeChat({
      _id: 'chat-archived',
      chatName: 'Archived Group',
      isGroupChat: true,
      organizationState: {
        muted: false,
        archived: true,
        pinned: false,
        favorite: false,
      },
    });

    renderSidebar({
      chats: [newerChat, archivedChat, pinnedChat],
      activeFilter: 'all',
    });

    const rows = screen.getAllByRole('button', { name: /Grace Hopper|Nora Stone/ });
    expect(rows[0]).toHaveTextContent('Grace Hopper');
    expect(screen.getByLabelText('Conversation pinned')).toBeInTheDocument();
    expect(screen.getByLabelText('Conversation starred')).toBeInTheDocument();
    expect(screen.queryByText('Archived Group')).not.toBeInTheDocument();
  });

  it('keeps a selected archived conversation visible in the all view', () => {
    const archivedChat = makeChat({
      _id: 'chat-archived',
      chatName: 'Archived Group',
      isGroupChat: true,
      organizationState: {
        muted: false,
        archived: true,
        pinned: false,
        favorite: false,
      },
    });

    renderSidebar({
      chats: [archivedChat],
      selectedChatId: archivedChat._id,
      activeFilter: 'all',
    });

    expect(screen.getByText('Archived Group')).toBeInTheDocument();
    expect(screen.getByLabelText('Conversation archived')).toBeInTheDocument();
  });

  it('keeps stable-ID selection through five, many, reordered, added, and removed rows', () => {
    const makeGroupChats = (count: number) => Array.from({ length: count }, (_, index) => makeChat({
      _id: `group-${index}`,
      chatName: `Operations room ${index}`,
      isGroupChat: true,
      updatedAt: new Date(Date.UTC(2026, 5, 8, 10, index)).toISOString(),
    }));
    const fiveChats = makeGroupChats(5);
    const selectedChatId = fiveChats[2]._id;
    const props = makeSidebarProps({ chats: fiveChats, selectedChatId });
    const { rerender } = render(<ChatSidebar {...props} />);

    expect(document.querySelectorAll('.chat-list-item')).toHaveLength(5);
    expect(screen.getByRole('button', { name: /^Operations room 2\b/ })).toHaveAttribute('aria-pressed', 'true');

    const manyChats = makeGroupChats(25).reverse();
    rerender(<ChatSidebar {...props} chats={manyChats} />);

    expect(document.querySelectorAll('.chat-list-item')).toHaveLength(25);
    expect(screen.getByRole('button', { name: /^Operations room 2\b/ })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelectorAll('.chat-list-item[aria-pressed="true"]')).toHaveLength(1);

    rerender(<ChatSidebar {...props} chats={manyChats.filter((chat) => chat._id !== selectedChatId)} />);

    expect(document.querySelectorAll('.chat-list-item[aria-pressed="true"]')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /^Operations room 3\b/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('removes a selected conversation from starred when it is no longer starred', () => {
    const unstarredChat = makeChat({
      _id: 'chat-unstarred',
      chatName: 'Unstarred Group',
      isGroupChat: true,
      organizationState: {
        muted: false,
        archived: false,
        pinned: false,
        favorite: false,
      },
    });

    renderSidebar({
      chats: [unstarredChat],
      selectedChatId: unstarredChat._id,
      activeFilter: 'favorite',
    });

    expect(screen.queryByText('Unstarred Group')).not.toBeInTheDocument();
    expect(screen.getByText('No starred conversations')).toBeInTheDocument();
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
