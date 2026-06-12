---
phase: 04-messenger-ui-reconstruction
plan: 03
subsystem: ui-tests
tags: [react, vitest, jsdom, rtl, smoke-evidence]
requires:
  - phase: 04-02
    provides: UI-SPEC compliant extracted chat components and failed-send recovery controls
provides:
  - React 19 compatible Vitest/jsdom test harness with RTL and user-event
  - Component regression tests for chat state views, message bubbles, composer, action menu, sidebar, message list, new-chat dialog, and conversation pane
  - Failed optimistic message dismissal helper coverage
  - Desktop/mobile smoke evidence artifact with explicit skipped visual prerequisites
affects: [04-messenger-ui-reconstruction, phase-5-baseline]
tech-stack:
  added:
    - "@testing-library/react"
    - "@testing-library/user-event"
    - "@testing-library/jest-dom"
    - "jsdom"
  patterns: [rtl-semantic-queries, jsdom-component-regressions, explicit-smoke-evidence]
key-files:
  created:
    - Frontend/Chatify/src/test/setup.ts
    - Frontend/Chatify/src/test/chatFixtures.ts
    - Frontend/Chatify/src/pages/chat/components/MessageBubble.test.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageComposer.test.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageActionMenu.test.tsx
    - Frontend/Chatify/src/pages/chat/components/NewChatDialog.test.tsx
    - .planning/phases/04-messenger-ui-reconstruction/04-SMOKE.md
  modified:
    - Frontend/Chatify/package.json
    - Frontend/Chatify/package-lock.json
    - Frontend/Chatify/vite.config.ts
    - Frontend/Chatify/vitest.config.ts
    - Frontend/Chatify/src/hooks/messageCache.test.ts
    - Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx
key-decisions:
  - "Used the existing dedicated vitest.config.ts as the active test runner config and mirrored jsdom setup in vite.config.ts."
  - "Kept browser smoke evidence documented rather than adding a permanent Playwright dependency."
  - "Added a narrow Sign in action to the session-expired state so the blocked UI has a visible recovery path."
patterns-established:
  - "Component tests use semantic queries, user-event, and small typed chat fixtures."
  - "RTL cleanup and requestAnimationFrame fallback live in src/test/setup.ts."
requirements-completed: [UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, TEST-03]
duration: 45min
completed: 2026-06-09
---

# Phase 04-03: Regression Test And Smoke Summary

**Phase 4 now has React 19 DOM regression coverage and documented smoke evidence for the reconstructed messenger UI.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-06-09T00:40:00+03:00
- **Completed:** 2026-06-09T00:53:00+03:00
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- Installed the approved DOM test dependencies: RTL, user-event, jest-dom, and jsdom.
- Configured Vitest/jsdom setup through the active `vitest.config.ts` and mirrored the same test block in `vite.config.ts`.
- Added shared typed fixtures for users, chats, and messages.
- Added component tests for empty/sidebar states, unread counts, no-selected-chat, session-expired recovery, failed-send retry/dismiss, tombstones, edited/sending/read states, composer keyboard behavior, action menu keyboard behavior, new-chat dialog focus, and message list callbacks.
- Added `dismissOptimisticMessage` coverage to ensure dismiss removes only the matching failed optimistic row.
- Recorded `04-SMOKE.md` with automated pass results, preview server probe evidence, and explicit skipped visual prerequisites.

## Task Commits

1. **Tasks 1-3: Add DOM harness, regression tests, session recovery action, and smoke artifact** - `37ff816` (`test(04-03): add chat UI regression coverage`)

## Files Created/Modified

- `Frontend/Chatify/package.json` - Added DOM test dev dependencies.
- `Frontend/Chatify/package-lock.json` - Locked DOM test dependencies.
- `Frontend/Chatify/vite.config.ts` - Added jsdom test setup metadata and preserved Vite build config.
- `Frontend/Chatify/vitest.config.ts` - Updated active Vitest discovery to include `.test.tsx`, jsdom, and setup file.
- `Frontend/Chatify/src/test/setup.ts` - Installed jest-dom matchers, RTL cleanup, and requestAnimationFrame fallback.
- `Frontend/Chatify/src/test/chatFixtures.ts` - Shared typed user/chat/message fixtures for component tests.
- `Frontend/Chatify/src/pages/chat/components/*.test.tsx` - Added focused DOM regression tests.
- `Frontend/Chatify/src/hooks/messageCache.test.ts` - Added failed optimistic dismissal coverage.
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx` - Added session-expired Sign in action.
- `.planning/phases/04-messenger-ui-reconstruction/04-SMOKE.md` - Recorded automated verification and desktop/mobile smoke outcomes or skipped reasons.

## Decisions Made

- Kept `vitest.config.ts` as the runner source of truth because the project already had that file and Vitest was ignoring the new TSX tests until it was updated.
- Kept no permanent browser automation dependency in this phase to honor D-20.
- Documented skipped visual smoke checks instead of inventing unauthenticated visual evidence.

## Deviations from Plan

- Added `NewChatDialog.test.tsx` and `ConversationPane.test.tsx` even though the initial artifact list focused on other component files. This directly covers the plan's dialog keyboard and session-expired requirements.
- Updated `vitest.config.ts` in addition to `vite.config.ts` because the dedicated Vitest config was the active test discovery source.

## Issues Encountered

- Initial Vitest discovery only found `src/**/*.test.ts` because `vitest.config.ts` excluded `.test.tsx`. Fixed by expanding include to `src/**/*.{test,spec}.{ts,tsx}`.
- Initial component test run kept DOM between tests because globals are disabled. Fixed by adding explicit `cleanup()` in `src/test/setup.ts`.

## Verification

- `cd Frontend/Chatify; npm test` - passed, 9 files and 28 tests.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed.
- `npx vitest list` - confirmed TSX component tests are discovered.
- `rg -n "react-dom/test-utils|Simulate" Frontend/Chatify/src` - no matches.
- `rg -n "@playwright/test|playwright" Frontend/Chatify/package.json` - no matches.
- Temporary preview probe: `npm run preview -- --host 127.0.0.1 --port 4177 --strictPort` responded with HTTP 200 and was stopped afterward.

## User Setup Required

None for automated tests. Manual visual review still needs an authenticated local chat fixture if the next phase wants browser screenshots.

## Next Phase Readiness

Phase 04 has all execution summaries and can move into final verification/review. Phase 05 can build on the tested messenger baseline.

---
*Phase: 04-messenger-ui-reconstruction*
*Completed: 2026-06-09*
