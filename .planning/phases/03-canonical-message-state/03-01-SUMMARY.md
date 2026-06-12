---
phase: 03-canonical-message-state
plan: 01
subsystem: backend
tags: [express, mongoose, socket.io, vitest, messages, unread, receipts]

requires:
  - phase: 02-authenticated-realtime-contract
    provides: Authenticated Socket.IO identity, membership checks, private user emissions, and socket test harnesses.
provides:
  - Backend canonical message serialization and status helper module.
  - Idempotent HTTP message creation by sender/chat/clientMessageId.
  - Monotonic delivered/read lifecycle shared by HTTP and Socket.IO.
  - Absolute per-user unread counts derived from Message.readBy and visibility.
  - Delete-for-self filtering and delete-for-everyone tombstones.
  - Bounded edit and reaction semantics with backend regression coverage.
affects: [03-02-frontend-message-merge, 03-03-cursor-history, phase-04-messenger-ui]

tech-stack:
  added: []
  patterns: [canonical message serializer, shared status-rank helper, absolute unread events, tombstone mutation contract]

key-files:
  created:
    - Backend/Chatify/Utils/messageState.mjs
    - Backend/Chatify/test/message/message.idempotency.test.mjs
    - Backend/Chatify/test/message/message.status-unread.test.mjs
    - Backend/Chatify/test/message/message.mutations.test.mjs
    - Backend/Chatify/test/socket/socket.message-state.test.mjs
  modified:
    - Backend/Chatify/Models/messageModel.mjs
    - Backend/Chatify/Controller/messageController.mjs
    - Backend/Chatify/Config/socket.mjs
    - Backend/Chatify/test/fixtures/messages.mjs
    - Backend/Chatify/test/socket/socket.authorization.test.mjs

key-decisions:
  - "Canonical message payloads are produced by serializeMessage(), not raw Mongoose documents."
  - "Unread socket updates use absolute count values, not relative increments."
  - "Delete-for-everyone preserves message identity as a redacted tombstone."
  - "Read/delivery transitions are promoted through shared rank helpers to prevent downgrades."

patterns-established:
  - "HTTP and Socket.IO message status paths call shared helper functions before saving."
  - "Message-bearing mutation events include both top-level compatibility fields and a canonical message payload."
  - "Visibility-sensitive queries exclude deletedFor for the requesting user."

requirements-completed: [MSG-01, MSG-03, MSG-04, MSG-05, MSG-07]

duration: 23min
completed: 2026-06-08
---

# Phase 03-01: Canonical Backend Message State Summary

**Backend message creation, receipts, unread counts, deletes, edits, and reactions now share one canonical persisted contract.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-06-08T18:25:21+03:00
- **Completed:** 2026-06-08T18:47:54+03:00
- **Tasks:** 5
- **Files modified:** 10

## Accomplishments

- Added `messageState.mjs` for text/client id validation, serialization, visibility filters, unread filters, status ranking, read/delivery application, and reaction bounds.
- Added message schema fields and indexes for `clientMessageId`, tombstones, cursor support, visibility, and idempotent create.
- Made `POST /api/message/new-message` idempotent for sender/chat/clientMessageId and server-authoritative for sender identity.
- Replaced relative unread increments with absolute per-user unread counts derived from message read state.
- Centralized HTTP read, batch read, and socket delivery behavior around monotonic status helpers.
- Replaced hard delete-for-everyone with redacted tombstones and added delete-for-self visibility filtering.
- Added focused backend and socket regression coverage for create, status, unread, mutation, authorization, and event payload behavior.

## Task Commits

1. **Task 1: Add schema fields, indexes, and canonical state helpers** - `68db0f1`
2. **Task 2: Implement idempotent HTTP message creation and canonical side effects** - `22eb705`
3. **Task 3: Centralize monotonic delivery, read, and unread behavior** - `de1c7ed`
4. **Task 4: Implement canonical delete, edit, and reaction semantics** - `abd8ea8`
5. **Task 5: Run backend state contract regression suite** - `ff3879a`

## Files Created/Modified

- `Backend/Chatify/Utils/messageState.mjs` - Canonical message helpers.
- `Backend/Chatify/Models/messageModel.mjs` - Idempotency/tombstone fields, indexes, and tombstone-compatible text validation.
- `Backend/Chatify/Controller/messageController.mjs` - Idempotent create, canonical responses/events, absolute unread counts, status/read/mutation semantics.
- `Backend/Chatify/Config/socket.mjs` - Shared delivery helper for socket delivery and join-side delivery marking.
- `Backend/Chatify/test/message/*.test.mjs` - Focused message state regression suites.
- `Backend/Chatify/test/socket/socket.message-state.test.mjs` - Socket event contract coverage.
- `Backend/Chatify/test/socket/socket.authorization.test.mjs` - Updated unread expectation to absolute `count`.

## Decisions Made

- Kept message creation HTTP-only and ignored client `sender` payloads.
- Returned existing canonical messages for duplicate clientMessageId retries, and `409` for reused ids with different normalized text.
- Kept tombstones visible in history unless hidden by `deletedFor`, so pagination and held message ids remain stable.
- Cleared reactions when a message is deleted for everyone to avoid retaining interactive state on redacted content.

## Deviations from Plan

### Auto-fixed Issues

**1. Tombstone text validator alignment**
- **Found during:** Task 4
- **Issue:** Empty tombstone text conflicted with the old unconditional `text` required validator.
- **Fix:** Made `text` required only when `deletedForEveryone` is false.
- **Files modified:** `Backend/Chatify/Models/messageModel.mjs`
- **Verification:** `npm test -- test/message/message.mutations.test.mjs test/socket/socket.message-state.test.mjs`
- **Committed in:** `abd8ea8`

**2. Legacy relative unread test expectation**
- **Found during:** Task 5 full suite
- **Issue:** Existing socket authorization test still expected `increment: 1`.
- **Fix:** Updated it to expect absolute `count: 1`.
- **Files modified:** `Backend/Chatify/test/socket/socket.authorization.test.mjs`
- **Verification:** `npm test`
- **Committed in:** `ff3879a`

**Total deviations:** 2 auto-fixed
**Impact on plan:** Both were required to make the planned canonical unread and tombstone contracts executable.

## Issues Encountered

- Full backend suite initially failed only on the legacy unread event expectation. Updating the test to the approved absolute-count contract resolved it.

## Verification

- `npm test -- test/message/message.idempotency.test.mjs` - 1 file, 3 tests passed.
- `npm test -- test/message/message.status-unread.test.mjs` - 1 file, 4 tests passed.
- `npm test -- test/message/message.mutations.test.mjs` - 1 file, 5 tests passed.
- `npm test -- test/socket/socket.message-state.test.mjs` - 1 file, 5 tests passed.
- `npm test` - 9 files, 47 tests passed.
- `rg -n "clientMessageId|deletedForEveryone|deletedBy|deletedAt" Backend/Chatify/Models/messageModel.mjs Backend/Chatify/Controller/messageController.mjs` - fields present.
- `rg -n "unReadMessages|increment:" Backend/Chatify/Controller/messageController.mjs Backend/Chatify/Config/socket.mjs` - no matches.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 03-02 can now rebuild frontend optimistic merge, rollback, socket event handling, and unread cache sync against a stable backend contract. Phase 03-03 still needs cursor pagination and frontend/backend validation alignment beyond the backend 1000-character model/controller boundary established here.

---
*Phase: 03-canonical-message-state*
*Completed: 2026-06-08*
