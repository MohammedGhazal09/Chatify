import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { LoaderCircle, Plus, RefreshCw, X } from 'lucide-react';
import type { User } from '../../../types/auth';
import UserAvatar from './UserAvatar';

interface StartConversationDialogProps {
  isOpen: boolean;
  contacts: User[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isCreatingChat: boolean;
  onlineUsers: Map<string, { isOnline: boolean }>;
  openerRef?: RefObject<HTMLButtonElement | null>;
  onSelectContact: (username: string) => void;
  onStartNewChat: () => void;
  onRetry: () => void;
  onClose: () => void;
}

const getContactName = (contact: User) => {
  const displayName = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();
  return displayName || contact.username || 'Chatify user';
};

const ContactsSkeleton = () => (
  <div className="space-y-2 p-2" aria-label="Loading contacts">
    {[0, 1, 2].map((item) => (
      <div key={item} className="flex min-h-14 items-center gap-3 rounded-[var(--chat-radius-md)] px-3">
        <div className="h-10 w-10 motion-safe:animate-pulse rounded-full bg-[var(--chat-panel-subtle)]" />
        <div className="space-y-2">
          <div className={`h-3 motion-safe:animate-pulse rounded bg-[var(--chat-panel-subtle)] ${item === 0 ? 'w-36' : 'w-28'}`} />
          <div className="h-3 w-20 motion-safe:animate-pulse rounded bg-[var(--chat-panel-subtle)]" />
        </div>
      </div>
    ))}
  </div>
);

const StartConversationDialog = ({
  isOpen,
  contacts,
  isLoading,
  isError,
  isCreatingChat,
  onlineUsers,
  openerRef,
  onSelectContact,
  onStartNewChat,
  onRetry,
  onClose,
}: StartConversationDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        window.requestAnimationFrame(() => openerRef?.current?.focus());
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

  const closeDialog = () => {
    onClose();
    window.requestAnimationFrame(() => openerRef?.current?.focus());
  };

  const hasContacts = Boolean(contacts && contacts.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close start conversation dialog"
        onClick={closeDialog}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-conversation-title"
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[var(--chat-border)] bg-[var(--chat-panel)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--chat-border)] p-5">
          <div>
            <h2 id="start-conversation-title" className="text-base font-bold text-[var(--chat-text)]">Start a conversation</h2>
            <p className="mt-1 text-sm text-[var(--chat-text-muted)]">Pick a contact to open a chat, or start a new one.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDialog}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Close start conversation dialog"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto chat-sidebar-scroll">
          {isLoading ? (
            <ContactsSkeleton />
          ) : isError ? (
            <div className="space-y-3 p-4 text-sm text-[var(--chat-danger)]" role="alert">
              <div>
                <p className="font-semibold text-[var(--chat-text)]">Contacts unavailable</p>
                <p className="mt-1 text-[var(--chat-danger)]">We could not load your contacts.</p>
              </div>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex min-h-9 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent-soft)] px-3 py-1 text-sm font-semibold text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : hasContacts ? (
            <ul className="space-y-1 p-2" aria-label="Available contacts">
              {contacts!.map((contact) => {
                const isOnline = onlineUsers.get(contact._id)?.isOnline === true;
                const contactName = getContactName(contact);

                return (
                  <li key={contact._id}>
                    <button
                      type="button"
                      disabled={!contact.username || isCreatingChat}
                      onClick={() => contact.username && onSelectContact(contact.username)}
                      className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[var(--chat-radius-md)] px-3 py-2 text-left transition hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Start conversation with ${contactName}`}
                    >
                      <span className="relative shrink-0">
                        <UserAvatar user={contact} size="sm" />
                        {isOnline ? (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--chat-panel)] bg-[var(--chat-success,#22c55e)]"
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--chat-text)]">{contactName}</span>
                        {contact.username ? (
                          <span className="mt-0.5 block truncate text-xs text-[var(--chat-text-muted)]">@{contact.username}</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs font-medium text-[var(--chat-text-soft)]">
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-[var(--chat-text-muted)]" role="status">
              <div className="space-y-1">
                <p className="font-semibold text-[var(--chat-text)]">No contacts yet</p>
                <p className="max-w-[260px]">Start a new conversation by entering a username.</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--chat-border)] p-4">
          <button
            type="button"
            onClick={onStartNewChat}
            className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-2 text-sm font-semibold text-[var(--chat-own-text)] transition-colors hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          >
            {isCreatingChat ? (
              <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
            ) : (
              <Plus aria-hidden="true" className="h-4 w-4" />
            )}
            New conversation
          </button>
        </div>
      </div>
    </div>
  );
};

export default StartConversationDialog;
