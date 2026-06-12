import OnlineStatus, { OnlineDot } from '../../../components/OnlineStatus';
import { ArrowLeft, MoreVertical, Phone, Search, Video } from 'lucide-react';
import type { RefObject } from 'react';
import type { User } from '../../../types/auth';
import type { Chat, UserOnlineStatus } from '../../../types/chat';
import AbstractIdentityTile from './AbstractIdentityTile';

interface ConversationHeaderProps {
  selectedChat: Chat;
  title: string;
  otherMember: User | null;
  otherMemberStatus: UserOnlineStatus | null;
  showMessageSearch: boolean;
  searchButtonRef: RefObject<HTMLButtonElement | null>;
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
  searchButtonRef,
  onOpenSidebar,
  onToggleMessageSearch,
}: ConversationHeaderProps) => {
  return (
    <div className="flex min-h-20 min-w-0 max-w-full items-center gap-3 overflow-hidden border-b border-[var(--chat-border)] bg-[var(--chat-panel)] px-4 py-3 text-[var(--chat-text)] md:px-8">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] md:hidden"
        aria-label="Open conversations"
      >
        <ArrowLeft aria-hidden="true" className="h-6 w-6" />
      </button>

      {otherMember && (
        <div className="relative shrink-0">
          <AbstractIdentityTile
            id={otherMember._id}
            label={`${otherMember.firstName} ${otherMember.lastName ?? ''}`.trim()}
            variant="conversation"
            className="h-12 w-12 md:h-14 md:w-14"
          />
          <OnlineDot isOnline={otherMemberStatus?.isOnline ?? false} size="sm" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-bold text-[var(--chat-text)] md:text-xl" title={title}>{title}</h2>
        {selectedChat.isGroupChat ? (
          <p className="text-xs font-medium text-[var(--chat-text-muted)]">
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
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-soft)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
        aria-label="Call"
        title="Call unavailable in this phase"
        disabled
      >
        <Phone aria-hidden="true" className="h-5 w-5" />
      </button>

      <button
        type="button"
        className="hidden h-11 w-11 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-soft)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] sm:grid"
        aria-label="Video call"
        title="Video call unavailable in this phase"
        disabled
      >
        <Video aria-hidden="true" className="h-5 w-5" />
      </button>

      <button
        ref={searchButtonRef}
        type="button"
        onClick={onToggleMessageSearch}
        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
        title="Search messages"
        aria-label="Search messages"
        aria-pressed={showMessageSearch}
      >
        <Search aria-hidden="true" className="h-5 w-5" />
      </button>

      <button
        type="button"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-soft)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
        aria-label="More conversation actions"
        title="More conversation actions unavailable in this phase"
        disabled
      >
        <MoreVertical aria-hidden="true" className="h-5 w-5" />
      </button>
    </div>
  );
};

export default ConversationHeader;
