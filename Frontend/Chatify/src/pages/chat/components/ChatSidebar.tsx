import AccountsButton from '../../../components/accountsButton';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { X } from 'lucide-react';
import type { User } from '../../../types/auth';
import type { Chat } from '../../../types/chat';
import { getChatTitle, getOtherMember } from '../utils/chatDisplay';
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
      className={`chat-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(86vw,320px)] max-w-[320px] flex-col border-r border-[#2E363C] bg-[#181C20] transition-transform duration-200 ease-out md:static md:z-auto md:w-[320px] md:min-w-[280px] md:max-w-none md:translate-x-0 2xl:w-[360px] 2xl:min-w-[360px] ${
        isOpen ? 'open translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="flex min-h-16 items-center gap-3 border-b border-[#2E363C] p-4">
        {user?.profilePic ? (
          <img src={user.profilePic} alt="Profile" className="profile-pic h-10 w-10 md:h-11 md:w-11 rounded-full object-cover" />
        ) : (
          <div className="profile-pic h-10 w-10 md:h-11 md:w-11 rounded-full bg-[#14B8A6] flex items-center justify-center text-base font-semibold text-[#101113]">
            {user?.firstName?.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#6F7B77]">Logged in as</p>
          <p className="truncate text-sm font-semibold text-[#F4F7F6]">{user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Guest'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCloseSidebar}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg text-[#A8B3AF] transition-colors hover:bg-[#20262B] hover:text-[#14B8A6] md:hidden"
            aria-label="Close conversations"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg text-[#A8B3AF] transition-colors hover:bg-[#20262B] hover:text-[#14B8A6]"
            title="Settings"
            aria-label="Open settings"
          >
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <div onClick={onLogout} className="cursor-pointer">
            <AccountsButton color="#dc2626" text="Logout" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-[#2E363C] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#A8B3AF]">Chats</h2>
        <button
          ref={newChatButtonRef}
          type="button"
          onClick={onToggleNewChat}
          className="min-h-8 cursor-pointer rounded-lg bg-[#14B8A6]/10 px-3 py-1 text-xs font-semibold text-[#14B8A6] hover:bg-[#14B8A6]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
        >
          {isNewChatOpen ? 'Close' : 'New chat'}
        </button>
      </div>

      <div className="border-b border-[#2E363C] px-4 py-2">
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
          className="w-full rounded-lg border border-[#2E363C] bg-[#101113] px-3 py-2 text-sm text-[#F4F7F6] placeholder:text-[#6F7B77] focus:border-[#14B8A6] focus:outline-none"
        />
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
          <div className="space-y-2 p-4 text-sm text-[#EF4444]">
            <p>We could not load your chats.</p>
            <button
              type="button"
              onClick={onRefetchChats}
              className="cursor-pointer rounded-lg bg-[#14B8A6]/10 px-3 py-1 text-[#14B8A6] hover:bg-[#14B8A6]/20"
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
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-[#A8B3AF]">
            <p className="font-semibold text-[#F4F7F6]">{searchQuery.trim() ? 'No matching conversations' : 'No conversations yet'}</p>
            <p>{searchQuery.trim() ? 'Try a different name or latest message, or use New chat to start by email.' : 'Start a chat to begin messaging.'}</p>
          </div>
        )}
      </div>
    </aside>
  );
};

const ChatListSkeleton = () => (
  <div className="space-y-1 p-2" aria-label="Loading chats">
    {[0, 1, 2, 3, 4, 5].map((item) => (
      <div key={item} className="flex min-h-[72px] items-center gap-3 rounded-lg px-3 py-2">
        <div className="h-10 w-10 shrink-0 motion-safe:animate-pulse rounded-full bg-[#20262B]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className={`h-3 motion-safe:animate-pulse rounded bg-[#20262B] ${item % 2 === 0 ? 'w-32' : 'w-24'}`} />
          <div className="h-3 w-full max-w-[180px] motion-safe:animate-pulse rounded bg-[#20262B]" />
        </div>
        <div className="h-3 w-10 motion-safe:animate-pulse rounded bg-[#20262B]" />
      </div>
    ))}
  </div>
);

export default ChatSidebar;
