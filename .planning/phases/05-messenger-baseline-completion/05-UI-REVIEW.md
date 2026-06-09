---
phase: 5
slug: messenger-baseline-completion
status: issues_found
review_type: ui
created: 2026-06-09
overall_score: 15/24
needs_visual_review: false
---

# Phase 05 UI Review

## Summary

Phase 05 added the right messenger-completion surfaces: selected-chat restore, local sidebar search, exact-email chat continuation, server-backed message search, session cleanup, and fixture-driven desktop/mobile smoke. The implementation is functional and well covered by tests, but the UI is not yet ready to call visually complete.

The strongest issue is visible in the saved mobile smoke screenshot: with the drawer flow under review, the sidebar appears clipped to a narrow strip while conversation content remains exposed. The message-search surface also falls short of the Phase 05 design contract: rows do not show sender/time metadata, result rows are card-like instead of full-width rows, copy drifts from the approved table, loaded results scroll without a temporary highlight, and clear does not return focus to the search field.

## Skills Used

| Skill | How it was used |
| --- | --- |
| `gsd-ui-review` | Structured this artifact as the retroactive 6-pillar Phase 05 UI audit. |
| `find-skills` | Selected relevant installed support skills for review coverage instead of installing duplicate skills. |
| `accessibility` | Checked labels, focus return, keyboard-operable result rows, dialog behavior, and live state announcements. |
| `frontend-design-ui-ux` | Reviewed flow completeness, responsive behavior, state handling, and implementation handoff adherence. |
| `design-taste-frontend` | Evaluated messenger density, visual hierarchy, row treatment, polish, and production-readiness. |
| `web-design-guidelines` | Cross-checked against current Vercel web interface guidance, including labels, accessible icon controls, focus states, overflow handling, safe responsive layouts, and reduced-motion expectations. |

External guideline source reviewed: https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

## Evidence Reviewed

| Artifact | Result |
| --- | --- |
| `.planning/phases/05-messenger-baseline-completion/05-UI-SPEC.md` | Used as the approved UI contract. |
| `.planning/phases/05-messenger-baseline-completion/05-SMOKE.md` | Verification passed, but screenshot evidence exposes a mobile drawer visual issue not asserted by the smoke test. |
| `.planning/phases/05-messenger-baseline-completion/05-ui-smoke-desktop-search.png` | Desktop search surface inspected. |
| `.planning/phases/05-messenger-baseline-completion/05-ui-smoke-mobile-drawer-search.png` | Mobile drawer search state inspected; drawer is visibly clipped. |
| `.planning/phases/05-messenger-baseline-completion/05-01-SUMMARY.md` | Backend/API message-search and continuation scope completed. |
| `.planning/phases/05-messenger-baseline-completion/05-02-SUMMARY.md` | Frontend navigation/search/session/smoke scope completed. |
| `.planning/phases/05-messenger-baseline-completion/05-REVIEW-FIX.md` | Code review cleanup verified as fixed before this UI audit. |
| `Frontend/Chatify/src/pages/chat/components/*` | Chat shell, sidebar, dialog, conversation, list, result, composer, and state components inspected. |
| `Frontend/Chatify/src/pages/chat/chat.tsx` | Search, selected-chat, focus, session, and scroll orchestration inspected. |
| `Frontend/Chatify/src/pages/chat/chat.css` | Drawer, overlay, responsive, scrollbar, and motion behavior inspected. |
| `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` | Smoke assertions inspected for visual blind spots. |

## Scorecard

| Pillar | Score | Assessment |
| --- | ---: | --- |
| Copywriting | 2/4 | Core concepts are understandable, but several approved Phase 05 strings drift in message search, sidebar no-results, and new-chat validation paths. |
| Visuals | 2/4 | Desktop structure is usable, but the mobile drawer screenshot is visibly broken and search results are rendered as small cards rather than divider rows. |
| Color | 3/4 | The neutral dark palette mostly holds, but search highlight uses the teal accent instead of the approved search-highlight token. |
| Typography | 3/4 | Compact app-scale type is preserved; uppercase count/status treatment and mixed punctuation reduce polish but do not block use. |
| Spacing | 2/4 | Stable dimensions are mostly present, but the mobile drawer/open layout and card-like result spacing miss the approved responsive contract. |
| Experience Design | 3/4 | The main flows work, but focus return and loaded-result highlight behavior are incomplete. |

Overall: **15/24**

## Findings

### UI-01 - Mobile sidebar drawer is visually clipped in smoke evidence

**Pillar:** Visuals / Spacing  
**Severity:** High  
**Evidence:** `.planning/phases/05-messenger-baseline-completion/05-ui-smoke-mobile-drawer-search.png`, `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx:13`, `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx:80`, `Frontend/Chatify/src/pages/chat/chat.css:172-185`

The Phase 05 mobile smoke says the drawer search is usable at 390px, but the saved screenshot shows only a thin strip of the sidebar visible while conversation messages remain exposed across the rest of the viewport. This fails the mobile contract that sidebar search stays inside the drawer and remains reachable without horizontal scrolling.

The smoke test only asserts that the target row can be found by role; it does not assert drawer bounds, visible width, overlay coverage, or that the conversation is visually covered when the drawer is open.

**Recommendation:** Fix the mobile drawer layout and add a visual/layout assertion to the Playwright smoke. On mobile, the sidebar should occupy `min(86vw, 320px)` from the left edge when open, sit above the overlay, and leave the conversation visually blocked behind the overlay. Add assertions for `.chat-sidebar.open` bounding box width and x-position at 390px, and refresh the mobile screenshot after the fix.

### UI-02 - Message search result rows omit required sender and time metadata

**Pillar:** Experience Design / Accessibility  
**Severity:** Medium  
**Evidence:** `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx:64-81`, `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx:66`

The UI contract requires each message-search row to include sender label, timestamp, highlighted snippet, and an optional loaded-message affordance. The current row only renders the snippet and, for unloaded results, a helper line. The button accessible name is also `Jump to message: {snippet}`, so screen-reader users do not get sender or time context before activating the row.

**Recommendation:** Pass enough conversation context into `MessageSearchResults` to derive sender display text and timestamp. Render a compact metadata line above the snippet on desktop and mobile, and build loaded-row accessible names from sender, time, and snippet. Keep unloaded results static unless they perform an action.

### UI-03 - Message search rows use card treatment and the wrong highlight token

**Pillar:** Visuals / Color  
**Severity:** Medium  
**Evidence:** `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx:74`, `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx:80`, `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx:118`

The Phase 05 layout contract specifies full-width unframed rows with dividers, not decorative cards. The current results use `rounded-lg border bg-[#181C20]` with `space-y-2`, which reads as stacked mini cards inside the message surface. The match highlight also uses teal (`#14B8A6`) instead of the approved search highlight token (`#F59E0B` or `rgba(245, 158, 11, 0.18)`).

**Recommendation:** Replace result-card styling with full-width list rows separated by `border-b border-[#2E363C]`, preserving 56px/64px minimum row heights. Use the approved amber search-highlight treatment for `mark`, without changing line height or overusing the accent color.

### UI-04 - Message search copy does not match the approved copy table

**Pillar:** Copywriting  
**Severity:** Medium  
**Evidence:** `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx:179-180`, `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx:34-60`, `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx:91-92`, `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts:183-186`

Approved Phase 05 copy says `Search this conversation`, `Type at least 2 characters to search.`, `{count} result{plural}`, `We could not search messages. Try again.`, `Try another word or clear search to return to the conversation.`, and `Clear search`. The implementation uses `Search in conversation...`, `Type at least 2 characters to search this conversation.`, `Found {n} message(s)`, `We could not search this conversation.`, `Try a different search term.`, and a visible `Clear` label with `Clear message search` as the accessible name. The smoke test now asserts the drifted strings, which will preserve the mismatch.

**Recommendation:** Align the component strings and tests to the approved copy table. Use the exact copy from `05-UI-SPEC.md` unless the spec is explicitly amended, and prefer one source of test fixtures for these strings so the UI contract and smoke assertions do not diverge again.

### UI-05 - Clearing message search does not return focus to the search input

**Pillar:** Accessibility / Experience Design  
**Severity:** Medium  
**Evidence:** `Frontend/Chatify/src/pages/chat/chat.tsx:762-764`, `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx:173-181`, `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx:41-48`

The accessibility contract says clearing search returns focus to the search input unless the user closes search. The current `handleClearMessageSearch` only clears state. Because the clear button lives inside the result region that disappears after clearing, focus can be dropped onto the document body instead of moving to the still-open search input.

**Recommendation:** Add a `messageSearchInputRef`, pass it to the search input, and focus it after clear with `requestAnimationFrame`. Keep the separate close-search path returning focus to the header search button.

### UI-06 - Loaded search results scroll without the approved temporary highlight

**Pillar:** Experience Design / Motion  
**Severity:** Medium  
**Evidence:** `Frontend/Chatify/src/pages/chat/chat.tsx:766-775`, `Frontend/Chatify/src/pages/chat/chat.css:129-136`

The motion contract requires a 900ms to 1400ms subtle loaded-message highlight after selecting a visible result. Current behavior closes search, clears the query, and scrolls the message into view, but it does not apply any transient selected-result state or highlight class to the target bubble. This makes the jump harder to understand, especially in dense histories.

**Recommendation:** Track `highlightedMessageId` after loaded-result selection, apply a non-layout-shifting highlight class to the matching `MessageBubble` wrapper, clear it after roughly 1200ms, and disable the pulse under `prefers-reduced-motion: reduce`. Add a focused component or Playwright assertion that verifies the target message receives and then clears the highlight.

### UI-07 - Sidebar and new-chat copy drift from the approved Phase 05 contract

**Pillar:** Copywriting  
**Severity:** Low  
**Evidence:** `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx:190-191`, `Frontend/Chatify/src/pages/chat/chat.tsx:698`, `Frontend/Chatify/src/pages/chat/chat.tsx:719-722`, `Backend/Chatify/Controller/chatController.mjs:64-70`

The sidebar no-results heading matches the spec, but the body says `Start or continue a chat by exact email.` instead of `Try a different name or latest message, or use New chat to start by email.` New-chat invalid-empty and backend invalid-email paths also produce `Please enter an email address.` or `Please provide a valid email address` instead of the approved `Enter a valid email address.` The generic failure copy is privacy-safe, but it differs slightly from the approved text.

**Recommendation:** Align sidebar and new-chat user-facing strings with `05-UI-SPEC.md`, then update tests that currently assert the drifted copy. Keep backend privacy-safe direct-chat errors, but normalize frontend display copy where possible so the UI contract stays stable.

## Positive Notes

- The Phase 05 desktop shell is close to the intended professional messenger density and keeps the conversation, sidebar, header, and composer in stable regions.
- Server-backed message search is isolated from durable message history instead of filtering `MessageList` as fake history.
- New chat dialog focus trapping and Escape/outside-click close behavior are covered by focused tests.
- Auth-expired cleanup hides private conversation content and the Playwright smoke covers that regression.
- Phase 05 already has a strong verification bundle: backend tests, frontend tests, lint, build, and route-intercepted Playwright smoke.

## Recommended Fix Order

1. Fix the mobile drawer clipping and add a Playwright layout assertion before trusting the mobile smoke.
2. Rework `MessageSearchResults` into full-width divider rows with sender/time metadata and accessible row names.
3. Align message-search copy and tests to the approved copy table.
4. Add clear-search focus return and close-search focus return coverage.
5. Add loaded-result temporary highlight with reduced-motion handling.
6. Align sidebar/new-chat copy drift after the higher-risk search and drawer issues are fixed.

## Completion Criteria For UI Remediation

- `npm test` passes from `Frontend/Chatify`.
- `npm run lint` passes from `Frontend/Chatify`.
- `npm run build` passes from `Frontend/Chatify`.
- `npm run test:ui` passes from `Frontend/Chatify`.
- The 390px mobile smoke screenshot shows the open drawer occupying the expected left-side width with the conversation visually blocked behind the overlay.
- Playwright asserts mobile drawer bounds, not only role reachability.
- Message-search rows show sender, timestamp, snippet, and loaded/unloaded affordance without card styling.
- Search highlight uses the approved amber search token and does not reflow snippets.
- Clearing search returns focus to the search input; closing search returns focus to the header search button.
- Loaded-result selection visibly highlights the target message for a short, reduced-motion-safe interval.
- Static search no longer finds Phase 05 UI copy that intentionally diverges from `05-UI-SPEC.md` unless the spec is amended first.

## Verification During Review

No product code was changed for this UI review. Existing Phase 05 verification evidence was reviewed from `05-SMOKE.md`, and the only new artifact from this pass is this review document.
