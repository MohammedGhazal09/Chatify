import { memo, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { MoreHorizontal, Phone, PhoneMissed, PhoneOff, RefreshCw, Video } from 'lucide-react';
import MessageStatus from '../../../components/MessageStatus';
import type { CallActivity, Chat, Message } from '../../../types/chat';
import { formatTimestamp } from '../utils/chatDisplay';
import AttachmentPreview from './AttachmentPreview';
import type { AttachmentPreviewTarget } from './AttachmentPreviewModal';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  isGroupChat: boolean;
  members: Chat['members'];
  isHighlighted?: boolean;
  onContextMenu?: (event: MouseEvent, message: Message) => void;
  onDoubleClick?: (message: Message) => void;
  onOpenActions?: (event: MouseEvent<HTMLButtonElement>, message: Message, isOwnMessage: boolean) => void;
  onOpenAttachmentPreview?: (attachment: AttachmentPreviewTarget) => void;
  onRetryFailed?: (message: Message) => void;
  onDismissFailed?: (message: Message) => void;
}

const formatCallDuration = (durationSeconds?: number | null) => {
  if (!Number.isFinite(Number(durationSeconds)) || Number(durationSeconds) <= 0) {
    return null;
  }

  const totalSeconds = Math.floor(Number(durationSeconds));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
};

const getCallActivityTitle = (activity: CallActivity) => {
  const modeLabel = activity.mode === 'video' ? 'Video' : 'Audio';
  const duration = formatCallDuration(activity.durationSeconds);

  switch (activity.result) {
    case 'missed':
      return `Missed ${modeLabel.toLowerCase()} call`;
    case 'rejected':
      return `${modeLabel} call declined`;
    case 'failed':
      return `${modeLabel} call failed`;
    case 'canceled':
      return `${modeLabel} call canceled`;
    case 'blocked':
      return `${modeLabel} call ended by conversation block`;
    case 'ended':
      return duration ? `${modeLabel} call ended after ${duration}` : `${modeLabel} call ended`;
    default:
      return `${modeLabel} call activity`;
  }
};

const getCallActivityIcon = (activity: CallActivity) => {
  if (activity.result === 'missed') {
    return PhoneMissed;
  }

  if (activity.result === 'rejected' || activity.result === 'failed' || activity.result === 'blocked') {
    return PhoneOff;
  }

  return activity.mode === 'video' ? Video : Phone;
};

const CallActivityRow = ({ message }: { message: Message }) => {
  const activity = message.callActivity;

  if (!activity) {
    return null;
  }

  const Icon = getCallActivityIcon(activity);
  const title = getCallActivityTitle(activity);
  const timestamp = formatTimestamp(activity.endedAt ?? message.updatedAt);

  return (
    <div
      className="flex justify-center"
      data-message-id={message._id}
      data-message-kind="call-activity"
      role="note"
      aria-label={`${title} at ${timestamp}`}
    >
      <div className="inline-flex max-w-[min(92vw,520px)] items-center gap-2 rounded-full border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-2 text-xs font-medium text-[var(--chat-text-muted)] shadow-sm">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--chat-accent)]" />
        <span className="min-w-0 truncate">{title}</span>
        <span aria-hidden="true" className="h-1 w-1 shrink-0 rounded-full bg-[var(--chat-text-soft)]" />
        <time dateTime={activity.endedAt ?? message.updatedAt} className="shrink-0">{timestamp}</time>
      </div>
    </div>
  );
};

const getMemberDisplayName = (members: Chat['members'], senderId: string) => {
  const member = members.find((candidate) => candidate._id === senderId);

  if (!member) {
    return 'Unknown member';
  }

  return `${member.firstName} ${member.lastName}`.trim() || member.username || 'Unknown member';
};

const MessageBubble = memo(({
  message,
  isOwnMessage,
  isGroupChat,
  members,
  isHighlighted = false,
  onContextMenu,
  onDoubleClick,
  onOpenActions,
  onOpenAttachmentPreview,
  onRetryFailed,
  onDismissFailed,
}: MessageBubbleProps) => {
  const seenByText = useMemo(() => {
    if (!isOwnMessage || !isGroupChat || !message.readBy || message.readBy.length === 0) {
      return null;
    }

    const readCount = message.readBy.length;
    const totalOthers = members.length - 1;

    if (readCount === totalOthers) {
      return 'Seen by everyone';
    }

    return `Seen by ${readCount} ${readCount === 1 ? 'person' : 'people'}`;
  }, [isGroupChat, isOwnMessage, members.length, message.readBy]);

  const groupedReactions = useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    const groups = new Map<string, number>();
    message.reactions.forEach((reaction) => {
      groups.set(reaction.emoji, (groups.get(reaction.emoji) || 0) + 1);
    });
    return Array.from(groups.entries()).map(([emoji, count]) => ({ emoji, count }));
  }, [message.reactions]);

  if (message.messageType === 'call') {
    return <CallActivityRow message={message} />;
  }

  const isFailed = message.optimisticState === 'failed';
  const isSending = message.optimisticState === 'sending';
  const visibleAttachments = message.deletedForEveryone ? [] : message.attachments ?? [];
  const requiresReattachForRetry = isFailed && visibleAttachments.length > 0 && !message.localFiles?.length;
  const bubbleTone = isFailed
    ? 'border-[color-mix(in_srgb,var(--chat-danger)_58%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-danger)_8%,var(--chat-panel-elevated))] text-[var(--chat-text)]'
    : isSending
      ? 'border-[var(--chat-warning)] bg-[var(--chat-own-bubble)] text-[var(--chat-own-text)]'
      : isOwnMessage
        ? 'border-transparent bg-[var(--chat-own-bubble)] text-[var(--chat-own-text)]'
        : 'border-[var(--chat-border)] bg-[var(--chat-received-bubble)] text-[var(--chat-received-text)]';
  const metadataTone = isFailed
    ? 'text-[var(--chat-text-muted)]'
    : isOwnMessage
      ? 'text-white/90'
      : 'text-[var(--chat-text-soft)]';
  const senderDisplayName = isGroupChat ? getMemberDisplayName(members, message.sender) : null;

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isHighlighted ? 'message-search-highlight' : ''}`}
      data-message-id={message._id}
      onContextMenu={onContextMenu ? (event) => onContextMenu(event, message) : undefined}
      onDoubleClick={onDoubleClick && isOwnMessage ? () => onDoubleClick(message) : undefined}
    >
      <div className={`message-bubble-wrap group flex max-w-[calc(100vw-32px)] flex-col ${isOwnMessage ? 'message-bubble-wrap--own' : 'message-bubble-wrap--received'}`}>
        {senderDisplayName && (
          <p
            className={`mb-1 max-w-full truncate px-2 text-xs font-semibold text-[var(--chat-text-muted)] ${
              isOwnMessage ? 'text-right' : 'text-left'
            }`}
            title={senderDisplayName}
          >
            {senderDisplayName}
          </p>
        )}
        <div
          className={`message-bubble relative rounded-[var(--chat-radius-xl)] border px-4 py-3 pr-11 text-base leading-6 shadow-sm cursor-pointer md:rounded-[var(--chat-radius-lg)] md:text-sm md:leading-5 ${bubbleTone}`}
        >
          <button
            type="button"
            onClick={onOpenActions ? (event) => onOpenActions(event, message, isOwnMessage) : undefined}
            className="absolute right-1.5 top-1.5 grid h-8 w-8 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-current opacity-70 transition hover:bg-black/10 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
            aria-label="Open message actions"
          >
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </button>
          {message.deletedForEveryone ? (
            <p className="italic text-[#A8B3AF]">This message was deleted</p>
          ) : (
            <>
              {message.text.trim() && <p className="whitespace-pre-wrap break-words">{message.text}</p>}
              {visibleAttachments.map((attachment) => (
                <AttachmentPreview
                  key={attachment.attachmentId}
                  attachment={attachment}
                  onOpenPreview={onOpenAttachmentPreview}
                />
              ))}
            </>
          )}
          <div className={`mt-1 flex items-end justify-start gap-1 text-xs ${metadataTone}`}>
            <span className="text-nowrap">{formatTimestamp(message.updatedAt)}</span>
            {message.isEdited && <span className="italic">edited</span>}
            {isSending && (
              <span className="inline-flex items-center gap-1 text-[var(--chat-warning)]">
                <RefreshCw aria-hidden="true" className="h-3 w-3 motion-safe:animate-spin" />
                sending
              </span>
            )}
            <MessageStatus status={message.status || 'sent'} isOwnMessage={isOwnMessage} />
          </div>
          {seenByText && <p className="mt-0.5 text-right text-xs text-[var(--chat-text-muted)]">{seenByText}</p>}
          {isFailed && (
            <div className="mt-2 border-t border-[color-mix(in_srgb,var(--chat-danger)_30%,transparent)] pt-2" aria-live="polite">
              <p className="text-xs text-[var(--chat-danger)]">Message failed to send. Retry or dismiss it.</p>
              {requiresReattachForRetry && (
                <p className="mt-1 text-xs text-[var(--chat-danger)]">Reattach files before retrying this message.</p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onRetryFailed?.(message)}
                  className="min-h-8 cursor-pointer rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 text-xs font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => onDismissFailed?.(message)}
                  className="min-h-8 cursor-pointer rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 text-xs font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
        {groupedReactions.length > 0 && (
          <div className={`mt-1 flex gap-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            {groupedReactions.map(({ emoji, count }) => (
              <span
                key={emoji}
                className="inline-flex pointer-events-none items-center gap-0.5 rounded-full border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-1.5 py-0.5 text-xs text-[var(--chat-text)]"
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-[var(--chat-text-muted)]">{count}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
