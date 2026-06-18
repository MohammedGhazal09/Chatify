---
phase: 24
slug: group-message-sender-names-and-group-voice-video-calls
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-18
---

# Phase 24 - UI Design Contract

> Visual and interaction contract for group sender labels and group-originated voice/video call controls.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | lucide-react |
| Font | Existing app font stack through Tailwind/global chat styles |

---

## Affected Surfaces

| Surface | UI Contract |
|---------|-------------|
| Group message bubbles | Show the sender display name above each normal group message bubble. |
| Conversation header | Keep the existing phone/video icon buttons and make them group-aware through call availability state. |
| Conversation detail content | Keep existing call/video actions aligned with the same availability state as the header. |
| Call overlay | Reuse existing incoming/outgoing/connected states; copy must not imply a full conference room in this phase. |

---

## Spacing Scale

Declared values remain the existing Tailwind/app scale.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap between sender label and bubble, icon gaps |
| sm | 8px | Compact button and label padding |
| md | 16px | Bubble horizontal padding and header action spacing |
| lg | 24px | Panel and overlay spacing |

Exceptions: none.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Sender label | 12px | 600 | Tailwind `text-xs` default |
| Bubble body | Existing bubble text size | Existing weight | Existing bubble line height |
| Disabled reason tooltip/title | Existing button/title pattern | Existing weight | Existing line height |
| Call overlay title/body | Existing `CallOverlay` typography | Existing weight | Existing line height |

Sender label constraints:
- Truncate within the message column using `max-w-full truncate`.
- Preserve right alignment for current-user bubbles and left alignment for received bubbles.
- Use `var(--chat-text-muted)` so attribution reads as metadata, not message content.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant | Existing `--chat-bg` / panel variables | Chat shell and conversation surface |
| Secondary | Existing bubble variables | Message bubbles and subtle panels |
| Accent | Existing `--chat-accent` | Existing phone/video icons and call activity icons |
| Muted text | Existing `--chat-text-muted` | Sender labels and disabled reasons |
| Destructive | Existing `--chat-danger` | Failed call/message states only |

Accent reserved for existing call/message status accents. Sender labels must not use the accent color.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Sender fallback | `Unknown member` |
| Group call unavailable, no reachable member | `No group members are available for a call right now.` |
| Group call unavailable, socket disconnected | Existing realtime-not-ready copy |
| Group call unavailable, unsupported browser | `Calls require a supported secure browser.` |
| Group call model | Copy may say group call/incoming call, but must not say "conference", "room", or "everyone connected" unless multi-peer support exists. |

---

## Interaction Contract

- The header and detail call buttons must share the same `callAvailability` result.
- Enabled group audio/video buttons must invoke the same `startCall(mode)` path as direct calls.
- Disabled group call buttons must expose a concrete `title`/accessible reason through existing button props.
- Sender labels are static text and must not introduce hover menus, avatars, or click targets in this phase.
- Existing message actions, retry/dismiss controls, reactions, attachments, and read receipt layout must not shift unexpectedly when labels are present.

---

## Responsive Contract

- Sender labels must fit within the same responsive message column as the bubble.
- The label must truncate instead of widening the message list on narrow mobile widths.
- Call controls must remain icon buttons; no new text-button group should be added to compact headers.
- Call overlay behavior remains inherited from existing direct-call overlay responsive rules.

---

## Accessibility Contract

- Sender label text must be visible text, not only a `title` attribute.
- Call buttons must keep meaningful `aria-label` values for audio and video call actions.
- Disabled/unavailable call controls must expose the concrete reason through the existing accessible button state.
- Incoming group-originated call overlays must preserve keyboard-accessible accept/reject controls.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party | none | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-06-18
