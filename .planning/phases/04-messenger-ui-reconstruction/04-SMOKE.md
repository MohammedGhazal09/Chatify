# Phase 04 Smoke Evidence

**Date:** 2026-06-09T00:51:44+03:00
**Scope:** Messenger UI reconstruction, plans 04-01 through 04-03

## Automated Verification

| Check | Result | Evidence |
| --- | --- | --- |
| `cd Frontend/Chatify; npm test` | Pass | 9 test files, 28 tests passed under Vitest/jsdom. |
| `cd Frontend/Chatify; npm run lint` | Pass | ESLint completed with no reported problems. |
| `cd Frontend/Chatify; npm run build` | Pass | `tsc -b && vite build` completed, including a separate `emoji-picker-react.esm-*.js` lazy chunk. |
| `rg -n "react-dom/test-utils|Simulate" Frontend/Chatify/src` | Pass | No matches. |
| `rg -n "@playwright/test|playwright" Frontend/Chatify/package.json` | Pass | No matches. |
| Temporary preview probe | Pass | `npm run preview -- --host 127.0.0.1 --port 4177 --strictPort` responded with HTTP 200 at `http://127.0.0.1:4177/`, and `index.html` contained `<div id="root"></div>`. |

## Desktop Smoke

**Viewport target:** 1440px wide desktop messenger layout.

**Outcome:** Skipped visual browser inspection in this execution. The built app was served successfully through Vite preview, but the available local smoke path did not include an authenticated session, backend fixture data, or a permanent browser automation dependency. Per Phase 04 decision D-20, no Playwright suite was added.

**Covered by automated evidence instead:**

- `ChatSidebar.test.tsx` covers empty sidebar, close control, unread count display, and conversation selection.
- `ConversationPane.test.tsx` covers no-selected-chat and session-expired blocked states.
- `MessageList.test.tsx` covers empty conversation, search-empty state, deduped display, load-older callback, and scroll-to-bottom callback.
- `MessageBubble.test.tsx` covers failed send, retry/dismiss, tombstones, sending, edited, and read status.
- `MessageActionMenu.test.tsx` covers explicit action trigger, quick reaction, Escape close, and focus return.
- `NewChatDialog.test.tsx` covers dialog semantics, input focus, submit, Escape close, and focus return.

## Mobile Smoke

**Viewport target:** 390px wide mobile messenger layout.

**Outcome:** Skipped visual browser inspection in this execution for the same prerequisite reasons as desktop: no authenticated local chat fixture and no permanent e2e/browser automation added. Mobile-specific behavior is covered through component-level assertions for drawer close control, explicit action controls, dialog focus return, and semantic button names.

**Covered by automated evidence instead:**

- Drawer close control is asserted through `Close conversations`.
- Explicit mobile-friendly message action trigger is asserted through `Open message actions`.
- New-chat dialog focus and Escape close behavior is asserted through semantic dialog tests.
- Component dimensions and palette were validated by lint/build and source inspection in plan 04-02.

## Skipped Checks

- **Authenticated desktop visual pass:** skipped because this execution did not have a seeded authenticated chat session or local backend fixture data.
- **Authenticated mobile visual pass:** skipped because this execution did not have a seeded authenticated chat session or local backend fixture data.
- **Permanent Playwright/e2e coverage:** intentionally skipped per D-20; no `@playwright/test` dependency was added.
- **Failed-send visual fixture in a real browser:** skipped because no controlled browser fixture existed to force an optimistic failed-send row without adding e2e infrastructure.

## Recommendation

For the next UI review checkpoint, use a seeded local backend account with one direct chat and one failed-send fixture, then visually inspect 1440px and 390px viewports in a browser. Keep this as a manual review checklist unless Phase 5 approves a permanent browser automation suite.
