# Phase 06 - UI Design Contract

> Visual and interaction contract for the Phase 06 Chatify messenger parity pass.

## Product Direction

Chatify should feel like a secure, professional private messenger. The goal of this phase is exact visual parity with the supplied desktop and mobile light/dark references, not a new art direction. The interface must stay calm, dense enough for repeat use, and clearly stateful.

The UI must preserve the Phase 3 message contract and the Phase 5 search/presence/session contract. This phase only reworks presentation and theme plumbing.

## Reference Images

- Desktop light reference: supplied image #1
- Desktop dark reference: supplied image #2
- Mobile light reference: supplied image #3
- Mobile dark reference: supplied image #4

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | existing app icon set or lucide-react for new controls |
| Font | system sans stack or the current app sans stack; match the reference metrics and weights |
| CSS strategy | Tailwind for layout/state styling; local CSS only for scrollbars and very small motion helpers |
| Theme | light and dark token variants with the same layout and interaction structure |

## Palette

### Light

- Background: warm off-white
- Panel surfaces: white or near-white
- Borders: very light zinc/gray
- Primary text: near-black charcoal
- Secondary text: muted graphite
- Accent: muted teal/jade

### Dark

- Background: deep graphite, not pure black
- Panel surfaces: slightly lighter graphite
- Borders: low-contrast zinc
- Primary text: soft white
- Secondary text: muted gray-green
- Accent: muted teal/jade

Avoid purple neon, electric glow, and one-note palettes in both themes.

## Layout Contract

### Desktop

- The shell fills the viewport.
- Left rail: fixed-width conversation rail with logo, current account chip, search, new chat control, and conversation list.
- Center rail: selected conversation with header, message stream, typing indicator, composer, and state surfaces.
- Right rail: contact/context panel with profile tile, action strip, pinned messages, shared files, shared media, and conversation security.
- The layout should read like the supplied references, not like a dashboard or a marketing page.

### Mobile

- The shell collapses to a single-column conversation view.
- Safe-area header at the top with back, identity tile, name, status, and compact action icons.
- Message stream occupies the main body with date chip, bubbles, typing row, and retry/pending surfaces.
- Composer remains fixed to the bottom above the safe area and keeps the secure-session footer visible.

## Stable Dimensions

- Icon buttons: 40px square on desktop, compact but still thumb-friendly on mobile.
- Conversation rows: consistent height with fixed icon/avatar tile, title, preview, timestamp, and status indicators.
- Message bubbles: comfortable radius, narrow enough to read like chat, wide enough to avoid excessive line breaks.
- Right rail sections: separated by simple dividers and consistent vertical rhythm.

## State Surfaces

The reference images show the following surfaces and they should remain visible and stable:

- Online dot and last-seen text in the header.
- Message timestamps under or inside bubbles.
- Sent checkmarks and retry icon treatment.
- Typing indicator bubble with three dots.
- Secure-session footer text and lock icon.
- Pinned messages section.
- Shared files section with file-type badges.
- Shared media strip with abstract thumbnails.
- Conversation security section with status rows.

## Identity And Content

All avatars, thumbnails, and placeholders must stay abstract:

- Geometric monograms.
- Patterned square tiles.
- File or document icons.
- Neutral material or interface previews.

Do not use humans, faces, hands, animals, plants, pets, or mascot art in any variant.

The visible chat content in the reference screenshots may be used as fixture copy for parity checks, including:

- "The socket reconnect looked clean on my side. Presence updated in under a second."
- "Good. I'm tightening the message states next so delivery, read, and retry are obvious."
- "Can we keep the UI quiet? I want it to feel secure, not noisy."
- "Exactly. Clear status, fewer distractions, better trust."
- "Pushing the retry logic update now."
- "Secure session active"

## Motion Contract

- Motion should be subtle and functional only.
- Keep transitions short and avoid broad layout animation.
- Do not use decorative blobs, orbs, bokeh, or other atmospheric filler.
- Respect reduced-motion settings by disabling non-essential motion.

## Negative Constraints

- No landing page.
- No social feed patterns.
- No photo avatars or living imagery.
- No pure black in dark mode.
- No purple gradients or neon glows.
- No overlapping controls or clipped text.
- No one-note card stack composition when the reference uses rails and sections.

## Verification Target

The final output should look like a production messenger screenshot at desktop and mobile sizes, in both themes, with the same visual rhythm as the supplied references.
