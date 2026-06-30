---
phase: 42
slug: contact-requests-and-trusted-conversation-onboarding
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-30
---

# Phase 42 - UI Design Contract

> Visual and interaction contract for contact request onboarding. Generated inline because this thread forbids subagents.

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
| xs | 4px | Icon gaps, status dots |
| sm | 8px | Button/content gaps |
| md | 16px | Dialog sections, request rows |
| lg | 24px | Panel padding |

Exceptions: existing chat CSS variables may map these values to local radius/spacing tokens.

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 12px | 600 | 1.4 |
| Heading | 16px | 700 | 1.35 |
| Status copy | 12px | 500 | 1.4 |

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | Existing `--chat-bg` / `#101113` | Messenger backdrop |
| Secondary (30%) | Existing `--chat-panel` / `#20262B` | Dialog and request rows |
| Accent (10%) | Existing `--chat-accent` / `#14B8A6` | Send request and accept actions only |
| Warning | Existing amber or `#F59E0B` | Pending request status |
| Destructive | Existing danger or `#EF4444` | Decline/cancel request only |

Accent reserved for: send request, accept request, focus rings, and selected request state. Do not recolor every icon.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Direct dialog heading | New chat |
| Direct dialog helper | Send a request before a new private chat opens. |
| Primary CTA | Send request |
| Pending sent | Request sent. You can chat after they accept. |
| Incoming heading | Contact requests |
| Empty incoming | No pending requests |
| Accept CTA | Accept |
| Decline CTA | Decline |
| Cancel CTA | Cancel request |
| Generic error | We could not update that request. Try again. |

## Interaction Contract

- The direct username field stays in `NewChatDialog`; submitting a new username sends a request unless an existing chat is returned.
- Pending outgoing state must not close the dialog as if a chat opened.
- Incoming request rows show public identity, username, and accept/decline buttons.
- Outgoing request rows show public identity, username, pending state, and cancel button.
- Accepting a request selects or opens the returned chat when the backend returns one.
- All request controls are disabled while their mutation is pending and expose visible loading text.
- Escape, focus trap, and opener focus restoration continue to work in dialogs.

## Responsive Requirements

- Request rows fit in the existing sidebar/start-conversation dialog at mobile width without clipped usernames.
- Buttons wrap to a second line if needed rather than overlapping identity text.
- Empty/loading/error request states must remain readable in desktop and mobile layouts.

## Accessibility

- Each request action has an accessible label that includes the target username or display name.
- Status messages use `role="status"` or `role="alert"` where appropriate.
- Keyboard users can tab through request actions in a predictable order.
- Color is not the only indicator of pending/accepted/error state.

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
