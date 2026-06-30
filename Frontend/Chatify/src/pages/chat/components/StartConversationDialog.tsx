import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { Check, Clock, LoaderCircle, Plus, RefreshCw, X } from 'lucide-react';
import type { User } from '../../../types/auth';
import type { ContactRequest, ContactRequestsData } from '../../../types/chat';
import UserAvatar from './UserAvatar';

interface StartConversationDialogProps {
  isOpen: boolean;
  contacts: User[] | undefined;
  contactRequests?: ContactRequestsData;
  isLoading: boolean;
  isError: boolean;
  isLoadingContactRequests?: boolean;
  isContactRequestsError?: boolean;
  isCreatingChat: boolean;
  isUpdatingContactRequest?: boolean;
  onlineUsers: Map<string, { isOnline: boolean }>;
  openerRef?: RefObject<HTMLButtonElement | null>;
  onSelectContact: (username: string) => void;
  onAcceptContactRequest?: (requestId: string) => void;
  onDeclineContactRequest?: (requestId: string) => void;
  onCancelContactRequest?: (requestId: string) => void;
  onStartNewChat: () => void;
  onRetry: () => void;
  onRetryContactRequests?: () => void;
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

const getRequestPeer = (request: ContactRequest) => (
  request.direction === 'incoming' ? request.requester : request.recipient
);

const ContactRequestItem = ({
  request,
  isUpdating,
  onAccept,
  onDecline,
  onCancel,
}: {
  request: ContactRequest;
  isUpdating: boolean;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onCancel: (requestId: string) => void;
}) => {
  const peer = getRequestPeer(request);
  const peerName = getContactName(peer);
  const isIncoming = request.direction === 'incoming';

  return (
    <li className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] p-3">
      <div className="flex items-start gap-3">
        <UserAvatar user={peer} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--chat-text)]">{peerName}</p>
          {peer.username ? (
            <p className="mt-0.5 truncate text-xs text-[var(--chat-text-muted)]">@{peer.username}</p>
          ) : null}
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--chat-text-soft)]">
            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            {isIncoming ? 'Wants to start a private chat' : 'Waiting for approval'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {isIncoming ? (
          <>
            <button
              type="button"
              onClick={() => onDecline(request._id)}
              disabled={isUpdating}
              className="min-h-9 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-1.5 text-xs font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => onAccept(request._id)}
              disabled={isUpdating}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check aria-hidden="true" className="h-3.5 w-3.5" />
              Accept
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onCancel(request._id)}
            disabled={isUpdating}
            className="min-h-9 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-1.5 text-xs font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel request
          </button>
        )}
      </div>
    </li>
  );
};

const StartConversationDialog = ({
  isOpen,
  contacts,
  contactRequests,
  isLoading,
  isError,
  isLoadingContactRequests = false,
  isContactRequestsError = false,
  isCreatingChat,
  isUpdatingContactRequest = false,
  onlineUsers,
  openerRef,
  onSelectContact,
  onAcceptContactRequest = () => undefined,
  onDeclineContactRequest = () => undefined,
  onCancelContactRequest = () => undefined,
  onStartNewChat,
  onRetry,
  onRetryContactRequests = () => undefined,
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
  const incomingRequests = contactRequests?.incoming ?? [];
  const outgoingRequests = contactRequests?.outgoing ?? [];
  const hasContactRequests = incomingRequests.length > 0 || outgoingRequests.length > 0;

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
          {isLoadingContactRequests ? (
            <div className="border-b border-[var(--chat-border)] p-4 text-sm text-[var(--chat-text-muted)]" role="status">
              Loading contact requests...
            </div>
          ) : isContactRequestsError ? (
            <div className="space-y-3 border-b border-[var(--chat-border)] p-4 text-sm text-[var(--chat-danger)]" role="alert">
              <div>
                <p className="font-semibold text-[var(--chat-text)]">Requests unavailable</p>
                <p className="mt-1 text-[var(--chat-danger)]">We could not load contact requests.</p>
              </div>
              <button
                type="button"
                onClick={onRetryContactRequests}
                className="inline-flex min-h-9 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent-soft)] px-3 py-1 text-sm font-semibold text-[var(--chat-accent)] hover:bg-[var(--chat-panel-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : hasContactRequests ? (
            <section className="border-b border-[var(--chat-border)] p-4" aria-labelledby="contact-requests-title">
              <h3 id="contact-requests-title" className="text-xs font-semibold uppercase tracking-wide text-[var(--chat-text-soft)]">
                Requests
              </h3>
              <ul className="mt-3 space-y-2">
                {incomingRequests.map((request) => (
                  <ContactRequestItem
                    key={request._id}
                    request={request}
                    isUpdating={isUpdatingContactRequest}
                    onAccept={onAcceptContactRequest}
                    onDecline={onDeclineContactRequest}
                    onCancel={onCancelContactRequest}
                  />
                ))}
                {outgoingRequests.map((request) => (
                  <ContactRequestItem
                    key={request._id}
                    request={request}
                    isUpdating={isUpdatingContactRequest}
                    onAccept={onAcceptContactRequest}
                    onDecline={onDeclineContactRequest}
                    onCancel={onCancelContactRequest}
                  />
                ))}
              </ul>
            </section>
          ) : null}
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
                      aria-label={`Request or open conversation with ${contactName}`}
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
