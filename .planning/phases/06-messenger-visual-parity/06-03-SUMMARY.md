---
phase: 06-messenger-visual-parity
plan: 03
subsystem: visual-smoke-evidence
tags: [playwright, screenshots, visual-verification, accessibility, responsive-ui]
requires:
  - phase: 06-01
    provides: theme override, abstract identity, desktop shell, context rail
  - phase: 06-02
    provides: mobile conversation, message stream, composer, and state surface parity
provides:
  - Deterministic Phase 06 coded visual fixture
  - Desktop light/dark and mobile light/dark Playwright screenshots
  - Playwright assertions for theme forcing, rails, mobile chrome hiding, search reuse, composer boundary, no overflow, and no profile-photo rendering
  - Final Phase 06 smoke evidence
affects: [06-messenger-visual-parity, chat-ui, visual-verification]
tech-stack:
  added: []
  patterns: [route-intercepted-visual-smoke, coded-non-person-fixtures, screenshot-evidence]
key-files:
  created:
    - Frontend/Chatify/src/pages/chat/components/Phase06VisualFixture.ts
    - Frontend/Chatify/src/pages/chat/components/Phase06VisualFixture.test.tsx
    - .planning/phases/06-messenger-visual-parity/06-SMOKE.md
    - .planning/phases/06-messenger-visual-parity/06-ui-desktop-light.png
    - .planning/phases/06-messenger-visual-parity/06-ui-desktop-dark.png
    - .planning/phases/06-messenger-visual-parity/06-ui-mobile-light.png
    - .planning/phases/06-messenger-visual-parity/06-ui-mobile-dark.png
  modified:
    - Frontend/Chatify/e2e/chat-ui-smoke.spec.ts
    - Frontend/Chatify/src/components/MessageStatus.test.tsx
    - Frontend/Chatify/src/pages/chat/chat.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatShell.tsx
    - Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageList.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx
    - Frontend/Chatify/src/test/chatFixtures.ts
key-decisions:
  - "Visual smoke uses coded non-person labels and fake profilePic inputs to prove identity surfaces stay abstract."
  - "The normal chat route remains under test; `chatVisualSmoke=phase06` only disables Socket.IO connection attempts for deterministic screenshots."
  - "The mobile screenshot intentionally scrolls to the bottom state so file-chip, retrying, failed-send, and composer states are visible together."
  - "Pixel-diff thresholds remain deferred; Playwright layout/accessibility assertions plus screenshot artifacts are the Phase 06 gate."
requirements-completed: [UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, TEST-03]
duration: 24m
completed: 2026-06-12
---

# Phase 06-03: Visual Smoke Evidence Summary

Chatify now has repeatable Phase 06 visual smoke coverage and four committed screenshot artifacts for desktop/mobile and light/dark theme parity.

## Performance

- **Duration:** 24m
- **Started:** 2026-06-12T14:14:43+03:00
- **Completed:** 2026-06-12T14:38:30+03:00
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Added a deterministic coded Phase 06 fixture with no human/person labels and fake `profilePic` inputs.
- Rebuilt Playwright smoke around the Phase 06 fixture while keeping the normal chat route and production components under test.
- Captured required screenshots:
  - `.planning/phases/06-messenger-visual-parity/06-ui-desktop-light.png`
  - `.planning/phases/06-messenger-visual-parity/06-ui-desktop-dark.png`
  - `.planning/phases/06-messenger-visual-parity/06-ui-mobile-light.png`
  - `.planning/phases/06-messenger-visual-parity/06-ui-mobile-dark.png`
- Added assertions for theme forcing, desktop rails, mobile hidden chrome, composer boundary, search reuse, accessible controls, no horizontal overflow, and no profile-photo `<img>` rendering.
- Fixed mobile header parity by keeping the Call action visible at mobile width.
- Added `min-h-0` and bottom-padding fixes so scrollable conversation content clears the composer dock.
- Softened failed-message styling while preserving text/action recovery cues.
- Recorded final smoke evidence in `06-SMOKE.md`.

## Task Commits

1. **Visual smoke fixture, screenshots, and evidence** - `35d6576` (`test(06-03): add visual parity smoke evidence`)

## Deviations from Plan

- Added the query flag `chatVisualSmoke=phase06` to disable Socket.IO connection attempts during visual smoke only. This avoids false reconnect UI in deterministic screenshots while still testing the normal chat route with intercepted REST/auth/chat/message calls.
- Playwright scrolls the mobile message list to the bottom before mobile screenshots so the required retrying, failed-send, file-chip, secure-session, and composer states fit in one deterministic viewport.

## Issues Encountered

- Initial Playwright locators collided with intentionally repeated labels in the center pane, sidebar, and right rail. Assertions were scoped to the intended region.
- Mobile composer-boundary checks exposed missing flex/grid shrink constraints and insufficient message-list bottom padding. `min-h-0` and explicit dock-safe padding fixed the layout.
- Full Vitest found a stale Phase 04 `MessageStatus` color assertion. The test now verifies Phase 06 inherited opacity states.

## Verification

- `cd Frontend/Chatify; npm test` - PASS, 22 files / 68 tests.
- `cd Frontend/Chatify; npm run test:ui` - PASS, 8 Playwright tests.
- `cd Frontend/Chatify; npm run lint` - PASS.
- `cd Frontend/Chatify; npm run build` - PASS.
- `git diff --check` - PASS, no whitespace errors.
- `Test-Path .planning/phases/06-messenger-visual-parity/06-ui-desktop-light.png` - PASS.
- `Test-Path .planning/phases/06-messenger-visual-parity/06-ui-desktop-dark.png` - PASS.
- `Test-Path .planning/phases/06-messenger-visual-parity/06-ui-mobile-light.png` - PASS.
- `Test-Path .planning/phases/06-messenger-visual-parity/06-ui-mobile-dark.png` - PASS.
- `rg -n "profilePic|<img|avatar" Frontend/Chatify/src/pages/chat/components -g "!*.test.tsx" -g "!Phase06VisualFixture.ts"` - PASS, no matches.
- `rg -n "axios|fetch\\(|/api/|messageApi|chatApi" Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx Frontend/Chatify/src/pages/chat/components/Phase06VisualFixture.ts` - PASS, no matches.

## Self-Check: PASSED

- Four required screenshots exist and are committed.
- Fixture identities are coded/abstract and no chat identity surface renders profile photos.
- Header and right rail search reuse the same in-conversation message-search mode.
- Mobile primary view hides sidebar/right rail chrome until drawer interaction.
- Composer and newest-message spacing is covered by Playwright.
- Full frontend verification passed.

## Phase Completion Readiness

Phase 06 is ready to mark complete.
