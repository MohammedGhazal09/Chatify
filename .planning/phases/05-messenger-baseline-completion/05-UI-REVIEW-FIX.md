---
phase: 05-messenger-baseline-completion
phase_number: "05"
phase_name: messenger-baseline-completion
review: .planning/phases/05-messenger-baseline-completion/05-UI-REVIEW.md
status: fixed
fixed_at: 2026-06-09
findings_fixed:
  high: 1
  medium: 5
  low: 1
  total: 7
verification:
  frontend_tests: passed
  focused_component_tests: passed
  ui_smoke: passed
  lint: passed
  build: passed
---

# Phase 05 UI Review Fix Summary

All findings from `05-UI-REVIEW.md` were fixed.

## Fixes

### UI-01: Mobile sidebar drawer is visually clipped in smoke evidence

Fixed in `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx`, `ChatShell.tsx`, `chat.css`, and `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts`.

- Moved the mobile drawer positioning to explicit responsive Tailwind classes on the sidebar instead of the older mobile CSS transform block.
- Kept the overlay fixed, hidden on desktop, and visible only while the mobile drawer is open.
- Added Playwright polling assertions for drawer x-position and width before capturing the mobile screenshot, preventing mid-transition evidence from passing as final layout.
- Refreshed `05-ui-smoke-mobile-drawer-search.png`.

### UI-02: Message search result rows omit required sender and time metadata

Fixed in `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx`.

- Passed selected-chat context and current user id into the result component.
- Added sender label and timestamp metadata to each result row.
- Updated loaded-result accessible names to include sender, timestamp, and snippet context.

### UI-03: Message search rows use card treatment and the wrong highlight token

Fixed in `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx`.

- Replaced stacked bordered cards with full-width divider rows.
- Switched query `<mark>` styling to the approved amber search-highlight token.
- Kept row heights stable across loaded and unloaded result states.

### UI-04: Message search copy does not match the approved copy table

Fixed in `MessageSearchResults.tsx`, `ConversationPane.tsx`, `ConversationPane.test.tsx`, and `chat-ui-smoke.spec.ts`.

- Aligned placeholder, helper, count, error, empty, and clear-action copy to `05-UI-SPEC.md`.
- Updated unit and Playwright assertions to the approved copy.

### UI-05: Clearing message search does not return focus to the search input

Fixed in `Frontend/Chatify/src/pages/chat/chat.tsx`, `ConversationPane.tsx`, and `ConversationHeader.tsx`.

- Added refs for the message-search input and header search button.
- Clearing search now returns focus to the still-open search input.
- Closing search with the header button or Escape returns focus to the header search button.
- Opening search from the header or Ctrl/Cmd+F focuses the search input.

### UI-06: Loaded search results scroll without the approved temporary highlight

Fixed in `chat.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `MessageBubble.test.tsx`, and `chat.css`.

- Added transient `highlightedMessageId` state for loaded search-result selection.
- Applied a non-layout-shifting amber highlight class to the target message bubble for 1200ms.
- Added reduced-motion handling for the highlight.
- Added a component regression test for the highlight class.

### UI-07: Sidebar and new-chat copy drift from the approved Phase 05 contract

Fixed in `ChatSidebar.tsx`, `ChatSidebar.test.tsx`, `NewChatDialog.tsx`, `NewChatDialog.test.tsx`, and `chat.tsx`.

- Aligned sidebar no-results body copy to the approved spec.
- Normalized empty/invalid email display copy to `Enter a valid email address.`
- Normalized generic new-chat failure copy to `We could not start that chat. Check the email and try again.`
- Added form metadata and ARIA error handling to the new-chat email input.

## Tests Updated

- `Frontend/Chatify/src/pages/chat/components/ConversationPane.test.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.test.tsx`
- `Frontend/Chatify/src/pages/chat/components/NewChatDialog.test.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.test.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageList.test.tsx`
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts`

## Verification

- `cd Frontend/Chatify; npm test -- --run src/pages/chat/components/ConversationPane.test.tsx src/pages/chat/components/ChatSidebar.test.tsx src/pages/chat/components/NewChatDialog.test.tsx src/pages/chat/components/MessageBubble.test.tsx` - passed, 4 files / 17 tests.
- `cd Frontend/Chatify; npm test` - passed, 15 files / 52 tests.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed.
- `cd Frontend/Chatify; npm run test:ui` - passed after updating the smoke to wait for final drawer geometry, 5 Playwright tests.

## Remaining Issues

None from `05-UI-REVIEW.md`.
