# Phase 05 Smoke Evidence

**Date:** 2026-06-09T07:03:49+03:00
**Scope:** Messenger baseline completion: direct-chat continuation, selected-chat restore, local conversation search, server-backed message search, auth/session cleanup, and desktop/mobile smoke.

## Automated Verification

| Check | Result | Evidence |
| --- | --- | --- |
| `cd Backend/Chatify; npm test` | Pass | 12 test files, 66 tests passed under Vitest/node. |
| `cd Frontend/Chatify; npm test` | Pass | 15 test files, 52 tests passed under Vitest/jsdom. |
| `cd Frontend/Chatify; npm run test:ui` | Pass | 5 Playwright tests passed with route-intercepted authenticated fixtures and mobile drawer bounds assertions. |
| `cd Frontend/Chatify; npm run lint` | Pass | ESLint completed with no reported problems. |
| `cd Frontend/Chatify; npm run build` | Pass | `tsc -b && vite build` completed successfully. |
| `rg -n "presence.*api\|api.*presence\|user-search\|search-users" Frontend/Chatify/src Backend/Chatify` | Pass | No matches, confirming no new passive presence or user-search endpoint path. |

## Desktop Smoke

**Viewport target:** 1440px by 900px desktop messenger layout.

**Outcome:** Passed through deterministic Playwright smoke against the Vite app with intercepted auth, chat, message, unread-count, message-search, and New chat continuation routes.

**Assertions:**

- Conversation heading `Grace Hopper` is visible for the restored/default direct chat.
- Composer textbox `Write a message` is visible.
- Failed-send fixture remains visible with retry controls.
- Sidebar search filters by latest visible snippet: `launch` shows `Alan Turing`; `retry` shows `Grace Hopper`.
- Message search opens from the header, waits for the server-backed result, and renders `1 result`.
- Search result row exposes sender/timestamp metadata and a loaded-result jump action.
- Clearing message search returns focus to the search input and restores the normal conversation history.

**Screenshot evidence:** `.planning/phases/05-messenger-baseline-completion/05-ui-smoke-desktop-search.png`

## Mobile Smoke

**Viewport target:** 390px by 844px mobile messenger layout.

**Outcome:** Passed through deterministic Playwright smoke against the Vite app.

**Assertions:**

- Conversation heading `Grace Hopper` is visible.
- Mobile `Open conversations` drawer control opens the sidebar.
- Sidebar drawer opens to the expected left-edge width at 390px and the overlay covers the conversation behind it.
- Sidebar search remains usable at 390px width after the drawer settles.
- `launch` search reveals `Alan Turing` through local title/latest-snippet matching.

**Screenshot evidence:** `.planning/phases/05-messenger-baseline-completion/05-ui-smoke-mobile-drawer-search.png`

## Session/Auth Smoke

**Outcome:** Passed.

**Assertions:**

- Exact-email New chat submit with `alan@example.com` receives an intercepted existing-chat `200`-style response and selects `Alan Turing`.
- URL restore with `?chatId=chat-2` selects `Alan Turing`.
- Invalid URL `?chatId=not-accessible` is replaced and falls back to the previously valid per-user stored selection.
- Dispatching `chatify:auth-expired` hides previous private conversation content and routes to `/login`.

## Skipped Checks

None.

## Notes

- The smoke uses Playwright route interception, not seeded production data.
- Socket.IO is intentionally aborted in smoke fixtures; reconnect copy remains visible and does not block the tested search, restore, continuation, or auth cleanup flows.
