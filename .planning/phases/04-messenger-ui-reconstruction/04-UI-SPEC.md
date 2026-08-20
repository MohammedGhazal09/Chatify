---
phase: 4
slug: messenger-ui-reconstruction
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-08
---

# Phase 04 - UI Design Contract

> Visual and interaction contract for the Phase 04 Chatify messenger reconstruction.

## Product Direction

Chatify should feel like a professional private direct-message messenger: calm, dense enough for repeated use, clearly stateful, responsive, and recoverable. This is an application surface, not a landing page or marketing screen.

The UI must preserve the Phase 3 message contract: TanStack Query owns durable chat/message state, optimistic messages reconcile by `_id` and `clientMessageId`, failed optimistic messages remain visible, and retry should preserve the client message identity where possible.

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | `lucide-react` preferred for new controls; preserve existing icons where replacement would add churn |
| Font | system sans stack: `Inter`, `ui-sans-serif`, `system-ui`, `-apple-system`, `Segoe UI`, `sans-serif` |
| CSS strategy | Tailwind for layout/state styling; `chat.css` only for scrollbars and keyframe animations |
| Theme | dark-first neutral messenger baseline with token-ready semantic roles |

## Layout Contract

### Desktop

- App shell fills the viewport with a fixed-height messenger layout.
- Left sidebar width: 320px default, 280px minimum on tablet, 360px maximum on wide desktop.
- Conversation pane fills remaining width and is never wrapped in a decorative card.
- Header height: 64px desktop.
- Composer area: 72px minimum, grows to fit multiline input up to 144px before internal scrolling.
- Message list is the only primary vertical scrolling region inside the conversation pane.
- Sidebar list is independently scrollable.

### Mobile

- Below the Tailwind `md` breakpoint, the sidebar becomes an overlay drawer.
- Drawer width: `min(86vw, 320px)`.
- Drawer closes on chat selection, outside click, and Escape.
- Conversation header includes an icon-only menu button with an accessible name.
- Composer remains anchored at the bottom and must not cover the newest message.
- Message bubbles use a max width of 85%.

### Stable Dimensions

- Icon buttons: 40px by 40px, 8px radius.
- Compact icon buttons inside bubbles/menus: 32px by 32px, 8px radius.
- Avatar: 40px mobile, 44px desktop.
- Chat list item: 72px minimum height.
- Message action trigger hit area: at least 32px square.
- Empty/error state blocks: max width 420px and centered within the available conversation pane.

## Spacing Scale

Declared values must be multiples of 4.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, badge padding, status glyph spacing |
| sm | 8px | Button padding, bubble metadata gap, compact stacks |
| md | 16px | Default component padding, message stack gap |
| lg | 24px | Header/sidebar section padding |
| xl | 32px | Empty state spacing, dialog body spacing |
| 2xl | 48px | Major layout separation only |
| 3xl | 64px | Reserved for full-pane empty states |

Exceptions: none. Do not use viewport-scaled spacing.

## Typography

Letter spacing must remain `0`.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 14px | 400 | 1.5 | Message text, sidebar preview, state body |
| Label | 12px | 500 | 1.35 | Time stamps, metadata, helper text |
| Control | 14px | 600 | 1.25 | Buttons, menu items, composer actions |
| Heading | 16px | 700 | 1.3 | Conversation title, sidebar heading |
| Section | 18px | 700 | 1.3 | Empty state heading only |

Do not use hero-scale type inside the messenger. Truncate long user names with an accessible full value in `title` or screen-reader text when needed.

## Color

The palette is dark-first, neutral-dominant, and stateful. Avoid a one-note emerald or slate-only UI.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#101113` | App background |
| Secondary (30%) | `#181C20` | Sidebar and header surfaces |
| Raised surface | `#20262B` | Menus, composer, modal/sheet body |
| Border | `#2E363C` | Panel edges, dividers, input borders |
| Primary text | `#F4F7F6` | Main readable text |
| Secondary text | `#A8B3AF` | Previews, timestamps, helper text |
| Muted text | `#6F7B77` | Disabled and placeholder text |
| Accent (10%) | `#14B8A6` | Send action, active chat indicator, focus ring |
| Own message | `#123C35` | Current user's message bubble |
| Other message | `#22282D` | Other user's message bubble |
| Info | `#38BDF8` | Read receipt accent and neutral information |
| Success | `#22C55E` | Connected, sent success, online |
| Warning | `#F59E0B` | Reconnecting, pending, recoverable warning |
| Destructive | `#EF4444` | Failed send, delete, destructive confirmation |

Accent reserved for: send button active state, selected conversation rail, keyboard focus ring, active unread marker, and links/actions that move the user forward. Do not apply accent to every button or text label.

Color contrast target: WCAG AA for text and at least 3:1 for interactive outlines/icons.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Send message |
| New chat CTA | New chat |
| Empty sidebar heading | No conversations yet |
| Empty sidebar body | Start a chat to begin messaging. |
| No selected chat heading | Select a conversation |
| No selected chat body | Choose a chat from the sidebar or start a new one. |
| Empty conversation heading | No messages yet |
| Empty conversation body | Send the first message when you are ready. |
| No search results heading | No matches found |
| No search results body | Try a different name or message term. |
| Offline state | You are offline. Reconnect to send new messages. |
| Reconnecting state | Reconnecting. Messages will update when the connection returns. |
| Failed send | Message failed to send. Retry or dismiss it. |
| Session expired | Your session expired. Sign in again to continue. |
| Delete for self confirmation | Delete this message from your view? |
| Delete for everyone confirmation | Delete this message for everyone? This cannot be undone. |

Copy must be action-oriented and concise. Error copy must name the problem and the next recovery action.

## Primary Flow

1. User opens `/chat`.
2. Sidebar loads conversations with unread indicators and latest visible message preview.
3. User selects a conversation.
4. Conversation header shows participant, online/typing context, and header actions.
5. Message list loads newest messages and exposes manual older-message loading when available.
6. User writes a message in the composer and sends it.
7. The message appears immediately with sending state.
8. HTTP/socket/refetch paths converge into sent, delivered, or read state without duplicates.
9. If send fails, the failed message remains inline with retry and dismiss actions.

## State Model

| State | Visual Contract | Interaction Contract |
|-------|-----------------|----------------------|
| Initial loading | Skeleton rows in sidebar and message list, not spinners alone | No destructive or send actions |
| Empty sidebar | Centered state in sidebar body | `New chat` remains available |
| No selected chat | Centered state in conversation pane | Sidebar remains usable |
| Empty conversation | Centered message list state above composer | Composer remains enabled if session/connection allows |
| Search empty | Inline result state in the searched region | Preserve query and allow clearing |
| Sending | Own bubble with pending metadata and subtle warning tone | Disable duplicate send for same submit; composer remains usable |
| Failed send | Own bubble with destructive border/icon and inline retry/dismiss | Retry uses same client message id where possible |
| Deleted for everyone | Neutral tombstone bubble, no original text | Actions hidden except allowed metadata |
| Edited | Message metadata shows `edited` after timestamp | Preserve normal message layout |
| Delivered/read | Status glyph near timestamp for own messages only | No extra layout shift when state changes |
| Typing | Inline row at bottom of message list above composer | `aria-live="polite"` announcement |
| Reconnecting | Banner below header, warning tone | Composer hint visible; sending allowed unless browser offline |
| Offline | Banner below header, destructive/warning tone | Send disabled with explicit reason |
| Session expired | Full conversation blocked state | Primary action routes user to sign in |
| Unknown error | Inline state with retry where possible | Preserve selected chat context |

## Component Contracts

### `ChatShell`

- Owns viewport layout, responsive split, mobile drawer open state, and global chat surface boundaries.
- Does not own durable message data.
- Provides skip-free keyboard focus order: sidebar controls, conversation header, message list, composer.

### `ChatSidebar`

- Contains account controls, connection-aware sidebar status when needed, search field, chat list, and `New chat` action.
- Chat list items must not resize when unread count or status changes.
- Empty and no-results states render inside the sidebar body.

### `ChatListItem`

- Fixed minimum height of 72px.
- Shows avatar, participant/chat name, latest visible message preview, timestamp, unread count, and online indicator when authorized.
- Selected state uses accent rail or border, not a full accent-filled block.

### `ConversationPane`

- Owns selected-chat presentation: header, connection/session banners, message list, typing row, and composer.
- Shows `ChatStateView` for no selected chat, session expired, unrecoverable load error, and empty states.

### `ConversationHeader`

- Shows drawer trigger on mobile, participant/avatar, online/last-seen/typing summary, and header actions.
- Header action buttons are icon buttons with accessible names and tooltips where meaning is not obvious.

### `MessageList`

- Owns scroll anchoring behavior and manual older-message loading.
- Preserves scroll position when prepending older messages.
- Auto-scrolls only when near bottom or after current user's own send.
- Uses semantic list/listitem structure or equivalent accessible grouping.

### `MessageBubble`

- Handles own/other alignment, text, metadata, status, edited/deleted/failed/sending/reaction states, and action trigger.
- Bubble max width: 68% desktop, 75% tablet, 85% mobile.
- Failed and pending states must not change bubble width when status changes.
- Deleted-for-everyone renders as a tombstone and never exposes original message text.

### `MessageComposer`

- Contains multiline text input, send button, emoji trigger, reply/edit preview when active, and connection/session hints.
- Enter sends; Shift+Enter inserts a newline.
- Disabled state must explain why sending is unavailable.
- Text limit follows the backend boundary of 1000 trimmed characters.

### `MessageActionMenu`

- Desktop opens from kebab or context menu.
- Mobile opens from explicit kebab control.
- Menu items include only actions authorized by current state.
- Escape closes and returns focus to the trigger.

### `NewChatDialog`

- Modal/sheet pattern with focus trap, Escape close, outside click close, and focus return.
- Uses email input, optional chat name only if already supported, submit, cancel, and inline validation.
- On success, closes and selects or surfaces the resulting conversation if available.

### `ChatStateView`

- Reusable state component for empty, no selected chat, search empty, offline, session expired, load error, and generic error states.
- Accepts icon, heading, body, primary action, and secondary action.
- Heading is 18px maximum; body is 14px.

## Accessibility Contract

- Every icon-only button requires an `aria-label`.
- Interactive SVG icons are hidden from screen readers when the button label already names the action.
- Menus, dialogs, and drawers support Escape close and focus return.
- Modal/sheet focus is trapped while open.
- Connection, typing, failed-send, and session-expired state changes use `aria-live="polite"` unless immediate interruption is required.
- Error text is tied to inputs with `aria-describedby`.
- Destructive actions require confirmation and must not rely on color alone.
- Focus ring uses `#14B8A6` or an equivalent high-contrast token.
- Keyboard users can send, retry, dismiss failed sends, open message actions, choose a reaction, close menus, and open/close the mobile drawer.

## Motion Contract

- Motion is functional and short: 120ms to 200ms for hover/focus/state changes, 200ms to 300ms for drawer/dialog entry.
- Use existing `chat.css` keyframes for typing, fade-in, reconnect, and drawer motion where possible.
- No decorative background blobs, orbs, or non-functional animation.
- Respect `prefers-reduced-motion` by disabling non-essential transitions.

## Implementation Handoff

| Area | Decision |
|------|----------|
| Implementation target | React/Vite/Tailwind engineer |
| Primary file to decompose | `Frontend/Chatify/src/pages/chat/chat.tsx` |
| CSS file to preserve | `Frontend/Chatify/src/pages/chat/chat.css` |
| Existing components to reuse | `MessageStatus`, `ConnectionIndicator`, `TypingIndicator`, `Toast`, `OnlineStatus`, `loadingSpinner` |
| Existing hooks to preserve | `useChatQueries`, `useChatSocket`, `messageCache`, `useLocalStorage` |
| Testing baseline | Vitest currently exists; add RTL, user-event, jest-dom, and jsdom |

Suggested component location: `Frontend/Chatify/src/pages/chat/components/` for chat-specific components and `Frontend/Chatify/src/pages/chat/hooks/` for chat-page view hooks.

## Test Contract

Component tests should cover:

- Initial loading state renders stable skeleton/state UI.
- Empty sidebar, no selected chat, empty conversation, and search-empty states.
- Optimistic sending bubble appears immediately.
- HTTP/socket duplicate merge does not render duplicate messages.
- Failed send renders retry and dismiss without losing message text.
- Retry action preserves the failed message context.
- Unread count update changes the chat list item without layout shift.
- Session-expired state blocks composer and exposes sign-in action.
- Mobile drawer opens, closes, and returns focus.
- Message action menu opens by trigger and closes on Escape.

React 19 testing requirements:

- Import `act` from `react` when needed.
- Prefer React Testing Library and `fireEvent`/`userEvent`; do not use removed `react-dom/test-utils` APIs.
- Measure StrictMode call counts from actual test output instead of assuming React 18 behavior.

## Verification Contract

Before Phase 04 completion:

- Run `npm test` from `Frontend/Chatify`.
- Run `npm run lint` from `Frontend/Chatify`.
- Run `npm run build` from `Frontend/Chatify`.
- Smoke-check desktop layout around 1440px width.
- Smoke-check mobile layout around 390px width.
- Document any skipped verification with a concrete reason.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party registry | none | blocked unless explicitly approved later |

No component registry blocks are approved for this phase. Use existing local components and Tailwind.

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS - copy is concise, state-specific, and recovery-oriented.
- [x] Dimension 2 Visuals: PASS - layout, components, state surfaces, and interaction behavior are specified.
- [x] Dimension 3 Color: PASS - neutral dark palette with restrained accent and semantic status colors.
- [x] Dimension 4 Typography: PASS - compact app-scale type with fixed sizes and zero letter spacing.
- [x] Dimension 5 Spacing: PASS - 4px-based spacing, stable dimensions, and responsive constraints are defined.
- [x] Dimension 6 Registry Safety: PASS - no external registry usage approved.

**Approval:** approved 2026-06-08
