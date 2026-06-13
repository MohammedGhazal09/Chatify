---
phase: 15
artifact: patterns
status: complete
created: 2026-06-14
---

# Phase 15 Pattern Map

## Purpose

This file maps current project patterns that Phase 15 implementation plans should follow. It replaces the default pattern-mapper subagent because project instructions forbid subagents.

## Backend Socket Patterns

### Authenticated Socket Boundary

Use `Backend/Chatify/Config/socket.mjs`.

Pattern:
- Socket identity is verified during handshake.
- Client `user:connect` identity replacement is rejected.
- Call events use `socket.data.userId`.
- Event handlers return ack payloads or `call:error`/`socket:error` payloads.

Use this for:
- Any Phase 15 backend call changes.
- Any call signal authorization regression.

Do not:
- Trust client-sent user ids.
- Emit call signals to client-provided rooms.
- Log cookies, access tokens, emails, SDP, or ICE candidate strings.

### Server-Authoritative Call Session

Use:
- `Backend/Chatify/Utils/callSessionState.mjs`
- `Backend/Chatify/Models/callSessionModel.mjs`
- `Backend/Chatify/Config/socket.mjs`

Pattern:
- `call:start` creates a ringing call session only after membership, direct-chat, activity, busy, and reachability checks.
- `call:accept` moves the server session to connected.
- `call:offer` and `call:answer` forward only after `loadAuthorizedCall` and signal validation.
- Terminal call states emit call activity messages.

Use this for:
- Preserving accept-before-offer sequencing.
- Adding regressions for stale, unauthorized, blocked, or multi-tab states.

### Socket Ack And Rate Limit Pattern

Use:
- `respondSocketSuccess`
- `respondSocketError`
- `emitCallAck`
- `emitCallError`
- `guardSocketEventRateLimit`

Pattern:
- Every call action should be ack-testable.
- Tests should assert ack shape and event code, not only side effects.

## Frontend WebRTC Patterns

### Peer Session Wrapper

Use `Frontend/Chatify/src/utils/webrtcCallSession.ts`.

Pattern:
- Keep direct `RTCPeerConnection` handling inside the wrapper.
- Keep controller state orchestration in `useCallController.ts`.
- Use explicit methods for offer, answer, accepting answer, adding ICE, and closing.

Phase 15 extension recommendation:
- Add a way for the wrapper or controller to know when remote description is ready.
- Flush pending ICE only after the peer session can safely apply it.
- Preserve testability with mocked `RTCPeerConnection` in `Frontend/Chatify/src/test/setup.ts`.

### Call Controller Pattern

Use `Frontend/Chatify/src/hooks/useCallController.ts`.

Pattern:
- Availability is derived before user actions.
- Media is requested before `call:start` or `call:accept`.
- Server ack drives durable session state.
- `call:sync` drives connected/terminal transitions.
- Peer creation happens only when there is a server session and local stream.

Phase 15 extension recommendation:
- Track pending ICE candidates by active call id.
- Clear pending ICE on terminal state, chat change, logout, and peer reset.
- Do not emit `call:start` if requested video media fails.
- Add retry behavior that starts from the same explicit requested mode.

### Call Overlay Pattern

Use `Frontend/Chatify/src/pages/chat/components/CallOverlay.tsx`.

Pattern:
- Dialog uses role `dialog` and aria label `Call controls`.
- Icon buttons use accessible labels and titles.
- Video surfaces use labeled video elements.
- Existing tests use React Testing Library and user-event.

Phase 15 extension recommendation:
- Keep changes inside the call overlay and call controls.
- Add explicit camera failure/retry and setup failure UI.
- Verify mobile and desktop layout with Playwright screenshots if UI shape changes.

## Frontend Test Patterns

### Vitest Hook And Component Tests

Use:
- `Frontend/Chatify/src/hooks/useCallController.test.tsx`
- `Frontend/Chatify/src/pages/chat/components/CallOverlay.test.tsx`
- `Frontend/Chatify/src/test/setup.ts`

Pattern:
- `renderHook` for hook orchestration.
- `vi.fn` socket actions to assert emitted call events.
- Mock `navigator.mediaDevices.getUserMedia`.
- Mock `RTCPeerConnection`.
- Use `vi.useFakeTimers()` for setup/disconnect timeouts and restore timers in `finally`.

Phase 15 extension recommendation:
- Convert the existing "falls back to audio when camera capture fails" test into "fails video without starting audio".
- Add tests for ICE candidate buffering and flushing.
- Add tests for incoming video accept camera failure.

### Playwright E2E Patterns

Use:
- `Frontend/Chatify/playwright.config.ts`
- `Frontend/Chatify/e2e/chat-calls.spec.ts`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`
- `Frontend/Chatify/e2e/pages/productionSmoke.ts`

Pattern:
- Role-based locators are preferred.
- Chromium fake media flags are already configured locally.
- Production smoke requires explicit environment and must not fall back to local origins.
- Artifacts should be written into phase folders or Playwright output attachments.

Phase 15 extension recommendation:
- Add a local two-account fake-media call acceptance path for audio and video.
- Reuse Phase 14 `exerciseCallMode` logic where possible, but make Phase 15 evidence file names and blocked reasons explicit.

## Planning Constraints To Preserve

- Do not modify unrelated messenger behavior.
- Do not overwrite protected local work in `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Keep React/Vite, Express, MongoDB, Socket.IO, TanStack Query, Zustand, Tailwind, Vitest, and Playwright.
- Keep production smoke honest: missing env or missing TURN is blocked, not passed.
- Keep privacy boundaries: no SDP, ICE candidate, cookies, emails, tokens, OAuth payloads, reset codes, or raw credential material in logs/artifacts.
