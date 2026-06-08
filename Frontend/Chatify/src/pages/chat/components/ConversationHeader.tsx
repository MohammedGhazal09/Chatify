import OnlineStatus, { OnlineDot } from '../../../components/OnlineStatus';
import type { User } from '../../../types/auth';
import type { Chat, UserOnlineStatus } from '../../../types/chat';

interface ConversationHeaderProps {
  selectedChat: Chat;
  title: string;
  otherMember: User | null;
  otherMemberStatus: UserOnlineStatus | null;
  showMessageSearch: boolean;
  onOpenSidebar: () => void;
  onToggleMessageSearch: () => void;
  onExportChat: () => void;
}

const ConversationHeader = ({
  selectedChat,
  title,
  otherMember,
  otherMemberStatus,
  showMessageSearch,
  onOpenSidebar,
  onToggleMessageSearch,
  onExportChat,
}: ConversationHeaderProps) => {
  return (
    <div className="border-b border-slate-900 bg-slate-900/60 p-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="cursor-pointer md:hidden text-slate-400 hover:text-emerald-400"
        aria-label="Open chat list"
      >
        <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {otherMember && (
        <div className="relative">
          {otherMember.profilePic ? (
            <img
              src={otherMember.profilePic}
              alt={otherMember.firstName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold">
              {otherMember.firstName?.charAt(0)}
            </div>
          )}
          <OnlineDot isOnline={otherMemberStatus?.isOnline ?? false} size="sm" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold">{title}</h2>
        {selectedChat.isGroupChat ? (
          <p className="text-xs text-slate-400">
            {selectedChat.members.length} member{selectedChat.members.length === 1 ? '' : 's'}
          </p>
        ) : otherMember ? (
          <OnlineStatus
            isOnline={otherMemberStatus?.isOnline ?? false}
            lastSeen={otherMemberStatus?.lastSeen}
            showText
            showDot={false}
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggleMessageSearch}
        className="cursor-pointer text-slate-400 hover:text-emerald-400 p-2"
        title="Search messages"
        aria-label={showMessageSearch ? 'Close message search' : 'Search messages'}
      >
        <span aria-hidden="true">Search</span>
      </button>

      <button
        type="button"
        onClick={onExportChat}
        className="cursor-pointer text-slate-400 hover:text-emerald-400 p-2"
        title="Export chat"
        aria-label="Export chat"
      >
        <span aria-hidden="true">Export</span>
      </button>
    </div>
  );
};

export default ConversationHeader;
