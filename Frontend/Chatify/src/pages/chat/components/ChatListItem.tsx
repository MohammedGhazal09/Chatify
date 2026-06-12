import OnlineStatus from '../../../components/OnlineStatus';
import type { Chat } from '../../../types/chat';
import { formatTimestamp } from '../utils/chatDisplay';
import AbstractIdentityTile from './AbstractIdentityTile';

interface ChatListItemProps {
  chat: Chat;
  title: string;
  isActive: boolean;
  isOnline: boolean;
  unreadCount: number;
  onSelect: () => void;
}

const ChatListItem = ({ chat, title, isActive, isOnline, unreadCount, onSelect }: ChatListItemProps) => {
  const timestamp = chat.latestMessage
    ? formatTimestamp(chat.latestMessage.updatedAt)
    : formatTimestamp(chat.updatedAt);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`min-h-[76px] cursor-pointer w-full rounded-[var(--chat-radius-md)] border-l-4 px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
          isActive ? 'border-[var(--chat-accent)] bg-[var(--chat-accent-soft)] text-[var(--chat-text)]' : 'border-transparent text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)]'
        }`}
      >
        <div className="flex items-center gap-3">
          <AbstractIdentityTile id={chat._id} label={title} variant="conversation" className="h-11 w-11" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-semibold leading-5">
              <span className="truncate">{title}</span>
              {!chat.isGroupChat && isOnline && <OnlineStatus isOnline size="sm" />}
            </span>
            <span className="mt-1 block truncate text-xs text-[var(--chat-text-muted)]">
              {chat.latestMessage ? chat.latestMessage.text : 'No messages yet'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {unreadCount > 0 && (
              <span className="min-w-5 rounded-full bg-[var(--chat-accent)] px-1.5 py-0.5 text-center text-xs font-bold text-[var(--chat-own-text)]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <span className="text-xs font-medium text-[var(--chat-text-soft)]">{timestamp}</span>
          </span>
        </div>
      </button>
    </li>
  );
};

export default ChatListItem;
