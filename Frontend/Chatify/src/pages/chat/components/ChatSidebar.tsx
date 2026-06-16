import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { Lock, LogOut, Plus, Search, Settings, X } from 'lucide-react';
import type { User } from '../../../types/auth';
import type { Chat } from '../../../types/chat';
import { getChatTitle, getOtherMember } from '../utils/chatDisplay';
import AbstractIdentityTile from './AbstractIdentityTile';
import ChatListItem from './ChatListItem';
import NewChatDialog from './NewChatDialog';

interface ChatSidebarProps {
  user: User | null;
  chats: Chat[] | undefined;
  selectedChatId: string | null;
  isOpen: boolean;
  isLoading: boolean;
  isError: boolean;
  searchQuery: string;
  isNewChatOpen: boolean;
  newChatEmail: string;
  createChatError: string | null;
  isCreatingChat: boolean;
  unreadCounts?: Map<string, number>;
  onlineUsers: Map<string, { isOnline: boolean }>;
  newChatButtonRef: RefObject<HTMLButtonElement | null>;
  onSearchChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onCloseSidebar: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onToggleNewChat: () => void;
  onNewChatEmailChange: (value: string) => void;
  onCreateChatSubmit: NewChatDialogProps['onSubmit'];
  onRefetchChats: () => void;
}

type NewChatDialogProps = Parameters<typeof NewChatDialog>[0];

const ChatSidebar = ({
  user,
  chats,
  selectedChatId,
  isOpen,
  isLoading,
  isError,
  searchQuery,
  isNewChatOpen,
  newChatEmail,
  createChatError,
  isCreatingChat,
  unreadCounts,
  onlineUsers,
  newChatButtonRef,
  onSearchChange,
  onSelectChat,
  onCloseSidebar,
  onOpenSettings,
  onLogout,
  onToggleNewChat,
  onNewChatEmailChange,
  onCreateChatSubmit,
  onRefetchChats,
}: ChatSidebarProps) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filteredChats = chats?.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const title = getChatTitle(chat, user?._id).toLowerCase();
    const latestSnippet = chat.latestMessage?.text?.toLowerCase() ?? '';
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return title.includes(normalizedQuery) || latestSnippet.includes(normalizedQuery);
  });

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <aside
      data-testid="chat-sidebar"
      className={`chat-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] max-w-[320px] flex-col border-r border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] transition-transform duration-200 ease-out md:static md:z-auto md:w-[320px] md:min-w-[280px] md:max-w-none md:translate-x-0 xl:w-[344px] xl:min-w-[344px] ${
        isOpen ? 'open translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="flex min-h-16 items-center gap-3 border-b border-[var(--chat-border)] p-4">
        <AbstractIdentityTile
          id={user?._id}
          label={user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Guest'}
          variant="account"
          className="h-11 w-11"
          aria-label="Current account abstract identity"
        />
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
            title="Logout"
            aria-label="Logout"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

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

      <NewChatDialog
        isOpen={isNewChatOpen}
        email={newChatEmail}
        error={createChatError}
        isSubmitting={isCreatingChat}
        openerRef={newChatButtonRef}
        onEmailChange={onNewChatEmailChange}
        onSubmit={onCreateChatSubmit}
        onClose={onToggleNewChat}
      />

      <div className="flex-1 overflow-y-auto chat-sidebar-scroll">
        {isLoading ? (
          <ChatListSkeleton />
        ) : isError ? (
          <div className="space-y-2 p-4 text-sm text-[var(--chat-danger)]">
            <p>We could not load your chats.</p>
            <button
              type="button"
              onClick={onRefetchChats}
              className="cursor-pointer rounded-[var(--chat-radius-md)] bg-[var(--chat-accent-soft)] px-3 py-1 text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
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
                  isActive={chat._id === selectedChatId}
                  isOnline={memberStatus?.isOnline ?? false}
                  unreadCount={unreadCounts?.get(chat._id) ?? 0}
                  onSelect={() => onSelectChat(chat._id)}
                />
              );
            })}
          </ul>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-[var(--chat-text-muted)]">
            <p className="font-semibold text-[var(--chat-text)]">{searchQuery.trim() ? 'No matching conversations' : 'No conversations yet'}</p>
            <p>{searchQuery.trim() ? 'Try a different name or latest message, or use New chat to start by email.' : 'Start a chat to begin messaging.'}</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-[var(--chat-border)] px-4 py-3 text-xs text-[var(--chat-text-muted)]">
        <span className="inline-flex items-center gap-2">
          <Lock aria-hidden="true" className="h-4 w-4" />
          Authenticated private chat
        </span>
        <button
          type="button"
          onClick={onOpenSettings}
          className="grid h-8 w-8 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          aria-label="Open settings"
        >
          <Settings aria-hidden="true" className="h-4 w-4" />
        </button>
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
