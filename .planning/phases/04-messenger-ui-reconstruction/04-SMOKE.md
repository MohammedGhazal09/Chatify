# Phase 04 Smoke Evidence

**Date:** 2026-06-09T04:14:00+03:00
**Scope:** Messenger UI reconstruction, UI-review remediation, and authenticated visual smoke.

## Automated Verification

| Check | Result | Evidence |
| --- | --- | --- |
| `cd Frontend/Chatify; npm test` | Pass | 10 test files, 33 tests passed under Vitest/jsdom. |
| `cd Frontend/Chatify; npm run test:ui` | Pass | 2 Playwright tests passed: authenticated desktop messenger smoke and authenticated mobile messenger smoke. |
| `cd Frontend/Chatify; npm run lint` | Pass | ESLint completed with no reported problems. |
| `cd Frontend/Chatify; npm run build` | Pass | `tsc -b && vite build` completed successfully. |
| `rg -n "react-dom/test-utils\|Simulate" Frontend/Chatify/src` | Pass | No matches. |
| Targeted UI-review static scan | Pass | No old chat UI matches for `h-screen`, `transition: all`, `transition-all`, raw text glyph controls, old loading ellipses, or old receipt color classes. |

## Desktop Smoke

**Viewport target:** 1440px wide desktop messenger layout.

**Outcome:** Passed through fixture-driven Playwright smoke against the actual Vite app. Backend HTTP calls were intercepted in the browser with authenticated user, chat, message, unread-count, and failed-send fixtures.

**Assertions:**

- Conversation heading `Grace Hopper` is visible.
- Composer textbox `Write a message` is visible.
- Failed-send fixture remains visible with retry controls.
- Explicit `Open message actions` control is visible.

**Screenshot evidence:** `.planning/phases/04-messenger-ui-reconstruction/04-ui-smoke-desktop.png`

## Mobile Smoke

**Viewport target:** 390px wide mobile messenger layout.

**Outcome:** Passed through fixture-driven Playwright smoke against the actual Vite app.

**Assertions:**

- Conversation heading `Grace Hopper` is visible.
- Composer textbox `Write a message` is visible.
- Failed-send fixture remains visible with retry controls.
- Mobile `Open conversations` drawer control opens the chat list.
- `Close conversations` closes the drawer.
- `Send message` control remains visible in the closed mobile conversation state.

**Screenshot evidence:**

- Closed conversation: `.planning/phases/04-messenger-ui-reconstruction/04-ui-smoke-mobile.png`
- Drawer open: `.planning/phases/04-messenger-ui-reconstruction/04-ui-smoke-mobile-drawer.png`

## Notes

- `@playwright/test` is now a frontend dev dependency because the UI review required authenticated desktop/mobile visual smoke and the user explicitly requested all problems be solved.
- Playwright output folders are ignored through `Frontend/Chatify/.gitignore`.
- The smoke uses request interception instead of a seeded database, so it stays deterministic and does not require local backend credentials.
