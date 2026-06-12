---
phase: 09-messenger-interaction-quality-gate
plan: 02
subsystem: testing
tags: [accessibility, axe, keyboard, focus, layout, privacy]
requires:
  - phase: 09-messenger-interaction-quality-gate
    provides: Phase 09 browser gate foundation
provides:
  - Axe-backed assembled messenger accessibility scans
  - Keyboard and focus-return browser checks
  - Responsive layout and touch target checks
  - Production fixes for contrast and drawer focus return
affects: [phase-09, accessibility, frontend-chat, chat-theme]
tech-stack:
  added: [@axe-core/playwright]
  patterns: [assembled-shell accessibility scans, focused geometry assertions]
key-files:
  created: []
  modified: [Frontend/Chatify/package.json, Frontend/Chatify/package-lock.json, Frontend/Chatify/e2e/chat-quality-gate.spec.ts, Frontend/Chatify/e2e/pages/chatPage.ts, Frontend/Chatify/src/pages/chat/chat.css, Frontend/Chatify/src/pages/chat/chat.tsx, Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx, Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx, Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx]
key-decisions:
  - "Install @axe-core/playwright because dependency resolution succeeded cleanly."
  - "Fix accessibility blockers in production code rather than suppressing axe rules."
patterns-established:
  - "Phase 09 accessibility scans run after real UI interactions, not first paint."
  - "Mobile drawer close paths must return focus to their opener."
requirements-completed: [TEST-03, TEST-05, PARITY-01, PARITY-02, PARITY-03, UI-01, UI-02, UI-03, UI-04, UI-05, BASE-01, BASE-02, MEDIA-01, MEDIA-02, MEDIA-03]
duration: 45min
completed: 2026-06-12
---

# Phase 09-02: Accessibility Layout Guardrails Summary

**Axe, keyboard, focus, layout, touch-target, and privacy checks for the assembled messenger**

## Performance

- **Duration:** 45 min
- **Started:** 2026-06-12T20:00:00Z
- **Completed:** 2026-06-12T20:45:00Z
- **Tasks:** 4
- **Files modified:** 9

## Accomplishments

- Installed `@axe-core/playwright` and added desktop/mobile assembled-shell scans.
- Added keyboard checks for Enter send, Shift+Enter newline, Escape close, focus return, and message action menu close.
- Added automated layout/touch checks for overflow, composer overlap, rail/drawer bounds, and visible mobile controls.
- Fixed real accessibility blockers discovered by the gate: light contrast tokens, own-message timestamp contrast, failed-message metadata contrast, and mobile detail drawer focus return.

## Task Commits

1. **Task 1-4: Accessibility, keyboard, layout, privacy, and blocker fixes** - `e86459c` (test/fix)

**Plan metadata:** included in the Phase 09 documentation commit.

## Files Created/Modified

- `Frontend/Chatify/package.json` and `Frontend/Chatify/package-lock.json` - Added `@axe-core/playwright`.
- `Frontend/Chatify/e2e/chat-quality-gate.spec.ts` - Assembled axe, keyboard, layout, privacy, and touch target checks.
- `Frontend/Chatify/e2e/pages/chatPage.ts` - Geometry, touch target, and privacy helper support.
- `Frontend/Chatify/src/pages/chat/chat.css` - Improved light-theme soft, success, and warning contrast.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - Correct metadata contrast for own and failed messages.
- `Frontend/Chatify/src/pages/chat/chat.tsx`, `ConversationHeader.tsx`, `ConversationPane.tsx` - Detail drawer focus return path.

## Decisions Made

- No axe rules were disabled; every reported violation was treated as a blocker.
- The detail drawer focus fix was implemented through an explicit button ref rather than querying the DOM.

## Deviations from Plan

### Auto-fixed Issues

**1. Axe color contrast blockers**
- **Found during:** Phase 09 Playwright gate.
- **Issue:** Light-theme metadata/status text and own-message metadata failed WCAG contrast.
- **Fix:** Darkened light soft/success/warning tokens and increased own-message metadata opacity.
- **Files modified:** `chat.css`, `MessageBubble.tsx`
- **Verification:** Phase 09 Playwright gate passed.
- **Committed in:** `e86459c`

**2. Mobile drawer focus return**
- **Found during:** Phase 09 Playwright gate.
- **Issue:** Escape closed the mobile detail drawer but left focus inactive.
- **Fix:** Added a detail button ref and close handler that returns focus.
- **Files modified:** `chat.tsx`, `ConversationHeader.tsx`, `ConversationPane.tsx`
- **Verification:** Phase 09 Playwright gate passed.
- **Committed in:** `e86459c`

## Issues Encountered

- The hidden file input shares the attach control label and confused touch target checks. The helper now prefers visible `button[aria-label=...]` controls.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 09-03 could run the full backend/frontend/browser gate and record durable evidence.

---
*Phase: 09-messenger-interaction-quality-gate*
*Completed: 2026-06-12*
