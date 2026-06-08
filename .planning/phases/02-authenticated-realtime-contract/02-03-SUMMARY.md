---
phase: 02-authenticated-realtime-contract
plan: 03
subsystem: realtime-presence
tags: [socket-io, presence, reconnect, zustand, tanstack-query, vitest]
requires:
  - phase: 02-authenticated-realtime-contract
    provides: Plan 01 authenticated socket identity and Plan 02 user-socket targeting.
provides:
  - Privacy-aware multi-socket presence lifecycle.
  - Four-second final-disconnect offline debounce with reconnect cancellation.
  - Authorized presence snapshots in socket:ready payloads.
  - Frontend reconnect reconciliation for chats, selected messages, unread counts, and presence.
  - Presence/reconnect integration tests using real Socket.IO clients.
affects: [presence, reconnect, horizontal-scaling, query-cache, socket-events]
tech-stack:
  added: []
  patterns: [authorized presence contacts, offline debounce, socket ready snapshots, reconnect query invalidation]
key-files:
  created:
    - Backend/Chatify/test/socket/socket.presence-reconnect.test.mjs
  modified:
    - Backend/Chatify/Config/socket.mjs
    - Backend/Chatify/test/helpers/socketClient.mjs
    - Frontend/Chatify/src/hooks/useChatSocket.ts
    - Frontend/Chatify/src/store/presenceStore.ts
key-decisions:
  - "A user remains online while any authenticated socket exists."
  - "Final disconnect waits 4000ms before marking offline and broadcasting to authorized contacts."
  - "showOnlineStatus suppresses online and offline broadcasts server-side."
  - "Reconnect refreshes durable query state instead of trusting stale socket-delivered cache."
  - "Presence remains single-process in Phase 2; Redis/shared presence is deferred."
patterns-established:
  - "socket:ready includes an authorized online contact presence snapshot."
  - "Frontend reconnect handling invalidates chats, selected messages, and unread-count query prefixes."
  - "Presence store snapshots replace online users to avoid stale reconnect state."
requirements-completed: [RT-04, RT-05, TEST-02]
duration: 45min
completed: 2026-06-08
---

# Phase 2 Plan 03 Summary

**Privacy-aware multi-socket presence with reconnect server-truth reconciliation**

## Performance

- **Duration:** 45 min
- **Started:** 2026-06-08T08:10:00Z
- **Completed:** 2026-06-08T08:55:00Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments

- Replaced room-wide presence broadcasts with authorized contact targeting derived from shared chats.
- Added multi-socket online state and a 4000ms final-disconnect offline debounce that cancels when the user reconnects.
- Added `socket:ready.presence` snapshots containing only authorized online contacts with visible presence enabled.
- Added frontend reconnect reconciliation that invalidates chats, selected messages, unread-count queries, and replaces presence snapshot state.
- Added real Socket.IO tests for multi-socket presence, debounce, privacy suppression, and reconnect readiness.

## Task Commits

1. **Tasks 1-4: Presence lifecycle, reconnect reconciliation, and contract tests** - `6f900dc` (feat)

**Plan metadata:** pending summary commit

## Files Created/Modified

- `Backend/Chatify/Config/socket.mjs` - Adds authorized presence contacts, offline timers, readiness snapshots, and timer teardown.
- `Backend/Chatify/test/helpers/socketClient.mjs` - Adds helpers for connecting existing signup sessions and waiting for readiness.
- `Backend/Chatify/test/socket/socket.presence-reconnect.test.mjs` - Covers multi-socket online/offline, debounce cancel, privacy, and reconnect readiness.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - Invalidates durable query state and applies presence snapshots on connect/readiness/reconnect.
- `Frontend/Chatify/src/store/presenceStore.ts` - Adds `replaceOnlineUsers()` for authoritative snapshot refresh.

## Decisions Made

- Presence broadcasts are sent only to users who share a chat with the subject user and only when `showOnlineStatus` is enabled.
- A reconnect during the debounce keeps the user logically online and does not emit a false offline transition.
- `socket:ready` is the server-truth readiness event for reconnect recovery; Socket.IO connection state recovery remains disabled.
- Presence maps and timers are intentionally documented as single-process state; Redis adapter/shared presence is deferred by D-29.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- Real debounce coverage adds about 13-20 seconds to socket test runs. Fake timers were avoided because Socket.IO real network clients are more reliable with real timers in this harness.

## User Setup Required

None - no external service configuration required.

## Verification

- `cd Backend/Chatify; npm test -- test/socket/socket.presence-reconnect.test.mjs` - PASS, 4 tests.
- `cd Backend/Chatify; npm test -- test/socket/socket.auth.test.mjs test/socket/socket.authorization.test.mjs test/socket/socket.presence-reconnect.test.mjs` - PASS, 3 files and 15 tests.
- `cd Backend/Chatify; npm test` - PASS, 5 files and 27 tests.
- `cd Frontend/Chatify; npm run lint` - PASS.
- `cd Frontend/Chatify; npm run build` - PASS, with the existing Vite chunk-size warning.
- `rg -n "connectionStateRecovery|user:connect|io\\.in\\(.*unread:update|showOnlineStatus|offline" Backend/Chatify/Config/socket.mjs Backend/Chatify/Controller/messageController.mjs Frontend/Chatify/src/hooks/useChatSocket.ts` - PASS, no connection state recovery and no room-wide unread update path.
- `git status --short Frontend/Chatify/src/pages/chat/chat.tsx` - unchanged by this plan; the file remains dirty from pre-existing local line-ending/worktree state.

## Next Phase Readiness

Phase 2 now has an authenticated realtime contract covering handshake identity, room/event authorization, targeted private emits, privacy-aware presence, and reconnect state recovery. Later scaling work must replace the current in-memory socket/presence maps with Redis adapter/shared presence before horizontal Socket.IO deployment.

---
*Phase: 02-authenticated-realtime-contract*
*Completed: 2026-06-08*
