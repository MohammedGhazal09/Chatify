# Phase 04: Messenger UI Reconstruction - Specification

**Status:** Approved
**Created:** 2026-06-08
**Phase:** 04-messenger-ui-reconstruction

## Goal

Rebuild the existing monolithic chat page into a polished, responsive messenger interface that sits on top of the Phase 3 canonical message state contract. Users should be able to understand conversation state, send and recover messages confidently, and use core message actions without layout instability on desktop or mobile.

## Requirements

1. The chat page MUST render a responsive messenger layout with a conversation sidebar, selected conversation header, message list, composer, and message actions.
2. The UI MUST clearly communicate loading, empty, offline, error, sending, failed-send, deleted, edited, delivered, read, and typing states.
3. Failed sends and network errors MUST be recoverable without losing message context.
4. Message actions MUST work without layout shifts, overlapping controls, or hidden state changes on desktop and mobile.
5. Chat UI code MUST be split into focused components and hooks so future changes are testable and reviewable.
6. Frontend tests MUST cover optimistic send, rollback, duplicate merge display, unread updates, session-expired state, failed-send recovery, and core UI states.
7. Existing chat affordances such as search, export, reply, reactions, edit, and delete MUST be preserved at their current capability level unless a UI-blocking bug requires a narrow fix.
8. The implementation MUST preserve the Phase 3 canonical message contract: TanStack Query owns durable message state, optimistic/socket/mutation/refetch paths merge by `_id` and `clientMessageId`, and failed optimistic messages remain visible.
9. The implementation MUST keep the existing React/Vite, TanStack Query, Zustand, Tailwind, Socket.IO client, and npm package layout.
10. The implementation MUST NOT introduce backend/API contract changes unless required to fix a blocker discovered during UI reconstruction.

## Boundaries

### In Scope

- Componentize the current chat page into focused layout, sidebar, list, bubble, composer, action menu, dialog/sheet, and state-view units.
- Redesign the desktop and mobile messenger surface around a professional direct-message baseline.
- Preserve current search/export/reply/reaction/edit/delete affordances without expanding their feature scope.
- Use a compact modal or sheet for starting a new chat.
- Use a mobile sidebar drawer below the Tailwind `md` breakpoint.
- Add explicit visual states for empty conversation, empty sidebar, no selected chat, no search results, connection degradation, session expiration, failed sends, typing, read/delivered, edited, and deleted messages.
- Add focused React/Vitest component tests and keep existing message cache helper tests.
- Use browser or screenshot smoke checks for desktop and mobile layout verification.

### Out of Scope

- New backend message, chat, socket, or auth APIs except narrow bug fixes.
- Group chats, attachments, notifications, moderation, admin tooling, and end-to-end encryption.
- Advanced message search, conversation search expansion, export improvements, threaded replies, and navigation continuity beyond preserving existing affordances.
- Permanent end-to-end test suite setup unless required by a blocker.
- Message virtualization unless performance evidence proves it is necessary in this phase.
- Broad design-system or routing rewrites.

## UX Decisions

- The UI direction is a WhatsApp/Telegram-style private direct-message messenger, not a social feed, dashboard, or Discord/Slack clone.
- Density should be comfortable: usable for repeated messaging, not oversized marketing-style UI.
- The color direction should be token-ready and dark-mode-friendly while avoiding a one-note palette.
- The sidebar becomes an overlay drawer on mobile and closes on chat selection, outside click, or Escape.
- Message actions use hover/kebab and right-click behavior on desktop, and an explicit kebab control on mobile. Long-press is deferred unless trivial and testable.
- Quick reactions stay lightweight; the full emoji picker is lazy-loaded only when opened.
- Typing appears inline at the bottom of the message list above the composer.
- Older history loading remains manual and must preserve scroll position.
- The message list auto-scrolls only when the user is already near the bottom or sends their own message.

## State And Recovery Decisions

- Server and durable message state stay in TanStack Query hooks.
- Transient UI state moves into component-local state or a focused `useChatViewState` hook.
- Failed sends remain inline with retry and dismiss actions.
- Retry should preserve the optimistic/client identity where possible.
- Connection degradation shows a visible conversation banner and composer hint.
- Sending is disabled only for browser offline or session-expired states, not for temporary socket reconnect if HTTP send can still work.
- Session expiration appears as a chat-level blocked state with a clear re-login path while preserving existing route guard behavior.

## Component Target

The implementation should converge on this minimum component shape:

- `ChatShell`
- `ChatSidebar`
- `ChatListItem`
- `ConversationPane`
- `ConversationHeader`
- `MessageList`
- `MessageBubble`
- `MessageComposer`
- `MessageActionMenu`
- `NewChatDialog`
- `ChatStateView`

Additional focused hooks/components are allowed when they reduce real complexity or improve testability.

## Testing And Verification

- Add frontend DOM test dependencies as needed: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom`.
- Component tests should cover UI behavior and states; helper tests should continue covering cache/merge logic.
- Required verification before completion:
  - `npm test` from `Frontend/Chatify`
  - `npm run lint` from `Frontend/Chatify`
  - `npm run build` from `Frontend/Chatify`
  - Desktop and mobile smoke verification of the chat layout
- Any skipped verification must be explicitly documented with the reason.

## Acceptance Criteria

1. A user can use the chat page on desktop and mobile with a stable sidebar, selected conversation header, message list, composer, and actions.
2. The user can distinguish loading, empty, offline, error, sending, failed-send, deleted, edited, delivered, read, and typing states without inspecting developer tools.
3. A failed send remains visible and can be retried or dismissed without losing conversation context.
4. Message actions are reachable on desktop and mobile without overlapping or resizing the message layout unpredictably.
5. The chat page is decomposed into focused components/hooks and no longer relies on one monolithic page for all behavior.
6. Frontend tests cover the required optimistic-state and core UI regressions.
7. Frontend lint, build, and tests pass, and desktop/mobile smoke checks are documented.

## Deferred Ideas

- Advanced conversation/contact search and message search improvements belong to Phase 5.
- Export improvements belong to a later feature pass.
- Threaded replies, long-press gesture polish, virtualization, and a permanent e2e suite are deferred unless they become blockers.

---

*Phase: 04-messenger-ui-reconstruction*
*Spec approved: 2026-06-08*
