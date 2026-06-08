import { memo, useMemo } from 'react';
import type { MouseEvent } from 'react';
import MessageStatus from '../../../components/MessageStatus';
import type { Chat, Message } from '../../../types/chat';
import { formatTimestamp } from '../utils/chatDisplay';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  isGroupChat: boolean;
  members: Chat['members'];
  onContextMenu?: (event: MouseEvent, message: Message) => void;
  onDoubleClick?: (message: Message) => void;
}

const MessageBubble = memo(({ message, isOwnMessage, isGroupChat, members, onContextMenu, onDoubleClick }: MessageBubbleProps) => {
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

  return (
    <div
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      data-message-id={message._id}
      onContextMenu={onContextMenu ? (event) => onContextMenu(event, message) : undefined}
      onDoubleClick={onDoubleClick && isOwnMessage ? () => onDoubleClick(message) : undefined}
    >
      <div className="flex max-w-[85%] flex-col md:max-w-[80%]">
        <div
          className={`message-bubble rounded-2xl py-2 pl-2.5 pr-8 text-sm shadow cursor-pointer ${
            isOwnMessage
              ? 'bg-emerald-500 text-emerald-950'
              : 'bg-slate-800 text-slate-100'
          }`}
        >
          {message.deletedForEveryone ? (
            <p className="italic opacity-80">This message was deleted</p>
          ) : (
            <>
              {message.isEdited && <span className="text-[9px] opacity-70 italic">(edited)</span>}
              <p>{message.text}</p>
            </>
          )}
          <div className={`mt-1 flex items-end-safe justify-start gap-1 text-[10px] ${isOwnMessage ? 'text-emerald-900' : 'text-slate-400'}`}>
            <span className="text-nowrap">{formatTimestamp(message.updatedAt)}</span>
            <MessageStatus status={message.status || 'sent'} isOwnMessage={isOwnMessage} />
          </div>
          {seenByText && <p className="mt-0.5 text-right text-[9px] text-emerald-800">{seenByText}</p>}
        </div>
        {groupedReactions.length > 0 && (
          <div className={`mt-1 flex gap-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
            {groupedReactions.map(({ emoji, count }) => (
              <span
                key={emoji}
                className="inline-flex pointer-events-none items-center gap-0.5 rounded-full bg-slate-700/80 px-1.5 py-0.5 text-xs"
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-slate-300">{count}</span>}
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
