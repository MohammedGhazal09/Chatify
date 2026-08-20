# Phase 34 Context

## Existing Entry Points

- `Backend/Chatify/Controller/messageController.mjs` owns message history, search, shared assets, pins, attachments, and message mutations.
- `Backend/Chatify/Utils/messageState.mjs` owns visibility filters, cursor helpers, and existing search query normalization.
- `Frontend/Chatify/src/api/messageApi.ts` owns typed transport methods for search and message history.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` owns `useMessageSearch`, message cache keys, and loaded-message state.
- `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx` renders the current search result panel.
- `Frontend/Chatify/src/pages/chat/chat.tsx` owns opening search, clearing search, selecting results, and highlighting messages.

## Relevant Constraints

- Search must never bypass chat membership or per-user visibility checks.
- Search must not expose private emails in user labels, payloads, logs, or tests.
- Attachment filters can use persisted attachment metadata only; file contents remain out of scope.
- Result jumps should preserve message cache merge behavior and avoid duplicate message rows.
- Existing local changes in `Frontend/Chatify/src/pages/chat/chat.tsx` must be handled carefully.

## Implementation Notes

- Keep existing `q` search behavior compatible for current callers.
- Add filter normalization in `messageState.mjs` so controller code stays readable.
- Prefer returning newest-first search results and chronological message windows for jump context.
- Reuse `serializeMessage` for all message payloads.
- Update focused tests before broad gates.
