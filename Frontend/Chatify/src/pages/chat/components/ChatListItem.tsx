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
        className={`min-h-[72px] cursor-pointer w-full rounded-lg border-l-2 px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6] ${
          isActive ? 'border-[#14B8A6] bg-[#20262B] text-[#F4F7F6]' : 'border-transparent text-[#F4F7F6] hover:bg-[#20262B]'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-semibold leading-5">
            <span className="truncate">{title}</span>
            {!chat.isGroupChat && isOnline && <OnlineStatus isOnline size="sm" />}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {unreadCount > 0 && (
              <span className="min-w-5 rounded-full bg-[#14B8A6] px-1.5 py-0.5 text-center text-xs font-bold text-[#101113]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
            <span className="text-xs font-medium text-[#6F7B77]">{timestamp}</span>
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-[#A8B3AF]">
          {chat.latestMessage ? chat.latestMessage.text : 'No messages yet'}
        </p>
      </button>
    </li>
  );
};

export default ChatListItem;
