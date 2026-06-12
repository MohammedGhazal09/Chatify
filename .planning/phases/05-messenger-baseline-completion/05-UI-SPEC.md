---
phase: 5
slug: messenger-baseline-completion
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-09
---

# Phase 05 - UI Design Contract

> Visual and interaction contract for completing the Chatify v1 messenger baseline. This UI-SPEC extends the Phase 04 messenger UI contract and locks Phase 05 search, continuation, presence, navigation, session, and verification surfaces before planning.

## Product Direction

Phase 05 should make the reconstructed messenger feel finished without changing its product category. The experience remains a quiet, professional private direct-message app: dense enough for repeated use, restrained in motion, explicit about state, and careful not to reveal account, message, or presence data outside authorized conversations.

The new UI work must feel like a continuation of Phase 04, not a second redesign. Search and navigation continuity should reduce friction while preserving the same dark-first messenger shell, stable dimensions, and recovery-oriented copy.

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | `lucide-react` for new controls; preserve existing local icons where replacement would add churn |
| Font | system sans stack: `Inter`, `ui-sans-serif`, `system-ui`, `-apple-system`, `Segoe UI`, `sans-serif` |
| CSS strategy | Tailwind for layout/state styling; `chat.css` only for scrollbars, keyframes, and narrow responsive affordances |
| Theme | dark-first neutral messenger baseline with token-ready semantic roles |
| Inherited contract | `.planning/phases/04-messenger-ui-reconstruction/04-UI-SPEC.md` remains authoritative for base chat shell, message list, composer, action menu, drawer, and state-view dimensions |

No shadcn or third-party registry blocks are approved. Use existing Chatify components and focused local additions.

## Layout Contract

### Desktop

- Preserve Phase 04 shell: left sidebar at 320px default, 280px minimum on tablet, 360px maximum on wide desktop.
- Sidebar search remains directly below the sidebar heading area and above the chat list. It must not add a second search band or multi-row toolbar.
- `New chat` remains in the sidebar header area; exact-email continuation stays in the existing compact modal/sheet pattern.
- Selected-conversation message search opens as a compact search band below `ConversationHeader`, replacing the current single input area with a richer result state region only when active.
- The normal message list remains the primary scroll area. Search results may scroll inside the message-list region but must not create nested scrollbars inside small panels.
- Search result rows use full-width unframed rows with dividers, not decorative cards.
- Navigation restore must not visibly flash the wrong conversation. While validation is pending, render the usual message skeleton or no-selected state, not stale private content.

### Mobile

- Below the Tailwind `md` breakpoint, keep the existing sidebar drawer behavior.
- Sidebar search stays inside the drawer and must remain reachable without horizontal scrolling at 390px width.
- Message search band must fit below the conversation header without covering the composer or newest message.
- Search result rows should use a compact two-line layout: sender/time metadata on one line, snippet on the next line.
- `NewChatDialog` remains modal/sheet-like with focus trap, Escape close, outside click close, and focus return.
- URL restore and session-expired states must render correctly in the mobile closed-conversation state and with the drawer open.

### Stable Dimensions

- Icon buttons: 40px by 40px, 8px radius.
- Compact result-row buttons: at least 32px by 32px, 8px radius.
- Search inputs: 40px minimum height.
- Sidebar chat list item: 72px minimum height.
- Search result row: 56px minimum height desktop, 64px minimum height mobile.
- Search band vertical padding: 8px compact, 12px maximum.
- Empty/error result state blocks: max width 420px and centered inside the available conversation/search region.
- Highlight spans must not change line height or cause snippet reflow after render.

## Spacing Scale

Declared values must remain multiples of 4.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, badge padding, highlight padding, status-dot spacing |
| sm | 8px | Search band padding, row metadata gap, compact button padding |
| md | 16px | Default component padding, sidebar search horizontal padding, result row padding |
| lg | 24px | Header/sidebar section padding and modal body gaps |
| xl | 32px | Empty state spacing and grouped state separation |
| 2xl | 48px | Major full-pane separation only |
| 3xl | 64px | Reserved for full-pane empty/session states |

Exceptions: none. Do not use viewport-scaled spacing for Phase 05 controls.

## Typography

Letter spacing must remain `0`.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 14px | 400 | 1.5 | Message text, snippets, state body |
| Label | 12px | 500 | 1.35 | Metadata, helper text, result count |
| Control | 14px | 600 | 1.25 | Buttons, menu items, search actions |
| Heading | 16px | 700 | 1.3 | Conversation title, sidebar heading |
| Section | 18px | 700 | 1.3 | Empty/session state heading only |
| Highlight | inherit | 700 | inherit | Matched query text inside snippets |

No hero-scale type belongs in Phase 05. Long names and snippets truncate with accessible full values where needed.

## Color

Use the Phase 04 palette. New Phase 05 surfaces must not introduce a new accent family.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#101113` | App background and message-list base |
| Secondary (30%) | `#181C20` | Sidebar, headers, search bands |
| Raised surface | `#20262B` | Inputs, modal/sheet body, result hover state |
| Border | `#2E363C` | Dividers, input borders, result row separators |
| Primary text | `#F4F7F6` | Main readable text |
| Secondary text | `#A8B3AF` | Snippets, timestamps, helper text |
| Muted text | `#6F7B77` | Placeholder, disabled, secondary metadata |
| Accent (10%) | `#14B8A6` | Focus ring, active search affordance, selected result if loaded |
| Search highlight | `#F59E0B` on transparent or `rgba(245, 158, 11, 0.18)` | Matched text emphasis only |
| Info | `#38BDF8` | Read state and neutral info where already established |
| Success | `#22C55E` | Online/connected and successful continuation |
| Warning | `#F59E0B` | Reconnecting, pending restore, recoverable search warning |
| Destructive | `#EF4444` | Auth loss, failed requests, destructive actions |

Accent reserved for: focus ring, active search trigger, selected conversation rail, loaded-result highlight, send/action-forward controls, and actionable links. Do not color every search match or row border with accent.

Color contrast target: WCAG AA for text and at least 3:1 for interactive outlines/icons.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Sidebar search placeholder | Search conversations |
| Sidebar no-results heading | No matching conversations |
| Sidebar no-results body | Try a different name or latest message, or use New chat to start by email. |
| New chat CTA | New chat |
| New chat submit | Start or continue chat |
| New chat existing success | Conversation opened. |
| New chat created success | Conversation started. |
| New chat generic failure | We could not start that chat. Check the email and try again. |
| Invalid email error | Enter a valid email address. |
| Message search placeholder | Search this conversation |
| Message search helper below minimum | Type at least 2 characters to search. |
| Message search loading | Searching messages... |
| Message search result count | {count} result{plural} |
| Message search empty heading | No message matches |
| Message search empty body | Try another word or clear search to return to the conversation. |
| Message search error | We could not search messages. Try again. |
| Search clear action | Clear search |
| Return to conversation | Back to conversation |
| Restoring selected chat | Opening conversation... |
| Invalid restored chat | Conversation unavailable. Showing your latest chat. |
| Session expired heading | Your session expired |
| Session expired body | Sign in again to continue. |
| Session expired action | Sign in |

Copy must be concise, recovery-oriented, and privacy-safe. Do not reveal whether an unsubmitted or failed email belongs to an account.

## Primary Flow

1. User opens Chatify.
2. App validates auth and restores selected chat from `?chatId=`, per-user localStorage, or the newest available chat.
3. Sidebar displays the user's authorized conversations with latest visible snippets.
4. User filters conversations locally from the sidebar search input.
5. User can open `New chat`, submit an exact email, and either start or continue the returned conversation.
6. Selected conversation displays presence and typing only for authorized members.
7. User opens message search from the header.
8. Message search waits for 2 trimmed characters, then shows loading, results, empty, or error states inside the conversation surface.
9. Clearing search restores the normal message list without changing durable message cache state.
10. Logout or auth refresh failure clears private chat/search/presence state and blocks private content behind the session-expired state.

## State Model

| State | Visual Contract | Interaction Contract |
|-------|-----------------|----------------------|
| Sidebar search idle | Existing chat list, search input empty | Typing filters local list only |
| Sidebar search results | Chat list narrowed by title/latest visible snippet | Selecting a row closes drawer on mobile and updates URL/localStorage |
| Sidebar search empty | Centered compact state in sidebar body | New chat remains visible and reachable |
| New chat submitting | Submit button shows pending state without resizing dialog | Prevent duplicate submit while pending |
| New chat existing chat | Dialog closes, returned conversation selected, optional toast/status copy | No `chat:new` expectation for existing chat |
| New chat failure | Inline error under email input with generic privacy-safe copy | Input remains focused or focus returns to field |
| Message search closed | Normal message list and composer | Search trigger has accessible name |
| Message search below minimum | Search band open with helper text | No remote request; clear/close available |
| Message search loading | Search band and list region show skeleton or pending row | Normal message cache remains visible only if not misleading; no stale result count |
| Message search results | Result rows with metadata, highlighted snippet, and loaded-message affordance when applicable | Keyboard can move through/click result rows |
| Message search empty | Centered compact state in result region | Clear search and retry/alternate query available |
| Message search error | Inline recoverable error in result region | Retry available; normal conversation state preserved |
| Result message already loaded | Result row may scroll/highlight the loaded bubble | Highlight is temporary and non-layout-shifting |
| Result message not loaded | Result remains snippet-only | No fake jump-to-context behavior |
| URL restore pending | Skeleton or "Opening conversation..." state | Do not render stale previous-user content |
| Invalid restored chat | Fallback chat selected with neutral copy if visible | URL is replaced without invalid `chatId` |
| Auth expired | Full conversation blocked state | Sign in action available; private message content hidden |
| Presence/typing stale cleanup | Presence/typing indicators disappear | No stale typing remains after chat change/auth loss |

## Component Contracts

### `ChatSidebar`

- Search is local-only and never emits user search requests.
- Filter by `getChatTitle(chat, user._id)` and requester-visible `latestMessage.text`.
- No-results state uses the Phase 05 copywriting contract and keeps `New chat` available.
- Chat rows preserve their 72px minimum height when search terms, unread counts, or presence states change.

### `NewChatDialog`

- Keep compact modal/sheet behavior from Phase 04.
- Email label stays above the input, error text below the input, helper text optional.
- Do not show account name, avatar, or presence before submit.
- Pending state must keep button dimensions stable.
- On success, close the dialog, clear stale errors, select returned chat, and let the chat pane show the returned conversation.
- On generic failure, do not expose account existence or self-target details in user-facing copy.

### `ConversationHeader`

- Search action remains an icon button with `aria-label` switching between `Search messages` and `Close message search`.
- Header presence summary remains scoped to the selected chat's authorized member.
- Do not add a second toolbar row beyond the search band.

### `ConversationPane`

- Owns the search band and result-mode switch.
- Normal message list, search result list, session-expired state, and no-selected state are mutually clear.
- Search result mode must not pass filtered search results into `MessageList` as if they were conversation history.
- Session-expired state hides private messages and composer content.

### `MessageSearchResults`

- New focused component is recommended.
- Renders loading, results, empty, and error states.
- Result row fields: sender label, timestamp, snippet with highlighted query text, and optional "in view" affordance when message is loaded.
- Use semantic list/listitem structure or equivalent accessible grouping.
- Result rows are keyboard-operable buttons only when they perform an action; otherwise render as static list rows.

### `ChatStateView`

- Reuse for message-search empty/error states and session-expired states where possible.
- Keep heading at 18px maximum and body at 14px.
- Do not use decorative cards inside the conversation pane.

### `TypingIndicator`

- Continue rendering below the connection/session/search band and above the message list or composer according to existing Phase 04 placement.
- Clear stale typing on selected-chat change and auth loss.
- Use `aria-live="polite"` and avoid repeated announcements for each debounce tick.

### `SelectedChatPersistence`

- URL and localStorage behavior may live in a focused hook.
- The hook must not render UI directly.
- It validates requested `chatId` against loaded chats before selecting and must never expose another user's stored selection.

## Accessibility Contract

- Every search input has a visible or programmatic label.
- Message search helper, count, loading, empty, and error states use `aria-live="polite"`.
- Inline errors are tied to inputs with `aria-describedby`.
- `NewChatDialog` keeps focus trap, Escape close, outside click close, and focus return.
- Search result rows that perform actions are reachable by keyboard and have accessible names that include sender and snippet context.
- Highlighting cannot be the only indication of a match; result count and snippet text must remain readable without color.
- Focus ring uses the existing accent token and must remain visible on dark surfaces.
- Clearing search returns focus to the search input unless the user closes search, in which case focus returns to the header search button.
- Auth-expired state moves focus to the blocked-state heading or primary action when it replaces private content.

## Motion Contract

- Search band open/close: 160ms to 220ms, transform/opacity only.
- Result row hover/active: color/background transition only, 120ms to 160ms.
- Loaded-message highlight after selecting a visible result: 900ms to 1400ms subtle background pulse using existing warning/highlight token.
- Drawer/dialog behavior remains governed by Phase 04.
- No decorative ambient motion, orbs, bokeh, or non-functional animations.
- Respect `prefers-reduced-motion` by disabling search band motion and loaded-message pulse.

## Implementation Handoff

| Area | Decision |
|------|----------|
| Primary frontend route | `Frontend/Chatify/src/pages/chat/chat.tsx` |
| Sidebar surface | `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` |
| New chat surface | `Frontend/Chatify/src/pages/chat/components/NewChatDialog.tsx` |
| Message search surface | `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx` plus a focused result component if useful |
| Search hook | `Frontend/Chatify/src/hooks/useChatQueries.ts` or nearby focused hook, using `['messageSearch', chatId, normalizedQuery]` |
| Persistence hook | `Frontend/Chatify/src/pages/chat/hooks/` recommended |
| Presence cleanup | `Frontend/Chatify/src/store/presenceStore.ts` and `Frontend/Chatify/src/hooks/useChatSocket.ts` |
| API client | `Frontend/Chatify/src/api/messageApi.ts` for message search |
| Smoke tests | Extend `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` with deterministic route interception |

Planner/executor may choose exact helper/component names if the UI behavior above remains intact.

## Test Contract

Frontend component and hook tests should cover:

- Sidebar search matches title and latest visible snippet.
- Sidebar search does not call a global user-search endpoint.
- Sidebar no-results copy points to New chat.
- New chat pending, success-existing, success-created, invalid-email, and generic failure states.
- Message search suppresses backend calls for fewer than 2 trimmed characters.
- Message search loading, results, empty, error, clear, and return-to-conversation states.
- Search results do not mutate `messagesQueryKey(chatId)` durable message cache.
- URL `chatId` restore, invalid id fallback, and per-user localStorage behavior.
- Logout/auth-expired cleanup hides private content and clears search/presence/typing state.
- Keyboard operation and focus return for search, result rows, and New chat dialog.

Playwright smoke should cover:

- Desktop sidebar search filters conversations.
- Mobile drawer search remains usable at 390px.
- Message search opens, shows fixture result, and clears back to normal conversation.
- New chat exact-email submit selects an existing chat through intercepted response.
- `?chatId=` restore selects the intended accessible conversation.
- Session-expired fixture hides private messages and shows Sign in.

## Verification Contract

Before Phase 05 completion:

- Run `npm test` from `Backend/Chatify`.
- Run `npm test` from `Frontend/Chatify`.
- Run `npm run test:ui` from `Frontend/Chatify`.
- Run `npm run lint` from `Frontend/Chatify`.
- Run `npm run build` from `Frontend/Chatify`.
- Capture or update smoke evidence for desktop and mobile Phase 05 baseline flows.
- Document any skipped verification with a concrete blocker.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party registry | none | blocked unless explicitly approved later |

No component registry blocks are approved for this phase. Use existing local components, Tailwind, `lucide-react`, and the current testing stack.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS - search, continuation, auth-loss, and empty/error copy is specific, concise, recoverable, and privacy-safe.
- [x] Dimension 2 Visuals: PASS - layout, state surfaces, result rows, stable dimensions, and responsive behavior are specified.
- [x] Dimension 3 Color: PASS - Phase 04 neutral dark palette is preserved with restrained search highlight use and semantic states.
- [x] Dimension 4 Typography: PASS - compact app-scale type with fixed sizes, zero letter spacing, and no hero-scale text.
- [x] Dimension 5 Spacing: PASS - 4px-based spacing, stable dimensions, and responsive constraints are defined.
- [x] Dimension 6 Registry Safety: PASS - no external registry usage approved.

**Approval:** approved 2026-06-09
