---
phase: 08
slug: media-files-and-conversation-detail-implementation
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-12
---

# Phase 08 UI Spec: Media Files And Conversation Detail Implementation

## Objective

Implement the media, files, pinned messages, and conversation-detail surfaces as real messenger UI connected to backend data. The result must preserve the Phase 06 visual language and the Phase 07 functional honesty rule: nothing may look enabled, populated, verified, secure, or downloadable unless that behavior exists and is backed by current conversation state.

This UI spec covers desktop and mobile, light and dark themes. It is intentionally implementation-facing: it defines concrete surfaces, states, copy, responsive behavior, and verification requirements for Phase 08 plans.

## Product Context

Chatify is a private real-time messenger. The current messenger shell already has a left conversation list, central conversation pane, message composer, desktop right rail, mobile conversation view, search, presence, and send/retry behavior. Phase 08 adds real attachment sending and conversation detail data. The UI must feel like a functional app, not a static reference screenshot.

Primary user goals:

- Send one or more supported files with a text message or as an attachment-only message.
- Understand upload validation, progress, failure, retry, and reload limits.
- View image/media attachments inline inside messages.
- View non-image files as clear, safe file cards with filename, type, size, and action buttons.
- Preview or download attachments only through protected backend routes.
- Inspect shared media, shared files, pinned messages, and factual conversation security/detail rows.
- Use the same workflows on desktop and mobile in both light and dark themes.

## Required Design System

### Framework And Libraries

- Component framework: existing React and Tailwind implementation.
- Component library: none; continue using local Chatify components.
- Icon library: use `lucide-react` icons already used in the chat UI when an icon exists.
- Animation: restrained CSS transitions only. Do not add large motion systems.
- Images and media: render only user-uploaded attachments from protected application routes. Use abstract, non-living placeholders only for empty/error states.

### Spacing

Use 4px-based spacing only:

- `4px`: icon/text gaps, tight status dots.
- `8px`: compact controls, file card inner gaps, bubble internal gaps.
- `12px`: chip spacing, mobile drawer section gaps when needed.
- `16px`: default component padding, composer tray padding, rail row padding.
- `24px`: section spacing and desktop rail block separation.
- `32px`: major vertical gaps in empty states.

Allowed exceptions:

- Safe area inset values: `env(safe-area-inset-*)`.
- Existing one-pixel borders and divider lines.
- Existing measured message tail or shadow values where already used by the chat UI.

### Typography

- Body text: existing chat body scale, 14px to 16px depending on viewport.
- Message text: preserve current bubble rhythm; attachments must not force hero-scale text.
- Metadata: 12px to 13px, medium or regular weight, muted color.
- Section labels: 13px to 14px, semibold, no oversized panel headings.
- File names: one or two lines maximum, ellipsized safely with full filename available in `title` or accessible label.
- Do not scale font size with viewport width.
- Letter spacing stays `0`.

### Color And Theme

Use the existing Chatify theme variables/classes and keep parity across light and dark themes.

- Primary accent: current teal/green Chatify accent, used only for send, selected/active states, focus rings, verified factual state, upload progress, and protected access indicators.
- Surface colors: existing page, panel, input, bubble, hover, and border tokens.
- Danger: existing red/danger token for blocked file validation, upload failure, and destructive unpin/delete confirmations.
- Warning: existing amber/yellow token for retryable upload or preview unavailable states.
- Success: existing green/teal token only for factual success states.
- Dark theme must not become a black-only interface; retain layered surfaces, borders, and readable contrast.
- Light theme must not become pure white blocks without depth; retain subtle borders and shadows already used in the chat UI.

## Non-Living Visual Constraint

No UI state, placeholder, thumbnail, background, empty illustration, avatar, icon, fixture, or generated/media asset introduced in this phase may depict humans, faces, body parts, animals, insects, fantasy creatures, plants as living subjects, or any living being.

Allowed visuals:

- Abstract geometry.
- Document/file glyphs.
- Lock, shield, link, image, paperclip, download, pin, search, alert, retry, and loading icons.
- User-uploaded attachments that are rendered from actual protected conversation data. Test fixtures for images must use abstract/non-living generated image data.

## Layout Requirements

### Desktop

The desktop chat page keeps the three-column Phase 06/07 composition:

- Left sidebar: conversation list and search remain unchanged except for latest-message attachment summaries.
- Center conversation: message stream, date separators, attachment bubbles, typing indicator, secure session footer, and composer.
- Right rail: server-backed profile summary, actions, pinned messages, shared files, shared media, and factual security rows.

Desktop detail surfaces must fit within the existing right rail. Do not open floating cards inside cards. Use full rail sections with dividers and compact rows.

### Mobile

The mobile chat page keeps a single conversation-first screen:

- Header with back, avatar/abstract icon, conversation title, presence, call/search/more actions according to supported state.
- Message stream with attachments rendered inline.
- Bottom composer with attachment tray and safe-area padding.
- The More action opens a full-height or near-full-height conversation detail drawer/sheet, not a tiny popover.

Mobile drawer contents:

- Conversation identity summary.
- Pinned messages.
- Shared files.
- Shared media.
- Factual security rows.
- Clear close control and accessible focus handling.

The drawer must be scrollable independently without shifting the conversation beneath it.

## Surface Contracts

### Composer Attachment Tray

The paperclip action becomes a real file selection control.

Requirements:

- Use a hidden native file input triggered by the paperclip button.
- Accept up to the backend-supported file count, recommended default: 5 files.
- Show selected files in an inline tray above or within the composer area.
- Each selected file chip/card shows:
  - file type icon or image thumbnail for supported images,
  - sanitized display filename,
  - size,
  - validation status,
  - remove button.
- Composer send is enabled when either trimmed text is present or at least one valid file is selected.
- Invalid files do not silently disappear. Show an inline error and allow removal.
- While uploading, show progress/loading state and prevent duplicate sends for the same pending payload.
- If upload fails before persistence, keep the failed optimistic message visible with retry when File objects are still available.
- After reload, failed attachment-only retries must explain that files need to be reattached because browser `File` objects are not durable.

### Message Bubbles With Attachments

Attachment rendering belongs inside message bubbles and must work for own and peer messages.

Image/media attachments:

- Render as protected preview images only after backend authorization.
- Use stable aspect ratios to avoid layout jumps.
- Use a skeleton or neutral placeholder while loading.
- Use an error state when preview fails.
- Never stretch or crop in a way that hides the attachment meaning.
- Opening preview can use a modal/lightbox only if it is accessible and backed by protected route URLs.

File attachments:

- Render as compact file cards with icon, filename, type, size, and download/open action.
- File card actions must use protected backend routes.
- Download action must be disabled or show an explicit unavailable state if the attachment is deleted, unauthorized, or not fully uploaded.
- Long filenames must wrap or ellipsize without overflowing the bubble.

Message metadata:

- Time, delivery/read status, failed/retry state, and retry icon must remain visible and not overlap attachments.
- Attachment-only messages still show timestamp and delivery/read status.

### Shared Files

The right rail and mobile drawer shared files section must be backed by `GET /api/message/:chatId/shared-assets?kind=file`.

Rows include:

- file type icon,
- sanitized filename,
- file type and size,
- sent date or relative date,
- download/open action,
- loading/empty/error states.

Empty state copy:

- "No shared files"

Do not render static file names, fake PDFs, fake XLSX files, or placeholder downloadable rows.

### Shared Media

The right rail and mobile drawer shared media section must be backed by `GET /api/message/:chatId/shared-assets?kind=media`.

Tiles include:

- protected thumbnail/preview,
- non-living abstract placeholder while loading,
- error state if preview is unavailable,
- keyboard-accessible open action.

Empty state copy:

- "No shared media"

Do not use decorative stock imagery, human/animal imagery, or static demo grids.

### Pinned Messages

Pinned messages are real message state, not latest-message reuse.

Rows include:

- pin icon,
- message text snippet or attachment summary,
- pinned/sent date,
- jump-to-message action,
- unpin action when allowed.

Empty state copy:

- "No pinned messages"

Pin/unpin actions must be reflected in desktop rail, mobile drawer, and conversation stream state through API responses and realtime events.

### Conversation Security Rows

Security rows must describe only capabilities proven by current application state. Use neutral labels instead of unsupported claims.

Recommended rows:

- Authenticated session: Verified only when the frontend has a current authenticated user and the route is protected.
- Member-only room: Active only when the selected chat includes the current user and backend membership checks are used.
- Realtime connection: Connected, reconnecting, offline, or unavailable based on socket state.
- Protected file access: Active only after protected preview/download routes exist and membership checks are tested.

Do not claim "end-to-end encrypted", virus scanned, compliance certified, or permanently secure unless a backend capability and test prove that claim.

### Header And Actions

Supported actions:

- Search remains wired to existing message search.
- More opens the conversation detail drawer on mobile.
- Pin/unpin lives on message action menus or detail rows after backend support exists.
- Download/open lives on attachment cards and shared asset rows.

Unsupported actions:

- Call, video, mute, profile, and favorite may remain only if disabled or hidden. They must not look clickable.

## Data And Loading States

Every data-backed section needs these states:

- Loading: skeleton rows/tiles with stable dimensions.
- Empty: concise empty message, no decorative life imagery.
- Error: concise retryable error message and retry control when applicable.
- Unauthorized: neutral "Unavailable" wording without leaking whether another user owns the file.
- Deleted/expired: "Attachment unavailable" or "File unavailable" with disabled actions.
- Offline: preserve existing cached metadata where safe; disable network-only actions with clear state.

## Accessibility Requirements

- File picker button has accessible name "Attach file".
- Remove selected file buttons include the filename in the accessible name.
- Download/open buttons include the filename in the accessible name.
- More drawer traps focus while open and returns focus to the trigger on close.
- Drawer closes with Escape and close button.
- Attachment thumbnails and media previews use meaningful alt text based on sanitized filename or "Shared media attachment".
- Pure decorative abstract placeholders use empty alt text.
- Validation errors are announced through existing alert/status patterns.
- Keyboard users can reach all attachment actions, pinned actions, search, and drawer controls.

## Copywriting

Use this copy unless a component already has equivalent concise wording:

- Composer placeholder: "Write a private message"
- Attach button: "Attach file"
- Selected file validation: "This file cannot be sent. Remove it or choose a supported file."
- Upload failed: "Upload failed. Retry or remove the attachment."
- Reloaded failed attachment: "Reattach the file to retry."
- Attachment unavailable: "Attachment unavailable"
- Download action: "Download"
- Preview action: "Open preview"
- Shared files empty: "No shared files"
- Shared media empty: "No shared media"
- Pinned empty: "No pinned messages"
- Unpin action: "Unpin message"
- Protected file access row: "Protected file access"

## Responsive Acceptance Criteria

- Desktop 1440px and 1280px: right rail remains visible and usable without horizontal overflow.
- Tablet/narrow desktop: rail may collapse behind a drawer if existing responsive shell requires it.
- Mobile 390px wide: message bubbles, filenames, selected file tray, and drawer rows never overflow horizontally.
- Mobile 390x844 and 430x932: composer tray and safe-area footer do not cover the last message.
- Light and dark themes: all attachment cards, validation states, drawer sections, and security rows meet readable contrast.

## Verification Requirements

Phase 08 implementation must provide evidence for:

- Unit/component tests for composer attachment selection, validation, removal, upload failure, retry, and reload limitation.
- Unit/component tests for attachment bubbles and file cards.
- API/hook tests for multipart send, shared assets, pinned messages, preview/download URLs, and cache reconciliation.
- Backend tests for upload validation, membership authorization, preview/download denial, shared asset queries, pin/unpin, and cleanup on failure.
- Socket tests or hook tests proving pin/unpin and attachment-bearing message updates reconcile without duplicates.
- Playwright behavior smoke for desktop light, desktop dark, mobile light, and mobile dark.
- Screenshot evidence after real interactions, not initial static render only.

## UI Checker Signoff

- Spacing uses 4px-based values: PASS.
- Typography is scaled to messenger surfaces: PASS.
- Light and dark themes are covered: PASS.
- Mobile and desktop layouts are covered: PASS.
- Data-backed state requirement is explicit: PASS.
- No static fake files/media/pins allowed: PASS.
- No living-being visuals allowed for new placeholders/test media: PASS.
- Unsupported security claims are blocked: PASS.
- Accessibility and keyboard requirements are defined: PASS.

Recommendation accepted: implement Phase 08 using this spec as the required UI safety gate before plan execution.
