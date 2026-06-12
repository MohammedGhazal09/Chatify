import {
  MoreHorizontal,
  Phone,
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
import { getChatTitle } from '../utils/chatDisplay';
import AbstractIdentityTile from './AbstractIdentityTile';

interface ChatContextRailProps {
  selectedChat: Chat;
  currentUserId?: string;
  otherMember: User | null;
  otherMemberStatus: UserOnlineStatus | null;
  messages: Message[];
  isAuthenticated: boolean;
  isSocketConnected: boolean;
  isReconnecting: boolean;
  isOffline: boolean;
  onSearchMessages: () => void;
}

const ChatContextRail = ({
  selectedChat,
  currentUserId,
  otherMember,
  otherMemberStatus,
  isAuthenticated,
  isSocketConnected,
  isReconnecting,
  isOffline,
  onSearchMessages,
}: ChatContextRailProps) => {
  const title = getChatTitle(selectedChat, currentUserId);
  const isMember = Boolean(currentUserId && selectedChat.members.some((member) => member._id === currentUserId));
  const socketStatus = isOffline
    ? { value: 'Offline', tone: 'warning' as const }
    : isReconnecting
      ? { value: 'Reconnecting', tone: 'warning' as const }
      : isSocketConnected
        ? { value: 'Connected', tone: 'success' as const }
        : { value: 'Unavailable', tone: 'neutral' as const };

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
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-soft)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              aria-label="Favorite conversation unavailable in this phase"
              disabled
            >
              <Star aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 border-b border-[var(--chat-border)] pb-5">
        <ContextAction label="Call" title="Call unavailable in this phase" icon={<Phone aria-hidden="true" className="h-5 w-5" />} />
        <ContextAction label="Video call" title="Video call unavailable in this phase" icon={<Video aria-hidden="true" className="h-5 w-5" />} />
        <ContextAction label="Search messages" icon={<Search aria-hidden="true" className="h-5 w-5" />} onClick={onSearchMessages} />
        <ContextAction label="More conversation actions" title="More conversation actions unavailable in this phase" icon={<MoreHorizontal aria-hidden="true" className="h-5 w-5" />} />
      </div>

      <RailSection title="Pinned messages" count={0}>
        <UnavailableRailState>Pinning is not available in this phase.</UnavailableRailState>
      </RailSection>

      <RailSection title="Shared files" count={0}>
        <UnavailableRailState>File sharing is planned for Phase 08.</UnavailableRailState>
      </RailSection>

      <RailSection title="Shared media" count={0}>
        <UnavailableRailState>Media sharing is planned for Phase 08.</UnavailableRailState>
      </RailSection>

      <RailSection title="Conversation security">
        <SecurityRow
          icon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}
          label="Authenticated session"
          value={isAuthenticated ? 'Active' : 'Unavailable'}
          tone={isAuthenticated ? 'success' : 'neutral'}
        />
        <SecurityRow
          icon={<Users aria-hidden="true" className="h-4 w-4" />}
          label="Member-only room"
          value={isMember ? 'Confirmed' : 'Unavailable'}
          tone={isMember ? 'success' : 'neutral'}
        />
        <SecurityRow
          icon={<Wifi aria-hidden="true" className="h-4 w-4" />}
          label="Realtime connection"
          value={socketStatus.value}
          tone={socketStatus.tone}
        />
      </RailSection>
    </aside>
  );
};

const ContextAction = ({
  label,
  title,
  icon,
  onClick,
}: {
  label: string;
  title?: string;
  icon: ReactNode;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={title}
    disabled={!onClick}
    className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] text-xs font-medium text-[var(--chat-text-muted)] transition enabled:cursor-pointer enabled:hover:border-[var(--chat-border-strong)] enabled:hover:bg-[var(--chat-panel-subtle)] enabled:hover:text-[var(--chat-accent)] disabled:cursor-not-allowed disabled:text-[var(--chat-text-soft)] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
  >
    {icon}
    <span>{label.replace(' conversation actions', '')}</span>
  </button>
);

const UnavailableRailState = ({ children }: { children: ReactNode }) => (
  <p className="rounded-[var(--chat-radius-md)] border border-dashed border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-3 text-sm text-[var(--chat-text-muted)]">
    {children}
  </p>
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
  tone = 'neutral',
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: 'success' | 'warning' | 'neutral';
}) => (
  <div className="flex min-h-9 items-center gap-3 text-sm">
    <span className="text-[var(--chat-text-muted)]">{icon}</span>
    <span className="min-w-0 flex-1 text-[var(--chat-text)]">{label}</span>
    <span
      className={`inline-flex items-center gap-2 ${
        tone === 'success'
          ? 'text-[var(--chat-success)]'
          : tone === 'warning'
            ? 'text-[var(--chat-warning)]'
            : 'text-[var(--chat-text-muted)]'
      }`}
    >
      {value}
      <span
        className={`h-2 w-2 rounded-full ${
          tone === 'success'
            ? 'bg-[var(--chat-success)]'
            : tone === 'warning'
              ? 'bg-[var(--chat-warning)]'
              : 'bg-[var(--chat-text-soft)]'
        }`}
        aria-hidden="true"
      />
    </span>
  </div>
);

export default ChatContextRail;
