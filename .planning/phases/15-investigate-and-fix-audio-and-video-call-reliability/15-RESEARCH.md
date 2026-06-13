---
phase: 15
artifact: research
status: complete
created: 2026-06-14
---

# Phase 15 Research: Audio And Video Call Reliability

## Research Scope

Phase 15 must investigate first, then implement. The work targets the existing audio and video call feature across frontend WebRTC setup, Socket.IO signaling, backend session authority, local fake-media acceptance, production smoke gating, TURN readiness, call UI, and privacy-safe diagnostics.

This research was performed inline because project instructions forbid subagents.

## Skills Used

- `find-skills`: required by project instructions before responses and used to select supporting skills.
- `webrtc`: used for peer connection, media, ICE, and call-state planning.
- `websocket-engineer`: used for Socket.IO signaling, event contract, auth, room, and ack planning.
- `vitest`: used for hook/session/unit test strategy and fake timer/media mock planning.
- `playwright-e2e-tester`: used for two-account fake-media and production smoke acceptance planning.
- `react19-test-patterns`: used for React hook/component test constraints and user-facing UI behavior checks.

## External Source Findings

1. `getUserMedia` requires secure browser context. MDN documents that `navigator.mediaDevices` is unavailable in insecure contexts, and camera/microphone access is governed by browser permission policy.
   Source: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

2. `RTCPeerConnection.addIceCandidate` requires a remote peer/remote description. MDN documents `InvalidStateError` when `remoteDescription` is null, and end-of-candidates can be represented by null or empty candidates. Recommendation: buffer ICE candidates until the peer session exists and the remote description is ready.
   Source: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/addIceCandidate

3. WebRTC's canonical flow is caller creates offer and sets local description, callee receives and sets remote description, callee creates and sets answer, caller receives and sets answer, then both sides exchange ICE candidates asynchronously. Recommendation: keep server-authoritative call acceptance before offer emission, but make the client robust to out-of-order signal delivery.
   Source: https://webrtc.org/getting-started/peer-connections-advanced

4. Socket.IO middlewares run for incoming connections and are appropriate for authentication/authorization/rate limiting. Recommendation: preserve the current cookie-authenticated handshake and do not reintroduce client-asserted identity.
   Source: https://socket.io/docs/v4/middlewares/

5. Socket.IO rooms are server-only and appropriate for user/device targeting and chat room broadcasts. Recommendation: keep call signaling routed through server-side user socket maps, not client-chosen rooms.
   Source: https://socket.io/docs/v4/rooms/

6. Socket.IO supports acknowledgements and timeout-based emits. Recommendation: call actions should retain ack handling and tests should assert ack failure states, not just passive event receipt.
   Source: https://socket.io/docs/v4/emit-cheatsheet/

7. Playwright can grant browser permissions and configure launch options. Recommendation: local call acceptance should use configured microphone/camera permissions plus Chromium fake media flags, matching the existing `Frontend/Chatify/playwright.config.ts`.
   Source: https://playwright.dev/docs/emulation
   Source: https://playwright.dev/docs/test-use-options

## Current Implementation Map

### Frontend WebRTC

- `Frontend/Chatify/src/utils/webrtcCallSession.ts` owns WebRTC support checks, media acquisition, stream stopping, peer construction, offer/answer creation, and ICE candidate addition.
- Current risk: `requestCallMedia('video')` catches failed video capture and silently retries audio, returning `audioFallback: true`. This violates Phase 15 decision D-28/D-29 because video call failure must not silently become an audio call.
- Current risk: `WebRtcCallSession.addIceCandidate` immediately calls `peerConnection.addIceCandidate`. The controller currently drops candidates when `peerSessionRef.current` does not exist, so early ICE can be lost.

### Frontend Call Controller

- `Frontend/Chatify/src/hooks/useCallController.ts` owns call state, availability, media acquisition, server call actions, peer creation, setup timeout, socket disconnect handling, and socket event handlers.
- Current useful behavior: the caller emits the offer only after the server sends a connected call sync. That preserves the Phase 15 server-authoritative accept-then-offer contract.
- Current risk: `handleCallIceCandidate` returns when there is no peer session or no signal. This is the most direct current explanation for intermittent media connection failure.
- Current risk: video camera failure currently updates state as an audio fallback instead of a failed video call with retry guidance.
- Current risk: connection setup timeout is present, but tests do not yet prove that buffered signals, setup retry, and media cleanup work across both audio and video modes.

### Frontend Call UI

- `Frontend/Chatify/src/pages/chat/components/CallOverlay.tsx` owns incoming/outgoing/connecting/connected/reconnecting/failed call surfaces.
- Current useful behavior: accessible dialog label, icon buttons, video surfaces, mute/camera toggles, and focus on primary call action.
- Current risk: the UI still contains "Camera unavailable. Audio fallback is active." copy and behavior. Phase 15 requires this path to be replaced with explicit video failure/retry choices.
- Current risk: UI tests only cover idle, incoming audio, and active video controls. They do not cover camera failure, retry, setup failure, reconnecting, or the mobile overlay shape.

### Socket.IO And Backend Session Authority

- `Backend/Chatify/Config/socket.mjs` owns authenticated socket connection, event rate limits, user socket maps, call start/accept/reject/end/sync, call signal forwarding, disconnect cleanup, and call acks.
- Current useful behavior: call events are rate-limited; `call:start` requires chat membership and direct chat; `call:accept` loads a server session; call signals are validated and forwarded only to the authorized peer sockets.
- Current useful behavior: multiple sockets are represented through `userToSockets`; a callee is reachable if at least one socket is connected.
- Current risk: accepted-call signaling is not yet proved in a full local fake-media browser run. Backend unit tests prove routing and validation, but browser behavior can still fail if frontend timing drops ICE.

### TURN/ICE Configuration

- `Backend/Chatify/Utils/callIceConfig.mjs` emits STUN defaults, optional TURN servers, `turnReady`, `productionReady`, and warnings.
- Current useful behavior: production readiness is false when production lacks TURN.
- Current risk: tests and artifacts need to prove that production smoke blocks or records a clear warning when TURN is missing, without claiming production call readiness.

### Existing Acceptance Coverage

- `Frontend/Chatify/playwright.config.ts` already grants microphone/camera permissions and launches Chromium with fake media flags.
- `Frontend/Chatify/e2e/chat-calls.spec.ts` currently includes an honest-unavailable control smoke and a skipped live placeholder under `CHATIFY_CALL_SMOKE=1`.
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts` includes `exerciseCallMode` for audio and video in Phase 14 production acceptance, but it is gated by explicit production smoke configuration.
- Recommendation: promote Phase 15 local acceptance to a required fake-media two-account test and reuse Phase 14 production acceptance patterns for production smoke, with a Phase 15 artifact that records pass, fail, or blocked.

## Failure Hypotheses

1. Early ICE candidate loss is the highest-confidence functional bug. ICE can arrive before the receiving side has created its peer session. Current code returns early instead of buffering, while WebRTC requires remote description readiness before candidate application.

2. Silent video-to-audio fallback hides camera failures and creates false acceptance. A user asks for video, camera capture fails, the app starts an audio call, and tests currently assert this behavior. Phase 15 must invert that test.

3. Browser-level local call success has not been proven. Existing unit and backend tests are useful but do not prove two authenticated browser contexts can ring, accept, connect, show audio/video state, and clean up.

4. Production call readiness can be overstated without TURN. The backend already emits warnings; Phase 15 should make test artifacts and final acceptance treat missing TURN as blocked for production call readiness.

5. UI state may be truthful but incomplete. The overlay needs explicit states for camera failure, media setup failure, reconnecting, retry, and clean end/cancel behavior without modifying unrelated chat layout.

6. Diagnostics may expose too much if added casually. Phase 15 should add only redacted call lifecycle metadata and never log SDP, ICE candidate contents, cookies, emails, or token material.

## Recommended Implementation Strategy

1. Start with failing tests and a failure report.
   Recommendation: document current reproducible defects in `15-FAILURE-REPORT.md`, including video fallback and early ICE loss, then add tests that fail before implementation.

2. Fix signaling timing without weakening server authority.
   Recommendation: keep backend accept-then-offer sequencing, but add client-side pending ICE buffering keyed by active call id. Flush only after peer creation and remote description readiness.

3. Make video failure explicit.
   Recommendation: remove silent video-to-audio fallback for `startCall('video')` and incoming video accept. If camera capture fails, show video-specific error/retry UI and do not emit `call:start` with mode `audio`.

4. Preserve backend call security and add targeted regressions.
   Recommendation: keep authenticated socket middleware, call session membership checks, payload validation, and rate limits. Add tests only where Phase 15 findings expose gaps.

5. Promote local fake-media acceptance to a blocking gate.
   Recommendation: add a Phase 15 Playwright spec that uses two authenticated local browser contexts with fake media to prove audio and video call connect and clean up.

6. Keep production smoke explicit and honest.
   Recommendation: reuse Phase 14 production acceptance helpers for Phase 15; if env/TURN/account configuration is missing, write a blocked artifact rather than falling back to local defaults.

7. Redesign only the call surface.
   Recommendation: change `CallOverlay` and call-control state where needed, but do not refactor unrelated `chat.tsx` or messenger layout.

## Validation Architecture

Validation must be layered because browser WebRTC, Socket.IO signaling, and production infrastructure fail in different ways.

1. Unit/hook layer:
   - `Frontend/Chatify/src/utils/webrtcCallSession.ts`
   - `Frontend/Chatify/src/hooks/useCallController.ts`
   - `Frontend/Chatify/src/pages/chat/components/CallOverlay.tsx`
   - Run: `npm test -- --run src/hooks/useCallController.test.tsx src/pages/chat/components/CallOverlay.test.tsx`

2. Backend socket/session layer:
   - `Backend/Chatify/Config/socket.mjs`
   - `Backend/Chatify/Utils/callSessionState.mjs`
   - `Backend/Chatify/Utils/callIceConfig.mjs`
   - Run: `npm test -- --run test/socket/socket.calls.test.mjs test/socket/socket.call-auth.test.mjs test/socket/socket.call-blocking.test.mjs`

3. Local browser acceptance layer:
   - `Frontend/Chatify/e2e/chat-calls.spec.ts` or a dedicated Phase 15 spec
   - Run: `npm run test:ui -- --grep "Phase 15"`
   - Must use two authenticated accounts, secure local origin, fake media flags, and visible audio/video success checks.

4. Production smoke layer:
   - `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`
   - Run: `npm run test:e2e:prod -- --grep "Phase 15|Phase 14 production live acceptance"` after env is configured.
   - Must block with a clear artifact if production env or TURN readiness is missing.

5. Privacy/security layer:
   - Search logs and tests for SDP, ICE candidate, cookie, token, email, and reset-code leakage.
   - Run: targeted `rg` checks plus backend socket tests.

## Risks And Blockers

- Local two-account browser acceptance may require seeded test users or a reusable auth fixture. Recommendation: prefer existing e2e auth helpers if present; otherwise create a narrow Phase 15 helper rather than broad auth refactors.
- Production smoke cannot be completed without configured production accounts and deploy origins. Recommendation: make missing env a documented blocked result, not a soft pass.
- TURN readiness depends on deployment environment variables. Recommendation: block production readiness if `callConfig.productionReady` is false or warning text indicates missing TURN.
- WebRTC behavior can be timing-sensitive. Recommendation: test at both the unit boundary with deterministic mocked peers and the browser boundary with fake media.
- `Frontend/Chatify/src/pages/chat/chat.tsx` has protected local work. Recommendation: avoid touching it unless call control wiring absolutely requires it, and inspect its current content before any implementation edit.

## RESEARCH COMPLETE
