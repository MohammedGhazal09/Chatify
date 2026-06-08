import OnlineStatus from '../../../components/OnlineStatus';
import type { Chat } from '../../../types/chat';
import { formatTimestamp } from '../utils/chatDisplay';

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
        className={`cursor-pointer w-full rounded-lg px-3 py-2 text-left transition-colors ${
          isActive ? 'bg-emerald-500/20 text-emerald-100' : 'hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <span className="truncate">{title}</span>
            {!chat.isGroupChat && isOnline && <OnlineStatus isOnline size="sm" />}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {unreadCount > 0 && (
              <span className="min-w-5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-center text-xs font-bold text-emerald-950">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <span className="text-xs text-slate-400">{timestamp}</span>
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-slate-400">
          {chat.latestMessage ? chat.latestMessage.text : 'No messages yet'}
        </p>
      </button>
    </li>
  );
};

export default ChatListItem;
