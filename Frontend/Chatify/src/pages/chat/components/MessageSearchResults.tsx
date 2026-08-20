import { LoaderCircle, X } from 'lucide-react';
import type { Chat, Message } from '../../../types/chat';
import { formatTimestamp } from '../utils/chatDisplay';
import { isEncryptedConversation } from '../../../utils/encryptedMessages';

interface MessageSearchResultsProps {
  query: string;
  selectedChat: Chat;
  currentUserId?: string;
  messages: Message[];
  loadedMessageIds: ReadonlySet<string>;
  isLoading: boolean;
  isError: boolean;
  isBelowMinimum: boolean;
  jumpingMessageId?: string | null;
  onClear: () => void;
  onSelectResult: (message: Message) => void;
}

const normalizeQuery = (query: string) => query.trim().toLowerCase();

const MessageSearchResults = ({
  query,
  selectedChat,
  currentUserId,
  messages,
  loadedMessageIds,
  isLoading,
  isError,
  isBelowMinimum,
  jumpingMessageId = null,
  onClear,
  onSelectResult,
}: MessageSearchResultsProps) => {
  const normalizedQuery = normalizeQuery(query);
  const statusText = getSearchStatusText({ isBelowMinimum, isLoading, isError, count: messages.length });
  const encryptedConversation = isEncryptedConversation(selectedChat);

  const getSenderLabel = (message: Message) => {
    if (message.sender === currentUserId) {
      return 'You';
    }

    const sender = selectedChat.members.find((member) => member._id === message.sender);
    return sender ? `${sender.firstName} ${sender.lastName ?? ''}`.trim() : 'Unknown sender';
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-[var(--chat-bg)] px-4 py-4 md:px-8" aria-label="Message search results">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-[var(--chat-text-soft)]" aria-live="polite">
          {statusText}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-8 items-center gap-2 rounded-[var(--chat-radius-md)] border border-[var(--chat-border)] px-3 py-1 text-xs font-semibold text-[var(--chat-text-muted)] hover:bg-[var(--chat-panel-subtle)] hover:text-[var(--chat-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chat-focus)]"
          aria-label="Clear search"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Clear search
        </button>
      </div>

      {encryptedConversation ? (
        <div className="space-y-1 text-sm" role="status">
          <p className="font-semibold text-[var(--chat-text)]">Search unavailable for encrypted conversations</p>
          <p className="text-[var(--chat-text-muted)]">Server-side search cannot read encrypted message text on this conversation.</p>
        </div>
      ) : isBelowMinimum ? (
        <div className="space-y-1 text-sm" role="status">
          <p className="font-semibold text-[var(--chat-text)]">Keep typing</p>
          <p className="text-[var(--chat-text-muted)]">Type at least 2 characters to search this conversation.</p>
        </div>
      ) : isLoading ? (
        <p className="inline-flex items-center gap-2 text-sm text-[var(--chat-text-muted)]" role="status">
          <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
          Searching messages...
        </p>
      ) : isError ? (
        <div className="space-y-1 text-sm" role="alert">
          <p className="font-semibold text-[var(--chat-danger)]">Search unavailable</p>
          <p className="text-[var(--chat-danger)]">We could not search messages. Check the connection or clear search to return to the conversation.</p>
        </div>
      ) : messages.length > 0 ? (
        <ul className="-mx-4 divide-y divide-[var(--chat-border)] border-y border-[var(--chat-border)] md:-mx-8">
          {messages.map((message) => {
            const isLoaded = loadedMessageIds.has(message._id);
            const isJumping = jumpingMessageId === message._id;
            const senderLabel = getSenderLabel(message);
            const timestampLabel = formatTimestamp(message.createdAt);
            const ariaLabel = `Jump to message from ${senderLabel} at ${timestampLabel}: ${message.text}`;
            const matchLabel = getMatchLabel(message);
            const metadata = (
              <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-[var(--chat-text-soft)]">
                <span className="truncate font-semibold text-[var(--chat-text-muted)]">{senderLabel}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {matchLabel && (
                    <span className="rounded bg-[var(--chat-panel-subtle)] px-1.5 py-0.5 font-semibold text-[var(--chat-text-muted)]">
                      {matchLabel}
                    </span>
                  )}
                  {isLoaded && (
                    <span className="rounded bg-[var(--chat-accent-soft)] px-1.5 py-0.5 font-semibold text-[var(--chat-accent)]">
                      In view
                    </span>
                  )}
                  <time dateTime={message.createdAt}>{timestampLabel}</time>
                </span>
              </div>
            );

            return (
              <li key={message._id}>
                <button
                  type="button"
                  onClick={() => onSelectResult(message)}
                  disabled={isJumping}
                  className="flex min-h-14 w-full flex-col justify-center px-4 py-3 text-left text-sm text-[var(--chat-text)] hover:bg-[var(--chat-panel-subtle)] disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--chat-focus)] md:px-8"
                  aria-label={ariaLabel}
                >
                  {metadata}
                  <span className="mt-1 leading-5 text-[var(--chat-text)]">
                    <SearchSnippet text={message.text || message.searchMatch?.attachmentName || ''} query={normalizedQuery} />
                  </span>
                  {!isLoaded && (
                    <p className="mt-1 text-xs text-[var(--chat-text-soft)]">
                      {isJumping ? 'Loading message context...' : 'Load and jump to this message.'}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-1 text-sm" role="status">
          <p className="font-semibold text-[var(--chat-text)]">No message matches</p>
          <p className="text-[var(--chat-text-muted)]">Try another word or clear search to return to the conversation.</p>
        </div>
      )}
    </section>
  );
};

const getMatchLabel = (message: Message) => {
  if (message.searchMatch?.attachmentName) {
    return message.searchMatch.attachmentName;
  }

  return message.searchMatch?.label ?? null;
};

const getSearchStatusText = ({
  isBelowMinimum,
  isLoading,
  isError,
  count,
}: {
  isBelowMinimum: boolean;
  isLoading: boolean;
  isError: boolean;
  count: number;
}) => {
  if (isBelowMinimum) {
    return 'Search needs 2 characters';
  }

  if (isLoading) {
    return 'Searching messages...';
  }

  if (isError) {
    return 'Search unavailable';
  }

  return `${count} result${count === 1 ? '' : 's'}`;
};

const SearchSnippet = ({ text, query }: { text: string; query: string }) => {
  if (!query) {
    return <span>{text}</span>;
  }

  const lowerText = text.toLowerCase();
  const matchIndex = lowerText.indexOf(query);

  if (matchIndex === -1) {
    return <span>{text}</span>;
  }

  const before = text.slice(0, matchIndex);
  const match = text.slice(matchIndex, matchIndex + query.length);
  const after = text.slice(matchIndex + query.length);

  return (
    <span>
      {before}
      <mark className="rounded-sm bg-[color-mix(in_srgb,var(--chat-warning)_24%,transparent)] px-0 font-bold text-[var(--chat-text)]">{match}</mark>
      {after}
    </span>
  );
};

export default MessageSearchResults;
