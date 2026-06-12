# Phase 04: Messenger UI Reconstruction - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 04 rebuilds the existing Chatify chat page into a polished, responsive, accessible direct-message messenger interface. The phase clarifies and implements UI structure, visual state handling, recovery paths, component boundaries, and frontend regression coverage on top of the Phase 3 canonical message state contract. It does not expand backend contracts or add new messenger baseline features beyond preserving current affordances.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `04-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `04-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Componentize the current chat page into focused layout, sidebar, list, bubble, composer, action menu, dialog/sheet, and state-view units.
- Redesign the desktop and mobile messenger surface around a professional direct-message baseline.
- Preserve current search/export/reply/reaction/edit/delete affordances without expanding their feature scope.
- Use a compact modal or sheet for starting a new chat.
- Use a mobile sidebar drawer below the Tailwind `md` breakpoint.
- Add explicit visual states for chat, message, connection, session, and recovery states.
- Add focused React/Vitest component tests and keep existing message cache helper tests.
- Use browser or screenshot smoke checks for desktop and mobile layout verification.

**Out of scope (from SPEC.md):**
- New backend message, chat, socket, or auth APIs except narrow bug fixes.
- Group chats, attachments, notifications, moderation, admin tooling, and end-to-end encryption.
- Advanced search/export/reply expansion and navigation continuity beyond preserving existing affordances.
- Permanent end-to-end test suite setup unless required by a blocker.
- Message virtualization unless performance evidence proves it is necessary.
- Broad design-system or routing rewrites.

</spec_lock>

<decisions>
## Implementation Decisions

### Artifact Sequencing
- **D-01:** Recover the missing `04-SPEC.md` before writing discuss context, then capture implementation decisions in `04-CONTEXT.md`.

### Component Decomposition
- **D-02:** Extract layout and presentational components first, then move repeated behavior into hooks after parity is clear.
- **D-03:** Target a minimum component tree of `ChatShell`, `ChatSidebar`, `ChatListItem`, `ConversationPane`, `ConversationHeader`, `MessageList`, `MessageBubble`, `MessageComposer`, `MessageActionMenu`, `NewChatDialog`, and `ChatStateView`.
- **D-04:** Keep durable chat/message state in TanStack Query hooks; move transient UI state into component-local state or a focused `useChatViewState`.

### Styling And Interaction
- **D-05:** Use Tailwind for layout and visual states, and keep `chat.css` only for scrollbars and small animations.
- **D-06:** Preserve search, export, reply, reactions, edit, and delete at their current capability level without feature expansion.
- **D-07:** Use a compact modal or sheet for new-chat creation.
- **D-08:** Use the Tailwind `md` boundary for mobile drawer behavior. The drawer closes on chat selection, outside click, and Escape.
- **D-09:** Auto-scroll only when the user is near the bottom or sends their own message; preserve scroll when loading older messages.

### Recovery And State Visibility
- **D-10:** Failed sends stay inline with failed status, retry, and dismiss actions.
- **D-11:** Retry should preserve optimistic/client identity where possible.
- **D-12:** Show a visible connection banner and composer hint for degraded connection states.
- **D-13:** Disable sending only for browser offline or session-expired states, not for temporary socket reconnect if HTTP send can still work.
- **D-14:** Session expiration appears as a chat-level blocked state with a clear re-login path while preserving route guard behavior.

### Actions, Emoji, And Accessibility
- **D-15:** Desktop message actions use hover/kebab and right-click behavior; mobile uses an explicit kebab control. Long-press is deferred unless trivial and testable.
- **D-16:** Quick reactions stay lightweight, and the full emoji picker is lazy-loaded only when opened.
- **D-17:** Icon buttons, modals, drawers, and menus must have accessible names, keyboard handling, Escape close behavior, focus return, and appropriate `aria-live` announcements.

### Testing And Verification
- **D-18:** Add `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom` for React 19 component tests.
- **D-19:** Keep helper tests for cache/merge logic and add component tests for optimistic send, rollback, duplicate merge display, unread updates, session-expired UI, empty states, and failed-send actions.
- **D-20:** Do not add a permanent Playwright suite in this phase unless required by a blocker. Use committed RTL/Vitest tests plus desktop/mobile smoke verification.
- **D-21:** Preserve current route chunking and only lazy-load heavy optional UI such as the emoji picker if needed.
- **D-22:** Keep the three planned work slices: `04-01` extraction, `04-02` redesign/states, and `04-03` regression coverage, with tests added incrementally.
- **D-23:** Completion is blocked on frontend test, lint, build, and desktop/mobile smoke verification or explicit skipped-check documentation.

### Agent Discretion
The agent may choose exact file boundaries, component prop shapes, class names, and minor UI copy where they preserve the approved UX direction and existing contracts. The agent may add small helper hooks/components when they improve testability or reduce real duplication.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project And Phase Scope
- `.planning/PROJECT.md` - Project value, collaboration preference, brownfield constraints, and repository hygiene constraints.
- `.planning/REQUIREMENTS.md` - UI-01 through UI-06 and TEST-03 requirements for Phase 04.
- `.planning/ROADMAP.md` - Phase 04 goal, success criteria, and planned work slices.
- `.planning/STATE.md` - Current project position and Phase 3 decisions that Phase 4 must build on.
- `.planning/phases/04-messenger-ui-reconstruction/04-SPEC.md` - Locked Phase 04 requirements, boundaries, UX decisions, and acceptance criteria.

### Prior Phase Contracts
- `.planning/phases/03-canonical-message-state/03-01-SUMMARY.md` - Backend canonical message state, idempotent create, status helpers, tombstones, and unread count contracts.
- `.planning/phases/03-canonical-message-state/03-02-SUMMARY.md` - Frontend Query-owned message state, optimistic merge/rollback helpers, and failed-send visibility.
- `.planning/phases/03-canonical-message-state/03-03-SUMMARY.md` - Cursor history, per-user latestMessage projection, and validation boundaries.

### Frontend Code To Scout
- `Frontend/Chatify/src/pages/chat/chat.tsx` - Existing monolithic chat page to decompose.
- `Frontend/Chatify/src/pages/chat/chat.css` - Existing chat-specific scrollbars and animations.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Query and mutation integration for chat state.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - Socket event integration for chat UI.
- `Frontend/Chatify/src/hooks/messageCache.ts` - Canonical frontend cache merge helpers.
- `Frontend/Chatify/src/hooks/messageCache.test.ts` - Existing frontend helper regression tests.
- `Frontend/Chatify/src/components/MessageStatus.tsx` - Existing message status display.
- `Frontend/Chatify/src/components/ConnectionIndicator.tsx` - Existing connection state display.
- `Frontend/Chatify/src/components/TypingIndicator.tsx` - Existing typing indicator.
- `Frontend/Chatify/src/components/Toast.tsx` - Existing toast surface.
- `Frontend/Chatify/package.json` - Frontend scripts and dependencies.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MessageStatus`: Reuse or adapt for delivered/read/sending/failed visual state.
- `ConnectionIndicator`: Promote into the chat layout or reuse for connection banners.
- `TypingIndicator`: Reuse for inline typing display above the composer.
- `Toast`: Reuse for transient non-blocking feedback where inline state is not enough.
- `messageCache` helpers: Preserve as the source of truth for merge/rollback behavior.

### Established Patterns
- Frontend transport stays behind API modules and hooks.
- TanStack Query owns server-backed chat/message state.
- Zustand stores hold auth and presence state.
- Frontend imports use relative paths and omit file extensions.
- New frontend code must satisfy strict TypeScript and ESLint settings.

### Integration Points
- New components will replace sections of `Frontend/Chatify/src/pages/chat/chat.tsx`.
- UI tests should target extracted components and mocked hook data rather than the full socket/backend stack.
- The composer and message actions must continue using existing mutation/socket integration through `useChatQueries` and `useChatSocket`.

</code_context>

<specifics>
## Specific Ideas

- Direct-message messenger baseline inspired by WhatsApp/Telegram-style layouts.
- Comfortable density with clear states rather than oversized decorative panels.
- Explicit inline failed-send recovery.
- Mobile-first drawer behavior with desktop sidebar parity.
- Token-ready dark baseline without a one-note palette.

</specifics>

<deferred>
## Deferred Ideas

- Advanced conversation/contact search and message search improvements belong to Phase 5.
- Export improvements belong to a later feature pass.
- Threaded replies, long-press gesture polish, virtualization, and permanent e2e coverage are deferred unless they become blockers.

</deferred>

---

*Phase: 04-messenger-ui-reconstruction*
*Context gathered: 2026-06-08*
