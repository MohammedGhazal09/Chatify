import type { ChangeEvent, KeyboardEventHandler, RefObject } from 'react';
import { LoaderCircle, Lock, Mic, Paperclip, Send, SmilePlus, X } from 'lucide-react';
import type { Message } from '../../../types/chat';
import { MAX_MESSAGE_TEXT_LENGTH } from '../../../hooks/messageCache';
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
  const trimmedValue = value.trim();
  const isMessageTooLong = trimmedValue.length > MAX_MESSAGE_TEXT_LENGTH;
  const composerStatusId = 'composer-status-message';
  const currentDisabledReason = sendDisabledReason ??
    (isMessageTooLong ? `Message exceeds maximum length of ${MAX_MESSAGE_TEXT_LENGTH} characters.` : null);

  return (
    <div className="composer-dock w-full max-w-full overflow-hidden border-t border-[var(--chat-border)] bg-[var(--chat-panel)] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:px-8">
      {replyingTo && (
        <div className="mx-auto mb-2 flex max-w-[880px] items-center justify-between rounded-[var(--chat-radius-md)] border-l-4 border-[var(--chat-accent)] bg-[var(--chat-panel-subtle)] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--chat-accent)]">Replying to</p>
            <p className="truncate text-sm text-[var(--chat-text-muted)]">{replyingTo.text}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="ml-2 grid h-8 w-8 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Cancel reply"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mx-auto flex max-w-[880px] items-center gap-3">
        <button
          type="button"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] text-[var(--chat-text-soft)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] md:h-10 md:w-10"
          aria-label="Attach file unavailable in this phase"
          disabled
          title="Attach file unavailable in this phase"
        >
          <Paperclip aria-hidden="true" className="h-6 w-6 md:h-5 md:w-5" />
        </button>

        <div className="min-w-0 flex-1 rounded-[var(--chat-radius-pill)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] focus-within:border-[var(--chat-focus)] focus-within:ring-2 focus-within:ring-[var(--chat-focus)]/25">
          <textarea
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Write a private message"
            aria-label="Write a private message"
            disabled={Boolean(sendDisabledReason)}
            aria-describedby={currentDisabledReason ? composerStatusId : undefined}
            className="chat-input-area max-h-24 min-h-12 w-full resize-none rounded-[var(--chat-radius-pill)] bg-transparent px-5 py-3 text-base leading-6 text-[var(--chat-text)] outline-none placeholder:text-[var(--chat-text-soft)] disabled:cursor-not-allowed disabled:text-[var(--chat-text-soft)] md:text-sm"
          />
        </div>

        <div className="relative hidden md:block" ref={emojiPickerRef}>
          <button
            type="button"
            onClick={onToggleEmojiPicker}
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] transition-colors hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
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

        <button
          type="button"
          className="hidden h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] text-[var(--chat-text-soft)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] md:grid"
          aria-label="Voice message unavailable in this phase"
          disabled
          title="Voice message unavailable in this phase"
        >
          <Mic aria-hidden="true" className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={onSend}
          disabled={Boolean(sendDisabledReason) || isSending || !trimmedValue || isMessageTooLong}
          className="grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--chat-accent)] text-[var(--chat-own-text)] shadow-[var(--chat-shadow)] transition hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:bg-[var(--chat-panel-subtle)] disabled:text-[var(--chat-text-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] md:h-12 md:w-12"
          aria-label="Send message"
          aria-describedby={currentDisabledReason ? composerStatusId : undefined}
        >
          {isSending ? (
            <LoaderCircle aria-hidden="true" className="h-5 w-5 motion-safe:animate-spin" />
          ) : (
            <Send aria-hidden="true" className="h-6 w-6" />
          )}
        </button>
      </div>
      <div className="mx-auto mt-3 flex max-w-[880px] items-center justify-center gap-2 text-sm text-[var(--chat-text-muted)]">
        <Lock aria-hidden="true" className="h-4 w-4 text-[var(--chat-accent)]" />
        <span>Authenticated private session</span>
      </div>
      {currentDisabledReason && (
        <p id={composerStatusId} className="mx-auto mt-2 max-w-[880px] text-sm text-[var(--chat-warning)]" aria-live="polite">
          {currentDisabledReason}
        </p>
      )}
      {isSendError && (
        <p className="mx-auto mt-2 max-w-[880px] text-sm text-[var(--chat-danger)]" aria-live="polite">We could not send your message. Please try again.</p>
      )}
    </div>
  );
};

export default MessageComposer;
