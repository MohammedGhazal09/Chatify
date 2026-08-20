import { useEffect, useRef, useState } from 'react';
import { Bookmark, LoaderCircle, MessageCircle, RefreshCw, Trash2, X } from 'lucide-react';
import type { SavedMessage } from '../../../types/chat';
import { useSavedMessages, useUnsaveMessage } from '../../../hooks/useChatQueries';
import { isEncryptedMessage } from '../../../utils/encryptedMessages';
import { getChatTitle } from '../utils/chatDisplay';

interface SavedMessagesDialogProps {
  isOpen: boolean;
  currentUserId?: string;
  onClose: () => void;
  onJumpToMessage: (savedMessage: SavedMessage) => void;
}

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Saved';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Saved';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const getSenderLabel = (savedMessage: SavedMessage) => {
  const sender = savedMessage.chat.members.find((member) => member._id === savedMessage.message.sender);

  if (!sender) {
    return 'Unknown sender';
  }

  const displayName = `${sender.firstName ?? ''} ${sender.lastName ?? ''}`.trim();
  return displayName || sender.username || 'Unknown sender';
};

const getSavedPreview = (savedMessage: SavedMessage) => {
  const { message } = savedMessage;

  if (message.deletedForEveryone) {
    return 'Message unavailable';
  }

  if (isEncryptedMessage(message)) {
    return 'Encrypted message';
  }

  const text = message.text.trim().replace(/\s+/g, ' ');

  if (text) {
    return text;
  }

  const attachments = message.attachments ?? [];

  if (attachments.length === 0) {
    return 'Message';
  }

  const firstKind = attachments[0]?.kind;

  if (firstKind === 'voice') {
    return attachments.length === 1 ? 'Voice message' : `${attachments.length} voice messages`;
  }

  if (firstKind === 'media') {
    return attachments.length === 1 ? 'Media attachment' : `${attachments.length} media attachments`;
  }

  if (firstKind === 'file') {
    return attachments.length === 1 ? attachments[0]?.displayName || 'File attachment' : `${attachments.length} file attachments`;
  }

  return attachments.length === 1 ? 'Attachment' : `${attachments.length} attachments`;
};

const SavedMessagesDialog = ({
  isOpen,
  currentUserId,
  onClose,
  onJumpToMessage,
}: SavedMessagesDialogProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const savedMessagesQuery = useSavedMessages(isOpen);
  const unsaveMessage = useUnsaveMessage();
  const savedMessages = savedMessagesQuery.data ?? [];
  const [pendingUnsaveId, setPendingUnsaveId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPendingUnsaveId(null);
      setActionError(null);
      return undefined;
    }

    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleUnsave = (savedMessage: SavedMessage) => {
    setPendingUnsaveId(savedMessage.messageId);
    setActionError(null);
    unsaveMessage.mutate(
      { messageId: savedMessage.messageId, chatId: savedMessage.chatId },
      {
        onError: () => {
          setActionError('Could not unsave that message.');
        },
        onSettled: () => {
          setPendingUnsaveId((currentId) => currentId === savedMessage.messageId ? null : currentId);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-3 py-4" role="presentation" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-messages-title"
        className="flex max-h-[min(720px,92vh)] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--chat-radius-lg)] border border-[var(--chat-border)] bg-[var(--chat-panel)] text-[var(--chat-text)] shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--chat-border)] px-4 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Bookmark aria-hidden="true" className="h-4 w-4 text-[var(--chat-accent)]" />
              <h2 id="saved-messages-title" className="text-base font-semibold text-[var(--chat-text)]">Saved messages</h2>
            </div>
            <p className="mt-1 text-xs text-[var(--chat-text-muted)]">
              {savedMessagesQuery.isSuccess ? `${savedMessages.length} saved` : 'Personal bookmarks'}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--chat-radius-md)] text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
            aria-label="Close saved messages"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {savedMessagesQuery.isLoading ? (
            <div className="space-y-2" aria-label="Loading saved messages">
              {[0, 1, 2].map((item) => (
                <div key={item} className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] p-3">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--chat-panel-subtle)]" />
                  <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-[var(--chat-panel-subtle)]" />
                </div>
              ))}
            </div>
          ) : savedMessagesQuery.isError ? (
            <div className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] p-4 text-sm" role="alert">
              <p className="font-semibold text-[var(--chat-text)]">Saved messages unavailable.</p>
              <button
                type="button"
                onClick={() => savedMessagesQuery.refetch()}
                className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 text-sm font-semibold text-[var(--chat-own-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Try again
              </button>
            </div>
          ) : savedMessages.length === 0 ? (
            <div className="rounded-[var(--chat-radius-md)] border border-dashed border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] p-5 text-center">
              <p className="font-semibold text-[var(--chat-text)]">No saved messages</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--chat-text-muted)]">
                Save a message from its actions when you want to find it later.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {savedMessages.map((savedMessage) => {
                const isUnsavePending = pendingUnsaveId === savedMessage.messageId && unsaveMessage.isPending;
                const conversationTitle = getChatTitle(savedMessage.chat, currentUserId);
                const senderLabel = getSenderLabel(savedMessage);
                const preview = getSavedPreview(savedMessage);
                const metadataParts = senderLabel === conversationTitle
                  ? [conversationTitle, formatDateTime(savedMessage.savedAt)]
                  : [conversationTitle, senderLabel, formatDateTime(savedMessage.savedAt)];

                return (
                  <li
                    key={savedMessage._id}
                    className="rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] bg-[var(--chat-panel-elevated)] p-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-[var(--chat-text)]">{preview}</p>
                      <p className="mt-1 truncate text-xs text-[var(--chat-text-muted)]">
                        {metadataParts.join(' - ')}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onJumpToMessage(savedMessage)}
                        className="inline-flex min-h-9 items-center gap-2 rounded-[var(--chat-radius-md)] bg-[var(--chat-accent)] px-3 text-sm font-semibold text-[var(--chat-own-text)] hover:bg-[var(--chat-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                      >
                        <MessageCircle aria-hidden="true" className="h-4 w-4" />
                        Jump
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnsave(savedMessage)}
                        disabled={isUnsavePending}
                        className="grid min-h-9 min-w-9 place-items-center rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] text-[var(--chat-text-muted)] hover:bg-[color-mix(in_srgb,var(--chat-danger)_12%,transparent)] hover:text-[var(--chat-danger)] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
                        aria-label="Unsave message"
                        title="Unsave message"
                      >
                        {isUnsavePending ? (
                          <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {actionError && (
          <p className="border-t border-[var(--chat-border)] px-4 py-3 text-sm text-[var(--chat-danger)]" role="alert">
            {actionError}
          </p>
        )}
      </div>
    </div>
  );
};

export default SavedMessagesDialog;
