import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, KeyboardEventHandler, RefObject } from 'react';
import { LoaderCircle, Lock, Mic, Paperclip, Send, SmilePlus, X } from 'lucide-react';
import type { AttachmentKind, ComposerAttachmentDraft, ComposerSendPayload, Message } from '../../../types/chat';
import { MAX_MESSAGE_TEXT_LENGTH } from '../../../hooks/messageCache';
import AttachmentTray from './AttachmentTray';
import LazyEmojiPicker from './LazyEmojiPicker';

interface MessageComposerProps {
  value: string;
  replyingTo: Message | null;
  showEmojiPicker: boolean;
  isSending: boolean;
  isSendError: boolean;
  sendDisabledReason?: string | null;
  resetToken?: number;
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>, payload: ComposerSendPayload) => void;
  onSend: (payload: ComposerSendPayload) => void;
  onToggleEmojiPicker: () => void;
  onAppendEmoji: (emoji: string) => void;
  onCancelReply: () => void;
}

const MAX_ATTACHMENTS_PER_MESSAGE = 5;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'txt', 'csv', 'docx', 'xlsx']);
const MEDIA_ATTACHMENT_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

const stripControlChars = (value: string) => (
  Array.from(value).filter((character) => {
    const code = character.charCodeAt(0);
    return code > 31 && code !== 127;
  }).join('')
);

const sanitizeAttachmentDisplayName = (value: string) => {
  const normalized = stripControlChars(value)
    .replace(/[\\/]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^\w .()-]/g, '_')
    .trim();

  if (!normalized || normalized === '.' || normalized === '..') {
    return null;
  }

  if (normalized.length <= 140) {
    return normalized;
  }

  const lastDotIndex = normalized.lastIndexOf('.');
  const extension = lastDotIndex > 0 ? normalized.slice(lastDotIndex) : '';
  const stemLength = Math.max(1, 140 - extension.length);
  return `${normalized.slice(0, stemLength)}${extension}`;
};

const getExtension = (displayName: string) => {
  const lastDotIndex = displayName.lastIndexOf('.');
  return lastDotIndex > -1 ? displayName.slice(lastDotIndex + 1).toLowerCase() : '';
};

const getAttachmentKind = (extension: string): AttachmentKind => (
  MEDIA_ATTACHMENT_EXTENSIONS.has(extension) ? 'media' : 'file'
);

const MessageComposer = ({
  value,
  replyingTo,
  showEmojiPicker,
  isSending,
  isSendError,
  sendDisabledReason,
  resetToken = 0,
  emojiPickerRef,
  onChange,
  onKeyDown,
  onSend,
  onToggleEmojiPicker,
  onAppendEmoji,
  onCancelReply,
}: MessageComposerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<ComposerAttachmentDraft[]>([]);
  const attachmentsRef = useRef<ComposerAttachmentDraft[]>([]);
  const [attachmentErrors, setAttachmentErrors] = useState<string[]>([]);
  const trimmedValue = value.trim();
  const isMessageTooLong = trimmedValue.length > MAX_MESSAGE_TEXT_LENGTH;
  const hasValidAttachments = attachments.length > 0 && attachmentErrors.length === 0;
  const composerStatusId = 'composer-status-message';
  const currentDisabledReason = sendDisabledReason ??
    (isMessageTooLong ? `Message exceeds maximum length of ${MAX_MESSAGE_TEXT_LENGTH} characters.` : null);
  const isDisabledByState = Boolean(sendDisabledReason) || isSending;
  const canSend = !isDisabledByState && !isMessageTooLong && attachmentErrors.length === 0 && (Boolean(trimmedValue) || hasValidAttachments);

  const payload = useMemo<ComposerSendPayload>(() => ({
    text: value,
    attachments,
  }), [attachments, value]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment.localPreviewUrl) {
          URL.revokeObjectURL(attachment.localPreviewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    setAttachments((currentAttachments) => {
      currentAttachments.forEach((attachment) => {
        if (attachment.localPreviewUrl) {
          URL.revokeObjectURL(attachment.localPreviewUrl);
        }
      });
      return [];
    });
    setAttachmentErrors([]);
  }, [resetToken]);

  const validateAndAddFiles = (files: File[]) => {
    const nextErrors: string[] = [];
    const remainingSlots = MAX_ATTACHMENTS_PER_MESSAGE - attachments.length;

    if (files.length > remainingSlots) {
      nextErrors.push(`Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments allowed per message.`);
    }

    const acceptedFiles = files.slice(0, Math.max(remainingSlots, 0)).reduce<ComposerAttachmentDraft[]>((drafts, file) => {
      const displayName = sanitizeAttachmentDisplayName(file.name);

      if (!displayName) {
        nextErrors.push('Attachment filename is invalid.');
        return drafts;
      }

      if (file.size <= 0) {
        nextErrors.push(`${displayName} is empty.`);
        return drafts;
      }

      if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
        nextErrors.push(`${displayName} exceeds the 10 MB attachment limit.`);
        return drafts;
      }

      const extension = getExtension(displayName);

      if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
        nextErrors.push(`${displayName} has an unsupported file type.`);
        return drafts;
      }

      const kind = getAttachmentKind(extension);
      const localPreviewUrl = kind === 'media' && typeof URL !== 'undefined' && 'createObjectURL' in URL
        ? URL.createObjectURL(file)
        : undefined;

      drafts.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        displayName,
        mimeType: file.type || (extension === 'txt' ? 'text/plain' : 'application/octet-stream'),
        size: file.size,
        kind,
        localPreviewUrl,
      });

      return drafts;
    }, []);

    setAttachments((currentAttachments) => [...currentAttachments, ...acceptedFiles]);
    setAttachmentErrors(nextErrors);
  };

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    validateAndAddFiles(files);
    event.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((currentAttachments) => {
      const target = currentAttachments.find((attachment) => attachment.id === id);
      if (target?.localPreviewUrl) {
        URL.revokeObjectURL(target.localPreviewUrl);
      }

      return currentAttachments.filter((attachment) => attachment.id !== id);
    });
    setAttachmentErrors([]);
  };

  const handleSend = () => {
    if (!canSend) {
      return;
    }

    onSend(payload);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    onKeyDown(event, payload);
  };

  return (
    <div className="composer-dock relative z-20 w-full max-w-full overflow-visible border-t border-[var(--chat-border)] bg-[var(--chat-panel)] px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:px-8">
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

      <AttachmentTray
        attachments={attachments}
        errors={attachmentErrors}
        disabled={isDisabledByState}
        onRemove={handleRemoveAttachment}
      />

      <div className="mx-auto flex max-w-[880px] items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="Attach file"
          onChange={handleAttachmentChange}
          accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.docx,.xlsx"
          disabled={isDisabledByState}
        />
        <button
          type="button"
          className="grid h-12 w-12 shrink-0 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] md:h-10 md:w-10"
          aria-label="Attach file"
          disabled={isDisabledByState}
          title="Attach file"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip aria-hidden="true" className="h-6 w-6 md:h-5 md:w-5" />
        </button>

        <div className="min-w-0 flex-1 rounded-[var(--chat-radius-pill)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] focus-within:border-[var(--chat-focus)] focus-within:ring-2 focus-within:ring-[var(--chat-focus)]/25">
          <textarea
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
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
            <div data-testid="composer-emoji-picker-layer" className="absolute bottom-full right-0 z-[70] mb-3">
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
          onClick={handleSend}
          disabled={!canSend}
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
