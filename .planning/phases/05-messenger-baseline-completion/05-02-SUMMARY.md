---
phase: 05-messenger-baseline-completion
plan: 02
subsystem: messenger-session-navigation
tags: [react, localStorage, url-state, auth-cleanup, presence, playwright]
requires:
  - phase: 05-01
    provides: direct-chat continuation, selected-chat message search API, and frontend result mode
  - phase: 04-messenger-ui-reconstruction
    provides: route shell, chat components, component tests, and Playwright smoke harness
provides:
  - Safe selected-chat restore from URL, per-user storage, and most recent accessible chat
  - Auth-expired event cleanup for private chat state, query cache, URL state, storage, presence, and typing maps
  - Presence store cleanup actions and selected-chat typing cleanup in the socket hook
  - Phase 05 route-intercepted Playwright smoke for desktop, mobile, New chat continuation, URL restore, and auth loss
  - Phase 05 smoke evidence artifact and screenshots
affects: [05-messenger-baseline-completion, v1-baseline-verification, auth-session-recovery]
tech-stack:
  added: []
  patterns: [per-user-selected-chat-storage, url-chat-restore, auth-expired-browser-event, deterministic-playwright-fixtures]
key-files:
  created:
    - Frontend/Chatify/src/pages/chat/hooks/useSelectedChatPersistence.ts
    - Frontend/Chatify/src/pages/chat/hooks/useSelectedChatPersistence.test.tsx
    - Frontend/Chatify/src/api/axios.test.ts
    - Frontend/Chatify/src/store/presenceStore.test.ts
    - .planning/phases/05-messenger-baseline-completion/05-SMOKE.md
    - .planning/phases/05-messenger-baseline-completion/05-ui-smoke-desktop-search.png
    - .planning/phases/05-messenger-baseline-completion/05-ui-smoke-mobile-drawer-search.png
  modified:
    - Frontend/Chatify/src/pages/chat/chat.tsx
    - Frontend/Chatify/src/api/axios.ts
    - Frontend/Chatify/src/hooks/useAuthQuery.ts
    - Frontend/Chatify/src/hooks/useChatSocket.ts
    - Frontend/Chatify/src/store/presenceStore.ts
    - Frontend/Chatify/src/store/authstore.ts
    - Frontend/Chatify/e2e/chat-ui-smoke.spec.ts
key-decisions:
  - "Selected-chat restore priority is URL chatId, then per-user localStorage, then newest accessible chat."
  - "Axios only dispatches chatify:auth-expired; ChatPage owns store/query/UI cleanup."
  - "Auth bootstrap starts in loading state so protected routing preserves incoming query params until auth init completes."
patterns-established:
  - "URL and localStorage chat ids are always validated against loaded accessible chats before selection."
  - "Auth loss cleanup clears private durable and transient frontend state through a single ChatPage callback."
  - "Playwright smoke remains deterministic through route interception instead of seeded backend data."
requirements-completed: [BASE-03, BASE-05, TEST-03]
duration: 39min
completed: 2026-06-09
---

# Phase 05-02: Navigation, Session Cleanup, And Smoke Summary

**Chatify now restores conversations safely, clears private state on auth loss, and has deterministic desktop/mobile smoke evidence for the v1 messenger baseline.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-06-09T05:54:45+03:00
- **Completed:** 2026-06-09T06:13:32+03:00
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Added `useSelectedChatPersistence` with URL, per-user storage, and newest-chat fallback behavior.
- Replaced the previous first-chat auto-select behavior with validated selected-chat persistence.
- Added `chatify:auth-expired` dispatch on unrecoverable refresh failure.
- Added full presence and typing cleanup actions to the presence store.
- Cleared private chat state, query cache, selected chat, sidebar search, message search, URL state, storage, presence, and typing on logout/auth loss.
- Cleared previous-room typing state in the socket hook when the selected chat changes.
- Extended Playwright smoke to cover desktop conversation search, message search result mode, mobile drawer search, exact-email New chat continuation, URL restore, invalid URL fallback, and auth-expired private-content hiding.
- Recorded `05-SMOKE.md` and generated Phase 05 smoke screenshots.

## Task Commits

Each task was committed atomically:

1. **Task 1: Persist selected chat through URL and per-user localStorage safely** - `468a823` (`feat(05-02): persist selected chat safely`)
2. **Task 2: Clear private chat state on logout, auth refresh failure, and selected-chat changes** - `d1d536e` (`feat(05-02): clear private chat state on auth loss`)
3. **Task 3: Extend focused smoke coverage and record Phase 05 verification evidence** - `4dce35b` (`test(05-02): extend messenger baseline smoke`)

## Files Created/Modified

- `Frontend/Chatify/src/pages/chat/hooks/useSelectedChatPersistence.ts` - Restores and persists selected chat safely.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - Wires selected-chat persistence and auth-loss private state cleanup.
- `Frontend/Chatify/src/api/axios.ts` - Dispatches `chatify:auth-expired` after failed refresh recovery.
- `Frontend/Chatify/src/hooks/useAuthQuery.ts` - Clears presence state during logout cleanup.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - Clears typing on chat changes and transient realtime state on teardown.
- `Frontend/Chatify/src/store/presenceStore.ts` - Adds `clearAllTyping()` and `clearPresenceState()`.
- `Frontend/Chatify/src/store/authstore.ts` - Starts auth initialization in loading state to preserve incoming query params.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` - Adds five Phase 05 deterministic smoke flows.
- `.planning/phases/05-messenger-baseline-completion/05-SMOKE.md` - Records full Phase 05 smoke evidence.

## Decisions Made

- Kept the route as `/` with `?chatId=` rather than adding a new route shape.
- Kept Axios store-agnostic by dispatching a browser event and letting ChatPage handle app cleanup.
- Treated auth-expired smoke as a private-content hiding check that routes to `/login` through the existing `ProtectedRoute` contract.

## Deviations from Plan

### Auto-fixed Issues

**1. Auth bootstrap query-param loss**
- **Found during:** Task 3 (Playwright URL restore smoke)
- **Issue:** The auth store initially set `isLoading: false`, allowing `ProtectedRoute` to redirect before auth initialization preserved `?chatId=`.
- **Fix:** Start auth state with `isLoading: true` so App renders the loading state until `useAuthInit` finishes.
- **Files modified:** `Frontend/Chatify/src/store/authstore.ts`
- **Verification:** `npm run test:ui` now passes URL restore smoke.
- **Committed in:** `4dce35b` (part of task commit)

---

**Total deviations:** 1 auto-fixed (runtime URL restore blocker)
**Impact on plan:** Required for approved URL restore behavior; no scope creep.

## Issues Encountered

- Playwright initially expected invalid URL fallback to newest chat, but the approved restore priority falls back to per-user storage after a prior valid selection. The smoke assertion was corrected to match the approved priority.

## Verification

- `cd Backend/Chatify; npm test` - PASS, 12 files / 66 tests.
- `cd Frontend/Chatify; npm test` - PASS, 14 files / 50 tests.
- `cd Frontend/Chatify; npm run test:ui` - PASS, 5 Playwright tests.
- `cd Frontend/Chatify; npm run lint` - PASS.
- `cd Frontend/Chatify; npm run build` - PASS.
- `rg -n "presence.*api|api.*presence|user-search|search-users" Frontend/Chatify/src Backend/Chatify` - PASS, no matches.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 05 completes the v1 messenger baseline acceptance layer. The project is ready for phase-level verification/closure or the next milestone decision.

---
*Phase: 05-messenger-baseline-completion*
*Completed: 2026-06-09*
