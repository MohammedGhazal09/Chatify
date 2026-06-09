import { memo, useMemo } from 'react';
import type { MouseEvent } from 'react';
import { MoreHorizontal } from 'lucide-react';
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
  const bubbleTone = isFailed
    ? 'border-[#EF4444] bg-[#2B2020] text-[#F4F7F6]'
    : isSending
      ? 'border-[#F59E0B] bg-[#123C35] text-[#F4F7F6]'
      : isOwnMessage
        ? 'border-transparent bg-[#123C35] text-[#F4F7F6]'
        : 'border-transparent bg-[#22282D] text-[#F4F7F6]';

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${isHighlighted ? 'message-search-highlight' : ''}`}
      data-message-id={message._id}
      onContextMenu={onContextMenu ? (event) => onContextMenu(event, message) : undefined}
      onDoubleClick={onDoubleClick && isOwnMessage ? () => onDoubleClick(message) : undefined}
    >
      <div className="group flex max-w-[calc(100vw-32px)] flex-col sm:max-w-[85%] md:max-w-[75%] xl:max-w-[68%]">
        <div
          className={`message-bubble relative rounded-2xl border py-2 pl-3 pr-10 text-sm leading-5 shadow cursor-pointer ${bubbleTone}`}
        >
          <button
            type="button"
            onClick={onOpenActions ? (event) => onOpenActions(event, message, isOwnMessage) : undefined}
            className="absolute right-1.5 top-1.5 grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#A8B3AF] opacity-100 transition hover:bg-black/20 hover:text-[#F4F7F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
            aria-label="Open message actions"
          >
            <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
          </button>
          {message.deletedForEveryone ? (
            <p className="italic text-[#A8B3AF]">This message was deleted</p>
          ) : (
            <>
              <p className="whitespace-pre-wrap break-words">{message.text}</p>
            </>
          )}
          <div className={`mt-1 flex items-end-safe justify-start gap-1 text-xs ${isOwnMessage ? 'text-[#A8B3AF]' : 'text-[#6F7B77]'}`}>
            <span className="text-nowrap">{formatTimestamp(message.updatedAt)}</span>
            {message.isEdited && <span className="italic">edited</span>}
            {isSending && <span className="text-[#F59E0B]">sending</span>}
            <MessageStatus status={message.status || 'sent'} isOwnMessage={isOwnMessage} />
          </div>
          {seenByText && <p className="mt-0.5 text-right text-xs text-[#A8B3AF]">{seenByText}</p>}
          {isFailed && (
            <div className="mt-2 border-t border-[#EF4444]/30 pt-2" aria-live="polite">
              <p className="text-xs text-[#EF4444]">Message failed to send. Retry or dismiss it.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onRetryFailed?.(message)}
                  className="min-h-8 cursor-pointer rounded-lg bg-[#14B8A6] px-3 text-xs font-semibold text-[#101113] hover:bg-[#22C55E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => onDismissFailed?.(message)}
                  className="min-h-8 cursor-pointer rounded-lg border border-[#2E363C] px-3 text-xs font-semibold text-[#A8B3AF] hover:bg-[#20262B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
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
                className="inline-flex pointer-events-none items-center gap-0.5 rounded-full border border-[#2E363C] bg-[#20262B] px-1.5 py-0.5 text-xs"
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-[#A8B3AF]">{count}</span>}
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
