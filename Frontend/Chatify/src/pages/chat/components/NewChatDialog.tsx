import { useEffect, useRef } from 'react';
import type { FormEvent, RefObject } from 'react';
import { LoaderCircle, X } from 'lucide-react';

interface NewChatDialogProps {
  isOpen: boolean;
  email: string;
  error: string | null;
  isSubmitting: boolean;
  openerRef: RefObject<HTMLButtonElement | null>;
  onEmailChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}

const NewChatDialog = ({
  isOpen,
  email,
  error,
  isSubmitting,
  openerRef,
  onEmailChange,
  onSubmit,
  onClose,
}: NewChatDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    inputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        window.requestAnimationFrame(() => openerRef.current?.focus());
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, openerRef]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close new chat dialog"
        onClick={() => {
          onClose();
          window.requestAnimationFrame(() => openerRef.current?.focus());
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
        className="relative w-full max-w-sm rounded-lg border border-[#2E363C] bg-[#20262B] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="new-chat-title" className="text-base font-bold text-[#F4F7F6]">New chat</h2>
            <p className="mt-1 text-sm text-[#A8B3AF]">Start or continue a private chat by exact email.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              window.requestAnimationFrame(() => openerRef.current?.focus());
            }}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#A8B3AF] hover:bg-[#181C20] hover:text-[#F4F7F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
            aria-label="Close new chat dialog"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <label htmlFor="new-chat-email" className="text-xs font-semibold text-[#A8B3AF]">
            Email address
          </label>
          <input
            ref={inputRef}
            id="new-chat-email"
            name="targetEmail"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            className="w-full rounded-lg border border-[#2E363C] bg-[#101113] px-3 py-2 text-sm text-[#F4F7F6] placeholder:text-[#6F7B77] focus:border-[#14B8A6] focus:outline-none focus:ring-1 focus:ring-[#14B8A6]"
            placeholder="friend@example.com"
            required
            autoComplete="email"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'new-chat-error' : undefined}
          />
          {error ? <p id="new-chat-error" className="text-xs text-[#EF4444]" role="alert">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                window.requestAnimationFrame(() => openerRef.current?.focus());
              }}
              className="min-h-10 cursor-pointer rounded-lg border border-[#2E363C] px-3 py-2 text-sm font-semibold text-[#A8B3AF] hover:bg-[#181C20]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-10 cursor-pointer rounded-lg bg-[#14B8A6] px-3 py-2 text-sm font-semibold text-[#101113] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                  Starting...
                </span>
              ) : (
                'Start or continue chat'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewChatDialog;
