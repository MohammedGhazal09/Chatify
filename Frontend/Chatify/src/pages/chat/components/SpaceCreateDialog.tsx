import { useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { LoaderCircle, Plus, X } from 'lucide-react';
import type { CreateSpacePayload } from '../../../types/space';
import { validateUsername } from '../../../utils/usernameValidation';

interface SpaceCreateDialogProps {
  isOpen: boolean;
  error: string | null;
  isSubmitting: boolean;
  openerRef: RefObject<HTMLButtonElement | null>;
  onSubmit: (payload: CreateSpacePayload) => void;
  onClearError: () => void;
  onClose: () => void;
}

const MAX_SPACE_MEMBERS = 25;
const MAX_INVITED_MEMBERS = MAX_SPACE_MEMBERS - 1;
const SPACE_NAME_REQUIRED_COPY = 'Enter a space name.';
const SPACE_INVALID_USERNAME_COPY = 'Use valid member usernames.';
const SPACE_DUPLICATE_COPY = 'Each member username must be unique.';
const SPACE_MAX_MEMBERS_COPY = 'Spaces can have up to 25 members.';

const normalizePlainText = (value: string) => value.trim().replace(/\s+/g, ' ');

const SpaceCreateDialog = ({
  isOpen,
  error,
  isSubmitting,
  openerRef,
  onSubmit,
  onClearError,
  onClose,
}: SpaceCreateDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const memberInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [memberUsernames, setMemberUsernames] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const activeError = localError ?? error;

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setMemberInput('');
      setMemberUsernames([]);
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

  const addMember = () => {
    const validation = validateUsername(memberInput);

    if (!validation.ok) {
      setLocalError(SPACE_INVALID_USERNAME_COPY);
      return;
    }

    if (memberUsernames.includes(validation.value)) {
      setLocalError(SPACE_DUPLICATE_COPY);
      return;
    }

    if (memberUsernames.length >= MAX_INVITED_MEMBERS) {
      setLocalError(SPACE_MAX_MEMBERS_COPY);
      return;
    }

    setMemberUsernames((current) => [...current, validation.value]);
    setMemberInput('');
    clearErrors();
    window.requestAnimationFrame(() => memberInputRef.current?.focus());
  };

  const removeMember = (username: string) => {
    setMemberUsernames((current) => current.filter((candidate) => candidate !== username));
    clearErrors();
  };

  const submitSpace = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = normalizePlainText(name);
    const normalizedDescription = normalizePlainText(description);

    if (normalizedName.length < 2) {
      setLocalError(SPACE_NAME_REQUIRED_COPY);
      return;
    }

    onSubmit({
      name: normalizedName,
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...(memberUsernames.length > 0 ? { memberUsernames } : {}),
    });
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
        aria-label="Close create space dialog"
        onClick={closeDialog}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-space-title"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-lg border border-[var(--chat-border)] bg-[var(--chat-panel)] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="create-space-title" className="text-base font-bold text-[var(--chat-text)]">Create space</h2>
            <p className="mt-1 text-sm text-[var(--chat-text-muted)]">Build a private workspace with username members.</p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Close create space dialog"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submitSpace} className="space-y-3" noValidate>
          <div className="space-y-2">
            <label htmlFor="space-name" className="text-xs font-semibold text-[var(--chat-text-muted)]">
              Space name
            </label>
            <input
              ref={nameInputRef}
              id="space-name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                clearErrors();
              }}
              maxLength={80}
              className="w-full rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm text-[var(--chat-text)] placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              placeholder="Launch room"
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="space-description" className="text-xs font-semibold text-[var(--chat-text-muted)]">
              Description
            </label>
            <textarea
              id="space-description"
              name="description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                clearErrors();
              }}
              maxLength={240}
              rows={3}
              className="max-h-28 min-h-20 w-full resize-none rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm text-[var(--chat-text)] placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              placeholder="Planning and decisions"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="space-member" className="text-xs font-semibold text-[var(--chat-text-muted)]">
                Member username
              </label>
              <span className="text-xs text-[var(--chat-text-muted)]">{memberUsernames.length + 1}/{MAX_SPACE_MEMBERS} members</span>
            </div>
            <div className="flex gap-2">
              <input
                ref={memberInputRef}
                id="space-member"
                name="memberUsername"
                type="text"
                value={memberInput}
                onChange={(event) => {
                  setMemberInput(event.target.value);
                  clearErrors();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addMember();
                  }
                }}
                className="min-w-0 flex-1 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-input-bg)] px-3 py-2 text-sm text-[var(--chat-text)] placeholder:text-[var(--chat-text-soft)] focus:border-[var(--chat-focus)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                placeholder="alex.morgan"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={addMember}
                disabled={memberUsernames.length >= MAX_INVITED_MEMBERS}
                className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                aria-label="Add space member"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>

          {memberUsernames.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-label="Selected space members">
              {memberUsernames.map((username) => (
                <span
                  key={username}
                  className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[var(--chat-border)] bg-[var(--chat-panel-subtle)] px-3 py-1 text-xs font-semibold text-[var(--chat-text)]"
                >
                  {username}
                  <button
                    type="button"
                    onClick={() => removeMember(username)}
                    className="grid h-5 w-5 cursor-pointer place-items-center rounded-full text-[var(--chat-text-muted)] hover:bg-[var(--chat-border)] hover:text-[var(--chat-text)]"
                    aria-label={`Remove ${username}`}
                  >
                    <X aria-hidden="true" className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

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
                'Create space'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpaceCreateDialog;
