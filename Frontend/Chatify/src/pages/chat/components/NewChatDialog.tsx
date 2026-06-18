import { useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { LoaderCircle, MessageCircle, Plus, Users, X } from 'lucide-react';
import { validateUsername } from '../../../utils/usernameValidation';
import type { CreateGroupChatPayload } from '../../../types/chat';

interface NewChatDialogProps {
  isOpen: boolean;
  username: string;
  error: string | null;
  isSubmitting: boolean;
  isGroupSubmitting: boolean;
  openerRef: RefObject<HTMLButtonElement | null>;
  onUsernameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCreateGroupSubmit: (payload: CreateGroupChatPayload) => void;
  onClearError: () => void;
  onClose: () => void;
}

type ConversationMode = 'direct' | 'group';

const MAX_GROUP_MEMBERS = 10;
const MAX_GROUP_SELECTED_MEMBERS = MAX_GROUP_MEMBERS - 1;
const MIN_GROUP_SELECTED_MEMBERS = 2;
const GROUP_NAME_REQUIRED_COPY = 'Enter a group name.';
const GROUP_MIN_MEMBERS_COPY = 'Add at least two other members.';
const GROUP_MAX_MEMBERS_COPY = 'Groups can have up to 10 members.';
const GROUP_DUPLICATE_COPY = 'Each member username must be unique.';
const GROUP_INVALID_USERNAME_COPY = 'Use valid member usernames.';

const NewChatDialog = ({
  isOpen,
  username,
  error,
  isSubmitting,
  isGroupSubmitting,
  openerRef,
  onUsernameChange,
  onSubmit,
  onCreateGroupSubmit,
  onClearError,
  onClose,
}: NewChatDialogProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const groupNameRef = useRef<HTMLInputElement>(null);
  const memberInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ConversationMode>('direct');
  const [groupName, setGroupName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [memberUsernames, setMemberUsernames] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const activeError = localError ?? error;
  const memberCount = memberUsernames.length + 1;
  const isActiveSubmitting = mode === 'direct' ? isSubmitting : isGroupSubmitting;

  useEffect(() => {
    if (!isOpen) {
      setMode('direct');
      setGroupName('');
      setMemberInput('');
      setMemberUsernames([]);
      setLocalError(null);
      return;
    }

    if (mode === 'direct') {
      inputRef.current?.focus();
    } else {
      groupNameRef.current?.focus();
    }

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
  }, [isOpen, mode, onClose, openerRef]);

  if (!isOpen) {
    return null;
  }

  const setConversationMode = (nextMode: ConversationMode) => {
    setMode(nextMode);
    setLocalError(null);
    onClearError();
  };

  const addGroupMember = () => {
    const validation = validateUsername(memberInput);
    const directUsernameValidation = validateUsername(username);

    if (!validation.ok) {
      setLocalError(GROUP_INVALID_USERNAME_COPY);
      return;
    }

    if (
      memberUsernames.includes(validation.value) ||
      (directUsernameValidation.ok && validation.value === directUsernameValidation.value)
    ) {
      setLocalError(GROUP_DUPLICATE_COPY);
      return;
    }

    if (memberUsernames.length >= MAX_GROUP_SELECTED_MEMBERS) {
      setLocalError(GROUP_MAX_MEMBERS_COPY);
      return;
    }

    setMemberUsernames((current) => [...current, validation.value]);
    setMemberInput('');
    setLocalError(null);
    onClearError();
    window.requestAnimationFrame(() => memberInputRef.current?.focus());
  };

  const removeGroupMember = (memberUsername: string) => {
    setMemberUsernames((current) => current.filter((candidate) => candidate !== memberUsername));
    setLocalError(null);
    onClearError();
  };

  const submitGroup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedGroupName = groupName.trim().replace(/\s+/g, ' ');

    if (!normalizedGroupName || normalizedGroupName.length < 2) {
      setLocalError(GROUP_NAME_REQUIRED_COPY);
      return;
    }

    if (memberUsernames.length < MIN_GROUP_SELECTED_MEMBERS) {
      setLocalError(GROUP_MIN_MEMBERS_COPY);
      return;
    }

    if (memberUsernames.length > MAX_GROUP_SELECTED_MEMBERS) {
      setLocalError(GROUP_MAX_MEMBERS_COPY);
      return;
    }

    setLocalError(null);
    onCreateGroupSubmit({
      chatName: normalizedGroupName,
      memberUsernames,
    });
  };

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
            <p className="mt-1 text-sm text-[#A8B3AF]">
              {mode === 'direct'
                ? 'Start or continue a private chat by username.'
                : 'Create a private group by username.'}
            </p>
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
        <div className="mb-4 grid grid-cols-2 gap-2" role="group" aria-label="Conversation type">
          <button
            type="button"
            onClick={() => setConversationMode('direct')}
            aria-pressed={mode === 'direct'}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
              mode === 'direct'
                ? 'border-[#14B8A6] bg-[#14B8A6] text-[#101113]'
                : 'border-[#2E363C] bg-[#181C20] text-[#A8B3AF] hover:text-[#F4F7F6]'
            }`}
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            Direct
          </button>
          <button
            type="button"
            onClick={() => setConversationMode('group')}
            aria-pressed={mode === 'group'}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
              mode === 'group'
                ? 'border-[#14B8A6] bg-[#14B8A6] text-[#101113]'
                : 'border-[#2E363C] bg-[#181C20] text-[#A8B3AF] hover:text-[#F4F7F6]'
            }`}
          >
            <Users aria-hidden="true" className="h-4 w-4" />
            Group
          </button>
        </div>

        {mode === 'direct' ? (
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <label htmlFor="new-chat-username" className="text-xs font-semibold text-[#A8B3AF]">
            Username
          </label>
          <input
            ref={inputRef}
            id="new-chat-username"
            name="targetUsername"
            type="text"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            className="w-full rounded-lg border border-[#2E363C] bg-[#101113] px-3 py-2 text-sm text-[#F4F7F6] placeholder:text-[#6F7B77] focus:border-[#14B8A6] focus:outline-none focus:ring-1 focus:ring-[#14B8A6]"
            placeholder="alex.morgan"
            required
            autoComplete="off"
            spellCheck={false}
            aria-invalid={activeError ? 'true' : 'false'}
            aria-describedby={activeError ? 'new-chat-error' : undefined}
          />
          {activeError ? <p id="new-chat-error" className="text-xs text-[#EF4444]" role="alert">{activeError}</p> : null}
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
              disabled={isActiveSubmitting}
              className="min-h-10 cursor-pointer rounded-lg bg-[#14B8A6] px-3 py-2 text-sm font-semibold text-[#101113] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isActiveSubmitting ? (
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
        ) : (
        <form onSubmit={submitGroup} className="space-y-3" noValidate>
          <div className="space-y-2">
            <label htmlFor="new-group-name" className="text-xs font-semibold text-[#A8B3AF]">
              Group name
            </label>
            <input
              ref={groupNameRef}
              id="new-group-name"
              name="chatName"
              type="text"
              value={groupName}
              onChange={(event) => {
                setGroupName(event.target.value);
                setLocalError(null);
                onClearError();
              }}
              className="w-full rounded-lg border border-[#2E363C] bg-[#101113] px-3 py-2 text-sm text-[#F4F7F6] placeholder:text-[#6F7B77] focus:border-[#14B8A6] focus:outline-none focus:ring-1 focus:ring-[#14B8A6]"
              placeholder="Project relay"
              maxLength={60}
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="new-group-member" className="text-xs font-semibold text-[#A8B3AF]">
                Member username
              </label>
              <span className="text-xs text-[#A8B3AF]">{memberCount}/{MAX_GROUP_MEMBERS} members</span>
            </div>
            <div className="flex gap-2">
              <input
                ref={memberInputRef}
                id="new-group-member"
                name="memberUsername"
                type="text"
                value={memberInput}
                onChange={(event) => {
                  setMemberInput(event.target.value);
                  setLocalError(null);
                  onClearError();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addGroupMember();
                  }
                }}
                className="min-w-0 flex-1 rounded-lg border border-[#2E363C] bg-[#101113] px-3 py-2 text-sm text-[#F4F7F6] placeholder:text-[#6F7B77] focus:border-[#14B8A6] focus:outline-none focus:ring-1 focus:ring-[#14B8A6]"
                placeholder="alex.morgan"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={addGroupMember}
                disabled={memberUsernames.length >= MAX_GROUP_SELECTED_MEMBERS}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#2E363C] text-[#A8B3AF] hover:bg-[#181C20] hover:text-[#F4F7F6] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Add group member"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>

          {memberUsernames.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-label="Selected group members">
              {memberUsernames.map((memberUsername) => (
                <span
                  key={memberUsername}
                  className="inline-flex min-h-8 items-center gap-2 rounded-full border border-[#2E363C] bg-[#181C20] px-3 py-1 text-xs font-semibold text-[#F4F7F6]"
                >
                  {memberUsername}
                  <button
                    type="button"
                    onClick={() => removeGroupMember(memberUsername)}
                    className="grid h-5 w-5 place-items-center rounded-full text-[#A8B3AF] hover:bg-[#2E363C] hover:text-[#F4F7F6]"
                    aria-label={`Remove ${memberUsername}`}
                  >
                    <X aria-hidden="true" className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {activeError ? <p id="new-chat-error" className="text-xs text-[#EF4444]" role="alert">{activeError}</p> : null}

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
              disabled={isActiveSubmitting}
              className="min-h-10 cursor-pointer rounded-lg bg-[#14B8A6] px-3 py-2 text-sm font-semibold text-[#101113] transition-colors hover:bg-[#22C55E] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isActiveSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create group'
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default NewChatDialog;
