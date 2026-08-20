# Phase 04: Messenger UI Reconstruction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 04-messenger-ui-reconstruction
**Areas discussed:** artifact sequencing, component decomposition, state ownership, styling, existing affordances, new chat UI, mobile behavior, scrolling, failed sends, network state, actions, emoji, accessibility, tests, smoke checks, performance, bundle behavior, sequencing, verification, deferrals

---

## Approved Recommendation Set

The user approved all recommendations from the one-shot discussion. The approved defaults are:

| Area | Selected Decision |
|------|-------------------|
| Artifact sequencing | Write `04-SPEC.md` first, then `04-CONTEXT.md`. |
| Extraction order | Extract layout/presentational components first, hooks after parity is clear. |
| Component tree | Target `ChatShell`, `ChatSidebar`, `ChatListItem`, `ConversationPane`, `ConversationHeader`, `MessageList`, `MessageBubble`, `MessageComposer`, `MessageActionMenu`, `NewChatDialog`, and `ChatStateView`. |
| State ownership | Keep durable message state in TanStack Query; move transient UI state to local state or focused hooks. |
| Styling | Tailwind for layout/states; `chat.css` only for scrollbars/animations. |
| Existing affordances | Preserve search/export/reply/reactions/edit/delete without expanding scope. |
| New chat UI | Compact modal/sheet. |
| Mobile behavior | Tailwind `md` breakpoint; overlay drawer closes on selection, outside click, and Escape. |
| Message scrolling | Auto-scroll only near bottom or on own send; preserve scroll on older-load. |
| Failed sends | Inline failed bubble with retry and dismiss. |
| Connection state | Visible banner and composer hint; disable only for offline/session-expired states. |
| Actions | Desktop hover/kebab and right-click; mobile explicit kebab; defer long-press unless trivial. |
| Emoji/reactions | Lightweight quick reactions; lazy-load full emoji picker. |
| Accessibility | Accessible names, keyboard handling, Escape close, focus return, and `aria-live` status updates. |
| Test dependencies | Add RTL, user-event, jest-dom, and jsdom. |
| Test boundaries | Helper tests for merge logic; component tests for UI state and recovery behavior. |
| E2E/smoke | No permanent Playwright suite unless blocked; use smoke verification separately. |
| Session expiration | Chat-level blocked state with re-login path. |
| Performance | Defer virtualization unless evidence requires it. |
| Bundle behavior | Preserve route chunking; lazy-load heavy optional UI. |
| Phase sequencing | Keep `04-01`, `04-02`, `04-03`; add tests incrementally. |
| Completion gate | Frontend test, lint, build, and desktop/mobile smoke verification. |
| Deferred ideas | Advanced search/export/reply expansion, virtualization, gestures, and e2e suite. |

## Agent Discretion

- Exact component file layout, prop shapes, class names, and minor UI copy.
- Whether a small helper hook/component is worth adding when it improves testability or reduces duplication.
- Whether the existing `MessageStatus`, `ConnectionIndicator`, `TypingIndicator`, and `Toast` are reused directly or lightly adapted.

## Deferred Ideas

- Advanced conversation/contact search and message search improvements.
- Export improvements.
- Threaded replies.
- Long-press gesture polish.
- Message virtualization.
- Permanent e2e test suite.
