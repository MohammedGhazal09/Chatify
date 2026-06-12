---
phase: 07-messenger-functional-parity-restoration
plan: 02
subsystem: chat-ui
tags: [react, tanstack-query, socket-io, vitest, messenger-ui]
requires:
  - phase: 07-01-fixture-isolation
    provides: Product chat runtime without visual-smoke fixture bypass
provides:
  - Honest right-rail empty and unavailable states
  - Native-disabled unsupported header, rail, composer, and favorite controls
  - Composer, action-menu, cache, and socket behavior regression coverage
affects: [phase-07, phase-08, chat-ui, realtime]
tech-stack:
  added: []
  patterns: [state-backed security rows, native disabled unsupported controls, socket handler unit harness]
key-files:
  created: []
  modified:
    - Frontend/Chatify/src/pages/chat/chat.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx
    - Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx
    - Frontend/Chatify/src/pages/chat/components/*.test.tsx
    - Frontend/Chatify/src/hooks/useChatSocket.test.tsx
    - Frontend/Chatify/src/hooks/messageCache.test.ts
key-decisions:
  - "Right rail keeps layout but shows zero/unavailable states for pins, files, and media until Phase 08 data contracts exist."
  - "Security rows report auth, membership, and realtime connection state instead of fixed Verified/Secure claims."
  - "Unsupported controls remain visible only as native disabled controls with muted styling and no handlers."
patterns-established:
  - "Component tests assert absence of fake assets and exact disabled semantics."
  - "Socket tests invoke captured event handlers to prove post-mount cache and presence updates."
requirements-completed: [PARITY-01, PARITY-02, UI-01, UI-02, UI-03, UI-04, UI-05, BASE-01, BASE-02, BASE-03, BASE-04, BASE-05, MSG-01, MSG-02, MSG-04, MSG-05, RT-04, TEST-03]
duration: 10 min
completed: 2026-06-12
---

# Phase 07 Plan 02: Live Surface And Honest Controls Summary

**Messenger shell now renders supported behavior from live state and downgrades unsupported right-rail/control surfaces honestly**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-12T13:47:00Z
- **Completed:** 2026-06-12T13:57:14Z
- **Tasks:** 4
- **Files modified:** 12

## Accomplishments

- Removed fake right-rail pinned messages, shared files, shared media tiles, and fixed security claims.
- Added state-backed right-rail rows for authenticated session, member-only room, and realtime connection.
- Converted unsupported call, video, more, favorite, attach, and voice controls to native disabled buttons with muted styling.
- Changed composer session copy to "Authenticated private session" and blocked over-limit Enter sends at the route layer.
- Removed production file-chip rendering so file-like text stays ordinary text until Phase 08 attachments.
- Expanded component and hook tests for composer boundaries, failed-send retry/dismiss, message actions, message cache boundaries, and socket event cache/store updates.

## Task Commits

1. **Tasks 1-4: Right-rail honesty, disabled controls, composer/action behavior, realtime coverage** - `8e2736b` (test)

**Plan metadata:** this summary commit.

## Files Created/Modified

- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx` - Honest empty/unavailable sections and state-backed security rows.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - Native-disabled unsupported header controls.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - Native-disabled unsupported controls, over-limit status, honest session copy.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - Removed fake file-chip rendering.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - Passes auth/socket/offline/reconnect state to the rail and blocks over-limit sends.
- Component and hook tests - Expanded assertions for supported workflows and honest unavailable states.

## Decisions Made

- Preserved the visible Phase 06 shell but converted unsupported data surfaces to empty or unavailable states.
- Kept text messaging as the only Phase 07 send path; attachments, media, pins, calls, voice, and detail APIs remain Phase 08 or later.
- Preserved emoji reactions as an existing supported messenger action while testing the behavior path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first boundary test used slow per-character typing for 1000 characters and hit the Vitest timeout. It was changed to a direct change event because the behavior under test is the component boundary, not keyboard-repeat performance.
- `Offline` appears both in member presence and realtime status in the rail. The test was adjusted to assert the presence of the state without treating duplicate user-visible status text as a failure.

## Verification

- `cd Frontend/Chatify; npm test -- --run src/pages/chat/components/ChatContextRail.test.tsx src/pages/chat/components/ConversationHeader.test.tsx src/pages/chat/components/MessageComposer.test.tsx src/pages/chat/components/MessageBubble.test.tsx src/pages/chat/components/MessageActionMenu.test.tsx src/pages/chat/components/ConversationPane.test.tsx src/hooks/useChatSocket.test.tsx src/hooks/useChatQueries.test.tsx src/hooks/messageCache.test.ts` - passed, 9 files and 41 tests.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed.
- `rg -n "message-states-spec|delivery-metrics|retry-logic-notes|mediaTiles|sharedFiles|Verified|Secure session active|Socket connected" Frontend/Chatify/src/pages/chat/components --glob "!**/*.test.*"` - no production component matches.
- Source inspection/search found no new Phase 08 media, file, pin, call, voice, or conversation-detail APIs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for `07-03`: the runtime shell no longer displays fake product data, and browser behavior tests can now exercise supported workflows against production-style fixtures.

---
*Phase: 07-messenger-functional-parity-restoration*
*Completed: 2026-06-12*
