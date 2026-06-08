import AccountsButton from '../../../components/accountsButton';
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
  onSearchChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
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
  onSearchChange,
  onSelectChat,
  onOpenSettings,
  onLogout,
  onToggleNewChat,
  onNewChatEmailChange,
  onCreateChatSubmit,
  onRefetchChats,
}: ChatSidebarProps) => {
  const filteredChats = chats?.filter((chat) => {
    if (!searchQuery.trim()) return true;
    const title = getChatTitle(chat, user?._id).toLowerCase();
    return title.includes(searchQuery.toLowerCase());
  });

  return (
    <aside className={`chat-sidebar w-80 border-r border-slate-900 bg-slate-900/60 backdrop-blur-sm flex flex-col ${isOpen ? 'open' : ''}`}>
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        {user?.profilePic ? (
          <img src={user.profilePic} alt="Profile" className="profile-pic h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="profile-pic h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center text-lg font-semibold">
            {user?.firstName?.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400">Logged in as</p>
          <p className="truncate font-semibold">{user ? `${user.firstName} ${user.lastName ?? ''}`.trim() : 'Guest'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="cursor-pointer p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
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

      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Chats</h2>
        <button
          type="button"
          onClick={onToggleNewChat}
          className="cursor-pointer rounded bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20"
        >
          {isNewChatOpen ? 'Close' : 'New chat'}
        </button>
      </div>

      <div className="px-4 py-2 border-b border-slate-800">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search chats..."
          className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      <NewChatDialog
        isOpen={isNewChatOpen}
        email={newChatEmail}
        error={createChatError}
        isSubmitting={isCreatingChat}
        onEmailChange={onNewChatEmailChange}
        onSubmit={onCreateChatSubmit}
      />

      <div className="flex-1 overflow-y-auto chat-sidebar-scroll">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading chats...</div>
        ) : isError ? (
          <div className="p-4 text-sm text-red-400 space-y-2">
            <p>We could not load your chats.</p>
            <button
              type="button"
              onClick={onRefetchChats}
              className="cursor-pointer rounded bg-emerald-500/10 px-3 py-1 text-emerald-300 hover:bg-emerald-500/20"
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
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-slate-400">
            {searchQuery.trim() ? 'No chats match your search.' : 'You do not have any chats yet. Start a conversation to see it here.'}
          </div>
        )}
      </div>
    </aside>
  );
};

export default ChatSidebar;
