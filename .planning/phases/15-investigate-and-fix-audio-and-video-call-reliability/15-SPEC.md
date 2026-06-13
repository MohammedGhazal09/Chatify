# Phase 15: Investigate and fix audio and video call reliability - Specification

**Created:** 2026-06-14
**Ambiguity score:** 0.08 (gate: <= 0.20)
**Requirements:** 15 locked

## Goal

Chatify audio and video calls move from locally tested but live-unproven or unreliable behavior to reproduced, repaired, and accepted two-account calls across local fake-media automation and configured production smoke, with production readiness blocked when required production environment or TURN evidence is unavailable.

## Background

Phase 13 implemented a real one-to-one call stack: backend call sessions and Socket.IO signaling in `Backend/Chatify/Config/socket.mjs`, call lifecycle utilities in `Backend/Chatify/Utils/callSessionState.mjs`, ICE configuration in `Backend/Chatify/Utils/callIceConfig.mjs`, frontend socket routing in `Frontend/Chatify/src/hooks/useChatSocket.ts`, WebRTC setup in `Frontend/Chatify/src/utils/webrtcCallSession.ts`, call orchestration in `Frontend/Chatify/src/hooks/useCallController.ts`, and visible call UI in `Frontend/Chatify/src/pages/chat/components/CallOverlay.tsx`.

The existing evidence is not enough to close this issue. Phase 13 passed local backend/frontend tests and a disabled-control smoke, but the live two-party fake-media happy path was skipped behind `CHATIFY_CALL_SMOKE=1`. Phase 14 added production audio/video acceptance checks, but the last recorded production live acceptance report was blocked before exercising calls because production smoke environment values were missing. The user has reported that the prior call and video-call fix attempt did not succeed. Phase 15 therefore must investigate first, identify the failing layer, implement the needed backend/frontend/UI/test fixes, and prove the repaired behavior with behavior-first evidence.

## Requirements

1. **Failure reproduction report**: Phase 15 must begin by reproducing or explicitly classifying the audio and video call failure before implementation changes are claimed.
   - Current: Phase 13 and Phase 14 artifacts show local mocked coverage and blocked/skipped live call paths, but no Phase 15 failure report exists.
   - Target: A Phase 15 failure report records local and, when configured, production call behavior for both audio and video, including whether failure occurs in media permission, WebRTC peer connection, ICE/TURN, Socket.IO signaling, backend session state, presence/reachability, UI state, CORS/cookies, or deployment configuration.
   - Acceptance: A verifier can open the Phase 15 failure report and see commands run, sanitized environment status, exact pass/fail observations for audio and video, and a failure classification for every unaccepted path.

2. **Investigation-first then implementation**: Implementation must follow the reproduction findings and every fix must trace back to an observed or high-confidence failure mode.
   - Current: The phase currently has only a roadmap entry and no traceability between user-reported call failure and code fixes.
   - Target: Phase 15 first investigates, then implements repairs. The final implementation summary maps each fix to a reproduction finding, blocked evidence item, or explicitly documented reliability gap.
   - Acceptance: The Phase 15 summary contains a fix-to-finding table; fixes without a linked finding are marked as preventive hardening with a concrete test proving why they are needed.

3. **Local two-account fake-media acceptance**: Local automation must prove a complete two-account audio and video call flow.
   - Current: `Frontend/Chatify/e2e/chat-calls.spec.ts` contains a skipped live two-party fake-media path unless an explicit smoke environment is provided.
   - Target: A deterministic local Playwright path starts the app against a local backend, signs in or seeds two authenticated users, opens the same direct chat in two browser contexts, starts audio and video calls, accepts from the callee, reaches connected state on both pages, ends the call, and verifies cleanup after reload.
   - Acceptance: `npm run test:ui` or a documented targeted Playwright command passes for both audio and video local fake-media happy paths without relying on static fixtures as the call source of truth.

4. **Production smoke acceptance or explicit block**: Production call readiness must be proven when smoke environment values are provided and explicitly blocked when they are not.
   - Current: `.planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md` records missing production smoke environment and readiness blocked.
   - Target: Phase 15 either runs the configured production smoke against real deployed frontend/backend origins and two disposable accounts, or writes a blocked production readiness result that names every missing env/config prerequisite.
   - Acceptance: A production acceptance artifact states `ready`, `failed`, or `blocked`; it includes sanitized frontend/backend origin, account presence, socket connection, and audio/video call rows without exposing credentials, cookies, SDP, ICE, or private message content.

5. **TURN and ICE readiness**: Production call behavior must not rely on an undocumented STUN-only path.
   - Current: `getCallIceConfig()` supplies a default STUN server and marks `productionReady` false when TURN configuration is missing.
   - Target: Production calls either use documented TURN configuration from environment or expose a clear disabled/blocking state that prevents false readiness claims.
   - Acceptance: Tests or production smoke evidence prove `CALL_TURN_URLS`, `CALL_TURN_USERNAME`, and `CALL_TURN_CREDENTIAL` are honored when configured; when missing in production, call controls or acceptance reports show a clear production readiness blocker.

6. **Backend signaling and session reliability**: Backend call sessions and socket signaling must converge reliably for valid calls and reject invalid calls truthfully.
   - Current: Backend call events and tests exist for start, accept, reject, end, timeout, busy, offline, authorization, blocking, and signal validation, but Phase 15 has not proven they match the observed failure.
   - Target: Backend call handling reliably creates, syncs, connects, rejects, ends, and cleans up call sessions for direct-message participants, including multi-tab, offline, blocked, stale, duplicate, and invalid signaling cases.
   - Acceptance: Backend socket tests pass for audio and video session start, incoming delivery, accept, offer, answer, ICE candidate forwarding, end, timeout, offline callee, busy user, multi-tab first-accept-wins, blocked conversation, stale call, cross-chat attempt, unauthorized socket, and oversized/invalid signaling payloads.

7. **Frontend call controller reliability**: The frontend call controller must not leave users stuck in outgoing, connecting, reconnecting, failed, or ended states.
   - Current: `useCallController.ts` handles media setup, socket acks, peer session creation, reconnect grace, setup timeout, unload cleanup, and terminal states, but the failed user outcome indicates this needs verification and possible repair.
   - Target: Every call state transition has a deterministic next state, local media is stopped on every terminal path, users can retry after failure/end, and socket or peer failures do not leave stale overlays or disabled controls.
   - Acceptance: Vitest coverage proves media success/failure, ack failure, offer/answer/ICE handling, setup timeout, reconnect timeout, beforeunload cleanup, block/auth loss cleanup, terminal-state retry, and no stale local/remote stream references after end.

8. **Audio call acceptance**: Audio calls must complete a microphone-only call path.
   - Current: Audio mode exists in code and local tests mock microphone access, but a full two-account call path has not been accepted in live-like automation.
   - Target: A caller can start an audio call, the callee receives an incoming audio call, the callee accepts, both sides show connected state, end works from either side, and both sides clean up after reload.
   - Acceptance: Local fake-media Playwright and, when configured, production smoke pass the complete audio flow; failure to reach connected or cleanup is a blocking failure.

9. **Video call acceptance and camera failure behavior**: Video calls must complete with fake camera/microphone, and camera failure must not silently become an audio call.
   - Current: `requestCallMedia('video')` can fall back to audio when camera capture fails, which risks making a Video call button start an audio call without an explicit user decision.
   - Target: Video call success uses camera and microphone; camera failure shows a clear video-specific failure or explicit audio retry choice instead of silently downgrading the requested video call.
   - Acceptance: Tests prove successful video calls show local preview on both participants, and camera-denied or camera-missing paths display explicit recovery copy without sending a hidden audio invite.

10. **Reachability and multi-tab truthfulness**: Calls must represent peer reachability honestly across online, offline, and multi-tab states.
    - Current: Backend call start checks reachable callee sockets and emits to all callee sockets, but live acceptance has not proven this under two real browser contexts.
    - Target: Offline recipients do not appear to ring, no missed-call activity is created when no authenticated socket received the invite, all callee tabs receive incoming state, first accepted tab wins, and other tabs converge without duplicate active calls.
    - Acceptance: Backend and Playwright tests verify offline unavailable behavior, no false missed call, multi-tab ringing, first accepted decision synchronization, and no duplicate active call sessions for either participant.

11. **Call UI and interaction repair, including redesign where needed**: Any call UI surface that prevents reliable or professional call use must be redesigned or replaced within this phase.
    - Current: Call UI exists through shared entry points and `CallOverlay`, but the reported failure means the UI may be contributing to blocked, misleading, stuck, or unprofessional call behavior.
    - Target: Header, detail rail/drawer, More menu, disabled reasons, incoming overlay, outgoing/connecting panel, connected controls, video surfaces, failure states, retry states, and cleanup states are redesigned as needed to make audio/video calls usable, truthful, accessible, and responsive.
    - Acceptance: Component tests and Playwright evidence prove every visible call/video control either completes its supported workflow or presents a specific accessible reason; desktop and mobile states have reachable controls, no trapped detail rail/drawer, no overlapping text, no stuck modal after end/reload, and no enabled no-op call controls.

12. **Security and authorization boundaries**: Call repair must preserve authenticated socket identity, direct-chat membership, block enforcement, and rate-limit protections.
    - Current: Phase 13 added server-authoritative call session checks and block behavior, but Phase 15 changes could regress them.
    - Target: Every call start, accept, reject, end, sync, offer, answer, and ICE candidate event remains scoped to authenticated socket identity and authorized direct-message participants.
    - Acceptance: Security-focused backend tests prove unauthenticated, non-member, cross-chat, stale, blocked, and rate-limited attempts fail with structured errors and do not notify unauthorized sockets.

13. **Privacy and logging controls**: Call repair must not persist or log sensitive WebRTC, device, auth, or account data.
    - Current: Existing call activity tests check metadata-only records, but Phase 15 investigation and new diagnostics could accidentally expose sensitive payloads.
    - Target: Diagnostics and artifacts use redacted IDs/statuses only; persisted call activity contains lifecycle metadata only; SDP, ICE candidates, media data, device labels, tokens, cookies, and full account identifiers are never persisted, logged, or written to artifacts.
    - Acceptance: Tests, scans, or review evidence confirm call activity serialization and Phase 15 artifacts exclude `sdp`, `candidate`, `ice`, `device`, `microphone`, `camera`, `token`, `cookie`, raw credential values, and full smoke account identifiers.

14. **Messenger regression protection**: Call fixes must not break core messenger behavior.
    - Current: The call stack shares Socket.IO, auth, presence, message timeline activity records, conversation controls, and route-level chat UI with message delivery and media/detail features.
    - Target: Message send/receive, delivery/read state, block/unblock, attachments, shared surfaces, and chat UI controls continue to work after call repairs.
    - Acceptance: Targeted backend and frontend regression commands pass for message state, call activity messages, blocking, attachments/pins, frontend chat tests, lint, build, and at least one behavior-first Playwright messenger smoke.

15. **Final evidence package and readiness decision**: Phase 15 completion must produce a durable acceptance package.
    - Current: Phase 15 has no SPEC, plan, investigation report, fix summary, or acceptance decision.
    - Target: Phase 15 ends with a summary and acceptance artifact containing the investigation result, implemented fixes, exact verification commands, local audio/video evidence, production readiness result, remaining blockers, and a clear final decision.
    - Acceptance: A verifier can read the Phase 15 artifacts and determine whether audio/video calls are accepted locally, accepted in production, failed, or blocked for missing external prerequisites.

## Boundaries

**In scope:**
- Investigation and reproduction of audio and video call failure across local full-stack and configured production smoke paths.
- Backend call session, Socket.IO signaling, authorization, reachability, timeout, cleanup, and activity-record repairs needed for reliability.
- Frontend WebRTC controller, media permission, peer connection, retry, cleanup, and socket event repairs needed for reliability.
- Call UI and interaction redesign wherever required to make call behavior truthful, accessible, responsive, and professional.
- Local Playwright two-account fake-media happy paths for both audio and video.
- Production Playwright two-account fake-media acceptance when production smoke env and credentials are provided.
- TURN/ICE readiness verification and honest blocking behavior when TURN is missing.
- Privacy-preserving diagnostics, failure report, implementation summary, and final acceptance artifact.
- Regression verification for shared messaging, presence, blocks, attachments, and chat UI behavior touched by call repairs.

**Out of scope:**
- Group calls or multi-party rooms - Phase 15 repairs direct-message one-to-one calling only.
- Screen sharing - separate feature, not required to restore basic call reliability.
- Recording, transcription, captions, or summaries - privacy-sensitive features outside the repair goal.
- Push notifications or native background calling - production call reliability here is limited to active authenticated browser sessions.
- Native iOS/Android call integration - Chatify currently targets the existing React/Vite web app.
- Device picker and mid-call audio/video upgrade or downgrade - excluded unless a minimal explicit audio retry is needed for video camera failure recovery.
- Replacing Socket.IO, Express, MongoDB, React, Vite, TanStack Query, Zustand, or Tailwind - broad stack replacement is outside the phase.
- Claiming production readiness without smoke env, two accounts, deployed origins, socket access, and TURN evidence - missing prerequisites must produce a blocked decision instead.

## Constraints

- Preserve the existing MERN, Socket.IO, React/Vite, TanStack Query, Zustand, Tailwind, and npm package layout.
- Do not use subagents.
- Do not hardcode TURN credentials or production account credentials.
- Do not quote or commit `.env` contents, cookies, JWTs, SDP bodies, ICE candidates, device labels, media data, or full smoke account identifiers.
- Production call readiness requires either working TURN configuration or an explicit documented blocker/honest unavailable state.
- Automated call acceptance must use deterministic fake microphone/camera media for repeatability.
- Browser call tests must run in a secure context or localhost/127.0.0.1, matching the WebRTC support guard.
- Implementation may edit call-related chat UI surfaces, including route integration, when required for reliability or professional UX, but unrelated local work must be preserved.
- Any Phase 15 production smoke must use disposable production-safe accounts and sanitized artifacts.

## Acceptance Criteria

- [ ] A Phase 15 failure report classifies audio and video behavior by failing layer or accepted path.
- [ ] Every implementation fix maps to a reproduction finding, blocked evidence item, or documented reliability gap.
- [ ] Local two-account fake-media Playwright audio call passes outgoing, incoming, accept, connected, end, and reload-cleanup states.
- [ ] Local two-account fake-media Playwright video call passes outgoing, incoming, accept, connected, local preview, end, and reload-cleanup states.
- [ ] Production smoke either passes both audio and video call acceptance against deployed origins or records a blocked/failed decision with exact sanitized blockers.
- [ ] TURN/ICE readiness is verified; production STUN-only calling is not claimed ready.
- [ ] Backend socket tests pass for valid lifecycle, signaling, offline, busy, multi-tab, stale, blocked, unauthorized, cross-chat, invalid payload, timeout, and cleanup paths.
- [ ] Frontend Vitest coverage passes for media requests, permission failures, explicit video camera failure handling, WebRTC signaling, reconnect/setup timeouts, cleanup, retry, and terminal states.
- [ ] Call UI tests and screenshots prove enabled controls are functional, disabled controls have accessible reasons, and no call overlay remains stuck after end, failure, or reload.
- [ ] Privacy checks prove artifacts, logs, and persisted call activity do not contain SDP, ICE candidates, media data, device labels, cookies, tokens, credentials, or full account identifiers.
- [ ] Regression checks pass for message delivery/state, conversation blocking, call activity timeline rows, attachments/shared surfaces, frontend lint, frontend build, and backend test targets.
- [ ] Final Phase 15 summary states local readiness, production readiness, remaining blockers, exact commands, and evidence paths.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.95  | 0.75  | met    | Outcome is concrete: reproduce, repair, and accept audio/video calls locally and in configured production smoke. |
| Boundary Clarity    | 0.90  | 0.70  | met    | Direct-message calls, reliability repairs, UI redesign where needed, and production blocker behavior are explicit. |
| Constraint Clarity  | 0.88  | 0.65  | met    | Stack, privacy, no-subagent, fake-media, TURN, production env, and local-work constraints are locked. |
| Acceptance Criteria | 0.92  | 0.70  | met    | Completion requires pass/fail reports, tests, production decision, and final evidence artifacts. |
| **Ambiguity**       | 0.08  | <=0.20| met    | Ready for discuss-phase and planning. |

Status: met = dimension meets minimum; below = planner treats as assumption.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What is Phase 15's core success target? | Treat audio and video as broken until real two-account fake-media flows prove outgoing, incoming, accept, connected, end, and cleanup. |
| 1 | Researcher | Should Phase 15 be investigation-first or implementation-first? | Investigation-first then implementation; fixes must follow reproduced or classified failures. |
| 1 | Researcher | Which environments must be covered? | Local full-stack two-browser fake-media is mandatory; production smoke is mandatory when env exists, otherwise blocked. |
| 1 | Researcher | What credentials/env are needed? | Two disposable accounts, deployed frontend/backend URLs, `CHATIFY_PRODUCTION_SMOKE=1`, and TURN env are needed for production proof. |
| 2 | Simplifier | Is TURN configuration in scope? | Yes; production must use TURN or honestly block/disable readiness. |
| 2 | Simplifier | Should video fall back to audio when camera access fails? | No silent downgrade; show a clear camera failure and offer explicit audio retry. |
| 2 | Simplifier | Should direct-message one-to-one remain the only supported call type? | Yes; group calls and adjacent call features remain out of scope. |
| 3 | Boundary Keeper | What should happen when the recipient is offline? | No fake ring or fake missed call; show unavailable when no authenticated socket receives the invite. |
| 3 | Boundary Keeper | How should multiple tabs/devices behave? | Ring all authenticated callee sockets; first accepted tab wins; other tabs sync and clean up. |
| 3 | Boundary Keeper | How strict should reconnect behavior be? | Recover short socket interruptions only; fail/end cleanly after grace timeout and allow retry. |
| 4 | Failure Analyst | What automated tests are required? | Backend socket tests, frontend Vitest, local Playwright two-account fake-media, and production Playwright when env exists. |
| 4 | Failure Analyst | Should real device/manual testing be required? | Add a manual real mic/camera checklist as supporting evidence; automated fake-media remains the blocking gate. |
| 4 | Failure Analyst | What privacy/logging boundary should be locked? | Never persist or log SDP, ICE, media, device labels, cookies, tokens, credentials, or full account identifiers. |
| 5 | Seed Closer | How much UI work is allowed? | Whatever call UI needs to be redesigned for reliable, professional calls must be redesigned. |
| 5 | Seed Closer | What artifact proves Phase 15 is complete? | Require a failure report, implementation summary, exact command results, screenshots/traces, and final readiness decision. |

---

*Phase: 15-investigate-and-fix-audio-and-video-call-reliability*
*Spec created: 2026-06-14*
*Next step: $gsd-discuss-phase 15 - implementation decisions (how to build what's specified above)*
