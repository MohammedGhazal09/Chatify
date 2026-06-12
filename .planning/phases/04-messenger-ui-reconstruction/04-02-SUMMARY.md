---
phase: 04-messenger-ui-reconstruction
plan: 02
subsystem: ui
tags: [react, vite, chat, accessibility, optimistic-state, lazy-loading]
requires:
  - phase: 04-01
    provides: Extracted chat component tree and chat page orchestration
provides:
  - UI-SPEC compliant chat layout, palette, spacing, and responsive drawer controls
  - Explicit loading, empty, offline, reconnecting, session-expired, sending, failed, deleted, edited, delivered, read, and typing states
  - Failed optimistic message retry and dismiss handling that preserves clientMessageId on retry
  - Lazy full emoji picker boundary with quick reactions kept inline
affects: [04-messenger-ui-reconstruction, 04-03, phase-5-baseline]
tech-stack:
  added: []
  patterns: [accessible-message-actions, lazy-optional-ui, query-owned-failed-send-dismissal]
key-files:
  created:
    - Frontend/Chatify/src/pages/chat/components/LazyEmojiPicker.tsx
  modified:
    - Frontend/Chatify/src/pages/chat/chat.tsx
    - Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageActionMenu.tsx
    - Frontend/Chatify/src/hooks/messageCache.ts
    - Frontend/Chatify/src/hooks/useChatQueries.ts
key-decisions:
  - "Kept browser-offline and session-expired states as composer-blocking conditions; temporary socket reconnecting remains a visible banner only."
  - "Dismissed failed optimistic rows through a narrow Query cache helper instead of adding component-owned durable message state."
  - "Lazy-loaded the full emoji picker through a dedicated component while keeping quick reaction buttons immediately available."
patterns-established:
  - "Message action menus are reachable through explicit buttons, right-click, Escape close, and focus return."
  - "Failed-send recovery is rendered inline in the failed bubble and uses the existing send mutation."
requirements-completed: [UI-01, UI-02, UI-03, UI-04, UI-05, UI-06]
duration: 35min
completed: 2026-06-09
---

# Phase 04-02: Messenger UI State Polish Summary

**Extracted chat components now carry the approved messenger visual system, recovery states, and accessible action controls.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-09T00:24:00+03:00
- **Completed:** 2026-06-09T00:39:00+03:00
- **Tasks:** 3
- **Files modified:** 19

## Accomplishments

- Applied the Phase 04 UI-SPEC palette and stable dimensions across shell, sidebar, header, list, composer, state views, dialogs, and message surfaces.
- Added explicit offline, reconnecting, session-expired, search-empty, empty-conversation, failed-send, sending, edited, deleted, delivered/read, and typing presentations.
- Added inline failed-send recovery with retry and dismiss controls. Retry preserves the failed row `clientMessageId`; dismiss removes only the matching failed optimistic row.
- Added browser online/offline tracking, guarded auto-scroll behavior, older-history scroll preservation, and conversation-level degraded-connection banners.
- Made mobile drawer, new-chat dialog, message action menu, composer, and message controls accessible through named buttons, dialog/menu semantics, Escape close, and focus return.
- Moved the full `emoji-picker-react` picker behind a lazy-loaded `LazyEmojiPicker` boundary while preserving inline quick reactions.

## Task Commits

1. **Tasks 1-3: Apply UI-SPEC, state recovery, accessibility, and lazy emoji loading** - `85f1a5e` (`feat(04-02): polish messenger states and actions`)

## Files Created/Modified

- `Frontend/Chatify/src/pages/chat/components/LazyEmojiPicker.tsx` - Lazy full emoji picker boundary with a dark fallback surface.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - Browser connection state, retry/dismiss failed-message callbacks, focus return, drawer/menu close behavior, and prop wiring.
- `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx` - UI-SPEC shell background, conversation region, and drawer overlay naming.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - Drawer sizing, accessible close/settings buttons, focused search, new-chat modal opener, and selection close.
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx` - Offline/reconnecting/session-expired state surfaces, composer disabled reasons, and state-view routing.
- `Frontend/Chatify/src/pages/chat/components/MessageList.tsx` - Search-empty state, stable scroll/list styling, and message action/retry/dismiss wiring.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - UI-SPEC bubble widths, deleted tombstones, failed-send recovery controls, action trigger, and metadata states.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - Disabled-state hints, lazy emoji picker trigger, accessible send control, and UI-SPEC composer surface.
- `Frontend/Chatify/src/pages/chat/components/MessageActionMenu.tsx` - Menu semantics, Escape close, focus handling, quick reactions, lazy full emoji picker, and named actions.
- `Frontend/Chatify/src/pages/chat/components/NewChatDialog.tsx` - Dialog semantics, outside close, Escape close, input focus, and opener focus return.
- `Frontend/Chatify/src/hooks/messageCache.ts` - `dismissOptimisticMessage` helper for failed optimistic rows.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Narrow `dismissFailedMessage` Query cache callback exposed through `useMessages`.
- `Frontend/Chatify/src/components/MessageStatus.tsx` - Accessible message status label.
- `Frontend/Chatify/src/components/TypingIndicator.tsx` - Polite live-region typing announcements.

## Decisions Made

- Kept temporary socket reconnecting non-blocking because HTTP send can still succeed while the socket reconnects.
- Treated browser offline and session expiration as composer-blocking states with visible copy instead of silently disabling the button.
- Kept the failed message text visible for context and placed retry/dismiss controls inside the bubble instead of moving recovery into a toast.
- Used Tailwind arbitrary color classes for Phase 04 UI-SPEC colors to avoid introducing a broad design-token layer mid-phase.

## Deviations from Plan

None - plan executed within the approved frontend-only boundary.

## Issues Encountered

- `ChatSidebar.tsx` briefly had a malformed duplicate `return` while adding the focus effect. Fixed before lint/build verification.
- The GSD state tool left `.planning/STATE.md` modified separately from this production commit; that state update is intentionally kept for the later documentation/state commit.

## Verification

- `cd Frontend/Chatify; npm test -- --run src/hooks/messageCache.test.ts` - passed, 1 file and 13 tests.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed; build emitted `emoji-picker-react.esm-*.js` as a separate lazy chunk.
- `rg -n "#101113|#181C20|#20262B|#2E363C|#14B8A6" Frontend/Chatify/src/pages/chat/components ...` - confirmed UI-SPEC palette usage.
- `rg -n "max-w-\\[85%\\]|md:max-w-\\[75%\\]|xl:max-w-\\[68%\\]" Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - confirmed responsive bubble width limits.
- `rg -n "emoji-picker-react" Frontend/Chatify/src/pages/chat` - confirmed only `LazyEmojiPicker.tsx` dynamically imports the picker.
- `rg -n "aria-label|aria-live|role=\"dialog\"|role=\"menu\"" ...` - confirmed named controls, live regions, dialog semantics, and menu semantics.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 04-03 can add focused component regression tests and smoke evidence against the extracted, polished component tree.

---
*Phase: 04-messenger-ui-reconstruction*
*Completed: 2026-06-09*
