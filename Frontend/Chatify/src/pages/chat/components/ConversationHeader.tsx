import OnlineStatus, { OnlineDot } from '../../../components/OnlineStatus';
import { Download, Menu, Search } from 'lucide-react';
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
    <div className="flex min-h-16 min-w-0 max-w-full items-center gap-3 overflow-hidden border-b border-[#2E363C] bg-[#181C20] px-4 py-3">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg text-[#A8B3AF] hover:bg-[#20262B] hover:text-[#14B8A6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] md:hidden"
        aria-label="Open conversations"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      {otherMember && (
        <div className="relative shrink-0">
          {otherMember.profilePic ? (
            <img
              src={otherMember.profilePic}
              alt={otherMember.firstName}
              className="h-10 w-10 rounded-full object-cover md:h-11 md:w-11"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#20262B] text-sm font-semibold text-[#F4F7F6] md:h-11 md:w-11">
              {otherMember.firstName?.charAt(0)}
            </div>
          )}
          <OnlineDot isOnline={otherMemberStatus?.isOnline ?? false} size="sm" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-bold text-[#F4F7F6]" title={title}>{title}</h2>
        {selectedChat.isGroupChat ? (
          <p className="text-xs font-medium text-[#A8B3AF]">
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
        className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg text-[#A8B3AF] hover:bg-[#20262B] hover:text-[#14B8A6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
        title="Search messages"
        aria-label={showMessageSearch ? 'Close message search' : 'Search messages'}
      >
        <Search aria-hidden="true" className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onExportChat}
        className="hidden h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg text-[#A8B3AF] hover:bg-[#20262B] hover:text-[#14B8A6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] sm:grid"
        title="Export chat"
        aria-label="Export chat"
      >
        <Download aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  );
};

export default ConversationHeader;
