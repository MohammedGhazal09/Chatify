import type { ChangeEvent, KeyboardEventHandler, RefObject } from 'react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import type { Message } from '../../../types/chat';

interface MessageComposerProps {
  value: string;
  replyingTo: Message | null;
  showEmojiPicker: boolean;
  isSending: boolean;
  isSendError: boolean;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onSend: () => void;
  onToggleEmojiPicker: () => void;
  onAppendEmoji: (emoji: string) => void;
  onCancelReply: () => void;
}

const MessageComposer = ({
  value,
  replyingTo,
  showEmojiPicker,
  isSending,
  isSendError,
  emojiPickerRef,
  onChange,
  onKeyDown,
  onSend,
  onToggleEmojiPicker,
  onAppendEmoji,
  onCancelReply,
}: MessageComposerProps) => {
  return (
    <div className="border-t border-slate-900 bg-slate-900/60 p-4">
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg border-l-4 border-emerald-500 bg-slate-800 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-emerald-400">Replying to</p>
            <p className="truncate text-sm text-slate-300">{replyingTo.text}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="cursor-pointer ml-2 text-slate-400 hover:text-slate-200"
            aria-label="Cancel reply"
          >
            <span aria-hidden="true">x</span>
          </button>
        </div>
      )}

      <div className="rounded-lg border border-slate-800 bg-slate-950 focus-within:border-emerald-500">
        <textarea
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="Write a message..."
          className="chat-input-area h-24 w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm text-slate-100 outline-none"
        />
        <div className="flex items-center justify-between border-t border-slate-800 px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="relative" ref={emojiPickerRef}>
              <button
                type="button"
                onClick={onToggleEmojiPicker}
                className="cursor-pointer p-1 text-slate-400 transition-colors hover:text-emerald-400"
                title="Add emoji"
                aria-label="Add emoji"
              >
                <span aria-hidden="true">Emoji</span>
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-10 left-0 z-50">
                  <EmojiPicker
                    theme={Theme.DARK}
                    onEmojiClick={(emoji) => {
                      onAppendEmoji(emoji.emoji);
                    }}
                    width={300}
                    height={400}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">Press Enter to send</p>
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={isSending || !value.trim() || value.length > 1000}
            className="cursor-pointer rounded bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
      {isSendError && (
        <p className="mt-2 text-sm text-red-400">We could not send your message. Please try again.</p>
      )}
    </div>
  );
};

export default MessageComposer;
