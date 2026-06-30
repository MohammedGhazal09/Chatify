---
phase: 46
slug: group-and-space-mentions
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-30
---

# Phase 46 - UI Design Contract

> Visual and interaction contract for group and space mention workflows.

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | existing React/Tailwind components |
| Icon library | lucide-react only where needed |
| Font | existing app font stack |

## Spacing Scale

Declared values:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Token gaps and metadata gap |
| sm | 8px | Suggestion row inner spacing |
| md | 16px | Suggestion panel padding |
| lg | 24px | Composer surrounding rhythm |

Exceptions: existing CSS variable radii and composer dimensions stay unchanged.

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | existing message body | regular | existing bubble line height |
| Label | 12px | 600 | 1.35 |
| Suggestion name | 14px | 700 | 1.35 |
| Suggestion username | 12px | 500 | 1.35 |

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant | existing `--chat-panel` / `--chat-bg` | Composer and message surfaces |
| Secondary | existing `--chat-panel-elevated` | Suggestion popover |
| Accent | existing `--chat-accent` and `--chat-accent-soft` | Mention chips and active suggestion emphasis |
| Destructive | existing `--chat-danger` | Not used by mention UI |

Accent reserved for: mention token background/border, suggestion hover/focus, current-user mention emphasis.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Suggestion region label | Mention members |
| Empty suggestions | No matching members |
| Candidate role label | Group member / Space member |
| Composer security footer | Existing "Authenticated private session" copy remains |
| Encrypted unavailable behavior | No mention suggestions in encrypted conversations |

## Interaction Model

- Typing `@` or `@prefix` opens a small suggestion panel above the composer input for group/space conversations.
- Clicking a suggestion inserts `@username ` at the caret and returns focus to the textarea.
- Pressing Enter while suggestions are open inserts the first suggestion instead of sending.
- Pressing Escape closes suggestions without changing text.
- Suggestion rows are buttons with stable names for keyboard and screen reader users.
- Mention chips inside messages remain inline and never create separate stacked UI.

## Layout Contract

- Suggestion panel is anchored inside the composer dock and constrained to the composer max width.
- Panel height is capped so long groups do not overlap the message list or send controls.
- Mobile uses the same panel but full available composer width.
- Mention tokens use inline spans that wrap naturally with text.

## State Coverage

- Default: no panel until an active mention token is detected.
- Query with matches: show up to five members.
- Query with no matches: show one non-interactive row with "No matching members".
- Disabled: no panel for direct chats, encrypted chats, blocked conversations, or missing members.
- Sending/failed: optimistic mention chips render from the optimistic message.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party | none | not required |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-06-30
