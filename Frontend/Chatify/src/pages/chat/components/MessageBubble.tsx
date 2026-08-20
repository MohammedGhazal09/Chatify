import { memo, useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { BookmarkCheck, Lock, MoreHorizontal, Phone, PhoneMissed, PhoneOff, RefreshCw, Video } from 'lucide-react';
import MessageStatus from '../../../components/MessageStatus';
import type { CallActivity, Chat, Message } from '../../../types/chat';
import { formatTimestamp } from '../utils/chatDisplay';
import { mentionTokenPattern } from '../utils/mentions';
import AttachmentPreview from './AttachmentPreview';
import type { AttachmentPreviewTarget } from './AttachmentPreviewModal';
import { decryptMessageText, isEncryptedMessage } from '../../../utils/encryptedMessages';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  isGroupChat: boolean;
  members: Chat['members'];
  currentUserId?: string;
  isHighlighted?: boolean;
  onContextMenu?: (event: MouseEvent, message: Message) => void;
  onDoubleClick?: (message: Message) => void;
  onOpenActions?: (event: MouseEvent<HTMLButtonElement>, message: Message, isOwnMessage: boolean) => void;
  onOpenAttachmentPreview?: (attachment: AttachmentPreviewTarget) => void;
  onJumpToMessage?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  reactionDisabledReason?: string | null;
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

const getReplyPreviewText = (replyTo: NonNullable<Message['replyTo']>) => {
  if (replyTo.isDeleted) {
    return 'Original message unavailable';
  }

  if (replyTo.isEncrypted) {
    return 'Encrypted message';
  }

  const preview = replyTo.textPreview?.replace(/\s+/g, ' ').trim();
  if (preview) {
    return preview;
  }

  if (replyTo.messageType === 'call') {
    return 'Call activity';
  }

  if (replyTo.attachmentCount === 1) {
    return 'Attachment';
  }

  if (replyTo.attachmentCount > 1) {
    return `${replyTo.attachmentCount} attachments`;
  }

  return 'Original message unavailable';
};

const ReplyQuote = ({
  message,
  members,
  isOwnMessage,
  onJumpToMessage,
}: {
  message: Message;
  members: Chat['members'];
  isOwnMessage: boolean;
  onJumpToMessage?: (messageId: string) => void;
}) => {
  const replyTo = message.replyTo;

  if (!replyTo) {
    return null;
  }

  const senderLabel = getMemberDisplayName(members, replyTo.sender);
  const preview = getReplyPreviewText(replyTo);
  const canJump = Boolean(replyTo.messageId && !replyTo.isDeleted && onJumpToMessage);
  const className = [
    'mb-2 w-full rounded-[var(--chat-radius-md)] border-l-2 px-3 py-2 text-left',
    isOwnMessage
      ? 'border-white/70 bg-white/10 text-white/90'
      : 'border-[var(--chat-accent)] bg-[var(--chat-panel-elevated)] text-[var(--chat-text)]',
    canJump
      ? 'cursor-pointer hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]'
      : 'cursor-default',
  ].join(' ');
  const content = (
    <>
      <span className={`block truncate text-xs font-bold ${isOwnMessage ? 'text-white' : 'text-[var(--chat-accent)]'}`}>
        {senderLabel}
      </span>
      <span className="mt-0.5 block max-h-10 overflow-hidden break-words text-xs leading-5 opacity-85" dir="auto">
        {preview}
      </span>
    </>
  );

  if (!canJump) {
    return (
      <div className={className} aria-label={`Quoted message from ${senderLabel}: ${preview}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.stopPropagation();
        onJumpToMessage?.(replyTo.messageId);
      }}
      aria-label={`Jump to quoted message from ${senderLabel}: ${preview}`}
    >
      {content}
    </button>
  );
};

const MentionedMessageText = ({
  text,
  mentions = [],
  currentUserId,
  isOwnMessage,
}: {
  text: string;
  mentions: Message['mentions'];
  currentUserId?: string;
  isOwnMessage: boolean;
}) => {
  const pattern = mentions?.length ? mentionTokenPattern(mentions) : null;

  if (!pattern) {
    return <p className="whitespace-pre-wrap break-words" dir="auto">{text}</p>;
  }

  const mentionsByUsername = new Map(
    mentions.map((mention) => [mention.username.toLocaleLowerCase('en-US'), mention])
  );
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const prefix = match[1] ?? '';
    const token = match[2] ?? '';
    const tokenStart = match.index + prefix.length;
    const tokenEnd = tokenStart + token.length;

    if (tokenStart > lastIndex) {
      parts.push(text.slice(lastIndex, tokenStart));
    }

    const mention = mentionsByUsername.get(token.slice(1).toLocaleLowerCase('en-US'));
    const isCurrentUserMention = Boolean(currentUserId && mention?.userId === currentUserId);
    parts.push(
      <span
        key={`${tokenStart}-${token}`}
        className={[
          'inline rounded-[var(--chat-radius-sm)] px-1 py-0.5 font-semibold',
          isOwnMessage
            ? 'bg-white/15 text-white'
            : 'bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]',
          isCurrentUserMention
            ? 'ring-1 ring-[var(--chat-accent)]'
            : '',
        ].join(' ')}
        data-mentioned-user={mention?.userId}
      >
        {token}
      </span>
    );

    lastIndex = tokenEnd;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <p className="whitespace-pre-wrap break-words" dir="auto">{parts}</p>;
};

type EncryptedDisplayState = 'idle' | 'decrypting' | 'missing-secret' | 'invalid-payload' | 'decrypt-failed';

const getEncryptedStateCopy = (state: EncryptedDisplayState) => {
  switch (state) {
    case 'decrypting':
      return 'Decrypting encrypted message...';
    case 'missing-secret':
      return 'This device needs the conversation secret to read encrypted messages.';
    case 'invalid-payload':
      return 'Encrypted message payload is unavailable.';
    case 'decrypt-failed':
      return 'Encrypted message could not be decrypted on this device.';
    default:
      return null;
  }
};

const EncryptedMessageContent = ({ text, state }: { text: string; state: EncryptedDisplayState }) => {
  const stateCopy = getEncryptedStateCopy(state);

  if (text) {
    return (
      <div className="space-y-1">
        <p className="whitespace-pre-wrap break-words" dir="auto">{text}</p>
        <p className="inline-flex items-center gap-1 text-xs text-current opacity-80">
          <Lock aria-hidden="true" className="h-3 w-3" />
          <span>Encrypted</span>
        </p>
      </div>
    );
  }

  return (
    <p className="inline-flex items-start gap-2 text-sm italic text-current opacity-85" role={state === 'decrypt-failed' || state === 'invalid-payload' ? 'alert' : 'status'}>
      <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{stateCopy ?? 'Encrypted message unavailable.'}</span>
    </p>
  );
};

const MessageBubble = memo(({
  message,
  isOwnMessage,
  isGroupChat,
  members,
  currentUserId,
  isHighlighted = false,
  onContextMenu,
  onDoubleClick,
  onOpenActions,
  onOpenAttachmentPreview,
  onJumpToMessage,
  onReaction,
  reactionDisabledReason,
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
    const groups = new Map<string, { count: number; reactedByCurrentUser: boolean }>();
    message.reactions.forEach((reaction) => {
      const group = groups.get(reaction.emoji);
      groups.set(reaction.emoji, {
        count: (group?.count ?? 0) + 1,
        reactedByCurrentUser: Boolean(
          group?.reactedByCurrentUser || (currentUserId && reaction.user === currentUserId)
        ),
      });
    });
    return Array.from(groups.entries()).map(([emoji, group]) => ({ emoji, ...group }));
  }, [currentUserId, message.reactions]);

  const encryptedMessage = isEncryptedMessage(message);
  const [decryptedText, setDecryptedText] = useState<string | null>(message.decryptedText ?? null);
  const [encryptedDisplayState, setEncryptedDisplayState] = useState<EncryptedDisplayState>('idle');

  useEffect(() => {
    if (!encryptedMessage || message.deletedForEveryone) {
      setDecryptedText(null);
      setEncryptedDisplayState('idle');
      return undefined;
    }

    if (message.decryptedText) {
      setDecryptedText(message.decryptedText);
      setEncryptedDisplayState('idle');
      return undefined;
    }

    let isCanceled = false;
    setDecryptedText(null);
    setEncryptedDisplayState('decrypting');

    void decryptMessageText(message.chatId, message.encryptedPayload).then((result) => {
      if (isCanceled) {
        return;
      }

      if (result.ok) {
        setDecryptedText(result.text);
        setEncryptedDisplayState('idle');
        return;
      }

      setEncryptedDisplayState(result.reason);
    });

    return () => {
      isCanceled = true;
    };
  }, [
    encryptedMessage,
    message.chatId,
    message.decryptedText,
    message.deletedForEveryone,
    message.encryptedPayload,
  ]);

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
  const displayText = encryptedMessage ? message.decryptedText ?? decryptedText ?? '' : message.text;

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isHighlighted ? 'message-search-highlight' : ''}`}
      data-message-id={message._id}
      onContextMenu={onContextMenu ? (event) => onContextMenu(event, message) : undefined}
      onDoubleClick={onDoubleClick && isOwnMessage && !encryptedMessage ? () => onDoubleClick(message) : undefined}
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
          {!message.deletedForEveryone && (
            <ReplyQuote
              message={message}
              members={members}
              isOwnMessage={isOwnMessage}
              onJumpToMessage={onJumpToMessage}
            />
          )}
          {message.deletedForEveryone ? (
            <p className="italic text-[#A8B3AF]">This message was deleted</p>
          ) : encryptedMessage ? (
            <EncryptedMessageContent text={displayText} state={encryptedDisplayState} />
          ) : (
            <>
              {message.text.trim() && (
                <MentionedMessageText
                  text={message.text}
                  mentions={message.mentions}
                  currentUserId={currentUserId}
                  isOwnMessage={isOwnMessage}
                />
              )}
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
            {message.savedByRequester && (
              <span className="inline-flex items-center" title="Saved" aria-label="Saved">
                <BookmarkCheck aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
            )}
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
            {groupedReactions.map(({ emoji, count, reactedByCurrentUser }) => {
              const content = (
                <>
                  <span>{emoji}</span>
                  {count > 1 && <span className="text-[var(--chat-text-muted)]">{count}</span>}
                </>
              );

              return reactedByCurrentUser && onReaction ? (
                <button
                  key={emoji}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onReaction(message._id, emoji);
                  }}
                  onDoubleClick={(event) => event.stopPropagation()}
                  disabled={Boolean(reactionDisabledReason)}
                  className="inline-flex min-h-7 cursor-pointer items-center gap-0.5 rounded-full border border-[var(--chat-accent)] bg-[var(--chat-accent-soft)] px-2 py-0.5 text-xs text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                  aria-label={`Remove ${emoji} reaction`}
                  title={reactionDisabledReason ?? 'Remove your reaction'}
                >
                  {content}
                </button>
              ) : (
                <span
                  key={emoji}
                  className="inline-flex pointer-events-none items-center gap-0.5 rounded-full border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] px-1.5 py-0.5 text-xs text-[var(--chat-text)]"
                >
                  {content}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
