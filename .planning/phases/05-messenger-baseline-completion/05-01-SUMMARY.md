---
phase: 05-messenger-baseline-completion
plan: 01
subsystem: messaging-baseline
tags: [direct-chat, message-search, react-query, privacy, accessibility]
requires:
  - phase: 03-canonical-message-state
    provides: canonical message serialization, visibility filters, cursor history, and latest-message projection
  - phase: 04-messenger-ui-reconstruction
    provides: extracted messenger components, accessible controls, and frontend component test harness
provides:
  - Database-enforced direct-chat uniqueness with duplicate-key continuation recovery
  - Selected-chat message search API with membership checks, visibility filtering, escaped matching, and 25-result cap
  - Debounced frontend message search query key separated from durable message history cache
  - Sidebar conversation search by title and visible latest snippet only
  - Exact-email New chat continuation copy and generic lookup failure behavior
affects: [05-messenger-baseline-completion, phase-5-navigation-session, messenger-search, direct-chat]
tech-stack:
  added: []
  patterns: [direct-key-partial-index, private-message-search-endpoint, dedicated-search-query-key, result-mode-component]
key-files:
  created:
    - Backend/Chatify/test/chat/chat.direct.test.mjs
    - Backend/Chatify/test/message/message.search.test.mjs
    - Frontend/Chatify/src/hooks/useChatQueries.test.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx
  modified:
    - Backend/Chatify/Models/chatModel.mjs
    - Backend/Chatify/Controller/chatController.mjs
    - Backend/Chatify/Routes/messageRouter.mjs
    - Backend/Chatify/Controller/messageController.mjs
    - Backend/Chatify/Utils/messageState.mjs
    - Frontend/Chatify/src/api/messageApi.ts
    - Frontend/Chatify/src/hooks/useChatQueries.ts
    - Frontend/Chatify/src/pages/chat/chat.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx
    - Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx
    - Frontend/Chatify/src/pages/chat/components/NewChatDialog.tsx
key-decisions:
  - "Direct chats use a sorted two-member directKey and MongoDB partial unique index as the durable idempotency boundary."
  - "Message search results live under messageSearchQueryKey and never replace messagesQueryKey durable history."
  - "Sidebar search remains local and does not match member email or call passive user-search/presence endpoints."
patterns-established:
  - "Exact-email direct-chat creation catches duplicate-key races and re-queries the canonical direct chat."
  - "Selected-chat search uses buildVisibleMessageFilter({ includeTombstones: false }) plus escaped case-insensitive text matching."
  - "ConversationPane switches to a dedicated result mode when message search has input, leaving MessageList for normal history."
requirements-completed: [BASE-01, BASE-02, BASE-04]
duration: 25min
completed: 2026-06-09
---

# Phase 05-01: Search And Direct Continuation Summary

**Direct-chat continuation and selected-conversation search now have private, tested backend contracts and separate frontend result state.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-06-09T05:30:00+03:00
- **Completed:** 2026-06-09T05:54:44+03:00
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments

- Added stable direct-chat `directKey` derivation and a unique partial index for non-group direct chats.
- Updated `createChat` to return existing direct chats with `200`, recover duplicate-key races, and keep missing/self-target lookup failures generic.
- Added `GET /api/message/search/:chatId` with authenticated membership checks, literal escaped matching, visibility filtering, tombstone exclusion, newest-first sorting, and a hard 25-result cap.
- Added `messageApi.searchMessages`, `messageSearchQueryKey`, and `useMessageSearch` with debounce and below-minimum suppression.
- Replaced loaded-page message filtering with a dedicated `MessageSearchResults` result mode.
- Updated sidebar search to match only title plus visible latest snippet, and updated New chat continuation copy and generic failure handling.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enforce idempotent exact-email direct-chat continuation** - `a47f86c` (`feat(05-01): enforce direct chat continuation`)
2. **Task 2: Add selected-chat message search API with visibility and query constraints** - `0757ff9` (`feat(05-01): add selected chat message search`)
3. **Task 3: Replace loaded-page filtering with dedicated frontend search and local sidebar continuation UX** - `932301d` (`feat(05-01): add frontend conversation search`)

## Files Created/Modified

- `Backend/Chatify/Models/chatModel.mjs` - Adds direct-chat key derivation and unique partial index.
- `Backend/Chatify/Controller/chatController.mjs` - Uses direct key lookup, duplicate-key recovery, and generic lookup failure copy.
- `Backend/Chatify/Routes/messageRouter.mjs` - Registers the static search route before parameterized routes.
- `Backend/Chatify/Controller/messageController.mjs` - Adds selected-chat search with membership and visibility enforcement.
- `Backend/Chatify/Utils/messageState.mjs` - Adds message-search query normalization, regex escaping, and limit helpers.
- `Frontend/Chatify/src/api/messageApi.ts` - Adds typed `searchMessages`.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Adds `messageSearchQueryKey` and `useMessageSearch`.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - Removes loaded-history filtering and passes dedicated search result state.
- `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx` - Adds result-mode UI states and loaded-result jump action.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - Matches title plus latest snippet and updates no-results copy.
- `Frontend/Chatify/src/pages/chat/components/NewChatDialog.tsx` - Updates exact-email start/continue copy.

## Decisions Made

- Preserved the exact-email New chat path as the only v1 contact start/continue mechanism.
- Kept invalid email format copy specific while using generic copy for private lookup/self-target failures.
- Kept older search results selectable only as static rows unless the result is already present in loaded message history.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- Frontend result text is split by highlight markup; the test assertion was adjusted to assert rendered text content instead of a single text node.
- Hook debounce tests initially mixed fake timers with React Query async resolution; the test now uses a small real debounce wait to avoid timer deadlock.

## Verification

- `cd Backend/Chatify; npm test -- --run test/chat/chat.direct.test.mjs test/message/message.search.test.mjs` - PASS, 2 files / 11 tests.
- `cd Frontend/Chatify; npm test -- --run src/pages/chat/components/ChatSidebar.test.tsx src/pages/chat/components/NewChatDialog.test.tsx src/pages/chat/components/ConversationPane.test.tsx src/hooks/useChatQueries.test.tsx` - PASS, 4 files / 14 tests.
- `cd Frontend/Chatify; npm run lint` - PASS.
- `cd Frontend/Chatify; npm run build` - PASS.
- `rg -n "conversationMessages|search-users|user-search|messageSearchQueryKey|messagesQueryKey" Frontend/Chatify/src Backend/Chatify` - PASS for no loaded-history filter and no passive user-search endpoints; only expected query-key references remain.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

05-02 can now build safe URL/localStorage selected-chat persistence, auth-loss cleanup, and smoke coverage on top of tested direct-chat continuation and search contracts.

---
*Phase: 05-messenger-baseline-completion*
*Completed: 2026-06-09*
