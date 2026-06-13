---
phase: 15
artifact: validation
status: complete
created: 2026-06-14
---

# Phase 15 Validation Architecture

## Objective

Prove that audio and video calls work reliably after investigation and implementation, without weakening call security, overstating production readiness, or regressing core messenger behavior.

## Required Validation Layers

### Layer 1: Deterministic Frontend Unit Tests

Targets:
- `Frontend/Chatify/src/utils/webrtcCallSession.ts`
- `Frontend/Chatify/src/hooks/useCallController.ts`
- `Frontend/Chatify/src/pages/chat/components/CallOverlay.tsx`
- `Frontend/Chatify/src/test/setup.ts`

Required proof:
- Audio call requests microphone, starts server call, reaches outgoing/ringing/connected states, and cleans up media.
- Video call requests camera plus microphone and does not fall back to audio when camera fails.
- Incoming video accept fails cleanly when camera capture fails and does not ack accept.
- Early ICE candidates are buffered and flushed once the peer can accept them.
- Pending ICE is cleared when the call ends, fails, is rejected, is missed, the chat changes, or auth ends.
- Overlay shows explicit camera/setup/retry states and keeps accessible controls.

Command:

```powershell
cd Frontend/Chatify
npm test -- --run src/hooks/useCallController.test.tsx src/pages/chat/components/CallOverlay.test.tsx
```

### Layer 2: Backend Socket And Session Tests

Targets:
- `Backend/Chatify/Config/socket.mjs`
- `Backend/Chatify/Utils/callSessionState.mjs`
- `Backend/Chatify/Utils/callIceConfig.mjs`
- `Backend/Chatify/Utils/callSocketContract.mjs`
- `Backend/Chatify/test/socket/*.mjs`

Required proof:
- Socket handshake auth is required before call events.
- `user:connect` cannot replace verified socket identity.
- Direct chat, membership, blocked conversation, stale call, busy call, and unauthorized signal paths reject with stable ack codes.
- Accepted call is server-authoritative before offer forwarding.
- Offers, answers, and ICE candidates forward only to authorized peer sockets.
- Missing TURN emits production readiness warning and blocks production readiness when `NODE_ENV=production`.

Command:

```powershell
cd Backend/Chatify
npm test -- --run test/socket/socket.calls.test.mjs test/socket/socket.call-auth.test.mjs test/socket/socket.call-blocking.test.mjs
```

### Layer 3: Local Full-Stack Fake-Media Acceptance

Targets:
- `Frontend/Chatify/e2e/chat-calls.spec.ts` or a dedicated Phase 15 Playwright spec.
- Existing local backend/frontend dev setup.

Required proof:
- Two authenticated local browser contexts are online in the same direct chat.
- Audio call starts, rings, accepts, connects, ends, and overlay closes for both users.
- Video call starts, rings, accepts, connects, shows local preview and remote video surfaces, ends, and overlay closes for both users.
- Camera-denied or missing-camera scenario fails explicitly as video and does not create an audio call.
- Cleanup leaves no stale overlay after reload.

Command:

```powershell
cd Frontend/Chatify
npm run test:ui -- --grep "Phase 15"
```

### Layer 4: Production Smoke Or Blocked Artifact

Targets:
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`
- `Frontend/Chatify/e2e/pages/phase14ProductionAcceptance.ts`
- `Frontend/Chatify/e2e/pages/productionSmoke.ts`
- `.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-CALL-ACCEPTANCE.md`

Required proof:
- If production smoke env is configured, run two-account production audio and video call checks.
- If production smoke env is missing, invalid, local-only, or TURN is not ready, record a blocked result with exact missing/invalid requirements.
- No production readiness claim is allowed without a successful configured smoke or an explicit blocked artifact.

Command:

```powershell
cd Frontend/Chatify
npm run test:e2e:prod -- --grep "Phase 15|Phase 14 production live acceptance"
```

### Layer 5: Messenger Regression Checks

Targets:
- Chat send/receive, unread, delivery/read, typing, block/unblock, attachment/pin/search surfaces that share socket or chat state with calls.

Required proof:
- Existing focused frontend tests still pass.
- Existing backend socket/message tests still pass.
- Phase 15 call work does not require unrelated redesign of `Frontend/Chatify/src/pages/chat/chat.tsx`.

Recommended commands:

```powershell
cd Frontend/Chatify
npm run lint
npm run build
npm test -- --run src/hooks/useChatSocket.test.tsx src/hooks/useChatQueries.test.tsx src/hooks/messageCache.test.ts
```

```powershell
cd Backend/Chatify
npm test -- --run test/socket/socket.message-state.test.mjs test/socket/socket.authorization.test.mjs test/socket/socket.presence-reconnect.test.mjs
```

### Layer 6: Privacy And Diagnostics Checks

Targets:
- New or changed diagnostics/logging/artifact code.

Required proof:
- No raw SDP.
- No raw ICE candidates.
- No cookies.
- No tokens.
- No emails.
- No OAuth payloads.
- No reset codes.
- No TURN credential values.

Recommended command:

```powershell
rg -n "sdp|candidate|cookie|token|email|reset|TURN_CREDENTIAL|CALL_TURN_CREDENTIAL" Backend/Chatify Frontend/Chatify .planning/phases/15-investigate-and-fix-audio-and-video-call-reliability
```

Manual review is required because some type names and env variable names are legitimate. Any sensitive value output must be removed or redacted before completion.

## Completion Rule

Phase 15 is complete only when:
- `15-FAILURE-REPORT.md` maps each implemented fix to a reproduced finding.
- `15-CALL-ACCEPTANCE.md` records local fake-media results, production smoke result or blocker, TURN readiness, commands, screenshots/traces where applicable, and residual risks.
- Audio and video calls pass local acceptance.
- Production is either passed through configured smoke or explicitly blocked.
- Security/privacy checks do not expose sensitive call data.
- Messenger regression checks pass or any non-call pre-existing failure is documented separately.
