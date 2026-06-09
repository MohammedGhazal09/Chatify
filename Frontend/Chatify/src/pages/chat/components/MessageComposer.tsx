import type { ChangeEvent, KeyboardEventHandler, RefObject } from 'react';
import { LoaderCircle, SmilePlus, X } from 'lucide-react';
import type { Message } from '../../../types/chat';
import LazyEmojiPicker from './LazyEmojiPicker';

interface MessageComposerProps {
  value: string;
  replyingTo: Message | null;
  showEmojiPicker: boolean;
  isSending: boolean;
  isSendError: boolean;
  sendDisabledReason?: string | null;
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
  sendDisabledReason,
  emojiPickerRef,
  onChange,
  onKeyDown,
  onSend,
  onToggleEmojiPicker,
  onAppendEmoji,
  onCancelReply,
}: MessageComposerProps) => {
  return (
    <div className="min-h-[72px] w-full max-w-full overflow-hidden border-t border-[#2E363C] bg-[#181C20] p-4">
      {replyingTo && (
        <div className="mb-2 flex items-center justify-between rounded-lg border-l-4 border-[#14B8A6] bg-[#20262B] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#14B8A6]">Replying to</p>
            <p className="truncate text-sm text-[#A8B3AF]">{replyingTo.text}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="ml-2 grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#A8B3AF] hover:bg-[#181C20] hover:text-[#F4F7F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
            aria-label="Cancel reply"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="rounded-lg border border-[#2E363C] bg-[#20262B] focus-within:border-[#14B8A6]">
        <textarea
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="Write a message…"
          aria-label="Write a message"
          disabled={Boolean(sendDisabledReason)}
          aria-describedby={sendDisabledReason ? 'composer-disabled-reason' : undefined}
          className="chat-input-area max-h-36 min-h-[72px] w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm leading-5 text-[#F4F7F6] outline-none placeholder:text-[#6F7B77] disabled:cursor-not-allowed disabled:text-[#6F7B77]"
        />
        <div className="flex items-center justify-between border-t border-[#2E363C] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative" ref={emojiPickerRef}>
              <button
                type="button"
                onClick={onToggleEmojiPicker}
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg text-[#A8B3AF] transition-colors hover:bg-[#181C20] hover:text-[#14B8A6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
                title="Add emoji"
                aria-label="Add emoji"
              >
                <SmilePlus aria-hidden="true" className="h-5 w-5" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-10 left-0 z-50">
                  <LazyEmojiPicker
                    onEmojiClick={(emoji) => {
                      onAppendEmoji(emoji.emoji);
                    }}
                    width={300}
                    height={400}
                  />
                </div>
              )}
            </div>
            <p className="hidden text-xs text-[#6F7B77] sm:block">Press Enter to send</p>
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={Boolean(sendDisabledReason) || isSending || !value.trim() || value.length > 1000}
            className="min-h-10 shrink-0 cursor-pointer rounded-lg bg-[#14B8A6] px-4 py-1.5 text-sm font-semibold text-[#101113] transition hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:bg-[#2E363C] disabled:text-[#6F7B77] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
            aria-label="Send message"
          >
            {isSending ? (
              <span className="inline-flex items-center gap-2">
                <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                Sending…
              </span>
            ) : (
              <>
                <span className="sm:hidden">Send</span>
                <span className="hidden sm:inline">Send message</span>
              </>
            )}
          </button>
        </div>
      </div>
      {sendDisabledReason && (
        <p id="composer-disabled-reason" className="mt-2 text-sm text-[#F59E0B]" aria-live="polite">
          {sendDisabledReason}
        </p>
      )}
      {isSendError && (
        <p className="mt-2 text-sm text-[#EF4444]" aria-live="polite">We could not send your message. Please try again.</p>
      )}
    </div>
  );
};

export default MessageComposer;
