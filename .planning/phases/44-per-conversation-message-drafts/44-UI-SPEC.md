---
phase: 44
slug: per-conversation-message-drafts
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-30
ui_skills: pbakaus/harden
---

# Phase 44 - UI Design Contract

> Visual and interaction contract for per-conversation message drafts. Generated inline because this thread forbids subagents.

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | lucide-react only if a new icon is needed |
| Font | existing app font stack |

Use existing chat theme CSS variables, radii, spacing, and sidebar row composition. Do not introduce a separate card or floating draft panel.

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Gap between `Draft:` label and preview text |
| sm | 8px | Existing sidebar row text spacing |
| md | 16px | No new page spacing; preserve current row padding |
| lg | 24px | No new phase-specific usage |

Draft indicators must fit inside the existing latest-message line and must not increase sidebar row height.

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Draft label | 12px | 700 | existing row snippet line-height |
| Draft preview | 12px | 500 | existing row snippet line-height |
| Generic encrypted draft copy | 12px | 500 | existing row snippet line-height |

Do not use viewport-based font sizing. The row remains single-line truncated.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant | Existing `--chat-panel` | Sidebar background |
| Secondary | Existing `--chat-text-muted` | Draft preview text |
| Accent | Existing `--chat-accent` | `Draft:` label only |
| Warning | none | Drafts are normal state, not a warning |

The draft label should stand out enough to scan, but it must not compete with unread badges.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Standard row prefix | Draft: |
| Empty latest fallback when no draft | No messages yet |
| Encrypted row copy | Draft saved on this device |
| Composer placeholder | Preserve existing `Message` / `Encrypted message` |

No visible instructional copy should be added. The feature should feel automatic.

## Interaction Contract

- Typing text in a selected conversation saves that conversation's local draft.
- Selecting another conversation restores that conversation's draft or clears the composer when none exists.
- Browser reload restores the draft for the selected accessible conversation after auth/chat restoration.
- Successful send clears the active conversation draft.
- Disabled, offline, blocked, too-long, and failed sends do not clear draft text.
- Logout or session-expiry cleanup removes all drafts for that user and clears the composer.
- Standard sidebar search includes standard draft preview text.
- Encrypted sidebar rows show a generic draft row and do not reveal encrypted draft plaintext in row text or search matching.

## Responsive Requirements

- Draft row text must stay within the existing sidebar row at 320px mobile width.
- Long German/CJK/Arabic/emoji drafts must truncate without horizontal overflow.
- Draft indicators must not overlap mute, pin, favorite, archive, unread, or timestamp indicators.
- Row height must remain stable before and after a draft appears.

## Accessibility

- Draft indicators are text inside the existing conversation button; no new tab stop is added.
- `Draft:` should remain visible text, not color-only state.
- Conversation rows keep their existing button accessible names.
- No animation is required; reduced-motion behavior remains unchanged.

## Hardening Checklist

- [ ] Long text: normalize whitespace and truncate in the row.
- [ ] Empty text: whitespace-only values remove the draft.
- [ ] RTL/CJK/emoji: row uses existing truncation and composer uses controlled text value.
- [ ] Storage failure: typing remains usable when localStorage throws.
- [ ] Account isolation: user id is part of the storage key.
- [ ] Encrypted state: sidebar does not expose encrypted draft plaintext.

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
