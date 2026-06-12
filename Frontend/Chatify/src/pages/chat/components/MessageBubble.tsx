import { memo, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { FileText, MoreHorizontal, RefreshCw } from 'lucide-react';
import MessageStatus from '../../../components/MessageStatus';
import type { Chat, Message } from '../../../types/chat';
import { formatTimestamp } from '../utils/chatDisplay';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  isGroupChat: boolean;
  members: Chat['members'];
  isHighlighted?: boolean;
  onContextMenu?: (event: MouseEvent, message: Message) => void;
  onDoubleClick?: (message: Message) => void;
  onOpenActions?: (event: MouseEvent<HTMLButtonElement>, message: Message, isOwnMessage: boolean) => void;
  onRetryFailed?: (message: Message) => void;
  onDismissFailed?: (message: Message) => void;
}

const MessageBubble = memo(({
  message,
  isOwnMessage,
  isGroupChat,
  members,
  isHighlighted = false,
  onContextMenu,
  onDoubleClick,
  onOpenActions,
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

  const isFailed = message.optimisticState === 'failed';
  const isSending = message.optimisticState === 'sending';
  const fileChip = (message as Message & { fileChip?: { name: string; meta?: string } }).fileChip;
  const bubbleTone = isFailed
    ? 'border-[color-mix(in_srgb,var(--chat-danger)_58%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-danger)_8%,var(--chat-panel-elevated))] text-[var(--chat-text)]'
    : isSending
      ? 'border-[var(--chat-warning)] bg-[var(--chat-own-bubble)] text-[var(--chat-own-text)]'
      : isOwnMessage
        ? 'border-transparent bg-[var(--chat-own-bubble)] text-[var(--chat-own-text)]'
        : 'border-[var(--chat-border)] bg-[var(--chat-received-bubble)] text-[var(--chat-received-text)]';

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isHighlighted ? 'message-search-highlight' : ''}`}
      data-message-id={message._id}
      onContextMenu={onContextMenu ? (event) => onContextMenu(event, message) : undefined}
      onDoubleClick={onDoubleClick && isOwnMessage ? () => onDoubleClick(message) : undefined}
    >
      <div className={`message-bubble-wrap group flex max-w-[calc(100vw-32px)] flex-col ${isOwnMessage ? 'message-bubble-wrap--own' : 'message-bubble-wrap--received'}`}>
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
              {fileChip ? (
                <div className="flex min-w-0 items-center gap-3 rounded-[var(--chat-radius-md)] border border-current/20 bg-black/5 p-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-sm)] bg-black/10">
                    <FileText aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{fileChip.name}</span>
                    {fileChip.meta && <span className="text-xs opacity-75">{fileChip.meta}</span>}
                  </span>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words">{message.text}</p>
              )}
            </>
          )}
          <div className={`mt-1 flex items-end justify-start gap-1 text-xs ${isOwnMessage ? 'text-white/78' : 'text-[var(--chat-text-soft)]'}`}>
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
