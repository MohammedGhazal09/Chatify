import { LoaderCircle, X } from 'lucide-react';
import type { Chat, Message } from '../../../types/chat';
import { formatTimestamp } from '../utils/chatDisplay';

interface MessageSearchResultsProps {
  query: string;
  selectedChat: Chat;
  currentUserId?: string;
  messages: Message[];
  loadedMessageIds: ReadonlySet<string>;
  isLoading: boolean;
  isError: boolean;
  isBelowMinimum: boolean;
  onClear: () => void;
  onSelectLoadedResult: (message: Message) => void;
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
  onClear,
  onSelectLoadedResult,
}: MessageSearchResultsProps) => {
  const normalizedQuery = normalizeQuery(query);
  const statusText = getSearchStatusText({ isBelowMinimum, isLoading, isError, count: messages.length });

  const getSenderLabel = (message: Message) => {
    if (message.sender === currentUserId) {
      return 'You';
    }

    const sender = selectedChat.members.find((member) => member._id === message.sender);
    return sender ? `${sender.firstName} ${sender.lastName ?? ''}`.trim() : 'Unknown sender';
  };

  return (
    <section className="flex-1 overflow-y-auto bg-[#101113] px-4 py-4 md:px-6" aria-label="Message search results">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-[#6F7B77]" aria-live="polite">
          {statusText}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-[#2E363C] px-3 py-1 text-xs font-semibold text-[#A8B3AF] hover:bg-[#20262B] hover:text-[#F4F7F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
          aria-label="Clear search"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Clear search
        </button>
      </div>

      {isBelowMinimum ? null : isLoading ? (
        <p className="inline-flex items-center gap-2 text-sm text-[#A8B3AF]">
          <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
          Searching messages...
        </p>
      ) : isError ? (
        <p className="text-sm text-[#EF4444]">We could not search messages. Try again.</p>
      ) : messages.length > 0 ? (
        <ul className="-mx-4 divide-y divide-[#2E363C] border-y border-[#2E363C] md:-mx-6">
          {messages.map((message) => {
            const isLoaded = loadedMessageIds.has(message._id);
            const senderLabel = getSenderLabel(message);
            const timestampLabel = formatTimestamp(message.createdAt);
            const ariaLabel = `Jump to message from ${senderLabel} at ${timestampLabel}: ${message.text}`;
            const metadata = (
              <div className="flex min-w-0 items-center justify-between gap-3 text-xs text-[#6F7B77]">
                <span className="truncate font-semibold text-[#A8B3AF]">{senderLabel}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {isLoaded && (
                    <span className="rounded bg-[#14B8A6]/10 px-1.5 py-0.5 font-semibold text-[#14B8A6]">
                      In view
                    </span>
                  )}
                  <time dateTime={message.createdAt}>{timestampLabel}</time>
                </span>
              </div>
            );

            return (
              <li key={message._id}>
                {isLoaded ? (
                  <button
                    type="button"
                    onClick={() => onSelectLoadedResult(message)}
                    className="flex min-h-14 w-full flex-col justify-center px-4 py-3 text-left text-sm text-[#F4F7F6] hover:bg-[#20262B] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#14B8A6] md:px-6"
                    aria-label={ariaLabel}
                  >
                    {metadata}
                    <span className="mt-1 leading-5 text-[#F4F7F6]">
                      <SearchSnippet text={message.text} query={normalizedQuery} />
                    </span>
                  </button>
                ) : (
                  <div className="flex min-h-14 flex-col justify-center px-4 py-3 text-sm text-[#F4F7F6] md:min-h-16 md:px-6">
                    {metadata}
                    <span className="mt-1 leading-5">
                      <SearchSnippet text={message.text} query={normalizedQuery} />
                    </span>
                    <p className="mt-1 text-xs text-[#6F7B77]">Load older history to jump to this message.</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-[#F4F7F6]">No message matches</p>
          <p className="text-[#A8B3AF]">Try another word or clear search to return to the conversation.</p>
        </div>
      )}
    </section>
  );
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
    return 'Type at least 2 characters to search.';
  }

  if (isLoading) {
    return 'Searching messages...';
  }

  if (isError) {
    return 'We could not search messages. Try again.';
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
      <mark className="rounded-sm bg-[#F59E0B]/20 px-0 font-bold text-[#F4F7F6]">{match}</mark>
      {after}
    </span>
  );
};

export default MessageSearchResults;
