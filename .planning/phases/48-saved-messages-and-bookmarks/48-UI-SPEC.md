---
phase: 48
slug: saved-messages-and-bookmarks
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-30
---

# Phase 48 - UI Design Contract

> Visual and interaction contract for the saved messages and bookmarks workflow.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | lucide-react |
| Font | Existing app font stack |

Use the existing Chatify messenger design language: dark functional surfaces, `--chat-*` CSS variables, tight density, 8px-or-less control radii where the local system already uses `--chat-radius-md`, and no decorative backgrounds.

---

## Spacing Scale

Declared values must remain multiples of 4:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, timestamp/icon gaps |
| sm | 8px | Saved item internal gaps, compact button gaps |
| md | 16px | Dialog section padding and list item padding |
| lg | 24px | Dialog header/body separation |
| xl | 32px | Large modal edge spacing on desktop |

Exceptions: Existing one-off values in reused chat components may remain if unchanged. New saved-message UI should not introduce arbitrary spacing outside this scale.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.45 |
| Label | 12px | 600 | 1.35 |
| Heading | 16px | 700 | 1.35 |
| Metadata | 12px | 500 | 1.35 |

No hero-scale type. Saved-message copy must fit dense chat surfaces and support long usernames, group names, filenames, and generated fallback text without overlap.

---

## Color

Use existing CSS variables rather than a new palette.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--chat-bg)` | Page backdrop behind modal |
| Secondary (30%) | `var(--chat-panel)`, `var(--chat-panel-elevated)` | Dialog shell, saved item rows |
| Accent (10%) | `var(--chat-accent)` | Focus rings, selected/active saved state, primary action emphasis |
| Muted text | `var(--chat-text-muted)`, `var(--chat-text-soft)` | Metadata, helper copy |
| Destructive | `var(--chat-danger)` | Unsave/delete-style action only |

Accent reserved for: active bookmark indicator, primary jump action, focus state, and sidebar saved entry hover/active state.

---

## Layout Contract

### Entry Point

- Add a sidebar footer button with a `Bookmark` or `BookmarkCheck` icon and accessible label `Open saved messages`.
- Keep the footer compact. Do not add a large text row that reduces conversation list space.
- Admin moderation and settings controls must remain visible and usable.

### Saved Messages Dialog

- Dialog is centered on desktop and uses nearly full width on mobile, following the existing overlay style from invite links and settings surfaces.
- Header: title `Saved messages`, count when loaded, close icon button.
- Body: vertical list of saved rows. Rows are not nested cards inside another card; they are list items on the dialog surface.
- Row hierarchy:
  1. Safe preview text or fallback (`Encrypted message`, `Attachment`, `Voice message`, etc.).
  2. Conversation title and sender display name as metadata.
  3. Saved timestamp and action buttons.
- Actions per row:
  - Jump: icon/text button, primary but compact.
  - Unsave: icon button with tooltip/title, destructive color only on hover/focus or explicit danger state.

### Message Bubble Indicator

- Saved state appears as a small bookmark icon in the metadata row.
- The icon must not displace delivery/read status or wrap timestamp controls on narrow bubbles.
- Do not add a large badge, ribbon, or extra row.

---

## Interaction Contract

| Interaction | Required behavior |
|-------------|-------------------|
| Open saved messages | Sidebar button opens dialog, focuses close button or dialog heading, and triggers saved-list query. |
| Close dialog | Escape, close button, or backdrop click closes the dialog and restores normal chat interaction. |
| Save from message actions | Eligible message action toggles to saved state and shows success/failure toast. |
| Unsave from message actions | Saved message action toggles to unsaved state and updates visible bubble/list state. |
| Unsave from list | Row remains stable while pending; on success it disappears from the list or changes to removed state without layout jump outside the list. |
| Jump to message | Dialog closes, target conversation/channel is selected, context loads if needed, message scrolls into view, and existing highlight behavior is used. |
| Error recovery | Query/mutation errors show concise copy and a retry path without trapping focus. |

---

## State Contract

| State | UI requirement |
|-------|----------------|
| Loading | Skeleton/list placeholder inside dialog body; no spinner-only blank surface. |
| Empty | Heading `No saved messages`; body `Save a message from its actions when you want to find it later.` |
| Error | Copy `Saved messages unavailable`; retry button `Try again`. |
| Populated | Rows render safe previews, conversation context, sender context, saved timestamp, jump, and unsave controls. |
| Pending save/unsave | Disable only the affected active control and preserve passive controls where safe. |
| Encrypted saved entry | Preview text is `Encrypted message`; no decrypted plaintext appears in the saved list. |
| Deleted/hidden entry | Backend should omit unavailable entries; UI handles an empty result after removal. |
| Mobile | Dialog width is constrained to viewport, row actions wrap below metadata if needed, and all touch targets are at least 36px high. |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Sidebar label | Saved messages |
| Dialog title | Saved messages |
| Message action save | Save message |
| Message action unsave | Unsave message |
| Bubble indicator title | Saved |
| Primary row action | Jump |
| Empty state heading | No saved messages |
| Empty state body | Save a message from its actions when you want to find it later. |
| Error state | Saved messages unavailable. |
| Retry action | Try again |
| Unsave failure | Could not unsave that message. |
| Save failure | Could not update saved message. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party registry | none | not allowed for this phase |

No new UI package or registry component is approved for Phase48.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS - labels are concise, operational, and avoid explanatory in-app instructions outside empty/error states.
- [x] Dimension 2 Visuals: PASS - dialog and controls follow existing messenger surfaces, no marketing/hero/card-heavy treatment.
- [x] Dimension 3 Color: PASS - uses existing CSS variables and restrained accent use only.
- [x] Dimension 4 Typography: PASS - compact sizes match tool surfaces and avoid viewport-scaled type.
- [x] Dimension 5 Spacing: PASS - new spacing uses 4px multiples and stable list/control sizing.
- [x] Dimension 6 Registry Safety: PASS - no registry or component-library addition.

**Approval:** approved 2026-06-30
