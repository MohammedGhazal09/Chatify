---
phase: 13-realtime-call-and-video-implementation
review: 13
status: resolved
depth: standard
files_reviewed: 47
resolved_by: 13-REVIEW-FIX.md
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
commands:
  - "Review only; no tests run"
  - "2026-06-17 verification: Backend/Chatify npm test -- --run test/socket/socket.calls.test.mjs test/socket/socket.call-auth.test.mjs test/socket/socket.call-blocking.test.mjs -> passed, 3 files / 12 tests"
skills:
  - "gsd-code-review"
  - "find-skills"
  - "websocket-engineer"
  - "react-code-review"
  - "typescript-security-review"
  - "e2e-testing-patterns"
---

# Phase 13 Code Review

## Resolution Status

Resolved by `13-REVIEW-FIX.md`. Fresh verification on 2026-06-17 passed the targeted backend call/socket suite: `cd Backend/Chatify; npm test -- --run test/socket/socket.calls.test.mjs test/socket/socket.call-auth.test.mjs test/socket/socket.call-blocking.test.mjs` (3 files / 12 tests).

## Scope

Reviewed the Phase 13 source scope from commits `4973172` and `334b427`, excluding planning screenshots and summary-only artifacts. I ran this review inline instead of using a reviewer subagent because the project instructions prohibit subagents.

## Findings

### CR-01: Active calls can be orphaned when a connected socket disconnects

Severity: Critical

Files:

- `Frontend/Chatify/src/hooks/useChatSocket.ts:217`
- `Frontend/Chatify/src/hooks/useChatSocket.ts:229`
- `Frontend/Chatify/src/pages/chat/chat.tsx:408`
- `Frontend/Chatify/src/hooks/useCallController.ts:553`
- `Backend/Chatify/Config/socket.mjs:844`
- `Backend/Chatify/Utils/callSessionState.mjs:41`
- `Backend/Chatify/Utils/callSessionState.mjs:182`

Evidence:

`useChatSocket` stores the Socket.IO instance once and registers `connect`, `socket:ready`, `reconnect`, `connect_error`, and `socket:error` handlers, but it does not register a normal `disconnect` handler that updates React state. `chat.tsx` passes `Boolean(socket?.connected)` into `useCallController`; `socket.connected` mutates on the same socket object and does not force a render by itself. The call controller's reconnect/failure timer only starts after `isSocketConnected` becomes false. On the backend, the socket `disconnect` handler only removes the socket from presence maps, while `ringing` and `connected` remain active call statuses that block future calls through `assertNoActiveUserCall`.

Why it matters:

If a user is in an accepted call and the realtime connection drops, the frontend may never enter the reconnecting state. Even when the controller is manually rerendered with `isSocketConnected=false`, the 15 second failure path only stops local media and marks the UI failed; it cannot notify the server while disconnected. The backend can keep the call session in `connected` forever, which means later `call:start` attempts can return `call_busy` even though nobody is actually in a working call.

Recommendation:

Make connection status an explicit state value returned from `useChatSocket`, set it on `connect`, `disconnect`, `reconnect`, and `connect_error`, and pass that state to `useCallController` instead of reading `socket.connected` directly. Add backend authority for active-call disconnect cleanup with a short reconnect grace window, so a connected call transitions to `failed` or `ended` and emits `call:sync` plus the call activity if a participant does not return. Add tests that trigger a frontend `disconnect` event and prove the call controller enters reconnecting, plus a backend socket test that disconnects a participant after `call:accept` and proves the active call no longer blocks future calls after the grace window.

### WR-01: Call signaling accepts and forwards unvalidated payloads

Severity: Warning

Files:

- `Backend/Chatify/Config/socket.mjs:239`
- `Backend/Chatify/Config/socket.mjs:250`
- `Backend/Chatify/Config/socket.mjs:703`
- `Frontend/Chatify/src/hooks/useChatSocket.ts:709`
- `Backend/Chatify/test/socket/socket.calls.test.mjs:225`

Evidence:

`forwardCallSignalToPeer` authorizes the call and participant, then forwards `payload.signal ?? null` to the peer for `call:offer`, `call:answer`, and `call:ice-candidate`. The frontend emitter is typed as `RTCSessionDescriptionInit` or `RTCIceCandidateInit`, but those TypeScript types do not protect the backend. The backend tests verify that a valid offer is forwarded only to the peer, but there is no negative coverage for malformed, oversized, null, or wrong-event signaling bodies.

Why it matters:

The server is the authority for the call contract, but this path lets an authenticated peer push arbitrary JSON through the realtime channel into another browser's WebRTC handlers. That can break calls with uncaught peer errors and creates an unnecessary denial-of-service surface through oversized SDP or ICE payloads.

Recommendation:

Add backend validation before forwarding: require offer/answer signals to have `type` matching the event and a bounded string `sdp`, require ICE candidates to have a bounded string `candidate` plus valid optional `sdpMid` and `sdpMLineIndex`, reject null or unknown shapes with `invalid_call_signal`, and keep signals out of logs and persistence. Add socket tests proving invalid and oversized offer/answer/candidate payloads are acknowledged with an error and are not emitted to the peer.

## Verification

No tests were run during this review. The findings came from source inspection of the Phase 13 call lifecycle, socket, and test changes. The existing Phase 13 test evidence shows backend and frontend suites passed during execution, but it does not cover accepted-call disconnect cleanup or invalid signaling rejection.
