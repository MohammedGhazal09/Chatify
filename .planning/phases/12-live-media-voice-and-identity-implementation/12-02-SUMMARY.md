---
phase: 12-live-media-voice-and-identity-implementation
plan: 02
subsystem: media-voice-send
tags: [attachments, voice, upload-progress, retry, validation]
provides:
  - Backend voice attachment validation and persistence
  - Voice duration metadata in message and shared asset summaries
  - Multipart upload progress and abort wiring
  - Same-session retry preservation for local attachment and voice drafts
  - Browser voice recorder hook and composer controls
key-files:
  created:
    - Backend/Chatify/test/message/message.voice.test.mjs
    - Frontend/Chatify/src/hooks/useVoiceRecorder.ts
    - Frontend/Chatify/src/hooks/useVoiceRecorder.test.tsx
    - Frontend/Chatify/src/pages/chat/components/VoiceRecorderTray.tsx
  modified:
    - Backend/Chatify/Controller/messageController.mjs
    - Backend/Chatify/Models/attachmentModel.mjs
    - Backend/Chatify/Models/messageModel.mjs
    - Backend/Chatify/Utils/attachmentValidation.mjs
    - Backend/Chatify/Utils/messageState.mjs
    - Backend/Chatify/test/fixtures/attachments.mjs
    - Backend/Chatify/test/message/message.attachments.test.mjs
    - Backend/Chatify/test/message/message.attachment-authorization.test.mjs
    - Frontend/Chatify/src/api/messageApi.ts
    - Frontend/Chatify/src/api/messageApi.test.ts
    - Frontend/Chatify/src/hooks/messageCache.ts
    - Frontend/Chatify/src/hooks/useChatQueries.ts
    - Frontend/Chatify/src/hooks/useChatQueries.test.tsx
    - Frontend/Chatify/src/pages/chat/chat.tsx
    - Frontend/Chatify/src/pages/chat/components/AttachmentTray.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx
    - Frontend/Chatify/src/pages/chat/components/MessageComposer.test.tsx
    - Frontend/Chatify/src/pages/chat/components/index.ts
    - Frontend/Chatify/src/pages/chat/sendDraftGuard.ts
    - Frontend/Chatify/src/pages/chat/sendDraftGuard.test.ts
    - Frontend/Chatify/src/pages/chat/utils/attachmentDisplay.ts
    - Frontend/Chatify/src/types/chat.ts
requirements_completed: [MEDIA-01, MEDIA-02, VOICE-01, VOICE-02, TEST-05]
completed: 2026-06-17
---

# Phase 12 Plan 02 Summary

## Accomplishments

- Added `voice` as a first-class attachment kind in backend attachment documents, message summaries, shared asset serialization, and frontend chat types.
- Extended backend attachment validation to accept browser voice containers (`audio/webm`, `audio/ogg`, `audio/opus`) with 10 MB size and 1-120 second duration enforcement.
- Added multipart `attachmentMetadata` handling so voice duration participates in persisted metadata and idempotency fingerprinting.
- Added backend voice coverage for voice-only sends, idempotent retries, changed metadata conflicts, protected preview/shared asset access, unsupported types, missing duration, too-short, and too-long payloads.
- Extended `messageApi.createMessage` with upload progress and abort options while keeping text-only sends as JSON payloads.
- Moved attachment send variables from raw `File[]` to local draft objects so same-session retry preserves voice duration and local preview metadata.
- Added hook-owned upload progress/cancel state around `useSendMessage`, with `AbortController` cancellation and failed optimistic message retry copy.
- Added `useVoiceRecorder` with runtime MediaRecorder MIME selection, microphone permission/device states, min/max duration handling, cleanup of media tracks, and local object URL cleanup.
- Replaced the disabled composer mic control with supported-browser voice recording controls and a recording/error tray.
- Updated the attachment tray and duplicate-send guard to render/count voice drafts and include duration in draft identity.

## Verification

```powershell
cd Backend/Chatify
npm test -- --run test/message/message.voice.test.mjs test/message/message.attachments.test.mjs test/message/message.attachment-authorization.test.mjs
```

Result: passed, 3 files and 13 tests.

```powershell
cd Frontend/Chatify
npm test -- src/api/messageApi.test.ts src/hooks/useChatQueries.test.tsx src/hooks/useVoiceRecorder.test.tsx src/pages/chat/components/MessageComposer.test.tsx src/pages/chat/sendDraftGuard.test.ts
```

Result: passed, 5 files and 29 tests.

```powershell
cd Frontend/Chatify
npm run lint
```

Result: passed.

```powershell
cd Frontend/Chatify
npm run build
```

Result: passed.

## Notes

- Voice playback and shared voice asset presentation remain intentionally limited to the existing protected attachment preview/download path in this slice; the dedicated playback and shared asset truth work belongs to Plan 12-03.
- Same-session retry now preserves local attachment drafts, including voice duration. After reload, retry still requires reattach or re-record because local bytes are not persisted in browser state.
- The protected `Frontend/Chatify/src/pages/chat/chat.tsx` file was edited only around send/retry/upload plumbing; existing detail rail viewport behavior was preserved.
