# Phase 06: Messenger Visual Parity - UI Design Contract

**Created:** 2026-06-12
**Status:** Approved for planning
**Phase:** 06 - Messenger Visual Parity
**Primary route:** `/chat`
**Implementation target:** React 19 + Vite + Tailwind CSS v4 + local CSS variables

## Purpose

This file is the authoritative visual and interaction contract for Phase 06. It turns the four supplied Chatify reference images into implementable UI rules for desktop light, desktop dark, mobile light, and mobile dark messenger variants.

The goal is reference parity, not a new creative direction. The implemented chat page must feel like a quiet, secure, professional private messenger with clear delivery, read, retry, typing, search, presence, and session states.

This phase must preserve the Phase 03 canonical message-state contract and the Phase 05 search, selected-chat, presence, continuation, and session-expired behavior.

## Source Inputs

- `.planning/phases/06-messenger-visual-parity/06-SPEC.md` - locked requirements and acceptance criteria.
- `.planning/phases/06-messenger-visual-parity/06-CONTEXT.md` - approved implementation decisions.
- Supplied reference image 1 - desktop light three-column Chatify messenger.
- Supplied reference image 2 - desktop dark three-column Chatify messenger.
- Supplied reference image 3 - mobile light single-conversation Chatify messenger.
- Supplied reference image 4 - mobile dark single-conversation Chatify messenger.

The supplied images are the visual source of truth. This document converts them into a durable contract because the image files may not be available to every future implementation session.

## Product And User Context

Chatify users are authenticated people having private direct conversations. They need to quickly understand who they are talking to, whether the session is connected, whether the other party is online, which messages were delivered or read, and whether a send is still retrying.

The UI should reduce anxiety around private messaging. It should not look like a social feed, marketing page, dashboard, or decorative concept screen. The visual tone is calm, secure, restrained, and work-focused.

## Visual North Star

### Desktop Light

Desktop light uses a full-height three-column messenger with a white/off-white base, thin gray separators, teal identity/action accents, and a right context rail. The left rail contains Chatify branding, current account chip, conversation search, new chat action, and compact conversation rows. The center pane contains a header with abstract identity tile, conversation title/status, compact icon actions, a dated message stream, and a rounded composer. The right rail contains contact identity, action tiles, pinned messages, shared files, shared media, and conversation security.

### Desktop Dark

Desktop dark keeps the same three-column structure but uses graphite and charcoal surfaces, low-contrast borders, soft text, and muted teal. The dark background must never be pure black and must not use neon glow, purple gradients, or decorative orbs. The right rail and left rail remain readable without heavy card nesting.

### Mobile Light

Mobile light is a single selected conversation. The primary screen shows a safe-area-aware header, back arrow, abstract identity tile, contact code/name, online status, call/search/more icons, date divider, stacked chat bubbles, typing bubble, secure-session line, and bottom composer with attachment, input, microphone, and circular send action. No sidebar chrome appears unless the conversation drawer is opened.

### Mobile Dark

Mobile dark keeps the same mobile rhythm but uses charcoal surfaces, subtle geometric background patterning if needed, teal sent bubbles, dark received bubbles, and a fixed bottom composer. It must stay legible, quiet, and secure without pure black, glow-heavy effects, or decorative imagery.

## Non-Negotiable Constraints

- No humans, faces, portraits, silhouettes, hands, bodies, animals, pets, birds, insects, plants, flowers, trees, mascots, profile photos, or realistic avatars anywhere in Phase 06 chat surfaces.
- Do not render `profilePic` image URLs in the chat UI.
- Use abstract geometric identity tiles, monograms, encrypted-pattern marks, document icons, file badges, and non-living interface/material thumbnails only.
- Do not add backend APIs for pinned messages, files, media, calls, video, mute, profile, or attachments.
- Do not create separate light and dark component trees.
- Do not add decorative blobs, bokeh, gradient orbs, neon treatments, or pure black backgrounds.
- Do not turn `/chat` into a landing page or dashboard.
- Do not overwrite unrelated local work in `Frontend/Chatify/src/pages/chat/chat.tsx`; keep it as the orchestration layer unless a later implementation phase explicitly authorizes a broader rewrite.

## Design Principles

1. **Reference first:** Layout, density, icon placement, bubble rhythm, and information hierarchy should follow the four supplied images.
2. **Quiet trust:** Status and security cues should be clear without creating visual noise.
3. **State clarity:** Delivery, read, retry, typing, online, search, and session states must be visible and understandable.
4. **Token discipline:** Color and surface changes must come from semantic variables, not scattered hard-coded classes.
5. **Brownfield safety:** Reuse existing chat data flow, query hooks, socket hooks, and tested behavior.
6. **Accessible by default:** Every icon-only control needs an accessible name, keyboard focus, and non-color-only state support.

## Theme System

Theme is controlled by CSS variables on the chat root. The same components render in both themes.

### Required Theme Entry Points

- System/default theme when no user preference exists.
- Settings modal control for production users.
- Deterministic URL and/or localStorage override for Playwright, for example `?chatTheme=light` and `?chatTheme=dark`.
- Per-user localStorage persistence.

### Root Contract

The chat root should expose stable selectors for tests:

```html
<div data-testid="chat-root" data-chat-theme="light">
```

or

```html
<div data-testid="chat-root" data-chat-theme="dark">
```

### Color Tokens

Use these as initial implementation values. Minor tuning is allowed only if screenshots show reference drift and contrast remains compliant.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--chat-bg` | `#F7F8F6` | `#0E171A` | Full route background |
| `--chat-panel` | `#FFFFFF` | `#121D21` | Rails, header, composer base |
| `--chat-panel-subtle` | `#F1F5F2` | `#172529` | Active rows, inset surfaces |
| `--chat-panel-elevated` | `#FFFFFF` | `#1B282C` | Bubbles, action tiles, popovers |
| `--chat-border` | `#DDE4E0` | `#26373B` | Column separators and section dividers |
| `--chat-border-strong` | `#C8D2CD` | `#34474D` | Focused/active outlines |
| `--chat-text` | `#111827` | `#F4F7F6` | Primary text |
| `--chat-text-muted` | `#5B6662` | `#A7B2AE` | Secondary labels |
| `--chat-text-soft` | `#8A948F` | `#74827D` | Metadata and placeholders |
| `--chat-accent` | `#0F766E` | `#2CB7A7` | Primary teal accent |
| `--chat-accent-strong` | `#0B5E59` | `#42CBBE` | Hover/focus teal |
| `--chat-accent-soft` | `#E4F4F1` | `#143A38` | Active list rows, chips |
| `--chat-success` | `#169B62` | `#57D17E` | Online/verified status |
| `--chat-warning` | `#A96800` | `#E1B75A` | Pending/retrying status |
| `--chat-danger` | `#C2413B` | `#FF8A80` | Failed state |
| `--chat-own-bubble` | `#0F766E` | `#126B63` | Outgoing bubble |
| `--chat-own-bubble-hover` | `#0B5E59` | `#197A72` | Outgoing hover/active |
| `--chat-own-text` | `#F8FFFC` | `#F8FFFC` | Outgoing text |
| `--chat-received-bubble` | `#FFFFFF` | `#1B282C` | Incoming bubble |
| `--chat-received-text` | `#111827` | `#F4F7F6` | Incoming text |
| `--chat-input-bg` | `#FFFFFF` | `#111B1F` | Composer input |
| `--chat-shadow` | `0 10px 30px rgba(15, 23, 42, 0.08)` | `0 18px 38px rgba(0, 0, 0, 0.24)` | Floating surfaces only |
| `--chat-focus` | `#0F766E` | `#42CBBE` | Focus ring |

### Typography

Use a system sans stack. Do not add a new font dependency for Phase 06.

```css
font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
letter-spacing: 0;
```

| Role | Size | Line height | Weight | Notes |
|------|------|-------------|--------|-------|
| Brand | 28px desktop, 24px mobile | 1.15 | 700 | Chatify wordmark in sidebar only |
| Conversation title | 18-20px desktop, 24px mobile | 1.2 | 700 | Mobile title is larger like references |
| Section heading | 14px | 1.35 | 700 | Right rail headings |
| Body/message | 16px desktop, 20-22px mobile reference mode | 1.42 | 400 | Mobile bubbles intentionally larger |
| Row title | 15-16px | 1.25 | 600 | Conversation list |
| Metadata | 12-13px | 1.25 | 400/500 | Time, status, file metadata |
| Buttons/labels | 13-14px | 1.2 | 500 | Action tiles and controls |

Do not scale font size with viewport width. Use fixed responsive steps at breakpoints.

### Radius And Shape

| Token | Value | Usage |
|-------|-------|-------|
| `--chat-radius-xs` | `4px` | Small badges |
| `--chat-radius-sm` | `6px` | File/media thumbnails |
| `--chat-radius-md` | `8px` | Identity tiles, action tiles |
| `--chat-radius-lg` | `12px` | Desktop bubbles, composer |
| `--chat-radius-xl` | `16px` | Mobile bubbles |
| `--chat-radius-pill` | `999px` | Inputs, send button, counters |

Cards are only allowed for repeated items, action tiles, modal surfaces, and framed tools. Do not put cards inside cards.

### Motion

- Default transition: `150ms ease-out` for color, border, shadow, and opacity.
- Pressed state: subtle `translateY(1px)` or `scale(0.98)` only for buttons.
- Do not animate layout width, height, left, or top.
- Do not add continuous decorative animation.
- Respect `prefers-reduced-motion: reduce` by removing non-essential transitions and animations.

## Responsive Layout Contract

### Breakpoints

| Range | Layout |
|-------|--------|
| `<768px` | Mobile single-conversation primary view |
| `768px-1279px` | Conversation list drawer or two-column fallback; right rail hidden |
| `>=1280px` | Full three-column desktop shell |
| `>=1536px` | Same structure with more breathing room, not new content |

### Desktop Grid

At `>=1280px`, render:

```css
grid-template-columns: 344px minmax(0, 1fr) 392px;
height: 100dvh;
width: 100vw;
overflow: hidden;
```

At very wide sizes, the left rail may grow to `360px` and the right rail to `400px`, but the center pane remains the flexible priority.

Column separators are 1px borders using `--chat-border`. No horizontal overflow is allowed.

### Desktop Left Rail

Required structure:

1. Brand row with abstract Chatify mark, `Chatify` wordmark, and compact panel/action icon.
2. Current account chip with abstract tile, coded label or account display name, connection status, status dot, and dropdown affordance.
3. Search row with conversation search input, filter/settings action, and new chat action.
4. Conversation list rows with abstract tile, title, preview, timestamp, delivery/read indicators, unread counter, and active left accent.
5. Footer row with lock/security copy and settings action.

Stable dimensions:

- Width: `344px`.
- Outer padding: `24px`.
- Brand row height: `48px`.
- Account chip height: `72px`.
- Search input height: `40px`.
- Conversation row height: `72px-80px`.
- Identity tile: `48px`.
- Active rail indicator: `4px` wide.

### Desktop Center Pane

Required structure:

1. Header with back affordance only when useful, abstract identity tile, title, online/last-seen text, and call/video/search/more icon cluster.
2. Message stream with date divider, incoming/outgoing bubbles, retry state, file chip state, and typing row.
3. Composer area with attachment control, rounded input, emoji, microphone, circular send button, and secure-session line.

Stable dimensions:

- Header height: `88px`.
- Header horizontal padding: `32px`.
- Message stream max content width: `760px-840px` centered inside the center pane.
- Desktop own bubble max width: `42%-48%` of message content width.
- Desktop received bubble max width: `46%-52%`.
- Composer max width: `calc(100% - 64px)`, capped near `880px`.
- Composer row height: `56px`.
- Secure-session line height: `28px`.

### Desktop Right Rail

Required structure:

1. Contact header with large abstract identity tile, title, online status, optional member-since/subtitle, favorite/star, and close icon if relevant.
2. Action strip with four square tiles. Light reference: Call, Video, Search, More. Dark reference may use Profile, Mute, Search, More. The exact labels can vary by theme only if the visual smoke fixtures require it; production should prefer one stable set.
3. Pinned messages section with count and two rows.
4. Shared files section with count and three rows.
5. Shared media section with count and four to six abstract thumbnails.
6. Conversation security section with authenticated session, member-only room, and socket connected rows.

Stable dimensions:

- Width: `392px`.
- Outer padding: `24px`.
- Large identity tile: `80px-96px`.
- Action tiles: four equal columns, `72px-84px` tall, radius `6px-8px`.
- Section divider: 1px `--chat-border`.
- File rows: `44px-52px`.
- Media thumbnails: square, `64px-72px`.

The right rail is presentational in Phase 06. It must not add backend feature scope.

### Mobile Single Conversation

Mobile primary view renders only the selected conversation.

Required structure:

1. Safe-area header with time/status bar space respected by browser safe area, back arrow, identity tile, title, online status, call/search/more actions.
2. Date divider.
3. Scrollable message stream.
4. Typing indicator.
5. Composer dock with attachment, rounded input, microphone, circular send action, secure-session line, and bottom safe-area padding.

Stable dimensions:

- Target screenshots: `390x844` and `430x932`.
- Header min height: `116px`; can expand to `128px` with safe-area inset.
- Header horizontal padding: `24px` on 390px width.
- Identity tile: `56px`.
- Icon buttons: `44px` minimum touch target.
- Message body padding: `20px 20px 140px`.
- Mobile own bubble max width: `70%-74%`.
- Mobile received bubble max width: `62%-68%`.
- Mobile bubble radius: `16px`.
- Composer dock min height: `126px` plus `env(safe-area-inset-bottom)`.
- Input height: `56px`.
- Send button: `56px`.

Mobile back arrow opens the conversation list drawer. It must not clear selected chat or navigate away from `/chat`.

## Component Contracts

### ChatThemeRoot

**Purpose:** Owns Phase 06 chat theme variables, root data attributes, and deterministic test overrides.

**Inputs:**

- Current authenticated user id, if available.
- System color scheme preference.
- Settings modal preference.
- URL/localStorage test override.

**Behavior:**

- Resolves theme in this order: URL/test override, persisted per-user preference, system preference, light fallback.
- Applies `data-chat-theme`.
- Keeps theme changes purely presentational.
- Does not reset selected chat, message search, sidebar search, composer text, presence state, or messages.

**Accessibility:** Settings control must be keyboard reachable and announce the current theme.

### AbstractIdentityTile

**Purpose:** Replaces all chat-surface profile images with deterministic non-living identity marks.

**Variants:**

- `brand`: Chatify logo mark.
- `account`: current user/account chip.
- `conversation`: sidebar and header identity tile.
- `large`: right rail contact tile.
- `media`: shared-media abstract thumbnail.
- `file`: file badge/document tile.

**Visual rules:**

- Rounded square/squircle, not a circular photo avatar.
- Deterministic pattern from stable id or label.
- Teal, graphite, slate, and muted neutral palettes only.
- Optional initials in list rows are allowed as text, but no portrait-like iconography.

**Forbidden:** `<img>` profile photos, UI avatar services, realistic silhouettes, human icons, animal icons, plant motifs, mascots.

### ChatShell

**Purpose:** Owns desktop grid and mobile shell collapse.

**Desktop behavior:**

- Renders left rail, center pane, and right rail at `>=1280px`.
- Hides right rail before collapsing the conversation list below `1280px`.
- Preserves overlays and existing modal/drawer behavior.

**Mobile behavior:**

- Shows selected conversation as primary view.
- Shows conversation list only in drawer state.
- Uses a fixed overlay with clear close behavior when drawer is open.

**Test hooks:** `data-testid="chat-shell"`, `data-testid="chat-sidebar"`, `data-testid="conversation-pane"`, `data-testid="chat-context-rail"`.

### ChatSidebar And ChatListItem

**Purpose:** Render conversation discovery and selection while matching the desktop left rail references.

**Required states:**

- Active conversation.
- Unread count.
- Online dot.
- Delivered/read indicators.
- Latest message preview.
- Empty search result.
- Loading skeleton.
- Error/retry surface.

**Interaction:**

- Conversation search keeps existing Phase 05 behavior.
- New chat control keeps existing continuation behavior.
- Row selection keeps selected-chat restoration and URL behavior intact.

### ConversationHeader

**Purpose:** Displays selected conversation identity, status, and compact actions.

**Required desktop actions:**

- Call - presentational unless real behavior exists.
- Video - presentational unless real behavior exists.
- Search - opens existing in-conversation search.
- More - presentational menu or disabled action.

**Required mobile actions:**

- Back - opens conversation drawer.
- Call - presentational unless real behavior exists.
- Search - opens existing in-conversation search.
- More - presentational menu or disabled action.

**Accessibility:**

- Icon controls use native `button`.
- Accessible names: `Open conversations`, `Call`, `Video call`, `Search messages`, `More conversation actions`.
- Presentational/disabled actions use `aria-disabled="true"` and avoid misleading success feedback.

### MessageList

**Purpose:** Renders chronological conversation states with reference spacing.

**Required visual states:**

- Date divider with horizontal rules.
- Incoming bubble.
- Outgoing bubble.
- Read/delivered marks.
- Retrying outgoing state.
- Failed outgoing state with retry action.
- File chip fixture.
- Typing bubble.
- Highlighted search result.
- Empty conversation.
- Loading skeleton.
- Network/error state.

**Behavior preservation:**

- Existing message merge, retry, delete, edit, reaction, highlight, and pagination contracts remain owned by existing hooks/components.
- Message order must not change for styling reasons.
- The newest message must never be obscured by the composer.

### MessageBubble

**Purpose:** Shows individual messages with reference bubble geometry and state metadata.

**Visual rules:**

- Outgoing bubbles use `--chat-own-bubble` and `--chat-own-text`.
- Incoming bubbles use `--chat-received-bubble` and `--chat-received-text`.
- Timestamps sit inside or directly aligned to the bubble like references.
- Read marks appear beside outgoing timestamps.
- Retrying state shows a subtle retry/spinner icon and text only when useful.
- Failed state uses both color and icon/text/action, not color alone.
- Bubble tails are allowed through pseudo-elements if they do not create layout shift.

### MessageComposer

**Purpose:** Keeps text sending functional while matching the reference composer.

**Required controls:**

- Attachment icon button - presentational/disabled in Phase 06.
- Text input with placeholder `Write a private message`.
- Emoji action - existing behavior, visually subordinate.
- Microphone icon button - presentational/disabled in Phase 06.
- Circular teal send button with paper-plane icon - functional text send path.
- Secure-session status line with lock icon.

**States:**

- Empty input.
- Focused input.
- Sending.
- Disabled because no selected chat.
- Disabled because session expired.
- Send error.

**Accessibility:**

- Textbox accessible name: `Write a private message`.
- Send button accessible name: `Send message`.
- Attachment accessible name: `Attach file unavailable in this phase` or equivalent.
- Microphone accessible name: `Voice message unavailable in this phase` or equivalent.

### ChatContextRail

**Purpose:** Provides the desktop right context rail without new backend scope.

**Data sources:**

- Existing selected chat/member data where available.
- Derived local message data where safe.
- Deterministic fixture data for visual smoke.

**Sections:**

- Contact summary.
- Action tiles.
- Pinned messages.
- Shared files.
- Shared media.
- Conversation security.

**Interaction:**

- Search action triggers existing message search.
- Other action tiles are presentational unless behavior already exists.
- Rows may use buttons if interactive, otherwise static rows with clear semantics.

### Phase06VisualFixture

**Purpose:** Provides deterministic UI data for screenshots.

**Fixture content should use coded, non-person identifiers** similar to the references, for example:

- Current account: `AX-7F3C` or `ZX-7A`.
- Selected conversation: `IN-8B21` or `Cipher Node`.
- Conversation list items: `DS-4C9A`, `PR-0E6F`, `PM-3D12`, `QA-77AA`, `CS-5F90`, `OP-1A2B`.

**Required message fixture copy:**

- `The socket reconnect looked clean on my side. Presence updated fast.`
- `Good. Next I'm making delivery, read, and retry states obvious.`
- `Keep it quiet and secure, not noisy.`
- `Exactly. Clear status, fewer distractions, better trust.`
- `Pushing the retry logic update now.`
- `Secure session active`

Desktop may use the longer reference sentence:

- `The socket reconnect looked clean on my side. Presence updated in under a second.`
- `Good. I'm tightening the message states next so delivery, read, and retry are obvious.`
- `Can we keep the UI quiet? I want it to feel secure, not noisy.`

Fixture media must be abstract thumbnails only.

## State Model

| State | Required treatment |
|-------|--------------------|
| Authenticated with selected chat | Full messenger shell, selected conversation visible |
| Authenticated without selected chat | Calm empty center state, no broken right rail |
| Sidebar search active | Filter rows without layout jump |
| Message search active | Existing in-conversation search surface, reference-aligned header/search treatment |
| Online | Green status dot plus text |
| Offline/last seen | Muted status text, no misleading green dot |
| Typing | Typing bubble in message stream |
| Sending | Subtle pending metadata, message remains in place |
| Retrying | Retry icon/text or status inside outgoing bubble |
| Failed send | Visible retry action with danger token and text/icon cue |
| Loading | Skeletons shaped like rows/bubbles, not generic center spinner |
| Empty messages | Quiet empty state in center pane |
| Network error | Inline retry surface, preserve conversation context |
| Session expired | Existing redirect/private-content hiding behavior remains intact |

## Accessibility Contract

- All actionable controls are native buttons or inputs.
- Every icon-only control has an accessible name.
- Keyboard focus order follows visible order: left rail, center header, message list actions, composer, right rail on desktop.
- Focus ring uses `--chat-focus` and is visible in both themes.
- Normal text contrast target: WCAG AA 4.5:1.
- Large text and UI component contrast target: at least 3:1.
- Do not rely on color alone for online, read, retry, failed, verified, or secure states.
- Use `aria-live="polite"` for connection, retry, send failure, and search result count updates where existing behavior already announces changes or can be added without noise.
- The mobile drawer must not trap keyboard focus when closed. When open, Escape closes it and focus returns to the trigger.
- Respect browser zoom to 200 percent without horizontal overflow.

## Iconography

Use `lucide-react` for new controls because it is already installed and matches existing project/developer constraints.

Required icon meanings:

- Back arrow.
- Panel/sidebar toggle.
- Search.
- Phone.
- Video.
- More vertical.
- Paper plane/send.
- Paperclip.
- Microphone.
- Lock.
- Star/favorite if shown.
- Pin.
- Download or file action if shown.
- Check/check-check for delivery/read.
- Refresh/retry.

Icons should use a consistent stroke width and size per control group. Do not manually draw SVG icons when a matching lucide icon exists.

## Content And Copy

Visible copy should be specific and quiet:

- `Write a private message`
- `Secure session active`
- `End-to-end encrypted` may appear only as existing/marketing copy, not as a new technical claim beyond current product scope.
- `Authenticated session`
- `Member-only room`
- `Socket connected`
- `Verified`
- `Active`
- `Secure` or `Stable`

Avoid loud or promotional text. Do not add visible instructional text explaining the redesign, the reference images, keyboard shortcuts, or how to use basic controls.

## Implementation Boundaries

Recommended file areas:

- `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatListItem.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageList.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx`
- `Frontend/Chatify/src/pages/chat/components/AbstractIdentityTile.tsx`
- `Frontend/Chatify/src/pages/chat/hooks/useChatTheme.ts`
- `Frontend/Chatify/src/pages/chat/chat.css`
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` or a focused Phase 06 Playwright spec

Keep `Frontend/Chatify/src/pages/chat/chat.tsx` as the state orchestration layer. Add focused components and hooks instead of moving socket/query behavior into presentational components.

## Visual Verification Contract

Phase 06 completion requires repeatable visual evidence for all four variants.

### Required Screenshot Artifacts

Write screenshots under `.planning/phases/06-messenger-visual-parity/`:

- `06-ui-desktop-light.png`
- `06-ui-desktop-dark.png`
- `06-ui-mobile-light.png`
- `06-ui-mobile-dark.png`

### Required Viewports

- Desktop: `1440x900` or wider.
- Mobile: `390x844`.
- Optional mobile confirmation: `430x932`.

### Required Playwright Assertions

The visual smoke must assert:

- `data-testid="chat-root"` exposes the forced light/dark theme.
- Desktop shows visible left rail, center pane, and right rail at `1440x900`.
- Desktop has no horizontal overflow.
- Mobile primary view hides sidebar and right rail until the drawer is opened.
- Mobile composer does not overlap the newest visible message.
- Search messages can be opened from the header.
- Right rail Search triggers the same search mode on desktop.
- No chat identity surface renders profile photos or other `<img>` avatars.
- Fixture state includes incoming, outgoing, read, retry/failed, typing, date divider, file chip, and secure-session status.

### Required Commands Before Completion

From `Frontend/Chatify`:

```powershell
npm test
npm run test:ui
npm run lint
npm run build
```

Completion is blocked until these pass and the four screenshots exist.

## Acceptance Checklist

- [ ] Desktop light matches the reference three-column information architecture, spacing, hierarchy, and state surfaces.
- [ ] Desktop dark matches the same structure with dark tokens and no pure-black/neon treatment.
- [ ] Mobile light matches the reference single-conversation header, message stream, typing state, composer, and secure-session footer.
- [ ] Mobile dark matches the mobile light structure with dark tokens and no layout drift.
- [ ] Theme switching changes tokens only and preserves selected chat, search state, composer text, messages, presence, and session behavior.
- [ ] Every chat identity, avatar, profile, media, and placeholder surface is abstract and non-living.
- [ ] The right rail is presentational and adds no backend API scope.
- [ ] Existing Phase 03 and Phase 05 behavior remains covered.
- [ ] Four Phase 06 screenshot artifacts are generated.
- [ ] `npm test`, `npm run test:ui`, `npm run lint`, and `npm run build` pass from `Frontend/Chatify`.

## Handoff Target

This UI contract is intended for a React/Vite/Tailwind implementation pass. The next planning step should break the work into the existing three Phase 06 roadmap waves:

1. Lock shared messenger theme tokens and desktop three-column shell.
2. Rebuild mobile single-column conversation, composer, and status surfaces.
3. Add light/dark desktop/mobile screenshot checks and close visual drift.

No additional user design decisions are needed before `$gsd-plan-phase 6` unless the implementation pass discovers a hard technical conflict with the existing chat architecture.
