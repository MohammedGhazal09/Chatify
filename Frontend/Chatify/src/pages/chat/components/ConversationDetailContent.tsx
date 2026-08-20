import {
  Clipboard,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  KeyRound,
  Lock,
  Mic,
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
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useEffect, useId, useState } from 'react';
import { messageApi } from '../../../api/messageApi';
import OnlineStatus from '../../../components/OnlineStatus';
import type { User } from '../../../types/auth';
import type { Chat, ConversationControls, PinnedMessage, SharedAsset, UserOnlineStatus } from '../../../types/chat';
import {
  exportConversationRecoveryKey,
  hasConversationSecret,
  importConversationRecoveryKey,
  isEncryptedConversation,
} from '../../../utils/encryptedMessages';
import type { RecoveryImportFailureReason } from '../../../utils/encryptedMessages';
import { formatFileSize } from '../utils/attachmentDisplay';
import { getChatTitle } from '../utils/chatDisplay';
import AttachmentPreview from './AttachmentPreview';
import type { AttachmentPreviewTarget } from './AttachmentPreviewModal';
import UserAvatar from './UserAvatar';

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
  isFavorite?: boolean;
  callDisabledReason?: string | null;
  videoCallDisabledReason?: string | null;
  onToggleFavorite?: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  onSearchMessages: () => void;
  onOpenMoreMenu: () => void;
  onOpenAttachmentPreview: (attachment: AttachmentPreviewTarget) => void;
  onOpenVoiceMessages: () => void;
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
  isFavorite = false,
  callDisabledReason,
  videoCallDisabledReason,
  onToggleFavorite,
  onStartAudioCall,
  onStartVideoCall,
  onSearchMessages,
  onOpenMoreMenu,
  onOpenAttachmentPreview,
  onOpenVoiceMessages,
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
      <div className="chat-detail-profile-card rounded-[var(--chat-radius-lg)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] p-3">
        <div className="flex items-start gap-4">
          <UserAvatar
            user={otherMember}
            label={title}
            variant="large"
            className="h-16 w-16"
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
        <div className="mt-4 grid grid-cols-4 gap-2">
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
      </div>
      {encryptedConversation && (
        <>
          <div className="mt-3 flex items-start gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-2 text-sm text-[var(--chat-text-muted)]" role="status">
            <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--chat-accent)]" />
            <p>This device needs the conversation secret to read encrypted messages. Attachments stay unavailable until encrypted upload is supported.</p>
          </div>
          <EncryptedRecoveryPanel chatId={selectedChat._id} />
        </>
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
          <VoiceMessagesSummary
            count={sharedVoice.length}
            onOpenVoiceMessages={onOpenVoiceMessages}
          />
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

const recoveryImportFailureCopy: Record<RecoveryImportFailureReason, string> = {
  empty: 'Paste a recovery key before importing.',
  format: 'Recovery key format is invalid.',
  version: 'Recovery key version is not supported by this browser.',
  'chat-mismatch': 'This recovery key belongs to a different conversation.',
  'secret-invalid': 'Recovery key secret is invalid.',
  'storage-unavailable': 'This browser cannot store recovery keys on this device.',
};

const EncryptedRecoveryPanel = ({ chatId }: { chatId: string }) => {
  const titleId = useId();
  const [hasLocalSecret, setHasLocalSecret] = useState(() => hasConversationSecret(chatId));
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setHasLocalSecret(hasConversationSecret(chatId));
    setRecoveryKeyInput('');
    setStatusMessage(null);
    setErrorMessage(null);
  }, [chatId]);

  const handleCopyRecoveryKey = async () => {
    const result = exportConversationRecoveryKey(chatId);

    setStatusMessage(null);
    setErrorMessage(null);

    if (!result.ok) {
      setHasLocalSecret(false);
      setErrorMessage(result.reason === 'missing-secret'
        ? 'This device does not have a recovery key for this conversation.'
        : 'The stored recovery key is invalid on this device.');
      return;
    }

    try {
      await navigator.clipboard.writeText(result.recoveryKey);
      setStatusMessage('Recovery key copied. Store it somewhere private.');
    } catch {
      setErrorMessage('Recovery key could not be copied from this browser.');
    }
  };

  const handleImportRecoveryKey = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = importConversationRecoveryKey(chatId, recoveryKeyInput);

    setStatusMessage(null);
    setErrorMessage(null);

    if (!result.ok) {
      setErrorMessage(recoveryImportFailureCopy[result.reason]);
      return;
    }

    setRecoveryKeyInput('');
    setHasLocalSecret(true);
    setStatusMessage('Recovery key imported on this device.');
  };

  const handleRecoveryKeyInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setRecoveryKeyInput(event.target.value);
    setErrorMessage(null);
    setStatusMessage(null);
  };

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="mt-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] p-3 text-sm"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
          <KeyRound aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="text-sm font-bold text-[var(--chat-text)]">Encrypted recovery</h3>
          <p className="mt-1 text-sm leading-5 text-[var(--chat-text-muted)]">
            {hasLocalSecret
              ? 'Recovery key ready on this device. Anyone with the key can read this encrypted conversation.'
              : 'This device needs the recovery key to read encrypted messages in this conversation.'}
          </p>
        </div>
      </div>

      {hasLocalSecret ? (
        <button
          type="button"
          onClick={() => {
            void handleCopyRecoveryKey();
          }}
          className="mt-3 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] px-3 py-2 font-semibold text-[var(--chat-text)] hover:border-[var(--chat-border-strong)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
        >
          <Clipboard aria-hidden="true" className="h-4 w-4" />
          Copy recovery key
        </button>
      ) : (
        <form className="mt-3 space-y-2" onSubmit={handleImportRecoveryKey}>
          <label className="block text-xs font-semibold uppercase text-[var(--chat-text-soft)]" htmlFor={`${titleId}-input`}>
            Recovery key
          </label>
          <textarea
            id={`${titleId}-input`}
            value={recoveryKeyInput}
            onChange={handleRecoveryKeyInputChange}
            rows={3}
            spellCheck={false}
            className="block w-full resize-none rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm text-[var(--chat-text)] outline-none placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:ring-2 focus:ring-[var(--chat-focus)]/25"
            placeholder="Paste recovery key"
          />
          <button
            type="submit"
            className="inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-2 font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            Import recovery key
          </button>
        </form>
      )}

      {statusMessage && (
        <p className="mt-2 text-sm text-[var(--chat-success)]" role="status">
          {statusMessage}
        </p>
      )}
      {errorMessage && (
        <p className="mt-2 text-sm text-[var(--chat-danger)]" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
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

const VoiceMessagesSummary = ({
  count,
  onOpenVoiceMessages,
}: {
  count: number;
  onOpenVoiceMessages: () => void;
}) => (
  <button
    type="button"
    onClick={onOpenVoiceMessages}
    className="flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-3 py-2 text-left text-sm text-[var(--chat-text)] hover:border-[var(--chat-border-strong)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
    aria-label="Show voice messages"
  >
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
      <Mic aria-hidden="true" className="h-5 w-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-semibold">Show voice messages</span>
      <span className="block truncate text-xs text-[var(--chat-text-muted)]">
        {count} voice message{count === 1 ? '' : 's'}
      </span>
    </span>
  </button>
);

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
}) => {
  const contentId = useId();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section className="chat-detail-section mt-3 rounded-[var(--chat-radius-lg)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] p-3">
      <h3>
        <button
          type="button"
          className="flex min-h-8 w-full items-center gap-2 rounded-[var(--chat-radius-sm)] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          aria-label={title}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          onClick={() => setIsExpanded((current) => !current)}
        >
          <span className="min-w-0 flex-1 text-sm font-bold text-[var(--chat-text)]">{title}</span>
          {typeof count === 'number' && (
            <span className="text-sm text-[var(--chat-text-muted)]" aria-hidden="true">{count}</span>
          )}
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-[var(--chat-text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      <div id={contentId} className="pt-3" hidden={!isExpanded}>
        {children}
      </div>
    </section>
  );
};

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
      className={`inline-flex rounded-[var(--chat-radius-sm)] border px-2 py-1 font-semibold ${
        tone === 'success'
          ? 'border-[color-mix(in_srgb,var(--chat-success)_34%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-success)_13%,var(--chat-panel))] text-[var(--chat-success)]'
          : tone === 'warning'
            ? 'border-[color-mix(in_srgb,var(--chat-warning)_34%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-warning)_12%,var(--chat-panel))] text-[var(--chat-warning)]'
            : 'border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] text-[var(--chat-text-muted)]'
      }`}
    >
      {value}
    </span>
  </div>
);

export default ConversationDetailContent;
