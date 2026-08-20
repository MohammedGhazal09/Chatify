# Phase 12: Live Media Voice And Identity Implementation - Specification

**Created:** 2026-06-13
**Ambiguity score:** 0.09 (gate: <= 0.20)
**Requirements:** 12 locked

## Goal

Chatify changes Phase 12 surfaces from static or partially wired media/identity controls into persisted, authorized workflows for abstract identity marks, attachment progress/cancel/retry, live shared media/files, and voice-message record/send/play behavior.

## Background

Phase 8 already added protected message attachments, GridFS-backed storage, membership-checked preview/download routes, attachment rendering, and shared asset APIs. That work makes media/files real, but Phase 12 must harden the remaining product behavior: shared media/files must never fall back to static placeholder cards, upload progress/cancel/retry must be explicit, and live updates must keep the detail surfaces synchronized after send, reload, search, pagination, and realtime events.

Identity is still weaker than the target state. The backend user model exposes `profilePic` as a string, OAuth providers can populate it, signup can accept it, and the frontend renders abstract identity tiles/profile values in several chat surfaces. There is no validated first-party identity settings flow that lets a user change an abstract identity mark and have it update consistently across the sidebar, chat list, header, message surfaces, and detail panel.

Voice messages are not implemented as a durable feature. The chat composer contains a disabled voice control, the shared message/attachment types do not include voice-specific metadata, and there is no record/preview/cancel/send/play/retry workflow. Phase 12 adds voice messages as persisted private conversation media without implementing live audio calls, video calls, WebRTC, or transcription.

Phase 12 depends on Phase 11 conversation controls and blocked-user safety. Phase 11 has spec, context, plans, review, and review-fix artifacts, but Phase 12 execution must not claim dependency readiness until the Phase 11 summary or equivalent final verification evidence exists.

## Requirements

1. **Dependency gate**: Phase 12 implementation must treat Phase 11 completion evidence as a prerequisite for execute-phase work that depends on block controls.
   - Current: Phase 11 has planning/review artifacts and review-fix evidence, but no final summary artifact is present in the phase directory.
   - Target: Phase 12 spec/discuss/plan may proceed, but execute-phase work must verify Phase 11 final evidence or explicitly document the dependency risk before changing block-dependent behavior.
   - Acceptance: The Phase 12 plan or execution artifact names the Phase 11 evidence it relies on, and no Phase 12 summary claims block-safe media/voice behavior without that evidence.

2. **Abstract identity settings**: Users can change their first-party Chatify identity mark through a validated profile/settings flow.
   - Current: User identity imagery is mainly a `profilePic` string from signup/OAuth and abstract tiles rendered from existing user data; no validated first-party identity mark editor exists.
   - Target: The account/profile settings surface lets the signed-in user choose or create a non-living abstract identity mark such as initials, monogram, geometric pattern, or color system, then persists it to the backend.
   - Acceptance: A signed-in user can change the abstract identity mark, reload the app, and see the new mark instead of the old one without touching static fixture data.

3. **Identity privacy and fallback**: First-party identity customization uses protected, validated data and has a deterministic fallback.
   - Current: `profilePic` can contain external provider imagery or a caller-supplied string, and fallback identity rendering is scattered across chat surfaces.
   - Target: First-party Chatify identity marks are stored as validated profile metadata or protected identity assets; arbitrary remote URL entry and bundled human, animal, plant, mascot, or realistic avatar defaults are out of scope. OAuth profile images may remain readable as legacy/provider data, but the new first-party customization path must default to abstract non-living marks.
   - Acceptance: Invalid identity payloads are rejected; a user without a first-party mark receives a deterministic abstract fallback; the app ships no first-party living-being identity assets for this flow.

4. **Identity propagation**: Identity changes update every chat surface that displays the current user or peer identity.
   - Current: Sidebar, chat list, header, message, and detail surfaces render identity values from existing query data and local component state, with no complete update flow after a profile identity change.
   - Target: After identity mutation succeeds, the current user tile, conversation list, selected conversation header, detail panel, message sender surfaces, user search/contact data, and relevant TanStack Query caches update without a full browser refresh.
   - Acceptance: A test changes a user's identity mark and verifies the new mark appears in all supported chat surfaces after mutation and still appears after reload.

5. **Attachment progress, cancellation, and retry**: Message attachment sends expose real send-state controls.
   - Current: The attachment picker and server-backed upload path exist, but Phase 12 still needs explicit progress, in-flight cancellation, and retry behavior aligned with the UI promises.
   - Target: Attachment sends show upload/sending progress, support cancellation before or during an in-flight request when the browser transport supports aborting, and retry failed sends without duplicating persisted messages.
   - Acceptance: Automated coverage proves a selected attachment can be cancelled before send, an in-flight upload can be aborted through the UI path, a failed upload can be retried, and retry does not create duplicate messages for one client send.

6. **Shared asset truth source**: Shared media and shared files are always derived from persisted attachment data.
   - Current: Phase 8 added shared asset APIs and UI wiring, but production concerns remain around static cards and fixture fallback in visible detail surfaces.
   - Target: Shared media/files panels render only server-returned persisted attachment assets or an honest empty/loading/error state. They update after attachment send, reload, search, pagination, and realtime message/attachment events.
   - Acceptance: Tests prove newly sent attachments appear in shared media/files without reload, survive reload, remain visible through pagination/search flows, and no static shared asset card is rendered when the API returns no assets.

7. **Voice message contract**: Voice messages are represented as persisted, authorized message media with voice-specific metadata.
   - Current: `AttachmentKind` supports file/media-style summaries, the backend attachment validator does not accept voice audio, and messages do not expose duration or voice playback metadata.
   - Target: Voice messages extend the message attachment contract with `kind: "voice"`, `durationMs`, audio mime type, size, status, protected playback/download identifiers, and optional waveform/client display metadata.
   - Acceptance: Backend and frontend type/API coverage prove a voice message can be created, fetched in history, received over realtime updates, and rendered with stable metadata after reload.

8. **Voice recording workflow**: The composer supports record, preview, cancel, send, and retry for voice messages.
   - Current: The voice composer control is disabled or unavailable, and there is no MediaRecorder-driven draft state.
   - Target: Supported browsers can record a WebM/Opus voice draft up to 2 minutes and 10 MB, preview it before send, cancel it without creating a message, send it as a private message attachment, and retry failed sends. Recording pause is out of scope; playback pause is in scope.
   - Acceptance: Frontend tests with mocked browser media APIs prove record, stop, preview, cancel, send, failed send, and retry states; backend tests reject oversize, over-duration, unsupported type, unauthorized, and blocked-conversation uploads.

9. **Voice permission and unsupported states**: Voice controls fail clearly and recoverably when recording or playback cannot proceed.
   - Current: The mic control does not expose complete permission, unsupported-browser, device, or playback states.
   - Target: The UI handles microphone permission denied, no input device, unsupported `MediaRecorder`, recording too short, recording too long, upload failure, playback loading, playback error, playing, paused, and retry states without losing the text draft or corrupting composer state.
   - Acceptance: Component or browser tests cover each recoverable state, and the UI never presents a false sent/delivered state for a voice message that failed to persist.

10. **Block, delete, and privacy integration**: Media, identity, and voice flows honor existing authorization and conversation safety rules.
   - Current: Phase 11 introduces block controls and backend/frontend enforcement, while Phase 12 media/voice surfaces must integrate with those rules.
   - Target: Blocked conversations disable new text, attachment, and voice sends in the UI and reject them on the backend; protected media/voice routes require chat membership; delete-for-everyone blocks playback/download and removes shared asset visibility; delete-for-self hides assets from that user according to existing message visibility rules.
   - Acceptance: Tests prove blocked users cannot send attachments or voice messages, unauthorized users cannot preview/download/play media or voice, delete-for-everyone makes protected asset routes unavailable, and delete-for-self hides assets only for the deleting user.

11. **Search and history behavior**: Media and voice integrate with message history and search without pretending to transcribe audio.
   - Current: Attachment metadata search guardrails exist, but voice messages do not have a defined search/history contract.
   - Target: History pagination includes media, file, and voice messages in chronological message order; search can match text captions, file/display names, and searchable metadata, but does not claim audio transcription or semantic audio search.
   - Acceptance: Tests prove voice messages appear in paginated history, attachment captions/names remain searchable when supported, and audio content is not presented as searchable transcript text.

12. **Verification and production boundary**: Phase 12 completion is proven with local/build/test evidence and does not claim final deployed production acceptance.
   - Current: Earlier local/UI evidence did not fully prove live deployed behavior, and production live acceptance is deferred to Phase 14.
   - Target: Phase 12 must pass targeted backend tests, frontend unit/component tests, browser smoke tests with mocked or synthetic media streams/blobs, lint, build, fixture/static-content guard checks, and an explicit summary of remaining production-live validation deferred to Phase 14.
   - Acceptance: The Phase 12 summary records exact command outcomes and evidence paths; no Phase 12 artifact claims the Vercel/Render production product is fully accepted without Phase 14 live evidence.

## Boundaries

**In scope:**
- First-party account/profile settings flow for changing abstract non-living identity marks.
- Identity persistence and cache propagation across sidebar, chat list, header, message surfaces, contact/user data, and detail panel.
- Attachment send-state hardening for progress, cancellation, abort, failure, and retry.
- Shared media/files panels backed only by persisted attachment data or honest empty/loading/error states.
- Voice message metadata, validation, persistence, history, realtime delivery, and protected playback/download.
- Composer voice workflow for record, preview, cancel, send, failed state, and retry.
- Playback states for voice messages, including loading, playing, paused, and error.
- Integration with Phase 11 block rules, membership checks, and delete visibility semantics.
- Automated backend, frontend, and browser evidence for identity, attachments, shared assets, voice, privacy, and production-build behavior.

**Out of scope:**
- Live audio calls and video calls - owned by Phase 13.
- WebRTC signaling, incoming call state, ringing, busy, missed, and ended call workflows - owned by Phase 13.
- Audio transcription, semantic audio search, captions generated from speech, or AI processing - separate media/AI scope.
- Server-side waveform analysis - optional future polish; Phase 12 may store client display metadata only if simple.
- Antivirus scanning or external object-storage migration - security/infrastructure scope beyond this phase.
- End-to-end encryption for media or voice - deferred v2 security capability.
- Public media galleries or public profile image galleries - Chatify conversation media remains private.
- Arbitrary first-party realistic human, animal, plant, mascot, or portrait identity uploads/defaults - excluded by the approved non-living identity policy and lack of semantic moderation in this phase.
- Final production live acceptance on Vercel/Render - owned by Phase 14, with Phase 12 limited to local/build/test and documented deploy-readiness evidence.

## Constraints

- Keep the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO realtime layer, TanStack Query, Zustand, Tailwind, and npm package layout.
- Preserve Phase 8 attachment limits unless a testable change is explicitly required: maximum 5 attachments per message and 10 MB per attachment.
- Voice MVP accepts browser-recorded WebM/Opus audio first, with a maximum duration of 2 minutes and maximum size of 10 MB.
- Media, files, voice, and first-party identity assets must not expose public object keys or unauthenticated URLs.
- All protected media/voice/identity routes must use cookie-authenticated requests and server-side membership/ownership checks.
- Logs must not include raw audio bytes, identity asset data, storage IDs, protected URLs, or sensitive profile/media metadata.
- Browser tests must not require real microphone hardware; use mocked `MediaRecorder`, mocked permissions, or synthetic Blobs.
- UI must work in desktop and mobile layouts, light and dark themes, keyboard/focus paths, and blocked/disabled/unsupported states.
- Existing unrelated local work, especially chat UI implementation files, must not be overwritten while writing this spec.

## Acceptance Criteria

- [ ] Phase 12 planning/execution artifacts name the Phase 11 dependency evidence used before implementing block-dependent media or voice behavior.
- [ ] A signed-in user can change a first-party abstract identity mark through settings/profile UI and see it persist after reload.
- [ ] Identity changes update sidebar, chat list, header, message surfaces, user/contact data, and detail panel without full browser refresh after the mutation.
- [ ] Invalid identity customization payloads are rejected, and users without a first-party mark receive deterministic abstract fallback imagery.
- [ ] Attachment sends expose progress, pre-send cancel, in-flight abort where supported, failed state, and retry without duplicate persisted messages.
- [ ] Shared media/files panels render only persisted server assets or honest empty/loading/error states; no static placeholder shared asset cards appear in production UI paths.
- [ ] Newly sent attachments appear in shared media/files after send and remain correct after reload, search, pagination, and realtime update paths.
- [ ] Voice messages can be recorded, previewed, cancelled, sent, reloaded from history, received through realtime updates, played, paused, and retried after failure.
- [ ] Voice permission denied, unsupported browser, no input device, too-short, too-long, upload failure, and playback failure states are recoverable and do not corrupt the text draft.
- [ ] Blocked or unauthorized users cannot send, preview, download, or play protected media/voice assets outside their permitted conversation scope.
- [ ] Delete-for-everyone blocks protected media/voice playback/download and removes shared asset visibility; delete-for-self hides assets only for that user.
- [ ] Backend tests, frontend tests, browser smoke tests with mocked/synthetic media, lint, build, and fixture/static-content guard checks are recorded in the Phase 12 summary.
- [ ] Phase 12 artifacts do not claim final deployed production acceptance; any live Vercel/Render acceptance remains deferred to Phase 14.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.92  | 0.75  | Met    | Approved scope covers identity, attachments, shared assets, and voice workflows. |
| Boundary Clarity    | 0.93  | 0.70  | Met    | Phase 13 calls/video, transcription, arbitrary realistic identity uploads, and Phase 14 production acceptance are excluded. |
| Constraint Clarity  | 0.86  | 0.65  | Met    | Stack, privacy, voice format, duration, size, test-media, and no-public-URL constraints are explicit. |
| Acceptance Criteria | 0.90  | 0.70  | Met    | Pass/fail checks cover identity, media, voice, privacy, block/delete integration, and verification evidence. |
| **Ambiguity**       | 0.09  | <=0.20| Met    | Gate passed after global approval of recommendations. |

Status: Met = dimension reached minimum; Below minimum = planner treats as assumption.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What already exists for attachments, identity, shared assets, and voice? | Phase 8 attachments/shared assets exist and are hardened here; identity update and voice messaging are new Phase 12 work. |
| 1 | Researcher | Should Phase 12 proceed despite Phase 11 artifact state? | Spec/discuss/plan may proceed; execute-phase must verify Phase 11 final evidence before block-dependent claims. |
| 2 | Simplifier | What is the minimum viable identity scope? | First-party identity customization is abstract and non-living; arbitrary realistic profile-photo uploads/defaults are out of scope. |
| 2 | Simplifier | What is the minimum viable voice scope? | Record, preview, cancel, send, retry, reload, play, and pause playback are in scope; recording pause and calls are out of scope. |
| 3 | Boundary Keeper | What media/file work is new rather than a Phase 8 rebuild? | Add progress/cancel/retry and prove shared panels are persisted/live, not static; do not rebuild the storage stack unnecessarily. |
| 3 | Boundary Keeper | Should voice appear in shared assets? | Voice is persisted as protected media with voice metadata; separate voice panels are not required unless later planning chooses them. |
| 4 | Failure Analyst | What failures would make Phase 12 unacceptable? | Static shared cards, false sent/delivered states, duplicate sends, unauthorized asset access, broken blocked-user rules, and real-mic-only tests are reject conditions. |
| 5 | Seed Closer | What production claim is allowed? | Phase 12 records local/build/test evidence only; final deployed production acceptance remains Phase 14. |

---

*Phase: 12-live-media-voice-and-identity-implementation*
*Spec created: 2026-06-13*
*Next step: $gsd-discuss-phase 12 - implementation decisions (how to build what is specified above)*
