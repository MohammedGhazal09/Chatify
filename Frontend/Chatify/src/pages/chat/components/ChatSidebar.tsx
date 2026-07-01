import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import {
  Archive,
  Bookmark,
  Hash,
  Inbox,
  Lock,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { User } from '../../../types/auth';
import type { Chat, ConversationFocusFilter } from '../../../types/chat';
import { isEncryptedConversation } from '../../../utils/encryptedMessages';
import { getChatTitle, getOtherMember } from '../utils/chatDisplay';
import ChatListItem from './ChatListItem';
import NewChatDialog from './NewChatDialog';
import UserAvatar from './UserAvatar';

interface ChatSidebarProps {
  user: User | null;
  chats: Chat[] | undefined;
  selectedChatId: string | null;
  isOpen: boolean;
  isLoading: boolean;
  isError: boolean;
  searchQuery: string;
  activeFilter: ConversationFocusFilter;
  isNewChatOpen: boolean;
  newChatUsername: string;
  createChatError: string | null;
  createChatNotice?: string | null;
  isCreatingChat: boolean;
  isCreatingGroupChat: boolean;
  draftsByChatId?: Record<string, string>;
  unreadCounts?: Map<string, number>;
  mutedChatIds?: string[];
  onlineUsers: Map<string, { isOnline: boolean }>;
  newChatButtonRef: RefObject<HTMLButtonElement | null>;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: ConversationFocusFilter) => void;
  onSelectChat: (chatId: string) => void;
  onCloseSidebar: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onToggleNewChat: () => void;
  onNewChatUsernameChange: (value: string) => void;
  onCreateChatSubmit: NewChatDialogProps['onSubmit'];
  onCreateGroupSubmit: NewChatDialogProps['onCreateGroupSubmit'];
  onClearCreateChatError: () => void;
  onRefetchChats: () => void;
  workspaceMode?: SidebarWorkspaceMode;
  spacesPanel?: ReactNode;
  onWorkspaceModeChange?: (mode: SidebarWorkspaceMode) => void;
  onOpenSavedMessages?: () => void;
}

type NewChatDialogProps = Parameters<typeof NewChatDialog>[0];
export type SidebarWorkspaceMode = 'conversations' | 'spaces';

const FILTER_OPTIONS: Array<{
  value: ConversationFocusFilter;
  label: string;
  icon: typeof MessageCircle;
}> = [
  { value: 'all', label: 'All', icon: MessageCircle },
  { value: 'unread', label: 'Unread', icon: Inbox },
  { value: 'direct', label: 'Direct', icon: UserRound },
  { value: 'group', label: 'Groups', icon: Users },
  { value: 'archived', label: 'Archived', icon: Archive },
  { value: 'favorite', label: 'Starred', icon: Star },
];

const getChatSortTime = (chat: Chat) => {
  const time = Date.parse(chat.updatedAt ?? '');
  return Number.isFinite(time) ? time : 0;
};

const sortChatsForSidebar = (chats: Chat[]) => [...chats].sort((left, right) => {
  const pinnedDelta = Number(right.organizationState?.pinned === true) - Number(left.organizationState?.pinned === true);

  if (pinnedDelta !== 0) {
    return pinnedDelta;
  }

  const timeDelta = getChatSortTime(right) - getChatSortTime(left);

  if (timeDelta !== 0) {
    return timeDelta;
  }

  return left._id.localeCompare(right._id);
});

const normalizeDraftText = (value?: string) => value?.replace(/\s+/g, ' ').trim() ?? '';

const matchesFocusFilter = (
  chat: Chat,
  filter: ConversationFocusFilter,
  unreadCount: number
) => {
  switch (filter) {
    case 'unread':
      return unreadCount > 0;
    case 'direct':
      return !chat.isGroupChat;
    case 'group':
      return chat.isGroupChat;
    case 'archived':
      return chat.organizationState?.archived === true;
    case 'favorite':
      return chat.organizationState?.favorite === true;
    case 'all':
    default:
      return chat.organizationState?.archived !== true;
  }
};

const getEmptyStateTitle = (filter: ConversationFocusFilter, hasSearch: boolean) => {
  if (hasSearch) {
    return 'No matching conversations';
  }

  switch (filter) {
    case 'unread':
      return 'No unread conversations';
    case 'direct':
      return 'No direct conversations';
    case 'group':
      return 'No group conversations';
    case 'archived':
      return 'No archived conversations';
    case 'favorite':
      return 'No starred conversations';
    case 'all':
    default:
      return 'No conversations yet';
  }
};

const getEmptyStateBody = (filter: ConversationFocusFilter, hasSearch: boolean) => {
  if (hasSearch) {
    return 'Try another name or message preview, or clear search to see every conversation.';
  }

  if (filter === 'all') {
    return 'Start a direct chat by username when you are ready to message.';
  }

  return 'Switch filters or start a new conversation when you need a fresh thread.';
};

const ChatSidebar = ({
  user,
  chats,
  selectedChatId,
  isOpen,
  isLoading,
  isError,
  searchQuery,
  activeFilter,
  isNewChatOpen,
  newChatUsername,
  createChatError,
  createChatNotice,
  isCreatingChat,
  isCreatingGroupChat,
  draftsByChatId = {},
  unreadCounts,
  mutedChatIds = [],
  onlineUsers,
  newChatButtonRef,
  onSearchChange,
  onFilterChange,
  onSelectChat,
  onCloseSidebar,
  onOpenSettings,
  onLogout,
  onToggleNewChat,
  onNewChatUsernameChange,
  onCreateChatSubmit,
  onCreateGroupSubmit,
  onClearCreateChatError,
  onRefetchChats,
  workspaceMode = 'conversations',
  spacesPanel,
  onWorkspaceModeChange,
  onOpenSavedMessages,
}: ChatSidebarProps) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isConversationsMode = workspaceMode === 'conversations';
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredChats = chats ? sortChatsForSidebar(chats).filter((chat) => {
    const title = getChatTitle(chat, user?._id).toLowerCase();
    const latestSnippet = chat.latestMessage?.text?.toLowerCase() ?? '';
    const draftSnippet = normalizeDraftText(draftsByChatId[chat._id]);
    const searchableDraftSnippet = isEncryptedConversation(chat) ? '' : draftSnippet.toLowerCase();
    const matchesSearch = !normalizedQuery ||
      title.includes(normalizedQuery) ||
      latestSnippet.includes(normalizedQuery) ||
      searchableDraftSnippet.includes(normalizedQuery);
    const unreadCount = unreadCounts?.get(chat._id) ?? 0;
    const matchesFilter = matchesFocusFilter(chat, activeFilter, unreadCount);
    const shouldKeepSelectedChatVisible = activeFilter === 'all' && chat._id === selectedChatId && !normalizedQuery;

    return matchesSearch && (matchesFilter || shouldKeepSelectedChatVisible);
  }) : undefined;
  const hasSearchQuery = Boolean(searchQuery.trim());

  useEffect(() => {
    if (isOpen && isConversationsMode) {
      searchInputRef.current?.focus();
    }
  }, [isConversationsMode, isOpen]);

  return (
    <aside
      data-testid="chat-sidebar"
      className={`chat-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] max-w-[320px] flex-col border-r border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] transition-transform duration-200 ease-out md:static md:z-auto md:w-[320px] md:min-w-[280px] md:max-w-none md:translate-x-0 xl:w-[344px] xl:min-w-[344px] ${
        isOpen ? 'open translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="flex min-h-16 items-center gap-3 border-b border-[var(--chat-border)] p-4">
        <button
          type="button"
          onClick={onOpenSettings}
          className="group grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          title="Open account settings"
          aria-label="Open account settings"
        >
          <UserAvatar
            user={user}
            label={user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Guest'}
            variant="account"
            className="h-11 w-11 transition group-hover:ring-2 group-hover:ring-[var(--chat-accent)]"
            imageAlt="Current account profile picture"
            fallbackAriaLabel="Current account profile picture fallback"
          />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--chat-text-soft)]">Chatify</p>
          <p className="truncate text-sm font-semibold text-[var(--chat-text)]">{user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Guest'}</p>
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--chat-success)]">
            <span className="h-2 w-2 rounded-full bg-[var(--chat-success)]" aria-hidden="true" />
            Connected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCloseSidebar}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] md:hidden"
            aria-label="Close conversations"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            title="Settings"
            aria-label="Open settings"
          >
            <Settings aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="chat-logout-button inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--chat-radius-md)] px-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            title="Logout from Chatify and sync open tabs"
            aria-label="Logout"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
      <div className="border-b border-[var(--chat-border)] px-3 py-2">
        <div className="grid grid-cols-2 gap-1 rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] p-1" role="group" aria-label="Sidebar workspace">
          <button
            type="button"
            onClick={() => onWorkspaceModeChange?.('conversations')}
            aria-pressed={workspaceMode === 'conversations'}
            className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-[var(--chat-radius-md)] px-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
              workspaceMode === 'conversations'
                ? 'bg-[var(--chat-panel)] text-[var(--chat-text)] shadow-sm'
                : 'text-[var(--chat-text-muted)] hover:text-[var(--chat-text)]'
            }`}
          >
            <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Conversations</span>
          </button>
          <button
            type="button"
            onClick={() => onWorkspaceModeChange?.('spaces')}
            aria-pressed={workspaceMode === 'spaces'}
            className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-[var(--chat-radius-md)] px-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
              workspaceMode === 'spaces'
                ? 'bg-[var(--chat-panel)] text-[var(--chat-text)] shadow-sm'
                : 'text-[var(--chat-text-muted)] hover:text-[var(--chat-text)]'
            }`}
          >
            <Hash aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Spaces</span>
          </button>
        </div>
      </div>

      {workspaceMode === 'conversations' ? (
        <>

      <div className="flex items-center justify-between gap-2 border-b border-[var(--chat-border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--chat-text-muted)]">Chats</h2>
        <button
          ref={newChatButtonRef}
          type="button"
          onClick={onToggleNewChat}
          className="inline-grid min-h-9 min-w-9 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-1 text-xs font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          aria-label={isNewChatOpen ? 'Close new chat' : 'Start new chat'}
        >
          {isNewChatOpen ? 'Close' : <Plus aria-hidden="true" className="h-4 w-4" />}
        </button>
      </div>

      <div className="border-b border-[var(--chat-border)] px-4 py-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--chat-text-soft)]" />
        <input
          ref={searchInputRef}
          type="text"
          name="conversation-search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          autoComplete="off"
          spellCheck={false}
            className="w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--chat-text)] placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
        />
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--chat-border)] px-3 py-2" aria-label="Conversation filters">
        {FILTER_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = activeFilter === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              aria-pressed={isActive}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--chat-radius-md)] px-2.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                isActive
                  ? 'bg-[var(--chat-accent)] text-[var(--chat-own-text)]'
                  : 'text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)]'
              }`}
            >
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      <NewChatDialog
        isOpen={isNewChatOpen}
        username={newChatUsername}
        error={createChatError}
        notice={createChatNotice}
        isSubmitting={isCreatingChat}
        isGroupSubmitting={isCreatingGroupChat}
        openerRef={newChatButtonRef}
        onUsernameChange={onNewChatUsernameChange}
        onSubmit={onCreateChatSubmit}
        onCreateGroupSubmit={onCreateGroupSubmit}
        onClearError={onClearCreateChatError}
        onClose={onToggleNewChat}
      />

      <div className="flex-1 overflow-y-auto chat-sidebar-scroll">
        {isLoading ? (
          <ChatListSkeleton />
        ) : isError ? (
          <div className="space-y-3 p-4 text-sm text-[var(--chat-danger)]" role="alert">
            <div>
              <p className="font-semibold text-[var(--chat-text)]">Conversations unavailable</p>
              <p className="mt-1 text-[var(--chat-danger)]">We could not load your private chat list.</p>
            </div>
            <button
              type="button"
              onClick={onRefetchChats}
              className="min-h-9 cursor-pointer rounded-[var(--chat-radius-md)] bg-[var(--chat-accent-soft)] px-3 py-1 text-sm font-semibold text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              Try again
            </button>
          </div>
        ) : filteredChats && filteredChats.length > 0 ? (
          <ul className="space-y-1 p-2">
            {filteredChats.map((chat) => {
              const otherMember = getOtherMember(chat, user?._id);
              const memberStatus = otherMember ? onlineUsers.get(otherMember._id) : null;

              return (
                <ChatListItem
                  key={chat._id}
                  chat={chat}
                  title={getChatTitle(chat, user?._id)}
                  avatarUser={otherMember}
                  isActive={chat._id === selectedChatId}
                  isOnline={memberStatus?.isOnline ?? false}
                  isMuted={chat.organizationState?.muted ?? mutedChatIds.includes(chat._id)}
                  isPinned={chat.organizationState?.pinned}
                  isFavorite={chat.organizationState?.favorite}
                  isArchived={chat.organizationState?.archived}
                  draftText={draftsByChatId[chat._id]}
                  unreadCount={unreadCounts?.get(chat._id) ?? 0}
                  onSelect={() => onSelectChat(chat._id)}
                />
              );
            })}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm text-[var(--chat-text-muted)]" role="status">
            <div className="space-y-1">
              <p className="font-semibold text-[var(--chat-text)]">{getEmptyStateTitle(activeFilter, hasSearchQuery)}</p>
              <p className="max-w-[240px]">
                {getEmptyStateBody(activeFilter, hasSearchQuery)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (hasSearchQuery) {
                  onSearchChange('');
                  return;
                }

                onToggleNewChat();
              }}
              className="min-h-9 cursor-pointer rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-1.5 text-sm font-semibold text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            >
              {hasSearchQuery ? 'Clear conversation search' : 'Start a new conversation'}
            </button>
          </div>
        )}
      </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          {spacesPanel}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-[var(--chat-border)] px-4 py-3 text-xs text-[var(--chat-text-muted)]">
        <span className="inline-flex items-center gap-2">
          <Lock aria-hidden="true" className="h-4 w-4" />
          Authenticated private chat
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {user?.role === 'admin' && (
            <a
              href="/admin"
              className="grid h-8 w-8 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              aria-label="Open admin operations"
              title="Admin operations"
            >
              <ShieldCheck aria-hidden="true" className="h-4 w-4" />
            </a>
          )}
          <button
            type="button"
            onClick={onOpenSavedMessages}
            className="grid h-8 w-8 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Open saved messages"
            title="Saved messages"
            disabled={!onOpenSavedMessages}
          >
            <Bookmark aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="grid h-8 w-8 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Open settings"
          >
            <Settings aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

const ChatListSkeleton = () => (
  <div className="space-y-1 p-2" aria-label="Loading chats">
    {[0, 1, 2, 3, 4, 5].map((item) => (
      <div key={item} className="flex min-h-[72px] items-center gap-3 rounded-[var(--chat-radius-md)] px-3 py-2">
        <div className="h-10 w-10 shrink-0 motion-safe:animate-pulse rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className={`h-3 motion-safe:animate-pulse rounded bg-[var(--chat-panel-subtle)] ${item % 2 === 0 ? 'w-32' : 'w-24'}`} />
          <div className="h-3 w-full max-w-[180px] motion-safe:animate-pulse rounded bg-[var(--chat-panel-subtle)]" />
        </div>
        <div className="h-3 w-10 motion-safe:animate-pulse rounded bg-[var(--chat-panel-subtle)]" />
      </div>
    ))}
  </div>
);

export default ChatSidebar;
