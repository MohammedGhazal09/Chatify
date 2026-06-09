import { LoaderCircle, X } from 'lucide-react';
import type { Message } from '../../../types/chat';

interface MessageSearchResultsProps {
  query: string;
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
  messages,
  loadedMessageIds,
  isLoading,
  isError,
  isBelowMinimum,
  onClear,
  onSelectLoadedResult,
}: MessageSearchResultsProps) => {
  const normalizedQuery = normalizeQuery(query);

  return (
    <section className="flex-1 overflow-y-auto bg-[#101113] px-4 py-4 md:px-6" aria-label="Message search results">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-[#6F7B77]" aria-live="polite">
          {isBelowMinimum
            ? 'Search paused'
            : isLoading
              ? 'Searching messages'
              : isError
                ? 'Message search unavailable'
                : `Found ${messages.length} message${messages.length === 1 ? '' : 's'}`}
        </p>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-[#2E363C] px-3 py-1 text-xs font-semibold text-[#A8B3AF] hover:bg-[#20262B] hover:text-[#F4F7F6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
          aria-label="Clear message search"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {isBelowMinimum ? (
        <p className="text-sm text-[#A8B3AF]">Type at least 2 characters to search this conversation.</p>
      ) : isLoading ? (
        <p className="inline-flex items-center gap-2 text-sm text-[#A8B3AF]">
          <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />
          Searching messages...
        </p>
      ) : isError ? (
        <p className="text-sm text-[#EF4444]">We could not search this conversation.</p>
      ) : messages.length > 0 ? (
        <ul className="space-y-2">
          {messages.map((message) => {
            const isLoaded = loadedMessageIds.has(message._id);
            const snippet = message.text;
            const ariaLabel = `Jump to message: ${snippet}`;

            return (
              <li key={message._id}>
                {isLoaded ? (
                  <button
                    type="button"
                    onClick={() => onSelectLoadedResult(message)}
                    className="w-full rounded-lg border border-[#2E363C] bg-[#181C20] px-3 py-2 text-left text-sm text-[#F4F7F6] hover:border-[#14B8A6] hover:bg-[#20262B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
                    aria-label={ariaLabel}
                  >
                    <SearchSnippet text={snippet} query={normalizedQuery} />
                  </button>
                ) : (
                  <div className="rounded-lg border border-[#2E363C] bg-[#181C20] px-3 py-2 text-sm text-[#F4F7F6]">
                    <SearchSnippet text={snippet} query={normalizedQuery} />
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
          <p className="text-[#A8B3AF]">Try a different search term.</p>
        </div>
      )}
    </section>
  );
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
      <mark className="rounded bg-[#14B8A6]/20 px-0 text-[#F4F7F6]">{match}</mark>
      {after}
    </span>
  );
};

export default MessageSearchResults;
