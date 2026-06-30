import { useEffect } from 'react';
import type { RefObject } from 'react';
import { Bookmark, BookmarkCheck, SmilePlus } from 'lucide-react';
import type { Message } from '../../../types/chat';
import type { MessageContextMenuState } from '../hooks/useChatViewState';
import LazyEmojiPicker from './LazyEmojiPicker';

interface MessageActionMenuProps {
  contextMenu: MessageContextMenuState | null;
  messages: Message[];
  showReactionPicker: boolean;
  activeActionsDisabled: boolean;
  activeActionsDisabledReason?: string | null;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  onReaction: (messageId: string, emoji: string) => void;
  onToggleReactionPicker: () => void;
  onReply: (message: Message) => void;
  onStartEdit: (messageId: string, currentText: string) => void;
  onDelete: (deleteForEveryone: boolean) => void;
  onCopy: (message: Message) => void;
  onTogglePin: (message: Message) => void;
  onToggleSave: (message: Message) => void;
  onReportMessage: (message: Message) => void;
  onClose: () => void;
}

const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MessageActionMenu = ({
  contextMenu,
  messages,
  showReactionPicker,
  activeActionsDisabled,
  activeActionsDisabledReason,
  contextMenuRef,
  onReaction,
  onToggleReactionPicker,
  onReply,
  onStartEdit,
  onDelete,
  onCopy,
  onTogglePin,
  onToggleSave,
  onReportMessage,
  onClose,
}: MessageActionMenuProps) => {
  useEffect(() => {
    if (contextMenu) {
      contextMenuRef.current?.focus();
    }
  }, [contextMenu, contextMenuRef]);

  if (!contextMenu) {
    return null;
  }

  const message = messages.find((item) => item._id === contextMenu.messageId);
  const canDeleteForMe = Boolean(message && !message.optimisticState);
  const canSaveMessage = Boolean(message && !message.optimisticState && !message.deletedForEveryone);
  const messageIsEncrypted = message?.messageType === 'encrypted' || message?.encryptionMode === 'e2ee_v1';
  const editDisabled = activeActionsDisabled || messageIsEncrypted;
  const editDisabledReason = messageIsEncrypted
    ? 'Encrypted messages cannot be edited in this release.'
    : activeActionsDisabledReason ?? undefined;

  return (
    <div
      ref={contextMenuRef}
      role="group"
      aria-label="Message actions"
      tabIndex={-1}
      className="fixed z-50 min-w-[200px] rounded-lg border border-[#2E363C] bg-[#20262B] py-1 shadow-xl"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
        }
      }}
    >
      <div className="flex justify-center gap-1 border-b border-[#2E363C] px-2 py-2">
        {quickReactions.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReaction(contextMenu.messageId, emoji)}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-lg transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
            aria-label={`React with ${emoji}`}
            disabled={activeActionsDisabled}
            title={activeActionsDisabledReason ?? undefined}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={onToggleReactionPicker}
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-lg text-[#A8B3AF] transition-transform hover:bg-[#181C20] hover:text-[#F4F7F6] disabled:cursor-not-allowed disabled:opacity-45 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
          title="More reactions"
          aria-label="More reactions"
          disabled={activeActionsDisabled}
        >
          <SmilePlus aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      {showReactionPicker && (
        <div className="absolute bottom-full left-0 z-50 mb-2">
          <LazyEmojiPicker
            onEmojiClick={(emojiData) => {
              onReaction(contextMenu.messageId, emojiData.emoji);
            }}
            width={300}
            height={350}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (message) onReply(message);
        }}
        disabled={activeActionsDisabled}
        title={activeActionsDisabledReason ?? undefined}
        className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#F4F7F6] hover:bg-[#181C20] disabled:cursor-not-allowed disabled:text-[#6B7378] focus:outline-none focus-visible:bg-[#181C20]"
      >
        Reply
      </button>
      {contextMenu.isOwn && (
        <button
          type="button"
          onClick={() => onStartEdit(contextMenu.messageId, message?.decryptedText ?? message?.text ?? '')}
          disabled={editDisabled}
          title={editDisabledReason}
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#F4F7F6] hover:bg-[#181C20] disabled:cursor-not-allowed disabled:text-[#6B7378] focus:outline-none focus-visible:bg-[#181C20]"
        >
          Edit
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (message) onCopy(message);
        }}
        className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#F4F7F6] hover:bg-[#181C20] focus:outline-none focus-visible:bg-[#181C20]"
      >
        Copy
      </button>
      {message && !message.deletedForEveryone && (
        <button
          type="button"
          onClick={() => onTogglePin(message)}
          disabled={activeActionsDisabled}
          title={activeActionsDisabledReason ?? undefined}
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#F4F7F6] hover:bg-[#181C20] disabled:cursor-not-allowed disabled:text-[#6B7378] focus:outline-none focus-visible:bg-[#181C20]"
        >
          {message.pinned ? 'Unpin message' : 'Pin message'}
        </button>
      )}
      {message && canSaveMessage && (
        <button
          type="button"
          onClick={() => onToggleSave(message)}
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#F4F7F6] hover:bg-[#181C20] focus:outline-none focus-visible:bg-[#181C20]"
        >
          {message.savedByRequester ? (
            <BookmarkCheck aria-hidden="true" className="h-4 w-4 text-[#14B8A6]" />
          ) : (
            <Bookmark aria-hidden="true" className="h-4 w-4" />
          )}
          {message.savedByRequester ? 'Unsave message' : 'Save message'}
        </button>
      )}
      {message && !contextMenu.isOwn && (
        <button
          type="button"
          onClick={() => onReportMessage(message)}
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#EF4444] hover:bg-[#181C20] focus:outline-none focus-visible:bg-[#181C20]"
        >
          Report message
        </button>
      )}
      {canDeleteForMe && (
        <button
          type="button"
          onClick={() => onDelete(false)}
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#F4F7F6] hover:bg-[#181C20] focus:outline-none focus-visible:bg-[#181C20]"
        >
          Delete for me
        </button>
      )}
      {contextMenu.isOwn && (
        <button
          type="button"
          onClick={() => onDelete(true)}
          disabled={activeActionsDisabled}
          title={activeActionsDisabledReason ?? undefined}
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#EF4444] hover:bg-[#181C20] disabled:cursor-not-allowed disabled:text-[#6B7378] focus:outline-none focus-visible:bg-[#181C20]"
        >
          Delete for everyone
        </button>
      )}
    </div>
  );
};

export default MessageActionMenu;
