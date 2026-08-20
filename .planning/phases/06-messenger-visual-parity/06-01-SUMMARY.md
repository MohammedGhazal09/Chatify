---
phase: 06-messenger-visual-parity
plan: 01
subsystem: messenger-theme-desktop-shell
tags: [react, tailwind, theme, accessibility, desktop-shell]
requires:
  - phase: 06-spec
    provides: approved visual parity and no-living-imagery contract
  - phase: 05-messenger-baseline-completion
    provides: selected-chat, search, presence, and session cleanup baseline
provides:
  - Token-driven chat theme root with light/dark/system preference handling
  - Settings modal theme control and deterministic URL/localStorage override support
  - Abstract identity tiles replacing chat-surface profile image rendering
  - Desktop three-column shell with presentational right context rail
  - Focused tests for theme, abstract identity, shell, rail, header, and sidebar behavior
affects: [06-messenger-visual-parity, chat-ui, visual-verification]
tech-stack:
  added: []
  patterns: [css-variable-theme-root, abstract-identity-tiles, presentational-context-rail]
key-files:
  created:
    - Frontend/Chatify/src/pages/chat/hooks/useChatTheme.ts
    - Frontend/Chatify/src/pages/chat/hooks/useChatTheme.test.tsx
    - Frontend/Chatify/src/pages/chat/components/AbstractIdentityTile.tsx
    - Frontend/Chatify/src/pages/chat/components/AbstractIdentityTile.test.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatContextRail.test.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatShell.test.tsx
    - Frontend/Chatify/src/pages/chat/components/ConversationHeader.test.tsx
  modified:
    - Frontend/Chatify/src/components/SettingsModal.tsx
    - Frontend/Chatify/src/pages/chat/chat.css
    - Frontend/Chatify/src/pages/chat/chat.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatListItem.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatShell.tsx
    - Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx
    - Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx
    - Frontend/Chatify/src/pages/chat/components/index.ts
key-decisions:
  - "Theme state is isolated in `useChatTheme` and applies through `data-chat-theme` plus CSS variables."
  - "Settings owns the production theme control; URL/localStorage override exists for deterministic visual smoke."
  - "Chat identity surfaces ignore `profilePic` and use deterministic abstract geometric tiles."
  - "The right context rail is presentational; only Search wires to existing message search."
requirements-completed: [UI-01, UI-02, UI-04, UI-05, UI-06]
duration: 1h
completed: 2026-06-12
---

# Phase 06-01: Theme Foundation And Desktop Shell Summary

Chatify now has the Phase 06 visual foundation for light/dark theming, abstract identity, and the desktop three-column messenger shell.

## Performance

- **Duration:** 1h
- **Started:** 2026-06-12T13:00:00+03:00
- **Completed:** 2026-06-12T14:03:45+03:00
- **Tasks:** 3
- **Files modified:** 16

## Accomplishments

- Added `useChatTheme` with URL override, localStorage override support, per-user preference, and system fallback.
- Added the required `data-testid="chat-root"` and `data-chat-theme="light|dark"` root contract.
- Added Phase 06 light/dark CSS variables on the chat root.
- Extended Settings with a keyboard-accessible theme control.
- Added `AbstractIdentityTile` and replaced chat-surface profile photo rendering in sidebar/header areas.
- Added `ChatContextRail` with contact, action, pinned, file, media, and security sections.
- Updated `ChatShell` to support the desktop three-column layout and stable Playwright test hooks.
- Added focused Vitest coverage for theme, identity, shell, rail, header, and sidebar behavior.

## Task Commits

1. **Theme, identity, desktop shell, and context rail foundation** - `a7c2cf5` (`feat(06-01): add themed desktop shell foundation`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Lint initially flagged an unused legacy `onExportChat` binding in `ConversationHeader`. The binding was removed while keeping the prop contract stable for callers.

## Verification

- `cd Frontend/Chatify; npm test -- --run src/pages/chat/hooks/useChatTheme.test.tsx src/pages/chat/components/AbstractIdentityTile.test.tsx src/pages/chat/components/ChatShell.test.tsx src/pages/chat/components/ChatContextRail.test.tsx src/pages/chat/components/ConversationHeader.test.tsx src/pages/chat/components/ChatSidebar.test.tsx` - PASS, 6 files / 12 tests.
- `cd Frontend/Chatify; npm run lint` - PASS.
- `cd Frontend/Chatify; npm run build` - PASS.
- `rg -n "profilePic|<img|avatar" Frontend/Chatify/src/pages/chat/components -g "!*.test.tsx"` - PASS, no component-source matches.
- `rg -n "axios|fetch\\(|/api/|messageApi|chatApi" Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx` - PASS, no backend/API calls.

## Self-Check: PASSED

- Chat root can be forced to light and dark themes deterministically.
- Desktop shell renders left rail, center pane, and presentational right rail.
- Chat identity surfaces are abstract-only in component source.
- Right rail Search uses the existing message-search callback.
- `chat.tsx` remains the orchestration layer for query/socket behavior.

## Next Phase Readiness

Ready for `06-02`: mobile conversation, message stream, composer, and state surface parity.
