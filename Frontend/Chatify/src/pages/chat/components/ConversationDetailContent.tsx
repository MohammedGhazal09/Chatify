import {
  Ban,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Lock,
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
import { useId } from 'react';
import { messageApi } from '../../../api/messageApi';
import OnlineStatus from '../../../components/OnlineStatus';
import type { User } from '../../../types/auth';
import type { Chat, ConversationControls, PinnedMessage, SharedAsset, UserOnlineStatus } from '../../../types/chat';
import { isEncryptedConversation } from '../../../utils/encryptedMessages';
import { formatFileSize } from '../utils/attachmentDisplay';
import { getChatTitle } from '../utils/chatDisplay';
import AttachmentPreview from './AttachmentPreview';
import type { AttachmentPreviewTarget } from './AttachmentPreviewModal';
import UserAvatar from './UserAvatar';
import VoiceMessagePlayer from './VoiceMessagePlayer';

export interface ConversationDetailContentProps {
  selectedChat: Chat;
  currentUserId?: string;
  otherMember: User | null;
  otherMemberStatus: UserOnlineStatus | null;
  isPresenceChecking?: boolean;
  pinnedMessages: PinnedMessage[];
  sharedFiles: SharedAsset[];
  sharedMedia: SharedAsset[];
  sharedVoice: SharedAsset[];
  isPinnedLoading: boolean;
  isSharedFilesLoading: boolean;
  isSharedMediaLoading: boolean;
  isSharedVoiceLoading: boolean;
  isPinnedError: boolean;
  isSharedFilesError: boolean;
  isSharedMediaError: boolean;
  isSharedVoiceError: boolean;
  isAuthenticated: boolean;
  isSocketConnected: boolean;
  isReconnecting: boolean;
  isOffline: boolean;
  conversationControls?: ConversationControls;
  isConversationControlPending: boolean;
  isFavorite?: boolean;
  callDisabledReason?: string | null;
  videoCallDisabledReason?: string | null;
  onToggleFavorite?: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  onSearchMessages: () => void;
  onOpenMoreMenu: () => void;
  onOpenAttachmentPreview: (attachment: AttachmentPreviewTarget) => void;
  onUnblockUser: () => void;
  onJumpToMessage: (messageId: string) => void;
  onUnpinMessage: (messageId: string) => void;
}

const ConversationDetailContent = ({
  selectedChat,
  currentUserId,
  otherMember,
  otherMemberStatus,
  isPresenceChecking = false,
  pinnedMessages,
  sharedFiles,
  sharedMedia,
  sharedVoice,
  isPinnedLoading,
  isSharedFilesLoading,
  isSharedMediaLoading,
  isSharedVoiceLoading,
  isPinnedError,
  isSharedFilesError,
  isSharedMediaError,
  isSharedVoiceError,
  isAuthenticated,
  isSocketConnected,
  isReconnecting,
  isOffline,
  conversationControls,
  isConversationControlPending,
  isFavorite = false,
  callDisabledReason,
  videoCallDisabledReason,
  onToggleFavorite,
  onStartAudioCall,
  onStartVideoCall,
  onSearchMessages,
  onOpenMoreMenu,
  onOpenAttachmentPreview,
  onUnblockUser,
  onJumpToMessage,
  onUnpinMessage,
}: ConversationDetailContentProps) => {
  const title = getChatTitle(selectedChat, currentUserId);
  const encryptedConversation = isEncryptedConversation(selectedChat);
  const isMember = Boolean(currentUserId && selectedChat.members.some((member) => member._id === currentUserId));
  const profileBio = getVisibleProfileBio(otherMember);
  const profileStatus = getVisibleProfileStatus(otherMember, otherMemberStatus);
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
        <UserAvatar
          user={otherMember}
          label={title}
          variant="large"
          className="h-20 w-20"
        />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-[var(--chat-text)]">{title}</h2>
              {encryptedConversation ? (
                <p className="inline-flex items-center gap-1 text-sm text-[var(--chat-text-muted)]">
                  <Lock aria-hidden="true" className="h-4 w-4 text-[var(--chat-accent)]" />
                  <span>
                    Encrypted conversation{selectedChat.isGroupChat ? ` - ${selectedChat.members.length} members` : ''}
                  </span>
                </p>
              ) : selectedChat.isGroupChat ? (
                <p className="text-sm text-[var(--chat-text-muted)]">
                  {selectedChat.members.length} member{selectedChat.members.length === 1 ? '' : 's'}
                </p>
              ) : otherMember && isPresenceChecking ? (
                <p className="text-sm text-[var(--chat-text-muted)]">
                  Checking availability
                </p>
              ) : otherMember ? (
                <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--chat-text-muted)]">
                  <OnlineStatus
                    isOnline={otherMemberStatus?.isOnline ?? false}
                    lastSeen={otherMemberStatus?.lastSeen}
                    showText
                    showDot
                  />
                  {profileStatus && (
                    <>
                      <span className="text-[var(--chat-text-soft)]" aria-hidden="true">/</span>
                      <span className="truncate" title={profileStatus}>{profileStatus}</span>
                    </>
                  )}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onToggleFavorite}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
                isFavorite
                  ? 'text-[var(--chat-warning)] hover:bg-[color-mix(in_srgb,var(--chat-warning)_14%,var(--chat-panel-subtle))]'
                  : 'text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)]'
              }`}
              aria-label={isFavorite ? 'Unstar conversation' : 'Star conversation'}
              aria-pressed={isFavorite}
              title={isFavorite ? 'Unstar conversation' : 'Star conversation'}
            >
              <Star aria-hidden="true" className="h-5 w-5" fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 border-b border-[var(--chat-border)] pb-5">
        <ContextAction
          label="Call"
          title={callDisabledReason ?? 'Start audio call'}
          icon={<Phone aria-hidden="true" className="h-5 w-5" />}
          disabledReason={callDisabledReason}
          onClick={onStartAudioCall}
        />
        <ContextAction
          label="Video call"
          title={videoCallDisabledReason ?? 'Start video call'}
          icon={<Video aria-hidden="true" className="h-5 w-5" />}
          disabledReason={videoCallDisabledReason}
          onClick={onStartVideoCall}
        />
        <ContextAction
          label="Search messages"
          icon={<Search aria-hidden="true" className="h-5 w-5" />}
          disabledReason={encryptedConversation ? 'Server-side search is unavailable for encrypted conversations.' : null}
          onClick={onSearchMessages}
        />
        <ContextAction label="More conversation actions" icon={<MoreHorizontal aria-hidden="true" className="h-5 w-5" />} onClick={onOpenMoreMenu} />
      </div>
      {encryptedConversation && (
        <div className="mt-3 flex items-start gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-2 text-sm text-[var(--chat-text-muted)]" role="status">
          <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--chat-accent)]" />
          <p>This device needs the conversation secret to read encrypted messages. Attachments stay unavailable until encrypted upload is supported.</p>
        </div>
      )}
      <CallAvailabilityNotice
        callDisabledReason={callDisabledReason}
        videoCallDisabledReason={videoCallDisabledReason}
      />

      {otherMember && (
        <RailSection title="Profile">
          <ProfileSummary
            bio={profileBio}
            status={profileStatus}
          />
        </RailSection>
      )}

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
            <SharedFileRow
              key={asset.attachmentId}
              asset={asset}
              onJumpToMessage={onJumpToMessage}
              onOpenAttachmentPreview={onOpenAttachmentPreview}
            />
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
                <AttachmentPreview
                  attachment={asset}
                  compact
                  onOpenPreview={onOpenAttachmentPreview}
                />
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

      <RailSection title="Voice messages" count={sharedVoice.length}>
        <DetailState
          isLoading={isSharedVoiceLoading}
          isError={isSharedVoiceError}
          isEmpty={sharedVoice.length === 0}
          loadingCopy="Loading voice messages"
          errorCopy="Voice messages unavailable"
          emptyCopy="No voice messages"
        >
          {sharedVoice.map((asset) => (
            <div key={asset.attachmentId} className="min-w-0">
              <VoiceMessagePlayer attachment={asset} compact />
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
        </DetailState>
      </RailSection>

      <RailSection
        title="Blocked people"
        count={conversationControls?.blockedByMe || conversationControls?.blockedMe ? 1 : 0}
      >
        <BlockedPeopleSection
          conversationControls={conversationControls}
          displayName={otherMember ? getMemberDisplayName(otherMember) : title}
          isActionPending={isConversationControlPending}
          onUnblockUser={onUnblockUser}
        />
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
        <SecurityRow
          icon={<ShieldCheck aria-hidden="true" className="h-4 w-4" />}
          label="Conversation controls"
          value={conversationControls?.canSendMessage === false ? 'Limited' : 'Active'}
          tone={conversationControls?.canSendMessage === false ? 'warning' : 'success'}
        />
      </RailSection>
    </>
  );
};

const getMemberDisplayName = (member: User) => (
  `${member.firstName} ${member.lastName ?? ''}`.trim() || member.username || 'Unknown user'
);

const getVisibleProfileBio = (member: User | null) => (
  typeof member?.profileBio === 'string' ? member.profileBio.trim() : ''
);

const getVisibleProfileStatus = (
  member: User | null,
  status: UserOnlineStatus | null
) => {
  const source = status ? status.profileStatus : member?.profileStatus;

  return typeof source === 'string' ? source.trim() : '';
};

const ProfileSummary = ({
  bio,
  status,
}: {
  bio: string;
  status: string;
}) => {
  if (!bio && !status) {
    return <DetailStateBox>No profile details shared.</DetailStateBox>;
  }

  return (
    <div className="space-y-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] p-3">
      {status && (
        <ProfileSummaryRow label="Status" value={status} />
      )}
      {bio && (
        <ProfileSummaryRow label="Bio" value={bio} />
      )}
    </div>
  );
};

const ProfileSummaryRow = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="text-xs font-semibold uppercase text-[var(--chat-text-soft)]">{label}</p>
    <p className="mt-1 break-words text-sm leading-5 text-[var(--chat-text)]">{value}</p>
  </div>
);

const BlockedPeopleSection = ({
  conversationControls,
  displayName,
  isActionPending,
  onUnblockUser,
}: {
  conversationControls?: ConversationControls;
  displayName: string;
  isActionPending: boolean;
  onUnblockUser: () => void;
}) => {
  if (!conversationControls?.isDirectChat) {
    return <DetailStateBox>Blocking controls are available for direct conversations.</DetailStateBox>;
  }

  if (!conversationControls.blockedByMe && !conversationControls.blockedMe) {
    return <DetailStateBox>No blocked people in this conversation.</DetailStateBox>;
  }

  const statusCopy = conversationControls.blockedByMe
    ? 'Blocked by you'
    : 'Activity blocked by this person';
  const detailCopy = conversationControls.blockedByMe
    ? 'New activity is paused until you unblock them.'
    : 'You cannot send new activity until this person unblocks the conversation.';

  return (
    <div className="rounded-[var(--chat-radius-md)] border border-[color-mix(in_srgb,var(--chat-warning)_38%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-warning)_10%,var(--chat-panel))] p-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[color-mix(in_srgb,var(--chat-warning)_18%,var(--chat-panel))] text-[var(--chat-warning)]">
          <Ban aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--chat-text)]">{displayName}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--chat-warning)]">{statusCopy}</p>
          <p className="mt-1 text-sm leading-5 text-[var(--chat-text-muted)]">{detailCopy}</p>
        </div>
      </div>
      {conversationControls.blockedByMe && (
        <button
          type="button"
          onClick={onUnblockUser}
          disabled={isActionPending}
          className="mt-3 inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-2 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:bg-[var(--chat-panel-subtle)] disabled:text-[var(--chat-text-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
        >
          {isActionPending && <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />}
          {isActionPending ? 'Unblocking...' : 'Unblock user'}
        </button>
      )}
    </div>
  );
};

const ContextAction = ({
  label,
  title,
  icon,
  disabledReason,
  onClick,
}: {
  label: string;
  title?: string;
  icon: ReactNode;
  disabledReason?: string | null;
  onClick?: () => void;
}) => {
  const reasonId = useId();
  const isDisabled = Boolean(disabledReason) || !onClick;

  return (
    <button
      type="button"
      onClick={disabledReason ? undefined : onClick}
      aria-label={label}
      aria-describedby={disabledReason ? reasonId : undefined}
      title={disabledReason ?? title}
      disabled={isDisabled}
      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] text-xs font-medium text-[var(--chat-text-muted)] transition enabled:cursor-pointer enabled:hover:border-[var(--chat-border-strong)] enabled:hover:bg-[var(--chat-panel-subtle)] enabled:hover:text-[var(--chat-accent)] disabled:cursor-not-allowed disabled:text-[var(--chat-text-soft)] disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
    >
      {icon}
      <span>{label.replace(' conversation actions', '')}</span>
      {disabledReason && <span id={reasonId} className="sr-only">{disabledReason}</span>}
    </button>
  );
};

const CallAvailabilityNotice = ({
  callDisabledReason,
  videoCallDisabledReason,
}: {
  callDisabledReason?: string | null;
  videoCallDisabledReason?: string | null;
}) => {
  if (!callDisabledReason && !videoCallDisabledReason) {
    return null;
  }

  const copy = callDisabledReason && videoCallDisabledReason && callDisabledReason === videoCallDisabledReason
    ? `Calls unavailable: ${callDisabledReason}`
    : [
        callDisabledReason ? `Call unavailable: ${callDisabledReason}` : null,
        videoCallDisabledReason ? `Video unavailable: ${videoCallDisabledReason}` : null,
      ].filter(Boolean).join(' ');

  return (
    <div className="mt-3 flex items-start gap-2 rounded-[var(--chat-radius-md)] border border-[color-mix(in_srgb,var(--chat-warning)_35%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-warning)_10%,var(--chat-panel))] px-3 py-2 text-sm text-[var(--chat-text-muted)]">
      <Wifi aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--chat-warning)]" />
      <p>{copy}</p>
    </div>
  );
};

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

const SharedFileRow = ({
  asset,
  onJumpToMessage,
  onOpenAttachmentPreview,
}: {
  asset: SharedAsset;
  onJumpToMessage: (messageId: string) => void;
  onOpenAttachmentPreview: (attachment: AttachmentPreviewTarget) => void;
}) => {
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
      <button
        type="button"
        onClick={() => onOpenAttachmentPreview(asset)}
        className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
        aria-label={`Open ${asset.displayName}`}
      >
        <ExternalLink aria-hidden="true" className="h-4 w-4" />
      </button>
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
