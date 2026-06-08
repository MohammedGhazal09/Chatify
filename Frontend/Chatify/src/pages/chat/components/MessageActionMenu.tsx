import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { Message } from '../../../types/chat';
import type { MessageContextMenuState } from '../hooks/useChatViewState';
import LazyEmojiPicker from './LazyEmojiPicker';

interface MessageActionMenuProps {
  contextMenu: MessageContextMenuState | null;
  messages: Message[];
  showReactionPicker: boolean;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  onReaction: (messageId: string, emoji: string) => void;
  onToggleReactionPicker: () => void;
  onReply: (message: Message) => void;
  onStartEdit: (messageId: string, currentText: string) => void;
  onDelete: (deleteForEveryone: boolean) => void;
  onCopy: (message: Message) => void;
  onClose: () => void;
}

const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const MessageActionMenu = ({
  contextMenu,
  messages,
  showReactionPicker,
  contextMenuRef,
  onReaction,
  onToggleReactionPicker,
  onReply,
  onStartEdit,
  onDelete,
  onCopy,
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
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-lg transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={onToggleReactionPicker}
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-lg text-[#A8B3AF] transition-transform hover:bg-[#181C20] hover:text-[#F4F7F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
          title="More reactions"
          aria-label="More reactions"
        >
          <span aria-hidden="true">+</span>
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
        className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#F4F7F6] hover:bg-[#181C20] focus:outline-none focus-visible:bg-[#181C20]"
      >
        Reply
      </button>
      {contextMenu.isOwn && (
        <button
          type="button"
          onClick={() => onStartEdit(contextMenu.messageId, message?.text || '')}
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#F4F7F6] hover:bg-[#181C20] focus:outline-none focus-visible:bg-[#181C20]"
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
      {contextMenu.isOwn && (
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
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#EF4444] hover:bg-[#181C20] focus:outline-none focus-visible:bg-[#181C20]"
        >
          Delete for everyone
        </button>
      )}
    </div>
  );
};

export default MessageActionMenu;
