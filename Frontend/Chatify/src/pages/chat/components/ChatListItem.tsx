import OnlineStatus from '../../../components/OnlineStatus';
import { Archive, BellOff, Pin, Star } from 'lucide-react';
import type { User } from '../../../types/auth';
import type { Chat } from '../../../types/chat';
import { isEncryptedConversation } from '../../../utils/encryptedMessages';
import { formatTimestamp } from '../utils/chatDisplay';
import UserAvatar from './UserAvatar';

interface ChatListItemProps {
  chat: Chat;
  title: string;
  avatarUser?: User | null;
  isActive: boolean;
  isOnline: boolean;
  isMuted?: boolean;
  isPinned?: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
  draftText?: string;
  unreadCount: number;
  onSelect: () => void;
}

const normalizeDraftText = (value?: string) => value?.replace(/\s+/g, ' ').trim() ?? '';

const ChatListItem = ({
  chat,
  title,
  avatarUser,
  isActive,
  isOnline,
  isMuted = false,
  isPinned = false,
  isFavorite = false,
  isArchived = false,
  draftText,
  unreadCount,
  onSelect,
}: ChatListItemProps) => {
  const timestamp = chat.latestMessage
    ? formatTimestamp(chat.latestMessage.updatedAt)
    : formatTimestamp(chat.updatedAt);
  const normalizedDraftText = normalizeDraftText(draftText);
  const hasDraft = Boolean(normalizedDraftText);
  const draftPreview = isEncryptedConversation(chat) ? 'Draft saved on this device' : normalizedDraftText;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={isActive}
        className={`chat-list-item min-h-[76px] cursor-pointer w-full rounded-[var(--chat-radius-md)] border-l-4 px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] ${
          isActive ? 'border-[var(--chat-accent)] bg-[var(--chat-accent-soft)] text-[var(--chat-text)]' : 'border-transparent text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)]'
        }`}
      >
        <div className="flex items-center gap-3">
          <UserAvatar
            user={avatarUser}
            label={title}
            variant="conversation"
            className="h-11 w-11"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-semibold leading-5">
              <span className="truncate" dir="auto">{title}</span>
              {!chat.isGroupChat && isOnline && <OnlineStatus isOnline size="sm" />}
              {isMuted && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--chat-panel-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--chat-text-muted)]"
                  title="Muted"
                  aria-label="Conversation muted"
                >
                  <BellOff aria-hidden="true" className="h-3 w-3" />
                  <span className="sr-only">Muted</span>
                </span>
              )}
              {isPinned && (
                <span
                  className="inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--chat-accent-soft)] text-[var(--chat-accent)]"
                  title="Pinned"
                  aria-label="Conversation pinned"
                >
                  <Pin aria-hidden="true" className="h-3 w-3" />
                </span>
              )}
              {isFavorite && (
                <span
                  className="inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--chat-warning)_14%,var(--chat-panel-subtle))] text-[var(--chat-warning)]"
                  title="Starred"
                  aria-label="Conversation starred"
                >
                  <Star aria-hidden="true" className="h-3 w-3" fill="currentColor" />
                </span>
              )}
              {isArchived && (
                <span
                  className="inline-grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--chat-panel-subtle)] text-[var(--chat-text-muted)]"
                  title="Archived"
                  aria-label="Conversation archived"
                >
                  <Archive aria-hidden="true" className="h-3 w-3" />
                </span>
              )}
            </span>
            <span className="mt-1 block truncate text-xs text-[var(--chat-text-muted)]">
              {hasDraft ? (
                <>
                  <span className="font-semibold text-[var(--chat-accent)]">Draft:</span>{' '}
                  <span dir="auto">{draftPreview}</span>
                </>
              ) : (
                <span dir="auto">{chat.latestMessage ? chat.latestMessage.text : 'No messages yet'}</span>
              )}
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
