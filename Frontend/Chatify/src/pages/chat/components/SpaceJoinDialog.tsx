import { useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import type { JoinSpacePayload } from '../../../types/space';

interface SpaceJoinDialogProps {
  isOpen: boolean;
  error: string | null;
  isSubmitting: boolean;
  openerRef: RefObject<HTMLButtonElement | null>;
  onSubmit: (payload: JoinSpacePayload) => void;
  onClearError: () => void;
  onClose: () => void;
}

const JOIN_CODE_LENGTH = 8;
const JOIN_CODE_REQUIRED_COPY = 'Enter a valid join code.';

const normalizeJoinCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const SpaceJoinDialog = ({
  isOpen,
  error,
  isSubmitting,
  openerRef,
  onSubmit,
  onClearError,
  onClose,
}: SpaceJoinDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  const [joinCode, setJoinCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const activeError = localError ?? error;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      setJoinCode('');
      setLocalError(null);
      return;
    }

    codeInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        window.requestAnimationFrame(() => openerRef.current?.focus());
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [isOpen, openerRef]);

  if (!isOpen) {
    return null;
  }

  const clearErrors = () => {
    setLocalError(null);
    onClearError();
  };

  const submitJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedCode = normalizeJoinCode(joinCode);

    if (normalizedCode.length !== JOIN_CODE_LENGTH) {
      setLocalError(JOIN_CODE_REQUIRED_COPY);
      return;
    }

    onSubmit({ joinCode: normalizedCode });
  };

  const closeDialog = () => {
    onClose();
    window.requestAnimationFrame(() => openerRef.current?.focus());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close join space dialog"
        onClick={closeDialog}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-space-title"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-lg border border-[var(--chat-border)] bg-[var(--chat-panel)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="join-space-title" className="text-base font-bold text-[var(--chat-text)]">Join a space</h2>
            <p className="mt-1 text-sm text-[var(--chat-text-muted)]">Enter the join code an owner or admin shared with you.</p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Close join space dialog"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submitJoin} className="space-y-3" noValidate>
          <div className="space-y-2">
            <label htmlFor="space-join-code" className="text-xs font-semibold text-[var(--chat-text-muted)]">
              Join code
            </label>
            <input
              ref={codeInputRef}
              id="space-join-code"
              name="joinCode"
              type="text"
              value={joinCode}
              onChange={(event) => {
                setJoinCode(normalizeJoinCode(event.target.value));
                clearErrors();
              }}
              maxLength={JOIN_CODE_LENGTH}
              className="w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-[var(--chat-text)] placeholder:tracking-normal placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              placeholder="ABCD2345"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
            />
          </div>

          {activeError ? <p className="text-xs text-[var(--chat-danger)]" role="alert">{activeError}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={closeDialog}
              className="min-h-10 cursor-pointer rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-2 text-sm font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-10 cursor-pointer rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-2 text-sm font-semibold text-[var(--chat-own-text)] transition-colors hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                  Joining...
                </span>
              ) : (
                'Join space'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpaceJoinDialog;
