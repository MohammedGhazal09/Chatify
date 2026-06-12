---
phase: 04-messenger-ui-reconstruction
phase_number: "04"
phase_name: messenger-ui-reconstruction
review: .planning/phases/04-messenger-ui-reconstruction/04-UI-REVIEW.md
status: fixed
fixed_at: 2026-06-09
findings_fixed:
  medium: 5
  low: 1
  total: 6
verification:
  tests: passed
  ui_smoke: passed
  lint: passed
  build: passed
---

# Phase 04 UI Review Fix Summary

All six findings from `04-UI-REVIEW.md` were fixed.

## Fixes

### UI-01: Message receipt colors drift from the semantic palette

Updated `MessageStatus` to use Phase 04 semantic colors:

- Sent/default: `#6F7B77`
- Delivered: `#22C55E`
- Read: `#38BDF8`

Added `MessageStatus.test.tsx` to assert the expected status color classes.

### UI-02: Several controls use raw text glyphs instead of proper icons

Replaced raw visible glyph controls with `lucide-react` icons while preserving accessible names:

- Message actions: `MoreHorizontal`
- Close controls: `X`
- Emoji/more reaction controls: `SmilePlus`
- Pending actions: `LoaderCircle`
- Scroll-to-bottom: `ArrowDown`

Kept existing `aria-label` values so keyboard and screen-reader affordances remain stable.

### UI-03: Initial loading states do not meet the skeleton-row contract

Added skeleton row loading states for:

- Chat list loading in `ChatSidebar`
- Message list loading in `MessageList`

Updated loading/pending text to use consistent typographic ellipsis and icon-assisted pending states.

### UI-04: The root chat shell uses `h-screen`, which is fragile on mobile

Replaced `h-screen` with a dynamic viewport-height shell and constrained horizontal overflow:

- `h-[100dvh]`
- `w-screen`
- `max-w-screen`
- `overflow-hidden`

Also tightened mobile header, message list, bubble, and composer constraints so the 390px smoke viewport keeps controls visible.

### UI-05: Motion declarations are broader than the contract allows

Replaced broad motion declarations:

- `transition: all` in `chat.css` became explicit `background-color`, `border-color`, and `box-shadow` transitions.
- `transition-all` on the scroll-to-bottom control became `transition-colors`.
- Skeleton and spinner animations use `motion-safe:` variants.

### UI-06: Authenticated desktop and mobile visual smoke were skipped

Added a minimal Playwright smoke harness:

- `Frontend/Chatify/playwright.config.ts`
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts`
- `Frontend/Chatify/package.json` script: `npm run test:ui`

The smoke intercepts backend HTTP calls in-browser and renders the actual Vite app with authenticated chat, message, unread-count, and failed-send fixtures.

Screenshot evidence was captured:

- `.planning/phases/04-messenger-ui-reconstruction/04-ui-smoke-desktop.png`
- `.planning/phases/04-messenger-ui-reconstruction/04-ui-smoke-mobile.png`
- `.planning/phases/04-messenger-ui-reconstruction/04-ui-smoke-mobile-drawer.png`

## Verification

- `cd Frontend/Chatify; npm test` - passed, 10 files and 33 tests.
- `cd Frontend/Chatify; npm run test:ui` - passed, 2 Playwright smoke tests.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed.
- `rg -n "react-dom/test-utils|Simulate" Frontend/Chatify/src` - no matches.
- Targeted UI-review static scan - no matches for old loading ellipses, raw text glyph controls, `h-screen`, `transition: all`, `transition-all`, or old receipt color classes.

## Remaining Issues

None.
