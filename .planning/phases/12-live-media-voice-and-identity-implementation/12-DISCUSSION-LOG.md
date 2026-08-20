# Phase 12: Live Media Voice And Identity Implementation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 12-live-media-voice-and-identity-implementation
**Areas discussed:** dependency boundary, abstract identity marks, attachment progress/cancel/retry, voice contract, voice recorder/playback, shared assets/search/delete/privacy, realtime/cache/block integration, verification

---

## Dependency Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Require Phase 11 evidence before execution | Context/planning may proceed, but block-dependent implementation must verify Phase 11 completion evidence first. | x |
| Proceed without gate | Implement Phase 12 without checking Phase 11 final evidence. | |

**User's choice:** Approved recommendation.
**Notes:** Phase 12 depends on conversationControls and block enforcement. Planning can proceed, but block-safe completion claims require Phase 11 evidence.

---

## Abstract Identity Marks

| Option | Description | Selected |
|--------|-------------|----------|
| Structured metadata | Store validated `identityMark` metadata on `User`; generate abstract marks from presets. | x |
| Binary identity asset | Store generated or uploaded identity image files. | |
| Arbitrary URL/profile image | Let users provide remote identity image URLs. | |

**User's choice:** Approved recommendation.
**Notes:** Metadata fits the non-living identity policy and avoids a larger private file surface. `profilePic` remains legacy/provider fallback only.

---

## Identity Settings And Propagation

| Option | Description | Selected |
|--------|-------------|----------|
| Account/profile settings route | Add protected user identity mutation and settings UI from sidebar account controls. | x |
| Conversation detail editor | Put identity editing inside the selected conversation rail/drawer. | |
| Local-only identity state | Change identity visually without backend persistence. | |

**User's choice:** Approved recommendation.
**Notes:** Account-level identity belongs in settings. Successful updates must refresh auth store, chats, contacts, message surfaces, and peers through query invalidation/socket notification.

---

## Attachment Progress, Cancel, And Retry

| Option | Description | Selected |
|--------|-------------|----------|
| API/hook-owned upload state | Extend `messageApi.createMessage` with progress and abort options; hooks own upload state. | x |
| Component-owned Axios calls | Let composer components call transport directly for progress. | |
| No in-flight abort | Keep only pre-send cancel and failed retry. | |

**User's choice:** Approved recommendation.
**Notes:** The selected path preserves frontend API/hook boundaries and makes progress/cancel/retry testable without bypassing TanStack Query.

---

## Attachment Retry After Reload

| Option | Description | Selected |
|--------|-------------|----------|
| Same-session retry only | Retry while local `File`/`Blob` still exists; after reload require reattach or re-record. | x |
| Persist local files across reload | Attempt browser-local file restoration. | |

**User's choice:** Approved recommendation.
**Notes:** Browser file handles are not reliably recoverable after reload. The UI must be honest instead of pretending retry can restore missing bytes.

---

## Voice Message Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Attachment kind | Extend attachment contract with `kind: "voice"` and voice metadata. | x |
| Separate voice model | Create a dedicated persistence model for voice messages. | |
| UI-only voice bubbles | Render local voice UI without persisted attachment contract. | |

**User's choice:** Approved recommendation.
**Notes:** The existing protected attachment pipeline already handles membership, storage, shared assets, and delete visibility. Voice should reuse it unless planning proves a blocker.

---

## Voice Format And Limits

| Option | Description | Selected |
|--------|-------------|----------|
| WebM/Opus first | Use `MediaRecorder.isTypeSupported()` with WebM/Opus, WebM, then Ogg/Opus fallback. | x |
| Accept broad audio types | Let the browser/server accept many audio formats. | |
| Server-decode media | Add server-side duration/waveform decoding now. | |

**User's choice:** Approved recommendation.
**Notes:** MDN docs show support varies by MIME, so runtime capability checks are needed. Phase 12 keeps server media processing minimal and enforces 2 minutes / 10 MB.

---

## Voice Recorder UX

| Option | Description | Selected |
|--------|-------------|----------|
| Focused recorder hook and inline tray | Add `useVoiceRecorder` plus composer recording/preview controls. | x |
| Composer-owned browser API logic | Put `getUserMedia` and `MediaRecorder` state directly in the composer component. | |
| Full-screen recorder modal | Use a separate recording modal for all devices. | |

**User's choice:** Approved recommendation.
**Notes:** A hook keeps permission/support/timer/cleanup logic isolated. Inline tray keeps mobile and desktop behavior consistent.

---

## Voice Playback UX

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated voice player | Render persisted voice attachments with a `VoiceMessagePlayer` using protected URLs. | x |
| Generic file card | Treat voice as a downloadable file card only. | |

**User's choice:** Approved recommendation.
**Notes:** Voice needs loading, play, pause, error, and retry states that are not the same as image previews or document cards.

---

## Unsupported And Permission States

| Option | Description | Selected |
|--------|-------------|----------|
| Honest enabled/disabled states | Enable mic only when secure context, media APIs, and supported MIME exist; handle permission/device errors. | x |
| Always show active mic | Let errors happen after click without support checks. | |

**User's choice:** Approved recommendation.
**Notes:** `getUserMedia` requires secure context and permission; unsupported browsers must not look functional.

---

## Shared Assets And Voice Surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Persisted-only assets with optional voice section | Add `voice` shared asset kind and show voice section only when real assets exist. | x |
| Static fallback cards | Keep placeholder files/media/voice when no assets exist. | |
| Mix voice into file/media cards | Show voice as normal shared files or media thumbnails. | |

**User's choice:** Approved recommendation.
**Notes:** Static detail content caused earlier product failures. Voice needs a clear section only when server data exists.

---

## Search, Delete, And Privacy

| Option | Description | Selected |
|--------|-------------|----------|
| Metadata-only search and protected access | Search text/captions/filenames/metadata only; protected routes enforce membership/delete visibility. | x |
| Audio transcription | Make voice content searchable from spoken words. | |
| Public/signed direct URLs | Expose asset access outside authenticated backend routes. | |

**User's choice:** Approved recommendation.
**Notes:** Transcription is out of scope. Delete-for-everyone must block playback/download; delete-for-self hides assets only for that user.

---

## Realtime And Cache Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| HTTP create remains canonical | Sockets broadcast persisted events and drive invalidation only. | x |
| Socket creates media/voice | Add socket persistence path for voice/media sends. | |

**User's choice:** Approved recommendation.
**Notes:** Phase 10.1 locked HTTP-only canonical creation. Socket handlers must not create duplicate or unmergeable messages.

---

## Block Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 11 controls | Gate text, attachment, and voice sends through `conversationControls` and backend helpers. | x |
| Separate media/voice checks | Add independent block checks only in new Phase 12 paths. | |

**User's choice:** Approved recommendation.
**Notes:** One capability contract avoids drift where text is blocked but media or voice can bypass the rule.

---

## Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Backend, frontend, browser, lint, build, static guards | Use mocked media APIs and synthetic blobs; record exact evidence. | x |
| Browser-only validation | Rely mostly on visual/manual UI checks. | |
| Real microphone tests | Require physical mic hardware for acceptance. | |

**User's choice:** Approved recommendation.
**Notes:** Browser media tests must be deterministic and hardware-independent. Production-live acceptance remains Phase 14.

---

## Plan Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Three slices | Identity first, voice/upload contract second, shared/realtime/privacy/evidence third. | x |
| One broad plan | Implement identity, media, voice, and tests in one large execution plan. | |

**User's choice:** Approved recommendation.
**Notes:** The three-slice shape matches dependency risk and keeps the implementation reviewable.

---

## the agent's Discretion

- Exact helper, route, hook, component, socket event, query key, and test filenames.
- Exact identity palette and pattern names, as long as they stay deterministic, abstract, non-living, and validated.
- Whether identity socket events carry sanitized identity metadata or only user ids for targeted invalidation.
- Whether voice playback restricts to one active player at a time.

## Deferred Ideas

- Live audio/video calls and WebRTC signaling remain Phase 13.
- Final deployed Vercel/Render acceptance remains Phase 14.
- Transcription, semantic audio search, server waveform analysis, antivirus scanning, external object storage migration, E2EE media, public galleries, and realistic avatar uploads remain outside Phase 12.
