import {
  Download,
  ExternalLink,
  FileText,
  MoreHorizontal,
  Phone,
  Pin,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  Video,
  Wifi,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { messageApi } from '../../../api/messageApi';
import OnlineStatus from '../../../components/OnlineStatus';
import type { User } from '../../../types/auth';
import type { Chat, PinnedMessage, SharedAsset, UserOnlineStatus } from '../../../types/chat';
import { formatFileSize } from '../utils/attachmentDisplay';
import { getChatTitle } from '../utils/chatDisplay';
import AbstractIdentityTile from './AbstractIdentityTile';
import AttachmentPreview from './AttachmentPreview';

export interface ConversationDetailContentProps {
  selectedChat: Chat;
  currentUserId?: string;
  otherMember: User | null;
  otherMemberStatus: UserOnlineStatus | null;
  pinnedMessages: PinnedMessage[];
  sharedFiles: SharedAsset[];
  sharedMedia: SharedAsset[];
  isPinnedLoading: boolean;
  isSharedFilesLoading: boolean;
  isSharedMediaLoading: boolean;
  isPinnedError: boolean;
  isSharedFilesError: boolean;
  isSharedMediaError: boolean;
  isAuthenticated: boolean;
  isSocketConnected: boolean;
  isReconnecting: boolean;
  isOffline: boolean;
  onSearchMessages: () => void;
  onJumpToMessage: (messageId: string) => void;
  onUnpinMessage: (messageId: string) => void;
}

const ConversationDetailContent = ({
  selectedChat,
  currentUserId,
  otherMember,
  otherMemberStatus,
  pinnedMessages,
  sharedFiles,
  sharedMedia,
  isPinnedLoading,
  isSharedFilesLoading,
  isSharedMediaLoading,
  isPinnedError,
  isSharedFilesError,
  isSharedMediaError,
  isAuthenticated,
  isSocketConnected,
  isReconnecting,
  isOffline,
  onSearchMessages,
  onJumpToMessage,
  onUnpinMessage,
}: ConversationDetailContentProps) => {
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
    <>
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

      <RailSection title="Pinned messages" count={pinnedMessages.length}>
        <DetailState
          isLoading={isPinnedLoading}
          isError={isPinnedError}
          isEmpty={pinnedMessages.length === 0}
          loadingCopy="Loading pinned messages"
          errorCopy="Pinned messages unavailable"
          emptyCopy="No pinned messages"
        >
          {pinnedMessages.map((pinnedMessage) => (
            <PinnedMessageRow
              key={pinnedMessage.messageId}
              pinnedMessage={pinnedMessage}
              onJumpToMessage={onJumpToMessage}
              onUnpinMessage={onUnpinMessage}
            />
          ))}
        </DetailState>
      </RailSection>

      <RailSection title="Shared files" count={sharedFiles.length}>
        <DetailState
          isLoading={isSharedFilesLoading}
          isError={isSharedFilesError}
          isEmpty={sharedFiles.length === 0}
          loadingCopy="Loading shared files"
          errorCopy="Shared files unavailable"
          emptyCopy="No shared files"
        >
          {sharedFiles.map((asset) => (
            <SharedFileRow key={asset.attachmentId} asset={asset} onJumpToMessage={onJumpToMessage} />
          ))}
        </DetailState>
      </RailSection>

      <RailSection title="Shared media" count={sharedMedia.length}>
        <DetailState
          isLoading={isSharedMediaLoading}
          isError={isSharedMediaError}
          isEmpty={sharedMedia.length === 0}
          loadingCopy="Loading shared media"
          errorCopy="Shared media unavailable"
          emptyCopy="No shared media"
        >
          <div className="grid grid-cols-3 gap-2">
            {sharedMedia.map((asset) => (
              <div key={asset.attachmentId} className="min-w-0">
                <AttachmentPreview attachment={asset} compact />
                <button
                  type="button"
                  onClick={() => onJumpToMessage(asset.messageId)}
                  className="mt-1 w-full truncate rounded-[var(--chat-radius-md)] px-1 py-1 text-xs text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  aria-label={`Jump to ${asset.displayName}`}
                >
                  Jump
                </button>
              </div>
            ))}
          </div>
        </DetailState>
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
        <SecurityRow
          icon={<FileText aria-hidden="true" className="h-4 w-4" />}
          label="Protected file access"
          value={isAuthenticated ? 'Active' : 'Unavailable'}
          tone={isAuthenticated ? 'success' : 'neutral'}
        />
      </RailSection>
    </>
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

const DetailState = ({
  isLoading,
  isError,
  isEmpty,
  loadingCopy,
  errorCopy,
  emptyCopy,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  loadingCopy: string;
  errorCopy: string;
  emptyCopy: string;
  children: ReactNode;
}) => {
  if (isLoading) {
    return <DetailStateBox>{loadingCopy}</DetailStateBox>;
  }

  if (isError) {
    return <DetailStateBox tone="danger">{errorCopy}</DetailStateBox>;
  }

  if (isEmpty) {
    return <DetailStateBox>{emptyCopy}</DetailStateBox>;
  }

  return <div className="space-y-3">{children}</div>;
};

const DetailStateBox = ({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'danger' }) => (
  <p
    className={`rounded-[var(--chat-radius-md)] border border-dashed px-3 py-3 text-sm ${
      tone === 'danger'
        ? 'border-[color-mix(in_srgb,var(--chat-danger)_45%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-danger)_8%,var(--chat-panel))] text-[var(--chat-danger)]'
        : 'border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] text-[var(--chat-text-muted)]'
    }`}
  >
    {children}
  </p>
);

const PinnedMessageRow = ({
  pinnedMessage,
  onJumpToMessage,
  onUnpinMessage,
}: {
  pinnedMessage: PinnedMessage;
  onJumpToMessage: (messageId: string) => void;
  onUnpinMessage: (messageId: string) => void;
}) => {
  const label = pinnedMessage.text.trim() || `${pinnedMessage.attachments.length} attachment${pinnedMessage.attachments.length === 1 ? '' : 's'}`;

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-2 text-sm">
      <Pin aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--chat-accent)]" />
      <button
        type="button"
        onClick={() => onJumpToMessage(pinnedMessage.messageId)}
        className="min-w-0 flex-1 truncate text-left text-[var(--chat-text)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
      >
        {label}
      </button>
      <button
        type="button"
        onClick={() => onUnpinMessage(pinnedMessage.messageId)}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-danger)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
        aria-label={`Unpin ${label}`}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
};

const SharedFileRow = ({ asset, onJumpToMessage }: { asset: SharedAsset; onJumpToMessage: (messageId: string) => void }) => {
  const previewUrl = messageApi.getAttachmentPreviewUrl(asset.attachmentId);
  const downloadUrl = messageApi.getAttachmentDownloadUrl(asset.attachmentId);

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-2 text-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
        <FileText aria-hidden="true" className="h-5 w-5" />
      </span>
      <button
        type="button"
        onClick={() => onJumpToMessage(asset.messageId)}
        className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
      >
        <span className="block truncate font-semibold text-[var(--chat-text)]">{asset.displayName}</span>
        <span className="block truncate text-xs text-[var(--chat-text-muted)]">{asset.mimeType} - {formatFileSize(asset.size)}</span>
      </button>
      <a
        href={previewUrl}
        target="_blank"
        rel="noreferrer"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
        aria-label={`Open ${asset.displayName}`}
      >
        <ExternalLink aria-hidden="true" className="h-4 w-4" />
      </a>
      <a
        href={downloadUrl}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
        aria-label={`Download ${asset.displayName}`}
      >
        <Download aria-hidden="true" className="h-4 w-4" />
      </a>
    </div>
  );
};

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
    {children}
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

export default ConversationDetailContent;
