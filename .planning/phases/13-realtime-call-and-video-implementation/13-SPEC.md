# Phase 13: Realtime Call And Video Implementation - Specification

**Created:** 2026-06-13
**Status:** Spec complete
**Phase Directory:** `.planning/phases/13-realtime-call-and-video-implementation`
**Roadmap Goal:** Users can start, receive, accept, reject, and end authenticated one-to-one audio and video calls from messenger controls with reliable state, permission handling, and blocked-user safety.
**Requirements:** CALL-01, CALL-02, CALL-03, CALL-04, BLOCK-02, RT-01, RT-02, TEST-02, TEST-05

## Executive Summary

Phase 13 turns Chatify's currently disabled call and video controls into a real, reliable one-to-one calling surface. The work covers browser WebRTC media setup, authenticated Socket.IO signaling, server-authoritative call session state, permission and device handling, blocked-user enforcement, accessible call UI, lifecycle recovery, and test coverage.

This phase is not another static UI pass. Every visible call surface in the messenger must either initiate a real supported flow or show an honest unavailable/error state. Header controls, detail rail/drawer actions, and More menu actions must all share the same call orchestration instead of independent placeholders.

## Background

Current call and video controls are present in the interface but intentionally disabled or static:

- `ConversationHeader` renders call and video buttons as unavailable.
- `ConversationDetailContent` shows Call and Video call actions without working handlers.
- `ConversationMoreMenu` contains disabled Call and Video call menu items.
- Existing tests assert that these controls are disabled, which must be replaced with functional behavior tests.
- The chat socket layer currently handles authenticated messaging, presence, typing, pins, blocks, and message lifecycle events, but it has no call signaling events.
- Backend socket membership and block helpers already provide a security foundation that Phase 13 must reuse for call authorization.

The approved direction is to implement one-to-one audio and video calls for direct messages only, with production readiness blocked if real TURN configuration is missing.

## Goals

1. Enable authenticated one-to-one audio calls from every call control.
2. Enable authenticated one-to-one video calls from every video call control.
3. Add a server-authoritative call session lifecycle over Socket.IO.
4. Use browser WebRTC for media, with configurable STUN/TURN servers.
5. Handle browser permissions, missing devices, peer offline state, busy state, timeout, reconnect, and tab lifecycle without stuck UI.
6. Enforce chat membership and blocked-user rules for every call attempt and signaling event.
7. Add accessible, responsive call UI for desktop and mobile.
8. Prove behavior with backend socket tests, frontend state/component tests, and Playwright fake-media smoke coverage.

## Non-Goals

1. Group calls.
2. Screen sharing.
3. Call recording.
4. Transcription, captions, or summaries.
5. Push notifications or native background calling.
6. Call analytics dashboard.
7. End-to-end encrypted media beyond standard WebRTC transport security.
8. Production live acceptance with real deployed TURN credentials. That belongs to Phase 14 unless this phase explicitly receives working production credentials and deployment access.
9. Replacing Socket.IO, React, Vite, Express, MongoDB, TanStack Query, Zustand, or Tailwind.

## Scope

### In Scope

- Direct-message audio-only calls.
- Direct-message video-with-audio calls.
- Call entry points from conversation header, details rail/drawer, and More menu.
- Incoming call banner/overlay.
- Outgoing/ringing/connecting/connected call panel.
- Active call controls: mute/unmute microphone, turn camera on/off for video calls, end call.
- Local preview for video calls.
- Remote stream state and fallback states.
- Server-owned call session identifiers and lifecycle acknowledgements.
- Lightweight call activity records for missed, rejected, ended, and failed call outcomes.
- Socket reconnect handling for ringing and outgoing call states.
- Safe end behavior for active media on refresh, unload, or prolonged disconnect.
- Backend and frontend tests with mocked media and WebRTC APIs.
- Playwright smoke using fake media devices where browser support allows it.

### Out of Scope

- Multi-party rooms.
- Device picker.
- Mid-call upgrade from audio to video or downgrade from video to audio.
- Screen share.
- Recording.
- Real media relay implementation inside Chatify.
- Native mobile background call handling.
- Push notification ringing when the recipient is offline.

## Functional Requirements

### REQ-13-001: Dependency Gate

Phase 13 spec, discuss, and plan work may proceed before Phases 10.1, 11, and 12 have final summaries. Phase 13 execution must not claim completion until the executor verifies final evidence from Phases 10.1, 11, and 12 and records any integration-impacting dependency findings in the Phase 13 summary.

**Recommendation:** Keep this as a hard execution gate because calling depends on reliable messaging, relationship controls, and production readiness behavior.

### REQ-13-002: Functional Call Entry Points

The conversation header call button, conversation header video button, detail rail/drawer Call action, detail rail/drawer Video call action, More menu Call item, and More menu Video call item must all invoke the same call orchestration flow for the selected direct message chat.

Each entry point must be enabled only when the current user, selected chat, browser capability, and relationship state allow the attempted call. Disabled or failed states must be explicit and actionable.

**Acceptance Evidence:** Frontend tests verify every call surface triggers the shared call flow or shows a specific unavailable reason.

### REQ-13-003: One-To-One Call Scope

The system must support only one-to-one direct-message calls in Phase 13. The call mode must be either `audio` or `video`. A video call includes audio. Group chats, multiple recipients, and mid-call mode changes are not supported.

**Acceptance Evidence:** Backend and frontend tests reject or hide call attempts outside direct-message conversations.

### REQ-13-004: Server-Authoritative Call Sessions

The backend must create and own a call session record or equivalent durable metadata object containing at least:

- `callId`
- `chatId`
- `callerId`
- `calleeId`
- `mode`
- `status`
- `startedAt`
- `ringingAt`
- `answeredAt`
- `endedAt`
- `endedReason`

The server must acknowledge valid state transitions and reject invalid, stale, duplicate, unauthorized, blocked, or cross-chat transitions.

**Acceptance Evidence:** Backend socket tests cover valid and invalid transition paths.

### REQ-13-005: Authentication, Membership, And Block Enforcement

Every call invite, accept, reject, end, timeout, busy, WebRTC offer, WebRTC answer, and ICE candidate event must be scoped to authenticated socket identity and verified chat membership. Blocked-user state must prevent new call attempts and inappropriate realtime call events across HTTP and Socket.IO.

**Acceptance Evidence:** Tests prove blocked users cannot initiate, receive, or continue call signaling after a block is active.

### REQ-13-006: WebRTC Signaling

The frontend must use browser WebRTC APIs for media sessions. Socket.IO must carry signaling messages between authorized direct-message participants. The application must not hardcode STUN/TURN credentials. ICE server configuration must come from environment or safe server-provided configuration.

Production readiness is blocked if TURN configuration is absent or undocumented.

**Acceptance Evidence:** Build-time and runtime configuration checks document whether production TURN is configured, and tests verify signaling is chat-scoped.

### REQ-13-007: Permission And Device Handling

Audio calls must request microphone permission before sending an outgoing invite and before accepting an incoming invite. Video calls must request microphone and camera permissions before sending an outgoing invite and before accepting an incoming invite.

If camera access fails for a video call but microphone access is available, the UI must offer audio call as a fallback instead of silently failing. If microphone access fails, the call must move to `permission_denied` or `failed` with a clear recoverable message.

**Acceptance Evidence:** Frontend tests mock `navigator.mediaDevices` success, denial, missing camera, and missing microphone paths.

### REQ-13-008: Lifecycle State Machine

The call state machine must support these states:

- `idle`
- `permission_requested`
- `outgoing`
- `incoming`
- `ringing`
- `connecting`
- `connected`
- `reconnecting`
- `rejected`
- `missed`
- `busy`
- `permission_denied`
- `failed`
- `ended`

The backend must enforce one active or ringing call per user. New attempts while either participant is busy must return `busy`. Ringing calls must time out after 30 seconds and become `missed` unless answered, rejected, failed, or ended earlier.

**Acceptance Evidence:** Unit or integration tests cover each state and invalid transition.

### REQ-13-009: Offline Peer Behavior

If the intended recipient is offline or has no authenticated reachable socket, Chatify must not show a successful live ring. The caller must see an unavailable or missed outcome, and the UI must not claim delivery of a call invite that was not actually delivered to a reachable peer.

**Acceptance Evidence:** Backend socket tests simulate absent recipient sockets and verify the caller receives a truthful outcome.

### REQ-13-010: Responsive Call UI

The call UI must match the Chatify messenger visual language for light and dark themes while remaining functional:

- Desktop incoming call uses a compact overlay or banner.
- Desktop active call uses a centered or prominent panel without blocking unrelated nav controls unnecessarily.
- Mobile incoming and active call states use a full-screen overlay.
- The right detail rail/drawer must remain closable and must not trap the user behind call controls.
- The UI must not use humans, animals, avatars of living beings, or generated life imagery for call visuals.

**Acceptance Evidence:** Playwright screenshots or smoke assertions cover desktop and mobile call entry states in both themes where practical.

### REQ-13-011: Connected Call Controls

Connected calls must support:

- Mute and unmute microphone.
- Turn camera off and on during video calls.
- End call.
- Local video preview for video calls.
- Remote stream connected, waiting, interrupted, and ended states.

Screen sharing, recording, device picker, and mid-call mode switch controls must not be introduced in Phase 13.

**Acceptance Evidence:** Frontend tests verify controls update local media tracks and UI state without requiring real devices.

### REQ-13-012: Reconnect, Refresh, And Unload Behavior

A short socket reconnect may recover ringing or outgoing state if the server still considers the call active. Active media sessions must end safely on page refresh, tab close, logout, prolonged disconnect, or fatal socket disconnect. The peer must receive an ended or failed state when possible.

**Acceptance Evidence:** Tests or documented smoke evidence cover reconnect recovery and unload cleanup behavior.

### REQ-13-013: Call Activity Records

Chatify must add lightweight system activity records for missed, rejected, ended, and failed calls so users can understand call history in the message timeline. These records must contain metadata only. Chatify must not store recordings, media streams, SDP payloads, ICE candidates, device labels, or raw private WebRTC payloads.

**Acceptance Evidence:** Backend and frontend tests verify activity records render as system events and do not expose sensitive signaling payloads.

### REQ-13-014: Privacy And Logging

The implementation must never log or persist:

- SDP bodies.
- ICE candidate payloads.
- Media stream contents.
- Raw device labels.
- Access tokens or cookie metadata.
- Private call payloads beyond minimal redacted identifiers needed for diagnostics.

Any diagnostic logging must be redacted and suitable for production.

**Acceptance Evidence:** Code review and tests or snapshots verify sensitive fields are absent from persisted call activity and intentional logs.

### REQ-13-015: Verification And Quality Gates

Phase 13 cannot be considered complete until all of the following are true:

- Backend socket tests cover invite, accept, reject, end, timeout, busy, offline, unauthorized, stale, cross-chat, and blocked paths.
- Frontend hook/component tests cover media permission success/failure, state machine transitions, call controls, detail rail closing, and all call entry points.
- Playwright fake-media smoke covers at least one audio or video happy path and one permission/error path where browser automation supports it.
- Frontend lint passes.
- Frontend build passes.
- Backend test suite passes for call-related tests.
- Static fixture guards prove shared files, shared media, pinned messages, profile images, voice controls, and attachment controls were not replaced with static call-era placeholders.

**Acceptance Evidence:** Phase 13 summary includes exact commands and results.

## UX Requirements

1. Call controls must feel native to the redesigned Chatify interface, not like modal demos.
2. Incoming calls must identify the peer, call mode, and available actions: accept, reject, or dismiss after missed.
3. Outgoing calls must show the peer, call mode, ringing status, cancel/end control, and timeout.
4. Active calls must show elapsed duration, peer identity, media state, and essential controls.
5. Permission errors must be specific enough for users to recover.
6. Offline and busy states must be truthful and must not imply delivery when none happened.
7. The mobile interface must keep controls reachable without horizontal scrolling.
8. The right-side detail rail or drawer must be user closable on desktop and mobile.

## Accessibility Requirements

1. All call actions must be keyboard reachable.
2. Active and incoming call overlays must manage focus predictably.
3. Escape should close non-critical menus and may reject/end only where the UI clearly indicates that behavior.
4. Status changes must be announced with `aria-live` or equivalent.
5. Icon buttons must have visible or accessible labels.
6. Focus must return to the initiating control after call overlay dismissal where practical.

## Security Requirements

1. Socket identity is the source of truth for all signaling.
2. Client-provided user ids must not be trusted for call authorization.
3. Chat membership must be checked for every call session and signaling event.
4. Blocked relationship state must reject call attempts and live signaling.
5. Stale call ids, cross-chat call ids, and duplicate transitions must be rejected.
6. Rate limiting or abuse protection must exist for repeated call attempts if current socket controls are insufficient.
7. No media payloads or sensitive WebRTC payloads are persisted or logged.

## Data Model Requirements

Phase 13 may add a call session model, message system-event extension, or equivalent persistence strategy. The chosen model must:

- Represent call lifecycle metadata without storing media.
- Support cleanup of expired ringing sessions.
- Support timeline activity records.
- Be queryable by chat membership rules.
- Avoid exposing sensitive WebRTC payloads through API responses.

## API And Socket Contract Requirements

The final implementation must define explicit event names and payloads during plan/execution. At minimum, the contract must cover:

- Start/invite call.
- Incoming call notification.
- Accept call.
- Reject call.
- End call.
- Busy response.
- Missed/timeout response.
- Permission-denied/failure response where server notification is needed.
- WebRTC offer.
- WebRTC answer.
- ICE candidate.
- Call state sync after reconnect.

Every event that expects client action must include a server acknowledgement or equivalent error path.

## Test Plan

### Backend

- Socket integration tests for call lifecycle.
- Authorization tests for unauthenticated, unauthorized, cross-chat, and blocked attempts.
- Busy and timeout tests.
- Offline recipient tests.
- Stale call id and duplicate transition tests.
- Redaction tests for persisted call activity.

### Frontend

- Hook tests for call state machine and socket event handling.
- Component tests for every call entry point.
- Mocked `navigator.mediaDevices.getUserMedia` tests.
- Mocked `RTCPeerConnection` tests.
- Connected control tests for microphone and camera track toggling.
- Detail rail/drawer close regression test.
- Theme/responsive rendering tests where practical.

### End-To-End Smoke

- Playwright fake-media call initiation and completion.
- Playwright permission denial or missing device path.
- Two-user realtime smoke where local infrastructure allows it.
- Evidence that messages still send once, receive instantly, and do not regress due to call socket changes.

## Open Decisions

All open decisions from discovery were approved with the recommendations below:

1. **Dependency sequencing:** Proceed with spec/discuss/plan now; gate execution completion on Phases 10.1, 11, and 12 evidence.
2. **Scope:** Direct-message one-to-one audio and video only.
3. **Entry points:** Header, detail rail/drawer, and More menu all use the same call flow.
4. **Modes:** Support audio-only and video-with-audio sessions; no mid-call upgrade/downgrade in Phase 13.
5. **State model:** Implement the full lifecycle state set listed in REQ-13-008.
6. **Offline behavior:** Show unavailable or missed, never false delivered.
7. **Concurrency:** One active or ringing call per user; 30-second ring timeout; busy for competing attempts.
8. **Authority:** Server owns call sessions and transition validity.
9. **Media stack:** Browser WebRTC with env-configured STUN/TURN; production readiness blocked without TURN.
10. **Permissions:** Request required media before outgoing invite and before accepting incoming calls.
11. **Device failures:** Audio requires microphone; video requires microphone and camera; offer audio fallback for camera failure.
12. **Reconnect:** Recover ringing/outgoing on short reconnect; active media ends safely on unload or prolonged disconnect.
13. **Controls:** Mute, camera toggle, end, local preview, and remote state only.
14. **UI:** In-app overlay/banners; mobile full-screen call overlay.
15. **History:** Lightweight system activity records only.
16. **Security:** Blocked, unauthorized, stale, and cross-chat attempts rejected server-side and disabled UI-side.
17. **Privacy:** No SDP, ICE, media, device labels, or private payload logging/persistence.
18. **Verification:** Backend socket tests, frontend mocked WebRTC/media tests, Playwright fake-media smoke, lint, build, and fixture guards.
19. **Accessibility:** Keyboard controls, focus management, labels, and live status announcements.
20. **Out of scope:** Group calls, screen share, recording, transcription, captions, push notifications, native background calling, analytics dashboard, E2EE media, and final production acceptance.

## Constraints

1. Preserve the existing MERN, Socket.IO, React/Vite, TanStack Query, Zustand, and Tailwind architecture.
2. Keep cookie-authenticated HTTP and socket credentials aligned.
3. Do not overwrite unrelated local work, especially `Frontend/Chatify/src/pages/chat/chat.tsx`.
4. Do not introduce hardcoded TURN credentials.
5. Do not add broad rewrites outside the call implementation boundary.
6. Do not use subagents.
7. Keep implementation evidence attached to the phase summary.

## Acceptance Criteria

- [ ] All call and video UI controls are functional or truthfully disabled with a reason.
- [ ] One-to-one audio calls work through authenticated Socket.IO signaling and WebRTC media.
- [ ] One-to-one video calls work through authenticated Socket.IO signaling and WebRTC media.
- [ ] Incoming, outgoing, ringing, connecting, connected, rejected, missed, busy, permission-denied, failed, reconnecting, and ended states are represented.
- [ ] Offline recipients do not receive false delivered/ringing claims.
- [ ] Blocked and unauthorized users cannot start or continue calls.
- [ ] Stale, duplicate, and cross-chat signaling is rejected.
- [ ] Permission and missing-device failures are recoverable.
- [ ] Active media is cleaned up on end, refresh, unload, logout, and prolonged disconnect.
- [ ] Call activity records contain metadata only.
- [ ] Sensitive WebRTC and auth data is not persisted or logged.
- [ ] Desktop and mobile UI are accessible and theme-compatible.
- [ ] Backend socket tests pass.
- [ ] Frontend tests pass.
- [ ] Playwright fake-media smoke passes or records a clear browser-support limitation.
- [ ] Frontend lint passes.
- [ ] Frontend build passes.

## Ambiguity Report

**Ambiguity Score:** 0.08

| Dimension | Score | Notes |
| --- | ---: | --- |
| Goal clarity | 0.93 | Phase objective is concrete: real one-to-one audio/video calling from existing messenger controls. |
| Boundary clarity | 0.94 | Group calls, recording, screen share, native calling, push notifications, and production live acceptance are out of scope. |
| Constraint clarity | 0.88 | Stack, auth, socket, WebRTC, TURN, privacy, and dirty-worktree constraints are explicit. |
| Acceptance clarity | 0.91 | Completion requires specific backend, frontend, Playwright, lint, build, and fixture-guard evidence. |

## Interview Log

- **Question:** Can Phase 13 planning proceed while Phases 10.1, 11, and 12 are not fully summarized?
  **Recommendation Accepted:** Yes for spec/discuss/plan; execution completion is gated on final evidence from those phases.

- **Question:** Should Phase 13 support group calls or one-to-one calls only?
  **Recommendation Accepted:** One-to-one direct-message calls only.

- **Question:** Should call controls remain visual placeholders if WebRTC is not ready?
  **Recommendation Accepted:** No. Controls must be functional or truthfully disabled with explicit reasons.

- **Question:** Should Chatify persist call media or signaling payloads?
  **Recommendation Accepted:** No. Persist only call lifecycle metadata and safe timeline activity records.

- **Question:** What verification is required?
  **Recommendation Accepted:** Backend socket tests, frontend mocked media/WebRTC tests, Playwright fake-media smoke, lint, build, and static fixture guard checks.

