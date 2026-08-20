# Phase 12 Research: Live Media Voice And Identity Implementation

## Status

Research complete. Phase 12 has enough product and technical context to plan the implementation, but plan-file creation is blocked by the UI design contract gate because `12-UI-SPEC.md` is not present.

Recommendation: run `$gsd-ui-phase 12` next, then rerun `$gsd-plan-phase 12` to create the actual implementation plans. Do not create `12-01-PLAN.md` or later plan files until the UI spec exists.

## Scope

Phase 12 turns identity marks, upload send-state behavior, shared media/files, and voice messages into real persisted workflows:

- users can change a first-party abstract, non-living identity mark through a protected settings/profile flow
- attachment sends expose real progress, cancellation, abort, failure, and retry states
- shared media/files render only persisted server assets or honest empty/loading/error states
- voice messages can be recorded, previewed, cancelled, sent, reloaded, played, paused, and retried
- all media, identity, and voice behavior honors membership, blocked-user controls, delete visibility, authenticated routes, and production fixture guards

Out of scope remains live audio/video calls, WebRTC signaling, transcription, public galleries, arbitrary realistic profile imagery, external object storage migration, antivirus scanning, E2E media encryption, and final deployed production acceptance.

## Skills Used

- `gsd-plan-phase`: phase research, plan gating, validation expectations, and UI-contract stop condition.
- `find-skills`: selected the local skill set without installing extra tools.
- `react-best-practices`: component and hook boundaries for recorder, player, composer, settings, and cache state.
- `api-and-interface-design`: REST and payload contract shape for identity, upload options, shared assets, and voice metadata.
- `webapp-testing`: browser/component evidence strategy with mocked media APIs and synthetic blobs.
- `privacy-by-design`: private media/identity data minimization, protected URLs, and log exclusions.
- `websocket-engineer`: room/event boundaries, authenticated emits, and HTTP-only canonical creation.
- `vitest-testing`: backend/frontend unit and component test strategy.
- `mongodb`: attachment storage and metadata/index implications.

## External Findings

### Browser Voice Capture

Source: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder

`MediaRecorder` is the correct browser primitive for recording audio from a `MediaStream`. The planner should require runtime support checks through `MediaRecorder.isTypeSupported()` and choose a MIME type before recording. `start()` can receive a timeslice so data is collected in chunks; `dataavailable`, `stop`, and `error` events drive draft creation and failure handling.

Recommendation:

- Add a `useVoiceRecorder` hook that checks `window.isSecureContext`, `navigator.mediaDevices`, `navigator.mediaDevices.getUserMedia`, `window.MediaRecorder`, and a supported MIME type before enabling the mic control.
- Prefer `audio/webm;codecs=opus`, then `audio/webm`, then `audio/ogg;codecs=opus` only if supported by the current browser.
- Keep recording pause out of scope, but support playback pause.
- Stop tracks and revoke object URLs on cancel, send, component unmount, and selected-chat changes.

### Microphone Permission And Unsupported States

Source: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

`getUserMedia()` returns a promise resolving to a `MediaStream`; denied permission or unavailable matching devices reject with browser errors such as `NotAllowedError` or `NotFoundError`. The API is available only in secure contexts, and the user can ignore the permission prompt.

Recommendation:

- Treat secure context, permission denied, no input device, inactive document, ignored prompt timeout, and browser unsupported as first-class composer states.
- Tests should mock `navigator.mediaDevices.getUserMedia`, `MediaRecorder`, permission failures, and synthetic `Blob` outputs. They must not require real microphone hardware.

### Upload Abort And Progress

Sources:

- https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- https://axios-http.com/docs/cancellation
- https://axios-http.com/docs/req_config

`AbortController` provides a signal to abort requests. Axios supports passing `signal` to cancel requests and supports `onUploadProgress` for upload progress callbacks.

Recommendation:

- Extend `messageApi.createMessage(payload, options)` to accept `signal` and `onUploadProgress`.
- Keep Axios usage inside `messageApi`; UI components should not call transport directly.
- Put upload state in `useSendMessage` or a focused adjacent hook, keyed by `clientMessageId`.
- Same-session retry should reuse the local `File`/`Blob` and same `clientMessageId`; after reload, the UI must ask the user to reattach or re-record because file handles are not recoverable.

### Server State And Realtime Invalidation

Sources:

- https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
- https://socket.io/docs/v4/rooms/

TanStack Query invalidation marks matching queries stale and refetches active queries. Socket.IO rooms are server-side channels; the server can emit to a chat room with `io.to(room).emit(...)`.

Recommendation:

- Keep HTTP message creation canonical. Sockets only broadcast persisted events and drive cache invalidation.
- Extend `message:new` payloads to include voice attachment summaries; the existing frontend socket hook already invalidates shared assets when attachments are present.
- Add a small `user:identity-updated` or `profile:identity-updated` event after a protected identity mutation, emitted only to affected users/chat rooms. The frontend should invalidate auth/user/chats/messages/detail queries instead of mutating disconnected UI copies.
- Do not create media or voice messages through Socket.IO.

### Protected Binary Storage

Source: https://www.mongodb.com/docs/drivers/node/current/crud/gridfs/

GridFS stores large files in chunks plus file metadata and supports upload and retrieval through a bucket. Chatify already has a GridFS-backed attachment storage service.

Recommendation:

- Reuse `Backend/Chatify/Services/attachmentStorageService.mjs` for voice bytes unless implementation proves a blocker.
- Keep playback/download behind authenticated backend routes; do not expose public object keys, storage ids, or unauthenticated URLs.
- Keep 10 MB maximum size for voice MVP and store duration as trusted-enough display metadata supplied by the client, with server-side range validation. Server-side waveform/duration decoding remains out of scope.

## Codebase Findings

### Existing Attachment Contract

Files inspected:

- `Backend/Chatify/Models/attachmentModel.mjs`
- `Backend/Chatify/Utils/attachmentValidation.mjs`
- `Backend/Chatify/Controller/messageController.mjs`
- `Backend/Chatify/Routes/messageRouter.mjs`
- `Backend/Chatify/Services/attachmentStorageService.mjs`
- `Backend/Chatify/Utils/messageState.mjs`
- `Frontend/Chatify/src/types/chat.ts`
- `Frontend/Chatify/src/api/messageApi.ts`
- `Frontend/Chatify/src/hooks/useChatQueries.ts`
- `Frontend/Chatify/src/hooks/useChatSocket.ts`
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx`
- `Frontend/Chatify/src/pages/chat/components/AttachmentPreview.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx`

Current state:

- Attachment model `kind` supports only `media` and `file`.
- Backend validation allowlist supports image/document extensions only.
- `normalizeSharedAssetKind()` accepts only `media` or `file`.
- `serializeAttachmentSummary()` coerces anything other than `media` to `file`, so voice would silently become a file unless changed.
- Frontend `AttachmentKind` and `SharedAssetKind` are `media | file`.
- `messageApi.createMessage()` builds `FormData` but has no upload progress or abort option.
- `useSendMessage()` already uses optimistic messages and idempotent `clientMessageId`, which is the correct retry anchor.
- `useChatSocket()` already invalidates shared asset queries when a message has attachments.
- `AttachmentPreview` renders image previews or file cards only; voice needs a dedicated player path.
- `MessageComposer` has a disabled mic button with "Voice message unavailable in this phase".

Recommendation:

- Extend the shared attachment contract in one slice: backend enum, validation allowlist, summary serializer, shared-asset kind, frontend types, API response types, preview/playback helper, message bubble renderer, and detail panel.
- Add `voiceMetadata` or a narrow `metadata.voice` object on attachments with `durationMs`, optional `waveform`/display samples, and optional `recordedMimeType`.
- Do not overload generic file rendering for voice. Add `VoiceMessagePlayer` and voice draft/preview components.

### Existing Message Creation And Idempotency

Current state:

- `newMessage` validates chat membership, applies Phase 11 `assertConversationActivityAllowed()`, validates attachments, normalizes text, requires `clientMessageId`, and checks existing messages for idempotent retry.
- Existing `attachmentFingerprint` includes display name, MIME type, size, and hash.
- `finalizeMessageCreate()` emits `message:new` after persistence and updates unread counts.

Recommendation:

- Preserve `clientMessageId` as the duplicate-prevention key for text, file, media, and voice sends.
- Include voice metadata in the idempotency fingerprint only if it materially changes the persisted message. At minimum the audio bytes hash and MIME/size must be part of the fingerprint.
- Do not mark a voice or attachment send as delivered until the canonical HTTP response or `message:new` event includes the persisted message.

### Existing Delete And Protected Access Behavior

Current state:

- Protected preview/download routes load attachments only after authenticated membership and visible-message checks.
- Delete-for-everyone sets message attachments and `Attachment` records to `deleted`.
- Shared asset listing filters active attachments and visible messages.

Recommendation:

- Reuse these protected routes for voice playback, optionally adding a readability alias such as `getAttachmentPlaybackUrl()`.
- Ensure `loadVisibleAttachmentForUser()` and shared asset list behavior still reject deleted-for-everyone and hidden-for-self voice assets.
- Add explicit tests that delete-for-everyone blocks audio playback/download and removes voice from shared asset/detail surfaces.

### Existing Identity Contract

Files inspected:

- `Backend/Chatify/Models/userModel.mjs`
- `Frontend/Chatify/src/types/auth.ts`
- `Frontend/Chatify/src/api/userApi.ts`
- `Frontend/Chatify/src/store/authstore.ts`
- chat identity rendering surfaces referenced in `12-CONTEXT.md`

Current state:

- User schema has `profilePic` as a string, plus auth provider fields and online/privacy fields.
- Frontend `User` type exposes `profilePic` but no first-party identity mark metadata.
- `userApi` has online users, privacy settings, and all-users calls, but no identity mutation.
- Chat UI uses abstract identity tile rendering, but there is no backend-persisted first-party customization path.

Recommendation:

- Add validated `identityMark` metadata to `User`, for example `{ label, paletteId, patternId, accentId }`, plus `identityMarkUpdatedAt`.
- Keep `profilePic` as legacy/provider fallback only.
- Add protected `PATCH /api/user/identity` in `userRouter.mjs` and `userController.mjs`.
- Return a sanitized user identity payload and update auth store plus relevant TanStack Query caches after mutation.
- Emit targeted identity update/invalidation to affected peers.

### Existing Test Surface

Files and commands found:

- Backend: `npm test` in `Backend/Chatify` runs Vitest through `vitest.config.mjs`.
- Frontend: `npm run test`, `npm run lint`, `npm run build`, and `npm run test:ui`.
- Backend tests already cover attachments, shared assets, idempotency, blocking, sockets, mutations, search, and pagination.
- Frontend tests include composer, conversation detail drawer/content, header, pane, message action menu, and fixture leak guard.
- Playwright E2E specs exist under `Frontend/Chatify/e2e`.

Recommendation:

- Backend tests should extend the existing message/attachment/shared-asset/block/socket suites rather than start a separate media stack.
- Frontend tests should add mocked `MediaRecorder`, mocked `getUserMedia`, synthetic `Blob`/`File`, upload progress, abort, retry, player, and identity cache-propagation coverage.
- Extend `fixtureLeakGuard.test.ts` to block static voice, static shared media/files, hardcoded screenshot identities, first-party living-being identity defaults, storage ids, public object keys, and raw hashes in production runtime code.

## Recommended Implementation Architecture

### Slice 1: Identity Contract, Settings, And Propagation

Goal: users can change a first-party abstract identity mark and see it update everywhere without refresh.

Core work:

- backend `identityMark` schema, validation helper, serializer, protected route, controller, tests
- frontend `IdentityMark` type, user API method, settings/profile UI, auth-store update, query invalidation
- chat identity surfaces consume the same sanitized identity shape and deterministic fallback
- socket identity update event or targeted invalidation for peers

Recommendation: implement this first because it is relatively independent from media storage and gives the UI spec a concrete settings surface to target.

### Slice 2: Attachment Progress, Abort, Retry, And Voice Contract

Goal: the transport and persistence contract can carry file/media/voice with correct state.

Core work:

- extend attachment kind and metadata from `media | file` to `media | file | voice`
- add voice validation allowlist and metadata validation
- extend create-message API options for progress and abort
- add hook-level upload/voice send state keyed by `clientMessageId`
- preserve duplicate prevention across failed/retried sends
- add backend and frontend tests for progress/cancel/retry and voice persistence

Recommendation: do this before building the full recorder UI because UI behavior needs the durable contract and retry semantics first.

### Slice 3: Recorder, Player, Shared Assets, Realtime, Privacy, And Evidence

Goal: voice and shared assets are usable across desktop/mobile, light/dark, realtime, reload, delete, blocked, and privacy paths.

Core work:

- `useVoiceRecorder`, recorder tray, voice draft preview, voice send/cancel/retry
- `VoiceMessagePlayer`, playback loading/error/play/pause state
- detail panel voice/shared asset rendering from server data only
- search/history behavior for attachments and voice metadata without transcription claims
- delete-for-everyone/self behavior, blocked-conversation UI/backend enforcement, protected playback/download checks
- fixture/static guard expansion, browser smoke with mocked media APIs, lint/build evidence

Recommendation: implement this last because it depends on the identity and attachment/voice contracts being stable.

## Validation Architecture

### Test Infrastructure

| Layer | Framework | Command |
|-------|-----------|---------|
| Backend unit/integration | Vitest + Supertest + mongodb-memory-server | `npm test -- --runInBand` from `Backend/Chatify` if supported, otherwise `npm test` |
| Frontend unit/component | Vitest + Testing Library + jsdom | `npm run test` from `Frontend/Chatify` |
| Frontend lint | ESLint | `npm run lint` from `Frontend/Chatify` |
| Frontend build | TypeScript + Vite | `npm run build` from `Frontend/Chatify` |
| Browser smoke | Playwright | `npm run test:ui` or targeted Playwright specs from `Frontend/Chatify` |

### Per-Slice Verification Map

| Slice | Requirements | Automated verification |
|-------|--------------|------------------------|
| 12-01 identity | ID-01, ID-02, TEST-05 | backend identity validation/mutation tests, frontend settings mutation/cache tests, fixture guard, build/lint |
| 12-02 upload and voice contract | MEDIA-01, MEDIA-02, VOICE-01, VOICE-02 | backend attachment/voice validation and idempotency tests, frontend API/hook progress/abort/retry tests |
| 12-03 shared assets and UX evidence | MEDIA-04, VOICE-01, VOICE-02, TEST-05, Phase 11 block dependency | shared asset/update/delete tests, blocked media/voice tests, socket invalidation tests, mocked media browser smoke, static guard, lint/build |

### Required Failure Coverage

- invalid identity payload rejected
- deterministic abstract fallback for users without first-party identity mark
- no first-party living-being identity defaults
- upload cancelled before send
- upload aborted in flight
- failed upload/voice retry uses same `clientMessageId` and does not duplicate persisted messages
- unsupported voice MIME rejected
- oversize and over-duration voice rejected
- permission denied, no device, unsupported browser, too short, too long, network failure, and playback error states are recoverable
- blocked conversations reject text, media, and voice sends on the backend and disable composer/media/voice UI on the frontend
- unauthorized users cannot preview/download/play protected assets
- delete-for-everyone blocks preview/download/playback and removes assets from detail panels
- delete-for-self hides assets only for the deleting user
- no static shared file/media/voice cards or fake counts in production runtime

### Manual Or Production-Defer Verification

Final deployed Vercel/Render acceptance remains Phase 14. Phase 12 should not claim production readiness beyond local/build/test evidence and deploy-readiness notes.

## Dependency And Gate Risks

1. Phase 11 final summary is missing.
   - Risk: Phase 12 depends on conversation controls and block behavior.
   - Recommendation: Phase 12 execution must verify `11-REVIEW-FIX.md` and any current test evidence, or require a `11-SUMMARY.md`, before claiming block-safe media/voice behavior.

2. `12-UI-SPEC.md` is missing.
   - Risk: plan-phase UI safety gate blocks implementation plan creation for a frontend-heavy phase.
   - Recommendation: run `$gsd-ui-phase 12` before creating plan files.

3. The worktree is dirty with unrelated implementation changes from prior phases.
   - Risk: planning docs could accidentally stage implementation edits.
   - Recommendation: stage and commit only Phase 12 planning artifacts from this research pass.

4. Browser voice APIs are capability-dependent.
   - Risk: a visually enabled mic can still fail in unsupported/insecure contexts.
   - Recommendation: support detection and honest disabled states must be part of the first UI implementation wave.

5. Server-side voice duration cannot be fully trusted without media decoding.
   - Risk: client-supplied duration may be inaccurate.
   - Recommendation: Phase 12 should enforce MIME and size server-side, validate duration range as metadata, and keep server-side duration/waveform decoding as future scope unless required by review.

## Research Outcome

Phase 12 should be planned in three implementation slices after the UI spec is available:

1. `12-01`: Identity contract, settings UI, cache propagation, and identity update events.
2. `12-02`: Attachment progress/abort/retry plus voice attachment contract and persistence.
3. `12-03`: Recorder/player UX, shared asset truth source, block/delete/privacy integration, static guards, and evidence.

Recommendation: keep these slices separate. A single broad implementation plan would hide too much risk across backend validation, browser media APIs, realtime cache invalidation, and UI state.

## Sources

- MDN MediaRecorder: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- MDN getUserMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN AbortController: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- Axios cancellation: https://axios-http.com/docs/cancellation
- Axios request config: https://axios-http.com/docs/req_config
- TanStack Query invalidation: https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
- Socket.IO rooms: https://socket.io/docs/v4/rooms/
- MongoDB GridFS Node driver: https://www.mongodb.com/docs/drivers/node/current/crud/gridfs/
