---
phase: 12
slug: live-media-voice-and-identity-implementation
status: approved
created: 2026-06-13
device_scope: desktop-mobile
theme_scope: light-dark
source_images: phase-06-ui-references
---

# Phase 12 - UI Design Contract

## Purpose

Phase 12 must turn the remaining identity, attachment, shared asset, and voice-message surfaces into real product interactions without weakening the approved Chatify messenger visual direction.

This UI contract is binding for planning and execution. The implementation must preserve the quiet secure messenger style from the Phase 6/8/9 UI references while replacing decorative or static behavior with backend-backed workflows.

## Visual Direction

Chatify remains a professional private messenger with abstract identity marks, geometric tiles, restrained teal accents, clear state feedback, and compact information density.

Required qualities:

- Secure, calm, operational, and trust-focused.
- Desktop three-zone layout stays readable: conversation list, active thread, detail rail.
- Mobile prioritizes one conversation at a time with a safe-area header, scrollable thread, bottom composer, and drawer/sheet detail surfaces.
- Light and dark themes must feel like the same product, not two unrelated skins.
- All identity imagery must be abstract and non-living. No first-party humans, faces, bodies, silhouettes, animals, plants, mascots, portrait defaults, or realistic avatars.
- Static demo cards, fake media thumbnails, fake files, fake voice clips, and fake counts are prohibited in production runtime UI.

## Theme Tokens

### Shared Shape And Rhythm

- Primary radius: 8px for cards, panels, inputs, menus, and repeated items.
- Circular icon controls remain circular only when the icon is the whole control.
- Minimum touch target: 44px on mobile, 36px on desktop.
- Composer controls must not resize the composer while recording, uploading, retrying, or showing errors.
- Message bubble max width: about 70 percent desktop, 78 percent mobile.
- Detail rail width: 320-360px desktop, full-width drawer/sheet on mobile.
- Do not use decorative gradient blobs, orbs, or unrelated illustration backgrounds.

### Light Theme

- App background: warm off-white or white with subtle borders.
- Conversation and detail panels: white or near-white.
- Primary accent: deep teal, matching existing sent bubbles and action buttons.
- Success/online: green dot with text label where needed.
- Warning/retry: amber used sparingly for failed or retrying sends.
- Error/block: red only for destructive or blocked states.
- Text contrast must pass WCAG AA for normal text.

### Dark Theme

- App background: charcoal/graphite, never pure black.
- Panels: slightly lifted dark surfaces with visible but quiet borders.
- Sent bubbles: deep teal with readable white text.
- Received bubbles: dark gray surface with enough contrast from the page.
- Muted metadata: soft gray with AA contrast where possible.
- Focus rings: teal or light outline visible on dark panels.

## Core Surface Contracts

### Sidebar And Account Identity

The sidebar account block must expose a real path to identity settings.

Required behavior:

- The current user's identity tile shows a deterministic abstract mark from first-party `identityMark` metadata, then legacy provider `profilePic` only as fallback.
- A settings/profile entry opens an identity editor without navigating away from the active chat unexpectedly.
- If a user has no first-party mark, show deterministic abstract initials/pattern fallback.
- Logout remains a real command and must not be displaced by identity editing.

Identity editor requirements:

- Preset selector for abstract pattern, palette, and initials/label.
- Live preview using the same identity renderer as the chat surfaces.
- Save, cancel, loading, success, validation-error, and server-error states.
- No arbitrary remote URL input in Phase 12.
- Invalid labels, unknown palettes, unknown patterns, living-being preset names, or unsafe metadata show validation copy and do not update UI optimistically as final.

### Conversation List

Conversation rows must refresh after peer or self identity changes.

Required behavior:

- Abstract identity tile updates without full page reload after identity mutation/socket invalidation.
- Existing unread, time, status, and selected-row behavior remains stable.
- Blocked conversations show capability state without replacing real latest-message data with fake copy.

### Conversation Header

The active header must show real identity and capability state.

Required behavior:

- Avatar/identity mark updates from current query/user data.
- Call/video buttons remain honest-unavailable until Phase 13 unless already implemented by a real call path.
- Search and More retain Phase 11 behavior.
- Detail rail close/open stays functional on desktop and drawer behavior stays functional on mobile.

### Message Thread

Message rendering must support text, file, media, and voice without layout shifts.

Required behavior:

- Sent/received bubbles keep current visual language.
- Attachment and voice sends show pending, uploading, retrying, failed, sent, delivered, and read states accurately.
- Failed attachment or voice messages remain visible and retryable while local bytes still exist.
- After reload, failed local-byte retry surfaces must ask the user to reattach or re-record instead of pretending bytes survived.
- Voice player must be accessible by keyboard and screen reader.

### Composer

The composer is the primary Phase 12 interaction surface. It must remain compact, stable, and reliable.

Attachment behavior:

- Attachment button opens the real picker.
- Selected files appear in an attachment tray with filename, type, size, remove button, and validation errors.
- Upload progress appears in the pending send surface, not as fake shared-file content.
- Cancel during upload uses AbortController where supported and produces an honest cancelled/failed state.
- Retry uses the same `clientMessageId` and must not duplicate persisted messages.

Voice behavior:

- Mic control is enabled only when secure context, media devices, `getUserMedia`, `MediaRecorder`, and supported MIME type are available.
- Unsupported mic state is visibly disabled with accessible title/label.
- Recording tray appears inline above or inside the composer without covering the thread.
- Recording tray includes elapsed time, stop, cancel, preview, send, and retry states.
- Voice drafts do not clear text drafts.
- Too-short, too-long, denied permission, no device, recording error, upload error, and playback error are recoverable.

### Detail Rail And Mobile Drawer

Shared detail surfaces must be server-derived only.

Required behavior:

- Shared files, shared media, and voice sections render from API/query data.
- Empty state is honest and compact: no fake files, no fake media, no fake waveform cards, no fake counts.
- Voice section appears only when real persisted voice assets exist, or as part of one combined empty state.
- Detail sections update after send, delete, search pagination, reload, and realtime events.
- Delete-for-everyone removes playback/download/open actions and shared visibility.
- Delete-for-self hides assets only for the current user.

## Component Handoff Matrix

| Surface | Primary Components | UI Contract |
|---------|--------------------|-------------|
| Identity settings | New settings/profile identity components | Abstract non-living editor, live preview, save/cancel/error states |
| Identity tile | Shared renderer or helper | Same metadata/fallback logic everywhere |
| Composer attachments | `MessageComposer`, attachment tray/preview, send hook | Picker, validation, progress, cancel, retry, no duplicate sends |
| Voice recorder | New `useVoiceRecorder`, recorder tray | Support detection, permission states, record/preview/cancel/send/retry |
| Voice playback | New `VoiceMessagePlayer` | Protected URL playback with loading/play/pause/error states |
| Message bubble | `MessageBubble`, attachment renderer | Text/file/media/voice layout with accurate send status |
| Detail content | `ConversationDetailContent`, rail/drawer wrappers | Persisted-only files/media/voice sections and honest empty states |
| Socket/query state | `useChatSocket`, `useChatQueries` | Invalidate/merge real persisted events only |

## Copy Rules

- Use concise product copy, not explanatory onboarding text.
- Prefer state labels over feature descriptions.
- Recommended strings:
  - `Identity updated`
  - `Save identity`
  - `Recording...`
  - `Preview voice message`
  - `Retry upload`
  - `Reattach to retry`
  - `Microphone unavailable`
  - `Permission denied`
  - `No shared files yet`
  - `No shared media yet`
  - `No voice messages yet`
- Avoid claims such as encrypted audio, scanned files, AI transcription, or production acceptance unless those features are actually proven.

## Accessibility Requirements

- Every icon-only button has an accessible label.
- Menus, drawers, recording controls, identity editor, and playback controls support keyboard navigation.
- Escape closes transient UI where appropriate and restores focus.
- Progress indicators expose readable status text.
- Voice playback controls expose pressed/playing state.
- Disabled unavailable controls communicate why through accessible title or adjacent status.
- Color is not the only indicator for failed, retrying, blocked, or recording states.

## Responsive Requirements

- Desktop keeps three-zone layout without nested cards.
- Mobile shows conversation first, detail as drawer/sheet, and composer fixed to bottom safe area.
- Recorder tray, attachment tray, and upload state must fit 390px-wide mobile without clipping labels or buttons.
- Long filenames and identity labels wrap or truncate predictably.
- Voice player must not exceed bubble width on mobile.

## Static Content Guard

Production runtime code must not ship:

- Hardcoded shared files/media/voice rows.
- Fake pinned counts or fake shared asset counts.
- First-party realistic identity photos, living-being avatars, plants, animals, mascots, faces, bodies, silhouettes, or portrait defaults.
- Public storage ids, raw hashes, protected URLs, cookie values, tokens, emails, or raw media metadata in UI strings/logs.

Test fixtures may exist only in test folders and must not be imported by production runtime modules.

## UI Verification Checklist

- Identity editor updates current user surfaces and persists after reload.
- Attachment progress/cancel/retry works on desktop and mobile.
- Voice record/preview/cancel/send/retry/play/pause/error states work with mocked browser media APIs.
- Shared files/media/voice panels render only API data or honest empty/loading/error states.
- Blocked conversations disable text, attachment, and voice send controls.
- Delete-for-everyone removes media/voice access.
- Light and dark screenshots are captured after real interactions, not static initial render.

## Approval Status

Approved for planning. This contract resolves the Phase 12 `blocked_by_ui_spec` gate.

