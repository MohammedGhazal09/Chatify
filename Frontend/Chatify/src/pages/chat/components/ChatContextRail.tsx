import {
  FileText,
  MoreHorizontal,
  Phone,
  Pin,
  Search,
  ShieldCheck,
  Star,
  Users,
  Video,
  Wifi,
} from 'lucide-react';
import type { ReactNode } from 'react';
import OnlineStatus from '../../../components/OnlineStatus';
import type { User } from '../../../types/auth';
import type { Chat, Message, UserOnlineStatus } from '../../../types/chat';
import { formatTimestamp, getChatTitle } from '../utils/chatDisplay';
import AbstractIdentityTile from './AbstractIdentityTile';

interface ChatContextRailProps {
  selectedChat: Chat;
  currentUserId?: string;
  otherMember: User | null;
  otherMemberStatus: UserOnlineStatus | null;
  messages: Message[];
  onSearchMessages: () => void;
}

const sharedFiles = [
  { name: 'message-states-spec.pdf', meta: 'PDF - 280 KB', date: 'May 12' },
  { name: 'delivery-metrics.xlsx', meta: 'XLSX - 48 KB', date: 'May 9' },
  { name: 'retry-logic-notes.txt', meta: 'TXT - 3 KB', date: 'May 7' },
];

const mediaTiles = ['media-a', 'media-b', 'media-c', 'media-d'];

const ChatContextRail = ({
  selectedChat,
  currentUserId,
  otherMember,
  otherMemberStatus,
  messages,
  onSearchMessages,
}: ChatContextRailProps) => {
  const title = getChatTitle(selectedChat, currentUserId);
  const pinnedMessages = messages.slice(-2).reverse();

  return (
    <aside
      data-testid="chat-context-rail"
      className="hidden min-h-0 flex-col overflow-y-auto border-l border-[var(--chat-border)] bg-[var(--chat-panel)] px-6 py-5 text-[var(--chat-text)] xl:flex"
      aria-label="Conversation details"
    >
      <div className="mb-5 flex items-start gap-4">
        <AbstractIdentityTile
          id={otherMember?._id ?? selectedChat._id}
          label={title}
          variant="large"
          className="h-20 w-20"
        />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-[var(--chat-text)]">{title}</h2>
              {selectedChat.isGroupChat ? (
                <p className="text-sm text-[var(--chat-text-muted)]">
                  {selectedChat.members.length} member{selectedChat.members.length === 1 ? '' : 's'}
                </p>
              ) : otherMember ? (
                <OnlineStatus
                  isOnline={otherMemberStatus?.isOnline ?? false}
                  lastSeen={otherMemberStatus?.lastSeen}
                  showText
                  showDot
                />
              ) : null}
            </div>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              aria-label="Favorite conversation unavailable in this phase"
              aria-disabled="true"
            >
              <Star aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 border-b border-[var(--chat-border)] pb-5">
        <ContextAction label="Call unavailable in this phase" icon={<Phone aria-hidden="true" className="h-5 w-5" />} />
        <ContextAction label="Video call unavailable in this phase" icon={<Video aria-hidden="true" className="h-5 w-5" />} />
        <ContextAction label="Search messages" icon={<Search aria-hidden="true" className="h-5 w-5" />} onClick={onSearchMessages} />
        <ContextAction label="More conversation actions unavailable in this phase" icon={<MoreHorizontal aria-hidden="true" className="h-5 w-5" />} />
      </div>

      <RailSection title="Pinned messages" count={pinnedMessages.length || 2}>
        {(pinnedMessages.length ? pinnedMessages : messages.slice(0, 2)).map((message, index) => (
          <div key={message?._id ?? index} className="flex min-h-10 items-center gap-3 text-sm">
            <Pin aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--chat-accent)]" />
            <p className="min-w-0 flex-1 truncate text-[var(--chat-text)]">
              {message?.text ?? 'Message state reference note'}
            </p>
            {message && (
              <time className="shrink-0 text-xs text-[var(--chat-text-soft)]" dateTime={message.createdAt}>
                {formatTimestamp(message.createdAt)}
              </time>
            )}
          </div>
        ))}
      </RailSection>

      <RailSection title="Shared files" count={sharedFiles.length}>
        {sharedFiles.map((file) => (
          <div key={file.name} className="flex min-h-12 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-sm)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
              <FileText aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--chat-text)]">{file.name}</p>
              <p className="text-xs text-[var(--chat-text-muted)]">{file.meta}</p>
            </div>
            <span className="text-xs text-[var(--chat-text-soft)]">{file.date}</span>
          </div>
        ))}
      </RailSection>

      <RailSection title="Shared media" count={mediaTiles.length}>
        <div className="grid grid-cols-4 gap-2">
          {mediaTiles.map((tile) => (
            <AbstractIdentityTile
              key={tile}
              id={tile}
              label="Shared media"
              variant="media"
              className="aspect-square w-full"
              aria-label="Abstract shared media"
            />
          ))}
        </div>
      </RailSection>

      <RailSection title="Conversation security">
        <SecurityRow icon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />} label="Authenticated session" value="Verified" />
        <SecurityRow icon={<Users aria-hidden="true" className="h-4 w-4" />} label="Member-only room" value="Active" />
        <SecurityRow icon={<Wifi aria-hidden="true" className="h-4 w-4" />} label="Socket connected" value="Secure" />
      </RailSection>
    </aside>
  );
};

const ContextAction = ({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-disabled={onClick ? undefined : 'true'}
    className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] text-xs font-medium text-[var(--chat-text-muted)] transition hover:border-[var(--chat-border-strong)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
  >
    {icon}
    <span>{label.replace(' unavailable in this phase', '').replace(' conversation actions', '')}</span>
  </button>
);

const RailSection = ({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) => (
  <section className="border-b border-[var(--chat-border)] py-5 last:border-b-0">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-bold text-[var(--chat-text)]">{title}</h3>
      {typeof count === 'number' && (
        <span className="text-sm text-[var(--chat-text-muted)]">{count}</span>
      )}
    </div>
    <div className="space-y-3">{children}</div>
  </section>
);

const SecurityRow = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex min-h-9 items-center gap-3 text-sm">
    <span className="text-[var(--chat-text-muted)]">{icon}</span>
    <span className="min-w-0 flex-1 text-[var(--chat-text)]">{label}</span>
    <span className="inline-flex items-center gap-2 text-[var(--chat-success)]">
      {value}
      <span className="h-2 w-2 rounded-full bg-[var(--chat-success)]" aria-hidden="true" />
    </span>
  </div>
);

export default ChatContextRail;
