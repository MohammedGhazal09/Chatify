---
phase: 43
slug: reply-to-message-with-quoted-context
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-30
ui_skills: pbakaus/harden
---

# Phase 43 - UI Design Contract

> Visual and interaction contract for durable quoted replies. Generated inline because this thread forbids subagents.

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | lucide-react |
| Font | existing app font stack |

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Quote accent/icon gaps |
| sm | 8px | Quote text gaps, action icon padding |
| md | 16px | Composer preview padding, bubble internal spacing |
| lg | 24px | Message list spacing remains unchanged |

Use existing chat radius and color variables. Quote blocks must not resize message rows unexpectedly during hover/action state.

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Quote label | 12px | 700 | 1.3 |
| Quote preview | 13px | 500 | 1.4 |
| Composer preview label | 12px | 700 | 1.3 |
| Composer preview text | 14px | 400 | 1.45 |
| Fallback status | 12px | 500 | 1.4 |

Quoted preview text may use `line-clamp-2` or equivalent wrapping. Do not use viewport-width font sizing.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant | Existing `--chat-bg` | Message list backdrop |
| Secondary | Existing `--chat-panel-subtle` | Composer quote preview |
| Own quote surface | White/teal mixed with existing own bubble | Own message quote block |
| Received quote surface | Existing `--chat-panel-elevated` | Received message quote block |
| Accent | Existing `--chat-accent` | Quote left rule, focus, source jump affordance |
| Warning | Existing warning token | Encrypted/unavailable limitation copy |

Do not introduce a new palette. Quote blocks should read as metadata inside a message, not as a separate card.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Action menu item | Reply |
| Composer label | Replying to {name} |
| Composer cancel label | Cancel reply |
| Bubble quote fallback deleted | Original message unavailable |
| Bubble quote fallback encrypted | Encrypted message |
| Bubble quote attachment fallback | Attachment |
| Encrypted limitation toast/status | Replies are unavailable in encrypted conversations in this release. |
| Quote jump failure | Original message is not available. |

Names use existing member display logic. Unknown sender fallback is `Unknown member`.

## Interaction Contract

- Selecting Reply sets composer quote preview and focuses the composer.
- Pressing Escape cancels reply before closing search or other lower-priority state, preserving existing Escape order where possible.
- Sending a successful standard reply clears the reply preview.
- Failed sends keep the quote on the failed optimistic message so retry semantics remain clear.
- The bubble quote block is clickable only when it has a source message id and the source is not marked deleted/unavailable.
- Clicking a quote first attempts local scroll/highlight. If absent, it loads context via the existing message context API and then highlights.
- If quote source loading fails, show a toast and keep the current scroll position.
- Encrypted conversations disable durable reply sending with clear copy; users should not think the action silently worked.

## Responsive Requirements

- Composer quote preview fits at 320px width with cancel icon still reachable.
- Long CJK/Arabic/German/emoji quote text wraps or clamps without horizontal overflow.
- Message bubbles keep existing max widths; quote block never exceeds the bubble width.
- Quote action/click target is at least 40px high on touch devices when clickable.
- Group sender labels and quote sender labels must not overlap.

## Accessibility

- Quote blocks use a button only when they perform a jump; otherwise render as non-interactive metadata.
- Interactive quote labels include source sender and preview in the accessible name.
- Cancel reply has `aria-label="Cancel reply"`.
- Dynamic encrypted/unavailable limitation copy uses `role="status"` or toast equivalent.
- Keyboard tab order remains: message actions, quote jump if present, composer, cancel reply, send.
- Color is not the only signal for quoted/deleted/encrypted states.

## Hardening Checklist

- [x] Long text: clamp/wrap quote preview and preserve bubble width.
- [x] Empty source: show fallback copy for attachment-only or deleted sources.
- [x] RTL/CJK/emoji: use `dir="auto"` and wrapping rules.
- [x] Error state: failed source jump has toast fallback.
- [x] Concurrent action: send mutation carries quote metadata with the optimistic message.
- [x] Permission state: unavailable source does not expose hidden text.
- [x] Encrypted state: no decrypted quote text leaves the device.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | no external registry code |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-06-30
