---
phase: 03-canonical-message-state
plan: 02
subsystem: frontend
tags: [react, tanstack-query, socket.io-client, vitest, optimistic-updates, unread]

requires:
  - phase: 03-canonical-message-state
    provides: Plan 03-01 backend canonical message contract, absolute unread updates, tombstones, and idempotent create.
provides:
  - Frontend Vitest harness for pure state helpers.
  - Canonical frontend message and event types.
  - Typed create-message API without client sender identity.
  - Query-owned message cache helpers and hook integration.
  - Socket event handling through shared cache helpers.
affects: [03-03-cursor-history, phase-04-messenger-ui]

tech-stack:
  added: [vitest]
  patterns: [pure cache helper tests, Query-owned message state, clientMessageId optimistic merge, absolute unread cache updates]

key-files:
  created:
    - Frontend/Chatify/vitest.config.ts
    - Frontend/Chatify/src/hooks/messageCache.ts
    - Frontend/Chatify/src/hooks/messageCache.test.ts
  modified:
    - Frontend/Chatify/package.json
    - Frontend/Chatify/package-lock.json
    - Frontend/Chatify/src/types/chat.ts
    - Frontend/Chatify/src/api/messageApi.ts
    - Frontend/Chatify/src/hooks/useChatQueries.ts
    - Frontend/Chatify/src/hooks/useChatSocket.ts
    - Frontend/Chatify/src/pages/chat/chat.tsx

key-decisions:
  - "TanStack Query data is the durable frontend message store."
  - "Optimistic and server messages merge by clientMessageId and persisted _id."
  - "Failed sends remain visible as failed optimistic messages."
  - "Socket events apply shared cache helpers before optional page callbacks run."

patterns-established:
  - "Keep cache convergence logic in pure helpers and test it without a DOM stack."
  - "Use canonical message payloads from socket/edit/delete/reaction events when present."
  - "Use absolute unread count updates first; keep increment only as compatibility behavior."

requirements-completed: [MSG-01, MSG-02, MSG-05]

duration: 16min
completed: 2026-06-08
---

# Phase 03-02: Frontend Message Cache Summary

**Frontend optimistic sends, socket events, mutation responses, unread counts, and refetch payloads now converge through shared TanStack Query helpers.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-06-08T18:50:00+03:00
- **Completed:** 2026-06-08T19:06:05+03:00
- **Tasks:** 5
- **Files modified:** 10

## Accomplishments

- Added frontend Vitest runner for pure helper tests without a DOM/browser testing stack.
- Updated frontend message/event/API types for `clientMessageId`, tombstones, receipt patches, absolute unread counts, and cursor metadata compatibility.
- Changed `messageApi.createMessage()` to accept `{ chatId, text, clientMessageId }` only.
- Added `messageCache.ts` helper coverage for optimistic+HTTP success, socket-before-HTTP, duplicate refetch, failed sends, retry replacement, status downgrade prevention, unread updates, and tombstones.
- Refactored `useMessages()` so TanStack Query owns the durable message list instead of local mirrored state.
- Routed send, read, delete, edit, reaction, socket, and unread updates through shared helper behavior.
- Kept the `chat.tsx` diff narrow: only canonical event payload wiring for delete/edit/reaction callbacks.

## Task Commits

1. **Task 1: Add minimal frontend Vitest harness** - `8469608`
2. **Task 2: Align frontend message API and TypeScript contracts** - `c7bd9cc`
3. **Task 3: Implement canonical TanStack Query message cache helpers** - `2e8a861`
4. **Task 4: Refactor useMessages and mutations around cache helpers** - `9d2d389`
5. **Task 5: Route socket events and minimal page wiring through shared helpers** - `aeeef10`

## Files Created/Modified

- `Frontend/Chatify/vitest.config.ts` - Node Vitest config for pure helper tests.
- `Frontend/Chatify/src/hooks/messageCache.ts` - Query cache helper module.
- `Frontend/Chatify/src/hooks/messageCache.test.ts` - Cache convergence regression suite.
- `Frontend/Chatify/src/types/chat.ts` - Canonical frontend message and event contract.
- `Frontend/Chatify/src/api/messageApi.ts` - Create payload and mutation response types.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Query-owned messages and helper-backed mutations.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - Socket events write through shared cache helpers.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - Minimal canonical event payload wiring.

## Decisions Made

- Used pure helper tests instead of React Testing Library because Phase 03-02 tests state convergence, not DOM behavior.
- Preserved the existing `useMessages()` callback names to avoid a chat page rewrite.
- Kept `increment` handling in unread helpers only as compatibility fallback; server-provided `count` wins.

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

- `npm test -- --run` initially failed because no test files existed; adding `messageCache.test.ts` made the runner blocking and useful.
- The plan's static `sender:` check could have been confused by optimistic local message construction, so the helper input was named `senderId` while the API payload remains sender-free.

## Verification

- `npm test -- --run src/hooks/messageCache.test.ts` - 1 file, 8 tests passed.
- `npm test -- --run` - 1 file, 8 tests passed.
- `npm run lint` - passed.
- `npm run build` - passed with existing Vite chunk-size warning.
- `rg -n "sender:" Frontend/Chatify/src/api/messageApi.ts Frontend/Chatify/src/hooks/useChatQueries.ts` - no matches.
- `git diff -- Frontend/Chatify/src/pages/chat/chat.tsx` - reviewed; only canonical delete/edit/reaction event wiring changed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 03-03 can replace offset pagination with cursor history and finish frontend/backend validation alignment on top of the Query-owned cache and canonical message payloads.

---
*Phase: 03-canonical-message-state*
*Completed: 2026-06-08*
