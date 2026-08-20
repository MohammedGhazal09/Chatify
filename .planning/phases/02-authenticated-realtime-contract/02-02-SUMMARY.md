---
phase: 02-authenticated-realtime-contract
plan: 02
subsystem: realtime-authorization
tags: [socket-io, authorization, mongoose, unread, vitest]
requires:
  - phase: 02-authenticated-realtime-contract
    provides: Plan 01 cookie-authenticated socket identity and socket integration helpers.
provides:
  - Centralized chat and message membership checks for socket events.
  - Structured socket event failure responses through ack callbacks or socket:error fallback.
  - Server-side rejection for direct socket message sends.
  - Recipient-only unread and private chat notifications through authenticated socket maps.
  - Socket authorization tests for joins, typing, delivery, message-send rejection, and unread targeting.
affects: [presence, reconnect, message-state, unread-counts, socket-events]
tech-stack:
  added: []
  patterns: [assertChatMember, assertMessageChatMember, emitToUserSockets, socket event ack errors]
key-files:
  created:
    - Backend/Chatify/Utils/chatAccess.mjs
    - Backend/Chatify/test/socket/socket.authorization.test.mjs
  modified:
    - Backend/Chatify/Config/socket.mjs
    - Backend/Chatify/Controller/messageController.mjs
    - Backend/Chatify/Controller/chatController.mjs
key-decisions:
  - "Every client-origin chat-scoped socket event uses socket.data.userId and server-side membership checks."
  - "message:delivered derives chat id from the persisted message instead of trusting client chatId."
  - "Direct socket message:send is deprecated and cannot emit message:new."
  - "User-private unread and chat lifecycle updates are emitted through emitToUserSockets."
patterns-established:
  - "Socket failures return { ok, code, event, message } through ack callbacks when available."
  - "Fire-and-forget unauthorized socket events emit socket:error with the same structured payload."
  - "Private resource failures use forbidden_or_not_found to avoid chat/message existence leaks."
requirements-completed: [RT-02, RT-03, TEST-02]
duration: 35min
completed: 2026-06-08
---

# Phase 2 Plan 02 Summary

**Membership-checked Socket.IO room/events with targeted private unread delivery**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-08T07:35:00Z
- **Completed:** 2026-06-08T08:10:00Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments

- Added `chatAccess.mjs` with ObjectId normalization, `assertChatMember`, and `assertMessageChatMember`.
- Secured `chat:join`, `chat:leave`, `typing:start`, `typing:stop`, and `message:delivered` behind verified socket identity and membership checks.
- Rejected direct socket `message:send` with `deprecated_socket_message_send` so clients cannot broadcast arbitrary unpersisted messages.
- Added `emitToUserSockets()` and used it for unread updates plus chat create/delete private notifications.
- Added real Socket.IO authorization tests for members, outsiders, fire-and-forget failures, stored-message delivery derivation, and recipient-only unread updates.

## Task Commits

1. **Tasks 1-4: Socket room/event authorization and private emits** - `d4bd0ac` (feat)

**Plan metadata:** pending summary commit

## Files Created/Modified

- `Backend/Chatify/Utils/chatAccess.mjs` - Central membership helper for chat/message socket authorization.
- `Backend/Chatify/Config/socket.mjs` - Adds structured socket errors, membership-checked room/event handlers, message-send rejection, and user-socket private emit helper.
- `Backend/Chatify/Controller/messageController.mjs` - Sends unread updates only to the intended recipient or reading user sockets.
- `Backend/Chatify/Controller/chatController.mjs` - Uses authenticated user socket targeting for chat lifecycle notifications.
- `Backend/Chatify/test/socket/socket.authorization.test.mjs` - Covers room authorization, typing, delivery, deprecated sends, and private unread emits.

## Decisions Made

- Kept ordinary authorization failures event-scoped instead of disconnecting the socket.
- Used generic `forbidden_or_not_found` for private ids so chat/message existence is not leaked to outsiders.
- Treated `chat:leave` as shape validation plus leave-only-if-currently-in-room to avoid existence leaks.
- Preserved intentional room-wide events such as `message:new`, `message:read`, and message status events while moving private unread state to user sockets.

## Deviations from Plan

### Auto-fixed Issues

**1. [Coverage - Stored message derivation] Added authorized delivery derivation test**
- **Found during:** Task 4.
- **Issue:** The planned unauthorized delivery test proved outsider rejection but did not directly prove that authorized delivery ignores a forged client `chatId`.
- **Fix:** Added a member delivery test that sends a bogus `chatId`, then asserts status update and persisted message status come from the stored message's chat.
- **Files modified:** `Backend/Chatify/test/socket/socket.authorization.test.mjs`.
- **Verification:** `cd Backend/Chatify; npm test -- test/socket/socket.authorization.test.mjs` passed.
- **Committed in:** `d4bd0ac`.

---

**Total deviations:** 1 auto-fixed coverage improvement.
**Impact on plan:** Strengthened the regression fence without expanding the behavior scope.

## Issues Encountered

None. The new socket authorization tests and full backend suite passed after implementation.

## User Setup Required

None - no external service configuration required.

## Verification

- `cd Backend/Chatify; npm test -- test/socket/socket.authorization.test.mjs` - PASS, 7 tests.
- `cd Backend/Chatify; npm test -- test/message/message.authorization.test.mjs` - PASS, 6 tests.
- `cd Backend/Chatify; npm test` - PASS, 4 files and 23 tests.
- `rg -n "socket\\.join\\(|typing:start|typing:stop|message:delivered|message:send|unread:update" Backend/Chatify/Config/socket.mjs Backend/Chatify/Controller/messageController.mjs` - PASS, joined rooms/events are authorized and unread emits use user socket targeting.
- `git status --short Frontend/Chatify/src/pages/chat/chat.tsx` - unchanged by this plan; the file remains dirty from pre-existing local line-ending/worktree state.

## Next Phase Readiness

Wave 3 can build presence and reconnect behavior on authenticated user socket maps, centralized private emit targeting, and real socket integration tests.

---
*Phase: 02-authenticated-realtime-contract*
*Completed: 2026-06-08*
