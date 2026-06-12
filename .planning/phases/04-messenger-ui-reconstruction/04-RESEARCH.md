# Phase 04: Messenger UI Reconstruction - Research

**Researched:** 2026-06-08
**Domain:** React 19, Vite, Tailwind messenger UI reconstruction
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Recover the missing `04-SPEC.md` before writing discuss context, then capture implementation decisions in `04-CONTEXT.md`.
- D-02: Extract layout and presentational components first, then move repeated behavior into hooks after parity is clear.
- D-03: Target a minimum component tree of `ChatShell`, `ChatSidebar`, `ChatListItem`, `ConversationPane`, `ConversationHeader`, `MessageList`, `MessageBubble`, `MessageComposer`, `MessageActionMenu`, `NewChatDialog`, and `ChatStateView`.
- D-04: Keep durable chat/message state in TanStack Query hooks; move transient UI state into component-local state or a focused `useChatViewState`.
- D-05: Use Tailwind for layout and visual states, and keep `chat.css` only for scrollbars and small animations.
- D-06: Preserve search, export, reply, reactions, edit, and delete at their current capability level without feature expansion.
- D-07: Use a compact modal or sheet for new-chat creation.
- D-08: Use the Tailwind `md` boundary for mobile drawer behavior. The drawer closes on chat selection, outside click, and Escape.
- D-09: Auto-scroll only when the user is near the bottom or sends their own message; preserve scroll when loading older messages.
- D-10: Failed sends stay inline with failed status, retry, and dismiss actions.
- D-11: Retry should preserve optimistic/client identity where possible.
- D-12: Show a visible connection banner and composer hint for degraded connection states.
- D-13: Disable sending only for browser offline or session-expired states, not for temporary socket reconnect if HTTP send can still work.
- D-14: Session expiration appears as a chat-level blocked state with a clear re-login path while preserving route guard behavior.
- D-15: Desktop message actions use hover/kebab and right-click behavior; mobile uses an explicit kebab control. Long-press is deferred unless trivial and testable.
- D-16: Quick reactions stay lightweight, and the full emoji picker is lazy-loaded only when opened.
- D-17: Icon buttons, modals, drawers, and menus must have accessible names, keyboard handling, Escape close behavior, focus return, and appropriate `aria-live` announcements.
- D-18: Add `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom` for React 19 component tests.
- D-19: Keep helper tests for cache/merge logic and add component tests for optimistic send, rollback, duplicate merge display, unread updates, session-expired UI, empty states, and failed-send actions.
- D-20: Do not add a permanent Playwright suite in this phase unless required by a blocker. Use committed RTL/Vitest tests plus desktop/mobile smoke verification.
- D-21: Preserve current route chunking and only lazy-load heavy optional UI such as the emoji picker if needed.
- D-22: Keep the three planned work slices: `04-01` extraction, `04-02` redesign/states, and `04-03` regression coverage, with tests added incrementally.
- D-23: Completion is blocked on frontend test, lint, build, and desktop/mobile smoke verification or explicit skipped-check documentation.

### Agent Discretion
- Exact file boundaries, component prop shapes, class names, and minor UI copy where they preserve the approved UX direction and existing contracts.
- Small helper hooks/components when they improve testability or reduce real duplication.

### Deferred Ideas (OUT OF SCOPE)
- Advanced conversation/contact search and message search improvements belong to Phase 5.
- Export improvements belong to a later feature pass.
- Threaded replies, long-press gesture polish, virtualization, and permanent e2e coverage are deferred unless they become blockers.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Messenger shell layout | Browser/Client | Static CSS | Phase 4 is a React/Vite UI reconstruction and should not change backend contracts. |
| Conversation/sidebar rendering | Browser/Client | TanStack Query cache | Data comes from existing chat/message hooks; component state should stay presentational. |
| Message lifecycle display | Browser/Client | Existing Query/socket hooks | Phase 3 already owns canonical status, optimistic, tombstone, unread, and cursor behavior. |
| Failed-send recovery UI | Browser/Client | Existing mutation hooks | `useSendMessage()` already accepts `clientMessageId`, so retry can reuse the existing API contract. |
| Connection/session states | Browser/Client | Auth and socket stores | UI should surface `socketError`, browser offline, and auth/session state without backend changes. |
| Component regression tests | Browser/Client test runtime | Vitest/jsdom | Existing Vitest helper tests are green; DOM tests require jsdom and RTL. |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 4 should be planned as a controlled decomposition and UI contract implementation, not as a broad rewrite. The current `Frontend/Chatify/src/pages/chat/chat.tsx` contains route-level orchestration, transient UI state, sidebar rendering, message list rendering, composer behavior, context/reaction menus, new-chat form, edit/reply state, scroll behavior, and the inline `MessageBubble` component in one file. The safest approach is to extract stable component boundaries first while preserving the existing hook contracts, then apply the approved UI-SPEC styling/state model, then add DOM regression coverage once components can be tested in isolation.

The Phase 3 foundation is good: `useChatQueries.ts`, `useChatSocket.ts`, and `messageCache.ts` already provide Query-owned state, optimistic failed-send state, cursor history, socket reconciliation, and 13 passing Vitest helper tests. Phase 4 must not duplicate durable message state or reintroduce local arrays as the source of truth. UI work should render and act through existing hooks, adding only UI helper hooks such as `useChatViewState` and presentational helpers where needed.

Primary recommendation: implement the roadmap's three slices sequentially: `04-01` component extraction, `04-02` visual/state/accessibility reconstruction, and `04-03` React 19 DOM regression coverage plus smoke verification.
</research_summary>

<standard_stack>
## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.1.0 | Component model and UI state | Existing app stack; React 19 testing guidance requires current `act` import behavior. |
| Vite | 7.x | Dev/build/test config host | Existing frontend build stack and Vitest-compatible config surface. |
| Tailwind CSS | 4.1.x | Layout and visual state styling | Existing styling tool; UI-SPEC says Tailwind owns layout/states. |
| TanStack Query | 5.90.x | Server-state cache | Existing canonical chat/message state owner from Phase 3. |
| Zustand | 5.0.x | Auth/presence store | Existing auth and presence shared state. |
| Vitest | 4.1.x | Test runner | Existing frontend test runner with current helper tests. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@testing-library/react` | latest compatible | Render React components in tests | Required for component state and interaction tests. |
| `@testing-library/user-event` | latest compatible | Simulate user interactions | Prefer for keyboard, typing, menu, and drawer behavior. |
| `@testing-library/jest-dom` | latest compatible | DOM matchers | Required for readable assertions such as visible/disabled states. |
| `jsdom` | latest compatible | DOM environment for Vitest | Required for React component tests outside browser mode. |
| `lucide-react` | 0.536.x | New icon controls | Existing dependency; use for icon buttons where available. |
| `emoji-picker-react` | 4.16.x | Full emoji picker | Keep but lazy-load only when opened. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsdom with RTL | Vitest browser mode | Browser mode is heavier and unnecessary for this phase's committed regression target. |
| Hand-rolled icon SVGs | `lucide-react` | Existing dependency avoids custom inaccessible SVG controls. |
| Virtualized message list | Manual cursor pagination and memoized bubbles | Virtualization adds scroll anchoring complexity and is out of scope without evidence. |
| Radix/shadcn dialog/menu | Local modal/menu primitives | UI-SPEC disallows registry blocks; local primitives are acceptable if accessibility requirements are implemented. |

**Installation:**
```bash
cd Frontend/Chatify
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### System Architecture Diagram

```text
/chat route
  |
  v
ChatPage orchestration
  |
  +--> useChats/useMessages/useUnreadCounts/useSendMessage/useCreateChat
  |      |
  |      v
  |   TanStack Query cache and messageCache helpers
  |
  +--> useChatSocket
  |      |
  |      v
  |   Socket events patched into Query cache
  |
  +--> useChatViewState
         |
         v
  ChatShell -> ChatSidebar -> ChatListItem
            -> ConversationPane -> ConversationHeader
                                -> MessageList -> MessageBubble
                                -> TypingIndicator
                                -> MessageComposer
                                -> MessageActionMenu/NewChatDialog
                                -> ChatStateView
```

### Recommended Project Structure

```text
Frontend/Chatify/src/pages/chat/
├── chat.tsx
├── chat.css
├── components/
│   ├── ChatShell.tsx
│   ├── ChatSidebar.tsx
│   ├── ChatListItem.tsx
│   ├── ConversationPane.tsx
│   ├── ConversationHeader.tsx
│   ├── MessageList.tsx
│   ├── MessageBubble.tsx
│   ├── MessageComposer.tsx
│   ├── MessageActionMenu.tsx
│   ├── NewChatDialog.tsx
│   ├── ChatStateView.tsx
│   └── index.ts
├── hooks/
│   └── useChatViewState.ts
└── utils/
    └── chatDisplay.ts
```

### Pattern 1: Extract presentational boundaries before changing visuals

**What:** Move stable JSX sections into components with explicit props while keeping `chat.tsx` as the orchestration owner.
**When to use:** First execution slice, before visual redesign and DOM tests.
**Why:** It preserves Phase 3 behavior and gives testable seams without combining refactor and redesign risk.

### Pattern 2: Keep server state in Query, view state in UI hooks/components

**What:** `useMessages()` and `messageCache.ts` remain the durable state surface. `useChatViewState` owns drawer, search toggles, edit/reply UI, menus, and scroll flags.
**When to use:** Any component extraction that needs state.
**Why:** Recreating local `messages` arrays would undo Phase 3's canonical state work.

### Pattern 3: Accessibility-first local primitives

**What:** Dialogs, drawers, menus, icon buttons, and banners must implement accessible names, focus return, Escape handling, and live regions.
**When to use:** `NewChatDialog`, mobile drawer, `MessageActionMenu`, failed-send controls, connection/session banners.
**Why:** This phase uses no external component library, so the local primitives carry the accessibility burden.

### Anti-Patterns to Avoid

- **Extract and redesign in the same diff:** makes regression causes unclear. Extract first, redesign second.
- **Creating a second message source of truth:** local message arrays will reintroduce duplicates/stale state.
- **Styling everything with accent color:** UI-SPEC reserves accent for specific controls and focus.
- **Only hover-based actions:** mobile and keyboard users need explicit controls.
- **Lazy-loading the entire chat page internals:** keep route chunking stable; lazy-load only heavy optional UI such as emoji picker.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-state reconciliation | New local message merge code | Existing `messageCache.ts` and Query hooks | Phase 3 already tested id/client merge, tombstones, receipts, unread sync. |
| DOM testing helpers | Custom render/mount utility from scratch | React Testing Library with jsdom | RTL encourages semantic queries and accessible behavior checks. |
| Icon glyph library | Ad hoc SVG set | `lucide-react` where an icon exists | Existing dependency and accessible button patterns are simpler. |
| Full emoji browser | Custom emoji grid | Lazy-loaded `emoji-picker-react` | Existing dependency handles emoji data and selection. |
| E2E suite | Permanent browser automation stack | Vitest/RTL plus smoke check | UI-SPEC defers permanent e2e unless a blocker requires it. |
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Component extraction accidentally changes behavior
**What goes wrong:** New components reorder callbacks, lose refs, or break scroll/typing/menu cleanup.
**Why it happens:** Extraction happens without parity checks.
**How to avoid:** Keep `chat.tsx` orchestration initially, pass current values as props, run `npm test`, `npm run lint`, and `npm run build` after extraction.
**Warning signs:** Large edits to `useChatQueries.ts` or `useChatSocket.ts` during the extraction slice.

### Pitfall 2: Failed sends are hidden by visual cleanup
**What goes wrong:** Failed optimistic rows disappear or cannot retry with the same `clientMessageId`.
**Why it happens:** UI treats failed send like a toast instead of a message state.
**How to avoid:** Render `optimisticState === 'failed'` inside `MessageBubble` and expose retry/dismiss actions inline.
**Warning signs:** Retry creates a new message without preserving the old failed row identity.

### Pitfall 3: Menus and drawers are mouse-only
**What goes wrong:** Message actions or mobile drawer cannot be used by keyboard or screen-reader users.
**Why it happens:** Custom menus use `div` click handlers and no focus management.
**How to avoid:** Use real `button` controls, `aria-label`, Escape close, focus return, and semantic menu/dialog roles.
**Warning signs:** Icon-only buttons without accessible names or CSS-only hover action controls.

### Pitfall 4: Component tests fight the full app shell
**What goes wrong:** Tests become brittle because they depend on Socket.IO, router auth, real Query network, or the full `ChatPage`.
**Why it happens:** Tests start at page level before components are isolated.
**How to avoid:** Test extracted components with typed fixtures and mock callbacks; keep cache behavior in existing helper tests.
**Warning signs:** Component tests require backend env vars or live sockets.

### Pitfall 5: Build warnings from heavy optional UI
**What goes wrong:** The chat chunk grows when emoji picker and optional menus are always loaded.
**Why it happens:** `EmojiPicker` is a static import in `chat.tsx`.
**How to avoid:** Lazy-load the full picker only when opened and keep quick reactions inline.
**Warning signs:** `chat-*.js` chunk grows materially after Phase 4.
</common_pitfalls>

<code_examples>
## Code Examples

### Vitest DOM setup pattern
```typescript
// Source: Vitest setup/config docs
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
}
```

### React 19 `act` import pattern
```typescript
// Source: React docs and React 19 upgrade guide
import { act } from 'react';
```

### RTL semantic query priority
```typescript
// Source: Testing Library queries docs
import { render, screen } from '@testing-library/react';

render(<button aria-label="Open menu" />);
screen.getByRole('button', { name: /open menu/i });
```
</code_examples>

<sota_updates>
## State of the Art (2024-2026)

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `act` from `react-dom/test-utils` | `act` from `react` | React 19 removed the old import path. |
| Enzyme/shallow-style tests | RTL semantic queries and user-event | Tests validate user-visible behavior and accessibility surfaces. |
| Always-load heavy optional UI | Conditional/lazy imports | Protects route chunk size while preserving optional features. |
| Global page tests for all states | Component tests plus pure helper tests | Lower flake risk and clearer failure signals. |

**New tools/patterns to consider:**
- Vitest jsdom environment with `setupFiles` for jest-dom matchers.
- RTL semantic queries for buttons, dialogs, menus, alerts, and text states.
- `userEvent` for keyboard, typing, drawer, and menu behavior.

**Deprecated/outdated:**
- `react-dom/test-utils` APIs for `act`, `Simulate`, and component traversal.
- Hover-only action surfaces for core mobile/keyboard message actions.
</sota_updates>

<validation_architecture>
## Validation Architecture

| Validation Layer | Command | Purpose |
|------------------|---------|---------|
| Existing helper regression | `cd Frontend/Chatify; npm test -- --run src/hooks/messageCache.test.ts` | Keeps Phase 3 canonical cache behavior intact while UI is refactored. |
| Full frontend tests | `cd Frontend/Chatify; npm test` | Runs helper and new DOM component tests. |
| Lint | `cd Frontend/Chatify; npm run lint` | Enforces strict TypeScript/React Hooks lint rules. |
| Build | `cd Frontend/Chatify; npm run build` | Verifies TypeScript project build and Vite production bundle. |
| Smoke checks | Desktop 1440px and mobile 390px | Confirms layout framing, drawer behavior, composer visibility, and no overlap. |

Baseline command results before planning:
- `npm test`: 1 test file passed, 13 tests passed.
- `npm run lint`: passed.
- `npm run build`: passed; current output includes route chunks and `chat-*.js` around 360 kB before Phase 4.

Test strategy:
- Keep pure cache behavior in `messageCache.test.ts`.
- Add component tests after extraction so UI tests do not depend on the full page.
- Use jsdom/RTL for semantic UI states, failed-send controls, menu/drawer keyboard behavior, and session/offline states.
- Use smoke checks for layout qualities that jsdom cannot measure reliably.
</validation_architecture>

<open_questions>
## Open Questions

1. **How much of `chat.tsx` should remain after extraction?**
   - What we know: The approved plan says componentize and move transient state out when it improves testability.
   - What's unclear: Exact prop boundaries will be clearer during implementation.
   - Recommendation: Keep `chat.tsx` as a thin orchestrator after Plan 04-01, not an empty shell.

2. **Can smoke checks be fully automated in this phase?**
   - What we know: Permanent e2e is out of scope; the app may need auth/backend state for real chat screenshots.
   - What's unclear: Whether the local environment has usable authenticated fixtures at execution time.
   - Recommendation: Run automated frontend commands regardless; run browser smoke if the dev environment supports it, otherwise document the skipped smoke reason in the summary.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- `.planning/phases/04-messenger-ui-reconstruction/04-SPEC.md` - locked phase requirements and boundaries.
- `.planning/phases/04-messenger-ui-reconstruction/04-CONTEXT.md` - approved implementation decisions.
- `.planning/phases/04-messenger-ui-reconstruction/04-UI-SPEC.md` - visual, accessibility, and test contract.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - current monolithic chat page.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Query/mutation state contract.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - socket event integration.
- `Frontend/Chatify/src/hooks/messageCache.ts` and `messageCache.test.ts` - canonical cache helpers and baseline tests.
- React `act` reference: https://react.dev/reference/react/act
- React 19 upgrade guide: https://react.dev/blog/2024/04/25/react-19-upgrade-guide
- Vitest config/setupFiles docs: https://vitest.dev/config/
- Vitest setup/teardown guide: https://v4.vitest.dev/guide/learn/setup-teardown
- Testing Library query docs: https://testing-library.com/docs/queries/about/

### Secondary (MEDIUM confidence)
- `C:/Users/saieh/.agents/skills/react-best-practices/SKILL.md` - bundle, rerender, and component performance guidance.
- `C:/Users/saieh/.agents/skills/accessibility/SKILL.md` - WCAG accessibility checklist.
- `C:/Users/saieh/.agents/skills/react19-test-patterns/SKILL.md` - React 19 test migration checklist.

### Tertiary (LOW confidence - needs validation)
- None. No non-primary web sources were used for planning decisions.
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: React 19, Vite 7, Tailwind 4, Vitest 4, TanStack Query 5.
- Ecosystem: RTL/jsdom, accessibility primitives, bundle-conscious lazy imports.
- Patterns: component extraction, Query-owned state, local view-state hooks, accessible local menus/dialogs.
- Pitfalls: state duplication, hover-only actions, failed-send disappearance, over-broad redesign.

**Confidence breakdown:**
- Standard stack: HIGH - package.json and official docs confirm the stack and test direction.
- Architecture: HIGH - current files and Phase 3 summaries define the canonical state boundaries.
- Pitfalls: HIGH - risks are visible in the current monolithic `chat.tsx` and UI-SPEC constraints.
- Code examples: HIGH - examples come from official docs and local code patterns.
</metadata>
