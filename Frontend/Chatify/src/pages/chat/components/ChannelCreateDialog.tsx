import { useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { Hash, LoaderCircle, X } from 'lucide-react';
import type { CreateSpaceChannelPayload } from '../../../types/space';

interface ChannelCreateDialogProps {
  isOpen: boolean;
  error: string | null;
  isSubmitting: boolean;
  openerRef: RefObject<HTMLButtonElement | null>;
  onSubmit: (payload: CreateSpaceChannelPayload) => void;
  onClearError: () => void;
  onClose: () => void;
}

const CHANNEL_NAME_REQUIRED_COPY = 'Enter a channel name.';
const normalizePlainText = (value: string) => value.trim().replace(/\s+/g, ' ');

const ChannelCreateDialog = ({
  isOpen,
  error,
  isSubmitting,
  openerRef,
  onSubmit,
  onClearError,
  onClose,
}: ChannelCreateDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const activeError = localError ?? error;

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setLocalError(null);
      return;
    }

    nameInputRef.current?.focus();

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
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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

  const clearErrors = () => {
    setLocalError(null);
    onClearError();
  };

  const closeDialog = () => {
    onClose();
    window.requestAnimationFrame(() => openerRef.current?.focus());
  };

  const submitChannel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = normalizePlainText(name);
    const normalizedDescription = normalizePlainText(description);

    if (normalizedName.length < 2) {
      setLocalError(CHANNEL_NAME_REQUIRED_COPY);
      return;
    }

    onSubmit({
      name: normalizedName,
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close create channel dialog"
        onClick={closeDialog}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-channel-title"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-lg border border-[var(--chat-border)] bg-[var(--chat-panel)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="create-channel-title" className="text-base font-bold text-[var(--chat-text)]">Create channel</h2>
            <p className="mt-1 text-sm text-[var(--chat-text-muted)]">Add a focused room inside this space.</p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Close create channel dialog"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submitChannel} className="space-y-3" noValidate>
          <div className="space-y-2">
            <label htmlFor="channel-name" className="text-xs font-semibold text-[var(--chat-text-muted)]">
              Channel name
            </label>
            <div className="relative">
              <Hash aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--chat-text-soft)]" />
              <input
                ref={nameInputRef}
                id="channel-name"
                name="name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  clearErrors();
                }}
                maxLength={40}
                className="w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--chat-text)] placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                placeholder="announcements"
                autoComplete="off"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="channel-description" className="text-xs font-semibold text-[var(--chat-text-muted)]">
              Description
            </label>
            <textarea
              id="channel-description"
              name="description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                clearErrors();
              }}
              maxLength={160}
              rows={3}
              className="max-h-28 min-h-20 w-full resize-none rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm text-[var(--chat-text)] placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              placeholder="Updates and handoffs"
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
                  Creating...
                </span>
              ) : (
                'Create channel'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChannelCreateDialog;
