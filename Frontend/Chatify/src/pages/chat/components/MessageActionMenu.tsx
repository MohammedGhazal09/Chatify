import type { RefObject } from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import type { Message } from '../../../types/chat';
import type { MessageContextMenuState } from '../hooks/useChatViewState';

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
}: MessageActionMenuProps) => {
  if (!contextMenu) {
    return null;
  }

  const message = messages.find((item) => item._id === contextMenu.messageId);

  return (
    <div
      ref={contextMenuRef}
      className="fixed z-50 min-w-[200px] rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex justify-center gap-1 border-b border-slate-700 px-2 py-2">
        {quickReactions.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReaction(contextMenu.messageId, emoji)}
            className="cursor-pointer p-1 text-lg transition-transform hover:scale-125"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          onClick={onToggleReactionPicker}
          className="cursor-pointer p-1 text-lg transition-transform hover:scale-125"
          title="More reactions"
          aria-label="More reactions"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>

      {showReactionPicker && (
        <div className="absolute bottom-full left-0 z-50 mb-2">
          <EmojiPicker
            theme={Theme.DARK}
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
        className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
      >
        Reply
      </button>
      {contextMenu.isOwn && (
        <button
          type="button"
          onClick={() => onStartEdit(contextMenu.messageId, message?.text || '')}
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
        >
          Edit
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (message) onCopy(message);
        }}
        className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
      >
        Copy
      </button>
      {contextMenu.isOwn && (
        <button
          type="button"
          onClick={() => onDelete(false)}
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
        >
          Delete for me
        </button>
      )}
      {contextMenu.isOwn && (
        <button
          type="button"
          onClick={() => onDelete(true)}
          className="cursor-pointer flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700"
        >
          Delete for everyone
        </button>
      )}
    </div>
  );
};

export default MessageActionMenu;
