---
phase: 13-realtime-call-and-video-implementation
plan: 03
subsystem: verification
tags: [call-activity, lifecycle-cleanup, playwright, regression-tests]
requires:
  - phase: 13-realtime-call-and-video-implementation
    provides: backend and frontend call implementation
provides:
  - metadata-only call activity timeline rendering
  - reconnect/logout/block cleanup tests
  - fixture guards for static call UI leaks
  - Playwright fake-media smoke evidence and production boundary
affects: [phase-14-production-live-acceptance, message-timeline, regression-gates]
tech-stack:
  added: []
  patterns: [system timeline activity rows, smoke-gated live e2e, metadata redaction tests]
key-files:
  created:
    - Backend/Chatify/test/message/message.call-activity.test.mjs
    - Frontend/Chatify/e2e/chat-calls.spec.ts
    - .planning/phases/13-realtime-call-and-video-implementation/13-CALL-EVIDENCE.md
  modified:
    - Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageList.test.tsx
    - Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts
    - Frontend/Chatify/playwright.config.ts
key-decisions:
  - "Call activity renders as a system row to avoid presenting it as user-authored text."
  - "Live two-party browser calling remains environment-gated and is not claimed complete without `CHATIFY_CALL_SMOKE=1`."
patterns-established:
  - "Call activity tests assert redaction by inspecting serialized payload text."
  - "Playwright call smoke captures unavailable-state evidence when no live socket/TURN setup exists."
requirements-completed: [CALL-01, CALL-02, CALL-03, CALL-04, BLOCK-02, RT-01, RT-02, TEST-02, TEST-05]
duration: 45 min
completed: 2026-06-13
---

# Phase 13 Plan 03: Call Activity, Lifecycle Cleanup, And Evidence Summary

**Metadata-only call history, cleanup regression coverage, fixture guards, and browser smoke evidence with an explicit production-live boundary**

## Performance

- **Duration:** 45 min
- **Started:** 2026-06-13T08:00:00+03:00
- **Completed:** 2026-06-13T08:11:17+03:00
- **Tasks:** 4 completed
- **Files modified:** 11

## Accomplishments

- Added call activity timeline rows for missed, declined, failed, blocked, canceled, and ended calls.
- Added backend call activity tests for duplicate prevention, missed-call reachability, safe serialization, and redaction.
- Added controller cleanup for auth loss, block state, and prolonged realtime loss, with tests for media stop and socket end.
- Extended fixture guard patterns to block static/demo/fake call cards, history, and state.
- Added Playwright fake-media launch args and a Phase 13 call smoke with captured unavailable-state evidence.

## Task Commits

1. **Tasks 1-4: Call activity, cleanup, fixture guards, and browser evidence** - `334b427` (`feat`)

## Verification

- `cd Backend/Chatify; npm test -- --run test/message/message.call-activity.test.mjs` - passed, 1 file / 2 tests.
- `cd Frontend/Chatify; npm test -- --run src/hooks/useCallController.test.tsx src/pages/chat/components/MessageBubble.test.tsx src/pages/chat/components/MessageList.test.tsx src/pages/chat/fixtureLeakGuard.test.ts` - passed, 4 files / 21 tests.
- `cd Frontend/Chatify; npm run test:ui -- --grep "Phase 13 call"` - passed, 1 passed / 1 skipped.
- `cd Backend/Chatify; npm test -- --run` - passed, 24 files / 112 tests.
- Full frontend tests, lint, and build passed as recorded in `13-CALL-EVIDENCE.md`.

## Deviations from Plan

### Auto-Fixed Issues

**1. [Rule 3 - Blocking] Updated socket mock in block-control backend test**
- **Found during:** Full backend suite
- **Issue:** `chat.block-controls.test.mjs` mocked `Config/socket.mjs` without the new `endActiveCallForChatDueToBlock` export, causing block route tests to fail with 500 responses.
- **Fix:** Added the missing mocked export.
- **Files modified:** `Backend/Chatify/test/chat/chat.block-controls.test.mjs`
- **Verification:** Full backend test suite passed, 24 files / 112 tests.
- **Committed in:** `334b427`

**2. [Rule 6 - Environment] Browser happy-path call smoke gated**
- **Found during:** Playwright smoke setup
- **Issue:** The local mocked e2e harness does not provide a live Socket.IO peer, TURN config, or two authenticated browser sessions.
- **Fix:** Added a passing unavailable-state smoke and a skipped live two-party smoke gated behind `CHATIFY_CALL_SMOKE=1`.
- **Files modified:** `Frontend/Chatify/e2e/chat-calls.spec.ts`, `Frontend/Chatify/playwright.config.ts`
- **Verification:** `npm run test:ui -- --grep "Phase 13 call"` passed with 1 passed / 1 skipped.
- **Committed in:** `334b427`

## Issues Encountered

- Full backend suite initially failed because of the missing socket mock export described above. Fixed and reran full backend successfully.

## User Setup Required

For live browser call acceptance, provide `CHATIFY_CALL_SMOKE=1`, live backend/frontend URLs, two test accounts, valid socket cookies/auth, and TURN credentials. Without those, Phase 13 does not claim deployed two-party call acceptance.

## Next Phase Readiness

Phase 14 can run production-live call acceptance using the gated Playwright path and production TURN/socket credentials.

---
*Phase: 13-realtime-call-and-video-implementation*
*Completed: 2026-06-13*
