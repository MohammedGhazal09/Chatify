# Phase 12: Live Media Voice And Identity Implementation - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 turns the remaining static or partial media and identity surfaces into real persisted messenger workflows. Users can change a first-party abstract identity mark, send attachments with visible progress/cancel/retry behavior, see shared media/files from persisted attachments only, and record, preview, cancel, send, reload, play, pause, and retry voice messages. This phase does not implement live audio/video calls, WebRTC signaling, transcription, arbitrary realistic avatar uploads, public media galleries, end-to-end encrypted media, external object storage migration, antivirus scanning, or final deployed production acceptance.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**12 requirements are locked.** See `12-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `12-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- First-party account/profile settings flow for changing abstract non-living identity marks.
- Identity persistence and cache propagation across sidebar, chat list, header, message surfaces, contact/user data, and detail panel.
- Attachment send-state hardening for progress, cancellation, abort, failure, and retry.
- Shared media/files panels backed only by persisted attachment data or honest empty/loading/error states.
- Voice message metadata, validation, persistence, history, realtime delivery, and protected playback/download.
- Composer voice workflow for record, preview, cancel, send, failed state, and retry.
- Playback states for voice messages, including loading, playing, paused, and error.
- Integration with Phase 11 block rules, membership checks, and delete visibility semantics.
- Automated backend, frontend, and browser evidence for identity, attachments, shared assets, voice, privacy, and production-build behavior.

**Out of scope (from SPEC.md):**
- Live audio calls and video calls - owned by Phase 13.
- WebRTC signaling, incoming call state, ringing, busy, missed, and ended call workflows - owned by Phase 13.
- Audio transcription, semantic audio search, captions generated from speech, or AI processing - separate media/AI scope.
- Server-side waveform analysis - optional future polish; Phase 12 may store client display metadata only if simple.
- Antivirus scanning or external object-storage migration - security/infrastructure scope beyond this phase.
- End-to-end encryption for media or voice - deferred v2 security capability.
- Public media galleries or public profile image galleries - Chatify conversation media remains private.
- Arbitrary first-party realistic human, animal, plant, mascot, or portrait identity uploads/defaults - excluded by the approved non-living identity policy and lack of semantic moderation in this phase.
- Final production live acceptance on Vercel/Render - owned by Phase 14, with Phase 12 limited to local/build/test and documented deploy-readiness evidence.

</spec_lock>

<decisions>
## Implementation Decisions

### Dependency And Phase Boundaries
- **D-01:** Phase 12 spec, discussion, and planning may proceed now, but execute-phase work that depends on blocked-user safety must verify Phase 11 final summary or equivalent review-fix evidence before claiming block-safe media or voice behavior.
- **D-02:** Keep Phase 12 focused on identity marks, attachments, shared assets, and voice messages. Calls/video remain disabled or honest-unavailable until Phase 13, and final deployed production readiness remains Phase 14.
- **D-03:** Preserve the existing stack and brownfield boundaries: React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, and current npm package layout.
- **D-04:** Do not use subagents for this phase work in this Codex thread.

### Abstract Identity Marks
- **D-05:** Store first-party identity customization as structured `identityMark` metadata on `User`, not as arbitrary remote image URLs. Recommended fields include initials or label, palette id, pattern id, optional accent tokens, and `identityMarkUpdatedAt`.
- **D-06:** Keep `profilePic` as legacy/provider fallback data. The new first-party Chatify path defaults to deterministic abstract non-living marks and must not ship human, animal, plant, mascot, portrait, silhouette, or realistic-avatar defaults.
- **D-07:** Implement a protected `PATCH /api/user/identity` route through `userRouter.mjs` and `userController.mjs`. The route validates only approved abstract presets/metadata, rejects arbitrary URLs, returns sanitized user identity data, and follows the existing response-envelope style.
- **D-08:** Put the identity editor in an account/profile settings surface opened from the sidebar user/settings area. Do not place account-level identity editing inside the conversation detail rail.
- **D-09:** Identity mark generation should be metadata-driven using deterministic palettes, initials/monograms, and geometric patterns. Avoid binary identity uploads in Phase 12 unless planning proves metadata cannot satisfy the UI.
- **D-10:** After identity mutation succeeds, update the current auth store, invalidate relevant user/chat/contact query data, and emit a socket identity/profile update to affected chat peers so sidebar, chat list, header, message surfaces, and detail panel refresh without a full page reload.

### Attachment Progress, Cancel, And Retry
- **D-11:** Extend `messageApi.createMessage` to accept upload options such as `onUploadProgress` and `AbortController.signal`. Do not call Axios directly from chat UI components.
- **D-12:** Keep send/upload state in the send-message hook or a focused adjacent hook. Components render progress, cancel, failed, and retry states from typed hook state.
- **D-13:** In-flight upload cancellation uses `AbortController` where browser transport supports it. Pre-send removal remains handled by the composer attachment tray.
- **D-14:** Same-session retry may reuse the local `File`/`Blob` and the same `clientMessageId`. After a browser reload, failed attachment or voice sends must require reattachment or re-recording because local file handles cannot be restored safely.
- **D-15:** Attachment and voice retry must preserve the Phase 10.1 idempotency contract: one user send action creates at most one persisted message and retry does not duplicate messages.

### Voice Message Contract And Validation
- **D-16:** Represent voice messages as protected persisted attachments with `kind: "voice"` plus voice metadata. Do not add a separate voice-message persistence model unless planning proves the attachment pipeline cannot support the contract.
- **D-17:** Extend frontend and backend shared asset kinds from `media | file` to include `voice`. Voice assets should not be mixed into generic image/file cards; show them through voice-specific UI.
- **D-18:** Voice metadata should include duration in milliseconds, audio MIME type, size, status, protected attachment ids, and optional simple client display metadata. Server-side waveform analysis is out of scope.
- **D-19:** Use a browser MIME preference list checked with `MediaRecorder.isTypeSupported()`: `audio/webm;codecs=opus`, then `audio/webm`, then `audio/ogg;codecs=opus` if supported. Backend validation should allow only the selected vetted audio types and reject unsupported audio.
- **D-20:** Enforce the Phase 12 MVP limits: maximum 2 minutes and 10 MB for voice recordings. The client records and displays duration; the backend enforces size/type and stores duration as display metadata without full media decoding in this phase.

### Voice Recorder And Playback UX
- **D-21:** Add a focused `useVoiceRecorder` hook for permission, support detection, recording, timer, preview, cancel, send, failure, and retry state. The composer should not own browser media API details directly.
- **D-22:** Enable the mic control only when the page is in a secure context and `navigator.mediaDevices`, `getUserMedia`, `MediaRecorder`, and a supported MIME type are available. Otherwise render an honest disabled or unavailable state.
- **D-23:** Handle microphone permission denied, no input device, unsupported browser, too-short recording, too-long recording, upload failure, playback loading, playback error, playing, paused, and retry states without losing the current text draft.
- **D-24:** Add a `VoiceMessagePlayer` component for persisted voice attachments. It should use protected attachment URLs, show loading/error/play/pause states, be keyboard accessible, and work on desktop/mobile and light/dark themes.
- **D-25:** Use an inline composer recording tray on mobile and desktop with large touch targets, elapsed time, cancel, preview, and send controls. Do not introduce a separate full-screen recording modal for Phase 12.

### Shared Assets, Search, Delete, And Privacy
- **D-26:** Shared media/files/voice surfaces render only server-returned persisted assets or honest loading/empty/error states. No production static cards, fake counts, or fixture fallback rows are allowed.
- **D-27:** Voice assets may appear in a separate "Voice messages" detail section only when real persisted voice assets exist. If no voice assets exist, hide the section or show one combined honest empty state according to the detail-panel pattern.
- **D-28:** Reuse the protected attachment preview/download route semantics for voice playback. A frontend helper alias such as `getAttachmentPlaybackUrl` is acceptable for readability, but access must still go through authenticated membership checks.
- **D-29:** Search does not transcribe or semantically index audio. Search can match message text, captions, sanitized display filenames, and supported metadata only.
- **D-30:** Delete-for-everyone must block protected media/voice preview, download, playback, and shared asset visibility. Delete-for-self hides assets only for that user according to existing message visibility rules.
- **D-31:** Backend logs for identity/media/voice may include redacted operational ids and lifecycle status, but must not include raw audio bytes, raw filenames when avoidable, storage ids, protected URLs, identity payload values, profile images, cookies, tokens, emails, or private media metadata.

### Realtime, Cache, And Block Integration
- **D-32:** Keep HTTP message creation canonical. Socket.IO must not create text, attachment, or voice messages; it only broadcasts persisted events and supports receipt/realtime invalidation.
- **D-33:** `message:new` should carry persisted voice attachment summaries like any other canonical message. The frontend socket hook updates query caches and invalidates active shared-asset queries; UI components must not register independent socket listeners.
- **D-34:** Identity updates should emit a small authenticated profile/identity update event to affected peers or their chat rooms, then the frontend invalidates users/chats/contact data instead of mutating disconnected UI copies.
- **D-35:** Reuse Phase 11 `conversationControls` and backend capability helpers for text, attachment, and voice sends. Blocked direct conversations disable composer/media/voice UI and backend mutations reject stale clients before persistence or emits.

### Verification And Static Guardrails
- **D-36:** Required backend coverage includes identity validation/persistence, attachment progress/cancel server effects where applicable, voice validation, protected playback/download, unauthorized access, delete visibility, and blocked-conversation send rejection.
- **D-37:** Required frontend coverage includes identity editor mutation/cache propagation, upload progress/cancel/retry, recorder states, voice preview/send/retry, player states, shared-asset invalidation, and blocked/unsupported UI states.
- **D-38:** Browser smoke tests should use mocked `MediaRecorder`, mocked permissions, and synthetic `Blob` objects. Tests must not require real microphone hardware.
- **D-39:** Extend fixture/static guard tests to prevent hardcoded shared files/media/voice/identity samples in production runtime code.
- **D-40:** Phase 12 summary must record exact backend test, frontend test, browser smoke, lint, build, and static guard outcomes. It must explicitly defer final deployed Vercel/Render live acceptance to Phase 14.

### Planning Shape
- **D-41:** Plan Phase 12 in three dependency-aware slices: identity contract/settings/propagation; voice and attachment contract/progress/cancel/retry; shared asset truth, realtime invalidation, block/delete/privacy integration, and evidence.

### the agent's Discretion
- The planner may choose exact helper, route, component, hook, event, query key, and test filenames if the contracts above are preserved.
- The planner may choose exact abstract identity palettes and pattern names if they stay deterministic, non-living, accessible, and easy to validate.
- The planner may choose whether identity socket updates carry sanitized identity metadata or only invalidate-by-user id, as long as peers refresh without a full browser reload and private data is not leaked.
- The planner may choose whether voice playback allows only one active player at a time if implementation research finds that necessary for reliability.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/12-live-media-voice-and-identity-implementation/12-SPEC.md` - locked Phase 12 requirements, boundaries, constraints, and acceptance criteria.
- `.planning/phases/12-live-media-voice-and-identity-implementation/12-CONTEXT.md` - implementation decisions captured by this discussion.
- `.planning/ROADMAP.md` - Phase 12 goal, dependency on Phase 11, success criteria, and Phase 13/14 boundaries.
- `.planning/REQUIREMENTS.md` - ID-01, ID-02, MEDIA-04, VOICE-01, VOICE-02, BLOCK-02, TEST-05, and production acceptance traceability.
- `.planning/PROJECT.md` - project core value, brownfield constraints, collaboration preference, repository hygiene, deployment origins, and no-subagent preference.
- `.planning/STATE.md` - current continuity record and active Phase 11/10.1 dependency status.

### Prior Phase Contracts
- `.planning/phases/11-conversation-controls-and-user-safety-implementation/11-SPEC.md` - locked Phase 11 controls/block requirements that Phase 12 must honor.
- `.planning/phases/11-conversation-controls-and-user-safety-implementation/11-CONTEXT.md` - conversationControls, block persistence, UI capability state, and no-subagent decisions.
- `.planning/phases/11-conversation-controls-and-user-safety-implementation/11-REVIEW-FIX.md` - current Phase 11 remediation evidence to check before execute-phase block-dependent claims.
- `.planning/phases/10.1-production-message-delivery-reliability-repair/10.1-CONTEXT.md` - HTTP-only canonical create, `clientMessageId` idempotency, duplicate prevention, and delivery truth decisions.
- `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-CONTEXT.md` - no static production detail content, honest disabled controls, and production-live evidence boundaries.
- `.planning/phases/08-media-files-and-conversation-detail-implementation/08-CONTEXT.md` - protected attachments, GridFS storage, shared assets, detail surfaces, attachment retry limits, and factual security rows.
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` - canonical message state, idempotent HTTP create, TanStack Query cache ownership, retry, receipt, unread, pagination, and delete visibility.
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` - authenticated Socket.IO identity, membership checks, targeted emits, reconnect, and presence privacy.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - frontend/backend layering, API/hook boundaries, controller/model/service responsibilities, and socket/auth boundaries.
- `.planning/codebase/STACK.md` - React, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, npm, Vercel, and Render stack.
- `.planning/codebase/CONVENTIONS.md` - TypeScript, ESM, import, naming, error handling, logging, and module-boundary conventions.

### Backend Runtime And Test Files
- `Backend/Chatify/Models/userModel.mjs` - current `profilePic` legacy field and user schema insertion point for `identityMark`.
- `Backend/Chatify/Routes/userRouter.mjs` - route boundary for protected identity update.
- `Backend/Chatify/Controller/userController.mjs` - current user profile/status/privacy controller and likely identity mutation home.
- `Backend/Chatify/Models/attachmentModel.mjs` - current `kind: media | file` attachment metadata model to extend with `voice` and metadata.
- `Backend/Chatify/Utils/attachmentValidation.mjs` - current file/media allowlist, attachment limits, fingerprinting, and shared asset kind normalization.
- `Backend/Chatify/Services/attachmentStorageService.mjs` - existing protected GridFS-backed storage service to reuse for voice bytes if no blocker is found.
- `Backend/Chatify/Controller/messageController.mjs` - canonical HTTP create, attachment upload, shared asset list, protected preview/download, delete, search, and socket emit behavior.
- `Backend/Chatify/Routes/messageRouter.mjs` - message, attachment, shared asset, and protected asset route boundary.
- `Backend/Chatify/Utils/conversationControls.mjs` - Phase 11 block/capability helper to reuse for media and voice sends.
- `Backend/Chatify/Config/socket.mjs` - Socket.IO room, message, receipt, shared detail, and profile/identity update integration boundary.
- `Backend/Chatify/test/message/*.test.mjs` - backend message, attachment, auth, block, delete, shared asset, and voice test patterns.
- `Backend/Chatify/test/socket/*.test.mjs` - authenticated socket/realtime event patterns to extend for voice and identity invalidation.

### Frontend Runtime And Test Files
- `Frontend/Chatify/src/types/chat.ts` - current `AttachmentKind = "media" | "file"` and `ConversationControls` types; extend for voice and identity-aware message/user surfaces.
- `Frontend/Chatify/src/types/auth.ts` - user/auth type boundary for identity mark metadata.
- `Frontend/Chatify/src/api/userApi.ts` - current user API client; add protected identity update.
- `Frontend/Chatify/src/api/messageApi.ts` - current create/shared assets/protected asset URL client; add upload progress/abort options and voice-aware shared asset type.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - durable send/query/shared asset cache owner; add upload state, retry, and identity/shared asset invalidation.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - Socket.IO client lifecycle and cache invalidation boundary for message, shared asset, and identity events.
- `Frontend/Chatify/src/store/authstore.ts` - current signed-in user state to update after identity mutation.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - chat route orchestration and selected-chat UI state. Preserve unrelated local work.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - existing attachment tray and disabled mic control; add recorder tray and upload progress/cancel wiring.
- `Frontend/Chatify/src/pages/chat/components/AttachmentTray.tsx` - current selected attachment tray to extend for progress/cancel if it remains the right UI boundary.
- `Frontend/Chatify/src/pages/chat/components/AttachmentPreview.tsx` - current media/file preview card; add or split voice playback rendering.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - message attachment rendering and failed-send retry surfaces.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` - shared files/media/security rows and future voice section integration point.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` - production runtime static/living/fixture guard to extend for identity, shared assets, and voice.
- `Frontend/Chatify/e2e/*.spec.ts` - Playwright behavior and screenshot evidence patterns; Phase 12 browser media tests must use mocked browser media APIs.

### Current Official Docs Checked During Discussion
- `https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder` - MediaRecorder support and `MediaRecorder.isTypeSupported()` guidance for MIME selection.
- `https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia` - secure context, permission, and microphone access constraints.
- `https://developer.mozilla.org/en-US/docs/Web/API/AbortController` - aborting web requests/streams for upload cancellation.

### Supporting Skills Used For This Discussion
- `C:/Users/saieh/.agents/skills/react-best-practices/SKILL.md` - React state, hook, and component-boundary guidance.
- `C:/Users/saieh/.agents/skills/api-and-interface-design/SKILL.md` - API contract and interface-boundary guidance.
- `C:/Users/saieh/.agents/skills/webapp-testing/SKILL.md` - browser behavior and Playwright evidence guidance.
- `C:/Users/saieh/.agents/skills/privacy-by-design/SKILL.md` - private media, identity, logs, and data minimization guidance.
- `C:/Users/saieh/.agents/skills/websocket-engineer/SKILL.md` - Socket.IO realtime, auth, room, reconnect, and event-boundary guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Backend/Chatify/Services/attachmentStorageService.mjs`: Existing GridFS storage path can store protected voice bytes behind authenticated routes if validation extends cleanly.
- `Backend/Chatify/Controller/messageController.mjs`: Already owns multipart message creation, attachment metadata, idempotent sends, shared assets, protected preview/download, delete visibility, and socket emits. Extend this contract rather than introducing a second voice persistence path.
- `Backend/Chatify/Utils/attachmentValidation.mjs`: Current validation and fingerprint helpers are the correct starting point for adding voice allowlists, size/duration metadata, and `voice` shared asset normalization.
- `Backend/Chatify/Utils/conversationControls.mjs`: Phase 11 capability checks should be reused so text, attachment, and voice sends share blocked-user enforcement.
- `Frontend/Chatify/src/api/messageApi.ts`: Existing create-message FormData builder is the correct transport boundary to extend with progress/abort options.
- `Frontend/Chatify/src/hooks/useChatQueries.ts`: Existing send mutation, retry, query keys, and invalidation are the correct durable state boundary for progress/cancel/retry and shared asset refresh.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx`: Already validates selected attachments, maintains local `File` drafts, revokes object URLs, and renders disabled voice control. Extend it through focused hooks/components instead of pushing browser API logic directly into the route.
- `AttachmentPreview.tsx` and `MessageBubble.tsx`: Current media/file rendering can remain, but voice needs a dedicated player or a split preview component because audio states differ from image/file cards.
- `ConversationDetailContent.tsx`: Existing shared detail surface should render persisted voice assets only when the backend returns real data.
- `fixtureLeakGuard.test.ts`: Existing runtime guard should be extended to catch static voice, identity, and shared asset sample leakage.

### Established Patterns
- Backend routers stay thin; controllers and helpers own validation, authorization, persistence, response shaping, and socket side effects.
- Frontend API clients hide endpoint paths and transport options; hooks own server state, optimistic state, upload state, and query invalidation.
- Socket.IO identity and chat access must be authenticated and membership-checked server-side.
- Durable message state is canonical in TanStack Query and merges by durable `_id` plus `clientMessageId`.
- Unsupported controls must be hidden or honestly disabled; enabled inert controls are blocking failures.
- Production runtime must not synthesize fake pinned/shared/media/voice/detail data.
- Visual identity remains abstract and non-living. First-party defaults must not include humans, animals, plants, mascots, portraits, silhouettes, photos, or realistic avatars.
- Tests can use fixtures and mocked browser APIs, but production runtime code cannot import fixture/demo content.

### Integration Points
- Add `identityMark` schema fields, validation, serializer inclusion, route/controller/API client method, auth store update, and query invalidation.
- Extend attachment kind/type contracts across backend model, validation utility, frontend TypeScript types, message API, shared asset API, message bubble rendering, and detail surfaces.
- Add upload progress/cancel transport options in the API client and hook-level mutation orchestration.
- Add a voice recorder hook/component using `getUserMedia`, `MediaRecorder`, object URLs, Blob/File conversion, timer state, and cleanup.
- Add voice player rendering backed by protected asset routes and membership/delete visibility checks.
- Add socket/profile invalidation for identity changes and shared asset invalidation for voice/media/file changes.
- Extend block/delete enforcement tests so media and voice cannot bypass Phase 11 controls.
- Extend browser/component tests with mocked media APIs and synthetic blobs, avoiding real microphone hardware.

</code_context>

<specifics>
## Specific Ideas

- The user approved all recommendations from the Phase 12 one-shot questionnaire on 2026-06-13.
- The target behavior is a real messenger, not a static screenshot: every visible identity, media, file, and voice surface must be persisted, authorized, and recoverable.
- Identity customization should feel like Chatify's abstract geometric design language, not a social profile photo upload feature.
- Voice messages should be quiet and secure: record, preview, cancel, send, retry, play, pause, and fail honestly.
- Shared media/files/voice sections must disappear or show honest empty states when the backend returns no assets.
- Planning should start by verifying the Phase 11 dependency state because block-safe media/voice behavior depends on it.

</specifics>

<deferred>
## Deferred Ideas

- Live audio/video calls, WebRTC signaling, ringing, busy, missed, and ended call flows belong to Phase 13.
- Final deployed Vercel/Render production acceptance belongs to Phase 14.
- Audio transcription, semantic audio search, AI captions, server-side waveform analysis, antivirus scanning, external object storage migration, public media galleries, E2EE media, and arbitrary realistic identity uploads remain outside Phase 12.

</deferred>

---

*Phase: 12-live-media-voice-and-identity-implementation*
*Context gathered: 2026-06-13*
