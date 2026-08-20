---
phase: 04-messenger-ui-reconstruction
plan: 01
subsystem: ui
tags: [react, vite, chat, component-extraction, tanstack-query]
requires:
  - phase: 03-canonical-message-state
    provides: Query-owned message state, optimistic cache helpers, socket reconciliation, cursor history, and failed-send visibility
provides:
  - Extracted chat component tree for sidebar, conversation, message list, message bubble, composer, action menu, new-chat form, and state views
  - Pure chat display helpers for timestamps, date separators, titles, and direct-message participant lookup
  - Focused transient chat view state hook that does not own durable chat/message data
affects: [04-messenger-ui-reconstruction, 04-02, 04-03, phase-5-baseline]
tech-stack:
  added: []
  patterns: [route-orchestrator, prop-driven-chat-components, query-owned-chat-state]
key-files:
  created:
    - Frontend/Chatify/src/pages/chat/components/ChatShell.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx
    - Frontend/Chatify/src/pages/chat/hooks/useChatViewState.ts
    - Frontend/Chatify/src/pages/chat/utils/chatDisplay.ts
  modified:
    - Frontend/Chatify/src/pages/chat/chat.tsx
key-decisions:
  - "Kept TanStack Query, socket wiring, auth/presence stores, and mutation orchestration in chat.tsx."
  - "Moved presentational sections into chat-specific components without changing backend/API contracts."
patterns-established:
  - "Chat page orchestrates durable data and passes typed props into extracted components."
  - "Chat-specific components live under pages/chat/components and are re-exported through components/index.ts."
requirements-completed: [UI-01, UI-04, UI-06]
duration: 45min
completed: 2026-06-09
---

# Phase 04-01: Component Extraction Summary

**Chat page decomposed into prop-driven React components while preserving Phase 3 Query and socket ownership**

## Performance

- **Duration:** 45 min
- **Started:** 2026-06-09T00:06:00+03:00
- **Completed:** 2026-06-09T00:23:00+03:00
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Extracted the approved Phase 4 component tree: shell, sidebar, list item, conversation pane, header, message list, bubble, composer, action menu, new-chat form, and reusable state view.
- Moved pure display helpers into `chatDisplay.ts` and transient page UI state into `useChatViewState.ts`.
- Reduced `chat.tsx` to route orchestration: auth, presence, Query hooks, socket callbacks, mutation handlers, refs, and prop wiring.
- Preserved current search, export, reply, reaction, edit, delete, settings, typing, new-chat, unread, and older-message loading paths.

## Task Commits

1. **Tasks 1-3: Extract helpers, component tree, and route orchestration** - `bcee005` (`feat(04-01): extract chat UI components`)

## Files Created/Modified

- `Frontend/Chatify/src/pages/chat/chat.tsx` - Route orchestrator for existing hooks, sockets, mutations, refs, and callbacks.
- `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx` - Viewport shell, drawer overlay, sidebar/conversation regions, and overlays.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - Account controls, chat search, new-chat form, chat list states, and list item wiring.
- `Frontend/Chatify/src/pages/chat/components/ChatListItem.tsx` - Conversation row with title, latest message, timestamp, unread count, and online status.
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx` - Selected conversation composition for header, search, typing, list, and composer.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - Selected chat header, mobile drawer trigger, participant status, search, and export.
- `Frontend/Chatify/src/pages/chat/components/MessageList.tsx` - Message scroll region, load older control, separators, edit form, empty/error/loading states, and scroll button.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - Extracted message bubble with status, edited/deleted metadata, reactions, and seen-by text.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - Reply preview, text input, emoji picker trigger, send button, and send error copy.
- `Frontend/Chatify/src/pages/chat/components/MessageActionMenu.tsx` - Quick reactions, reply, edit, copy, delete-for-self, and delete-for-everyone controls.
- `Frontend/Chatify/src/pages/chat/components/NewChatDialog.tsx` - Existing email-based new-chat form extracted from the sidebar.
- `Frontend/Chatify/src/pages/chat/components/ChatStateView.tsx` - Reusable state block for empty/loading/error conversation surfaces.
- `Frontend/Chatify/src/pages/chat/components/index.ts` - Re-export barrel for chat-specific components.
- `Frontend/Chatify/src/pages/chat/hooks/useChatViewState.ts` - Transient UI state holder with no API/socket imports.
- `Frontend/Chatify/src/pages/chat/utils/chatDisplay.ts` - Timestamp, date separator, chat title, and direct-message member helpers.

## Decisions Made

- Kept `useDebounce` local to `chat.tsx` because it still coordinates socket typing side effects with composer input.
- Kept `NewChatDialog` visually inline for 04-01 to preserve behavior; 04-02 owns modal/sheet polish.
- Kept emoji picker imports inside extracted UI components for 04-01; 04-02 owns lazy-loading heavy optional UI.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Build initially surfaced a React-vs-DOM `MouseEvent` type collision in document event listeners. Fixed by aliasing React mouse events as `ReactMouseEvent`.
- Lint initially warned that `allMessages` could change hook dependencies on every render. Fixed by memoizing `allMessages` and `conversationMessages`.

## Verification

- `cd Frontend/Chatify; npm test` - passed, 1 file and 13 tests.
- `cd Frontend/Chatify; npm run lint` - passed with no warnings after cleanup.
- `cd Frontend/Chatify; npm run build` - passed.
- `rg -n "const MessageBubble|interface MessageBubbleProps" Frontend/Chatify/src/pages/chat/chat.tsx` - returned no inline bubble definition.
- `Get-ChildItem Frontend/Chatify/src/pages/chat/components` - target component files exist.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 04-02 can apply the approved visual/state/accessibility reconstruction to the extracted components without touching backend contracts.

---
*Phase: 04-messenger-ui-reconstruction*
*Completed: 2026-06-09*
