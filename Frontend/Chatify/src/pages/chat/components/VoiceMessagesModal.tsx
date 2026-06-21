import { LoaderCircle, Mic, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { SharedAsset } from '../../../types/chat';
import VoiceMessagePlayer from './VoiceMessagePlayer';

interface VoiceMessagesModalProps {
  isOpen: boolean;
  assets: SharedAsset[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
  onClose: () => void;
  onJumpToMessage: (messageId: string) => void;
}

const VoiceMessagesModal = ({
  isOpen,
  assets,
  isLoading,
  isError,
  hasMore,
  isFetchingMore,
  onLoadMore,
  onClose,
  onJumpToMessage,
}: VoiceMessagesModalProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Voice messages"
    >
      <button
        type="button"
        aria-label="Close voice messages backdrop"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="relative z-10 flex h-full max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[var(--chat-radius-lg)] border border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] shadow-[var(--chat-shadow)]">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--chat-border)] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] bg-[var(--chat-panel-subtle)] text-[var(--chat-accent)]">
              <Mic aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold">Voice messages</h2>
              <p className="text-xs text-[var(--chat-text-muted)]">
                {assets.length} loaded
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Close voice messages"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--chat-bg)] px-4 py-4">
          {isLoading ? (
            <VoiceMessagesState tone="neutral">Loading voice messages</VoiceMessagesState>
          ) : isError ? (
            <VoiceMessagesState tone="danger">Voice messages unavailable</VoiceMessagesState>
          ) : assets.length === 0 ? (
            <VoiceMessagesState tone="neutral">No voice messages</VoiceMessagesState>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => (
                <article
                  key={asset.attachmentId}
                  className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] p-3"
                >
                  <VoiceMessagePlayer attachment={asset} compact />
                  <button
                    type="button"
                    onClick={() => onJumpToMessage(asset.messageId)}
                    className="mt-2 w-full cursor-pointer rounded-[var(--chat-radius-md)] px-2 py-2 text-sm font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                    aria-label={`Jump to ${asset.displayName}`}
                  >
                    Jump
                  </button>
                </article>
              ))}
              {hasMore && (
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isFetchingMore}
                  className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel)] px-3 py-2 text-sm font-semibold text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] disabled:cursor-not-allowed disabled:text-[var(--chat-text-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                >
                  {isFetchingMore && <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />}
                  {isFetchingMore ? 'Loading...' : 'Load older voice messages'}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const VoiceMessagesState = ({
  children,
  tone,
}: {
  children: string;
  tone: 'neutral' | 'danger';
}) => (
  <p
    className={`rounded-[var(--chat-radius-md)] border border-dashed px-3 py-3 text-sm ${
      tone === 'danger'
        ? 'border-[color-mix(in_srgb,var(--chat-danger)_45%,var(--chat-border))] bg-[color-mix(in_srgb,var(--chat-danger)_8%,var(--chat-panel))] text-[var(--chat-danger)]'
        : 'border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] text-[var(--chat-text-muted)]'
    }`}
  >
    {children}
  </p>
);

export default VoiceMessagesModal;
