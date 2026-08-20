---
phase: 07-messenger-functional-parity-restoration
plan: 03
subsystem: chat-ui
tags: [playwright, e2e, messenger-ui, behavior-smoke, realtime]
requires:
  - phase: 07-02-live-surface-behavior
    provides: Honest live-state UI surfaces and disabled unsupported controls
provides:
  - Phase 07 production-style Playwright behavior fixture
  - Desktop/mobile light/dark behavior-first smoke coverage
  - After-interaction screenshot evidence
  - Browser-visible realtime update proof
affects: [phase-07, phase-08, chat-ui, realtime, e2e]
tech-stack:
  added: []
  patterns: [production-shaped e2e fixtures, page helper route mocks, after-interaction screenshots]
key-files:
  created:
    - Frontend/Chatify/e2e/chat-functional-parity.spec.ts
    - Frontend/Chatify/e2e/fixtures/phase07BehaviorFixture.ts
    - Frontend/Chatify/e2e/pages/chatPage.ts
    - .planning/phases/07-messenger-functional-parity-restoration/07-BEHAVIOR-SMOKE.md
    - .planning/phases/07-messenger-functional-parity-restoration/07-ui-desktop-light-after-search.png
    - .planning/phases/07-messenger-functional-parity-restoration/07-ui-desktop-dark-after-search.png
    - .planning/phases/07-messenger-functional-parity-restoration/07-ui-mobile-light-after-drawer.png
    - .planning/phases/07-messenger-functional-parity-restoration/07-ui-mobile-dark-after-retry.png
  modified:
    - Frontend/Chatify/e2e/chat-ui-smoke.spec.ts
    - Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatSidebar.test.tsx
    - Frontend/Chatify/src/pages/chat/components/NewChatDialog.test.tsx
key-decisions:
  - "Behavior smoke uses Phase 07-specific fixture data and route mocks instead of Phase 06 visual fixture identities."
  - "Deepest workflow coverage runs on desktop light and mobile dark, with lighter smoke across desktop dark and mobile light."
  - "Realtime browser proof updates presenceStore after initial render while hook tests remain the Socket.IO event callback contract."
patterns-established:
  - "Playwright page helpers own production-shaped route mocks and artifact paths."
  - "Evidence screenshots are captured after user interactions rather than first paint."
requirements-completed: [PARITY-01, PARITY-02, PARITY-03, UI-01, UI-02, UI-03, UI-04, UI-05, BASE-01, BASE-02, BASE-03, BASE-04, BASE-05, MSG-01, MSG-02, MSG-04, MSG-05, RT-04, TEST-03, TEST-05]
duration: 20 min
completed: 2026-06-12
---

# Phase 07 Plan 03: Behavior-First Browser Smoke Summary

**Phase 7 now has behavior evidence across desktop, mobile, light theme, and dark theme.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-06-12T13:58:15Z
- **Completed:** 2026-06-12T14:18:48Z
- **Tasks:** 4
- **Files modified:** 12

## Accomplishments

- Added Phase 07 Playwright behavior fixtures with non-Phase-06 identities, chat ids, messages, unread counts, presence, typing, search results, and exact-email continuation data.
- Added e2e page helpers for API route mocks, chat opening by URL/theme, artifact paths, overflow checks, composer overlap checks, and a post-render realtime-style state update.
- Added behavior-first Playwright coverage for conversation search, no-results search, message search, jump/highlight, send, retry, dismiss, mobile drawer selection, URL restore, invalid fallback, new-chat continuation, auth expiry, disabled unsupported controls, and no fake file/media/pin surfaces.
- Captured after-interaction screenshots for desktop light, desktop dark, mobile light, and mobile dark variants under the Phase 07 evidence directory.
- Recorded exact command outcomes and evidence paths in `07-BEHAVIOR-SMOKE.md`.

## Task Commits

1. **Tasks 1-4: Behavior fixtures, Playwright workflows, realtime proof, and evidence** - `c003490` (test)

**Plan metadata:** this summary commit.

## Files Created/Modified

- `Frontend/Chatify/e2e/chat-functional-parity.spec.ts` - Phase 07 behavior-first Playwright workflows.
- `Frontend/Chatify/e2e/fixtures/phase07BehaviorFixture.ts` - Production-shaped Phase 07 fixture data.
- `Frontend/Chatify/e2e/pages/chatPage.ts` - Route mocks, page helpers, realtime update helper, and artifact paths.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` - Updated expected composer session copy.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - Replaced E2EE claim with authenticated private chat copy.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.test.tsx` - Locks the honest sidebar footer copy.
- `Frontend/Chatify/src/pages/chat/components/NewChatDialog.test.tsx` - Stabilized the interaction-heavy focus test with a local timeout.
- `07-BEHAVIOR-SMOKE.md` and four `07-ui-*` screenshots - Phase 07 evidence artifacts.

## Decisions Made

- Kept visual smoke and behavior smoke separate so visual reference checks remain useful while behavior tests prove runtime workflows.
- Used route-level API mocks shaped like production responses instead of importing production component fixtures.
- Used `presenceStore` from browser context for visible realtime proof after initial render; socket event coverage stays in fast hook tests.
- Left Phase 08 file/media/pin/call/voice behavior disabled or unavailable until data-backed contracts exist.

## Deviations from Plan

- `Frontend/Chatify/playwright.config.ts` did not need changes because the existing single-worker Chrome setup and Vite web server already satisfied the Phase 07 behavior smoke requirements.

## Issues Encountered

- The first functional parity run exposed broad locator matches for retry and continuation text. Tests were scoped to `conversation-pane` so they target chat content rather than sidebar snippets.
- The first desktop-light Playwright test hit the app loading shell during cold start. The helper now waits up to 15 seconds for the real chat root and requested theme.
- The full Vitest suite exposed a timeout-prone focus-trap test. The test passed in isolation, so only that interaction-heavy test received a local 10-second timeout.

## Verification

- `cd Frontend/Chatify; npm test -- --run src/pages/chat/fixtureLeakGuard.test.ts src/pages/chat/components/ChatSidebar.test.tsx` - passed, 2 files and 5 tests.
- `cd Frontend/Chatify; npm run test:ui -- --grep "functional parity"` - passed, 5 Playwright tests.
- `cd Frontend/Chatify; npm test` - passed, 22 files and 72 tests.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed.
- `cd Frontend/Chatify; npm run test:ui` - passed, 13 Playwright tests.
- `rg -n "phase06|PHASE06_|Phase06VisualFixture|chatVisualSmoke" Frontend/Chatify/e2e/chat-functional-parity.spec.ts Frontend/Chatify/e2e/fixtures/phase07BehaviorFixture.ts Frontend/Chatify/e2e/pages/chatPage.ts Frontend/Chatify/src/pages/chat --glob "!**/*.test.*"` - no matches.
- `Test-Path ../../.planning/phases/07-messenger-functional-parity-restoration/07-BEHAVIOR-SMOKE.md` - evidence file exists.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Phase 08 planning/execution: Phase 07 now proves the reference messenger shell is behavior-backed for current supported workflows, and it honestly marks file/media/pin/detail/call/voice surfaces as Phase 08 work.

---
*Phase: 07-messenger-functional-parity-restoration*
*Completed: 2026-06-12*
