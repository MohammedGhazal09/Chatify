---
phase: 15-investigate-and-fix-audio-and-video-call-reliability
plan: 01
completed_at: 2026-06-17T10:19:12+03:00
status: completed_with_blocked_acceptance
commits: []
files_changed:
  - .planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-FAILURE-REPORT.md
  - .planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-CALL-ACCEPTANCE.md
  - Frontend/Chatify/e2e/chat-calls.spec.ts
  - Frontend/Chatify/e2e/pages/phase15CallAcceptance.ts
verification:
  - "cd Frontend/Chatify; npm run test:ui -- --grep \"Phase 15\""
  - "cd Frontend/Chatify; npm test -- --run src/hooks/useCallController.test.tsx src/pages/chat/components/CallOverlay.test.tsx"
  - "cd Backend/Chatify; npm test -- --run test/socket/socket.calls.test.mjs test/socket/socket.call-auth.test.mjs test/socket/socket.call-blocking.test.mjs"
---

# Phase 15 Plan 01 Summary: Investigation, Failure Report, And Test Harness

## Result

Created the Phase 15 investigation report and local call acceptance harness. The report maps video media failure, ICE timing, backend authority, local browser acceptance, production/TURN readiness, and call overlay proof into stable findings.

The new Phase 15 Playwright path is fail-closed: it can run real local two-account fake-media audio/video calls when `CHATIFY_LOCAL_*` smoke variables are provided, and it writes `15-CALL-ACCEPTANCE.md` with exact blockers when they are absent.

## Verification

- Frontend call unit target passed: 2 files, 21 tests.
- Backend call socket target passed: 3 files, 12 tests.
- Phase 15 Playwright target skipped one live local call test and wrote a blocked acceptance artifact because the local smoke env was not configured.

## Blocker

Local browser acceptance remains blocked until `CHATIFY_LOCAL_CALL_SMOKE=1`, local frontend/backend URLs, and two disposable local smoke accounts are provided.
