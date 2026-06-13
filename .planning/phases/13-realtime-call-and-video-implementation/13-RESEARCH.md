# Phase 13 Research: Realtime Call And Video Implementation

## Status

Research complete. Phase 13 has enough product, codebase, and external API context to plan execution in three dependency-ordered slices.

Recommendation: implement Phase 13 as a real vertical calling feature, not as another UI-only pass. Start with server-authoritative session and signaling semantics, then wire the browser WebRTC controller and UI entry points, then finish with call activity, reconnect/unload behavior, fixture guards, and browser smoke evidence.

## Skills Used

- `gsd-plan-phase`: phase planning gates, requirements coverage, decision coverage, and plan-file structure.
- `find-skills`: selected existing local skills without installing new tools.
- `websocket-engineer`: Socket.IO authentication, rooms, acknowledgements, rate limiting, reconnect, and event-boundary design.
- `api-and-interface-design`: stable event payloads, structured acknowledgements, one-version contract, and error semantics.
- `react-testing`: behavior-focused hook and component tests with mocked media and peer connection APIs.
- `e2e-testing-patterns`: deterministic Playwright smoke strategy with stable selectors and real workflows.
- `accessibility`: keyboard, focus, live region, labels, and modal or overlay behavior.

## External Findings

### Browser Media Permission And Secure Context

Source: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia

`getUserMedia()` requires explicit user permission for microphone or camera access and is only available in supported secure contexts. Permission denial, unsupported context, inactive documents, and missing devices must be represented as recoverable application states.

Recommendation:

- Check `window.isSecureContext`, `navigator.mediaDevices?.getUserMedia`, and requested media constraints before enabling call actions.
- Request microphone permission before sending an audio invite and microphone plus camera before sending a video invite.
- Request the same media before accepting an incoming call.
- If video camera access fails but microphone succeeds, offer an audio-call fallback before sending or accepting a video session.
- Tests must mock permission success, `NotAllowedError`, `NotFoundError`, missing `mediaDevices`, and unsupported secure-context paths.

### WebRTC Session Setup And ICE Configuration

Sources:

- https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection
- https://webrtc.org/getting-started/peer-connections

WebRTC peer connections are created through `RTCPeerConnection(configuration)`. The configuration may include STUN and TURN servers in `iceServers`. WebRTC does not define an application signaling transport. The application must exchange offers, answers, and ICE candidates through another channel.

Recommendation:

- Use native WebRTC through a focused frontend service or hook wrapper instead of putting peer connection details inside UI components.
- Use Socket.IO only for authenticated signaling and state synchronization.
- Deliver ICE server configuration from backend-controlled environment values in `socket:ready`, `call:start` ack, or a small authenticated config path.
- Do not hardcode TURN credentials in frontend source. If production TURN is not configured, Phase 13 can pass local tests but must record production call readiness as blocked for Phase 14.
- Use trickle ICE: send candidates as discovered, but do not persist them.

### Connection State Mapping

Source: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState

`RTCPeerConnection.connectionState` can be `new`, `connecting`, `connected`, `disconnected`, `failed`, or `closed`. These should not be exposed raw to users. They need a Chatify state mapping with a short reconnect grace window.

Recommendation:

- Map `connecting` to Chatify `connecting`.
- Map `connected` to Chatify `connected`.
- Map `disconnected` to Chatify `reconnecting` for a bounded grace window.
- Map `failed` and unrecovered `closed` to `failed` or `ended`.
- Tests should drive mocked connection state changes and assert UI state, cleanup, and socket events.

### Socket.IO Delivery, Acknowledgements, And Rooms

Sources:

- https://socket.io/docs/v4/
- https://socket.io/docs/v4/emit-cheatsheet/
- https://socket.io/docs/v4/client-api/
- https://socket.io/docs/v4/delivery-guarantees

Socket.IO supports automatic reconnection, rooms, and acknowledgements with timeouts. It guarantees event ordering for events that arrive, but the default message arrival guarantee is at-most-once and there is no server-side replay buffer for disconnected clients.

Recommendation:

- Every client call action should use `socket.timeout(...).emitWithAck(...)` or a callback ack and handle timeout as a first-class failure.
- Backend call state must be server-authoritative because client-side socket delivery does not prove peer receipt.
- Offline or no-reachable-socket calls must return unavailable or failed instead of creating a false ring state.
- Use chat rooms for broad chat-scoped state only when safe, and use `emitToUserSockets()` for user-targeted incoming-call and multi-tab sync.
- Add call-specific socket rate limits beside existing `chat:join`, typing, and delivery limits.

### Playwright Fake Media And Browser Smoke

Sources:

- https://playwright.dev/docs/api/class-browsertype
- https://playwright.dev/docs/emulation

Playwright supports passing browser launch args and emulating devices/viewports/color scheme. Chromium fake media can be enabled through browser args, but the app tests should still have mocked media fallback paths because browser and CI support vary.

Recommendation:

- Add frontend unit tests that mock `navigator.mediaDevices` and `RTCPeerConnection` as the primary deterministic coverage.
- Add at least one Playwright smoke path using Chromium fake media args or application-level test doubles, and record limitations if a browser cannot support a path.
- Cover desktop and mobile call UI entry states and both theme surfaces where practical.

### Accessible Call Overlays

Source: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

Modal dialogs require focus movement into the dialog, a contained tab sequence, Escape handling, accessible labeling, and focus return after close. For Phase 13, incoming and active call UI can be modal on mobile or prominent overlay on desktop, but it must not trap unrelated navigation incorrectly.

Recommendation:

- Incoming call overlays need visible accept/reject/end controls with accessible labels.
- Use `role="dialog"` and `aria-modal="true"` only when the UI actually blocks background interaction.
- Add `aria-live` status text for ringing, connecting, connected, reconnecting, failed, missed, and ended.
- Focus should return to the initiating call button or a logical chat control after dismissal where practical.

## Codebase Findings

### Disabled Call Controls

Files inspected:

- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationMoreMenu.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.test.tsx`
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.test.tsx`

Current state:

- Header Call and Video call buttons are disabled with "unavailable in this phase" titles.
- Detail rail/drawer Call and Video call actions render disabled because no `onClick` is supplied.
- More menu Call and Video call items are disabled.
- Existing tests assert the disabled behavior.

Recommendation:

- Replace disabled assertions with behavior tests proving every visible call surface uses the same call controller path.
- Keep controls honestly disabled only for unsupported browser, group chat, blocked conversation, unauthenticated session, no selected direct chat, busy state, or offline peer state.

### Socket Foundation

Files inspected:

- `Backend/Chatify/Config/socket.mjs`
- `Backend/Chatify/Utils/chatAccess.mjs`
- `Backend/Chatify/Utils/conversationControls.mjs`
- `Backend/Chatify/test/helpers/socketClient.mjs`
- `Backend/Chatify/test/helpers/socketServer.mjs`
- `Backend/Chatify/test/socket/*.test.mjs`

Current state:

- Socket identity is verified from the access-token cookie during handshake.
- Sockets auto-join authorized chat rooms.
- Existing socket events use structured success/error acknowledgements.
- Membership and block helpers already reject unauthorized or blocked chat-scoped activity.
- Rate limiting exists for selected socket events.
- `emitToUserSockets()` and `getUserSockets()` can target all sockets for a user, which is required for multi-tab incoming calls.

Recommendation:

- Add call events to or adjacent to `socket.mjs`, but move transition-heavy call logic into a helper module so the socket file does not become a large state machine.
- Reuse `assertChatMember()`, `getDirectChatPeerId()`, `assertConversationActivityAllowed()`, and `toSocketAccessError()`.
- Add call event limits and per-user call-start cooldown.
- Test blocked, unauthorized, cross-chat, stale call id, multi-socket, busy, offline, and timeout paths through socket integration tests.

### Message Reliability Risk

Files inspected:

- `Backend/Chatify/Controller/messageController.mjs`
- `Backend/Chatify/Config/socket.mjs`
- `Backend/Chatify/test/message/message.idempotency.test.mjs`
- `Backend/Chatify/test/socket/socket.message-state.test.mjs`
- `Frontend/Chatify/src/hooks/useChatQueries.ts`
- `Frontend/Chatify/src/hooks/useChatSocket.ts`

Current state:

- Phase 10.1 added critical guarantees around one-send/one-message, recipient realtime receive, and server-confirmed delivery/read.
- Call socket work touches the same socket file and can regress message event registration, cleanup, or cache invalidation if implemented casually.

Recommendation:

- Put call events in a separate listener setup block with explicit cleanup and no changes to message creation semantics.
- Final Phase 13 verification must re-run targeted message idempotency, realtime receive, and delivery/read tests.
- The browser smoke should send a normal message before and after a call session to prove call socket handlers did not break messaging.

### Frontend Ownership Boundary

Files inspected:

- `Frontend/Chatify/src/hooks/useChatSocket.ts`
- `Frontend/Chatify/src/pages/chat/chat.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx`
- `Frontend/Chatify/src/types/chat.ts`
- `Frontend/Chatify/src/test/setup.ts`

Current state:

- `useChatSocket` owns the Socket.IO instance and event listeners.
- `chat.tsx` orchestrates selected chat, message send, search, detail rail, More menu, block/unblock, and socket callbacks.
- Presentational chat components receive props and callbacks.
- Test setup has requestAnimationFrame shims but no media or peer connection mocks yet.

Recommendation:

- Add a focused call controller hook or service, for example `useCallController`, that receives the socket transport, selected chat, user, and peer status.
- Keep WebRTC lifecycle, local media stream, remote stream, cleanup, and action state inside that hook/service.
- Keep `useChatSocket` as the event transport boundary and expose typed call emit helpers/events to the controller.
- Mount `CallOverlay` at route level from `chat.tsx`, not inside the right detail rail.

## Recommended Plan Shape

### Plan 13-01: Backend Call Session And Signaling Authority

Goal: create the server-owned call lifecycle, transient signaling contract, ICE config delivery, rate limits, block enforcement, and backend socket tests.

Recommendation: do this first because all UI state must be driven by server acknowledgements and sync events.

### Plan 13-02: Frontend Call Controller, WebRTC Media, And Entry Points

Goal: add typed call events, media permission handling, `RTCPeerConnection` lifecycle, route-level overlay UI, and functional header/detail/menu call controls.

Recommendation: do this second because the frontend needs the stable socket contract and ICE config from Plan 13-01.

### Plan 13-03: Call Activity, Reconnect/Unload, Regression Gates, And Evidence

Goal: persist safe call activity system records, finish reconnect/unload/block-during-call behavior, add fixture guards, run messaging regression tests, add Playwright fake-media smoke, and write final evidence.

Recommendation: do this last because it crosses backend persistence, frontend timeline rendering, browser behavior, and the dependency gate against Phases 10.1, 11, and 12.

## Validation Architecture

| Layer | Target |
|-------|--------|
| Backend socket tests | `call:start`, `call:incoming`, accept, reject, end, timeout, busy, offline, blocked, unauthorized, stale, cross-chat, multi-socket sync, and rate limits |
| Backend persistence tests | `CallSession` lifecycle metadata and safe call activity records with no SDP, ICE, media, device labels, tokens, or cookies |
| Frontend hook tests | media support, permission denial, missing device, peer connection state mapping, cleanup, action acks, ack timeout, and socket sync |
| Frontend component tests | header/detail/menu entry points, overlay controls, detail rail closing, accessible labels, and live status text |
| Playwright smoke | fake-media or mocked-media happy path plus permission/unsupported path, with desktop/mobile and theme evidence where practical |
| Regression tests | message one-send/one-bubble, recipient realtime receive, server-truth delivery/read, shared assets, pinned messages, voice/attachment controls, and fixture guards |

## Dependency And Gate Risks

1. Phase 13 depends on Phase 10.1 message reliability.
   - Risk: call socket changes can reintroduce duplicate sends or no-refresh delivery.
   - Recommendation: make message reliability regression checks part of Plan 13-03 completion.

2. Phase 13 depends on Phase 11 conversation controls.
   - Risk: call attempts could bypass block state.
   - Recommendation: all call helpers must use `conversationControls` and block tests before UI is enabled.

3. Phase 13 depends on Phase 12 media/voice/identity work.
   - Risk: call UI may collide with media permissions or identity surfaces.
   - Recommendation: execution summary must inspect final Phase 12 evidence before claiming completion.

4. TURN configuration may be missing.
   - Risk: local STUN-only calls can pass while production peer connectivity fails behind restrictive NATs.
   - Recommendation: Phase 13 can implement configurable ICE support, but final deployed call acceptance remains Phase 14 unless TURN is configured and verified.

5. Worktree is dirty.
   - Risk: planning commits could accidentally include unrelated implementation or screenshot changes.
   - Recommendation: stage only Phase 13 research/plans and intentional GSD state/roadmap updates.

## Research Outcome

Proceed with three execution plans:

1. `13-01`: Backend call session, signaling, ICE config, rate limits, and socket tests.
2. `13-02`: Frontend call controller, WebRTC media lifecycle, overlay UI, and functional call entry points.
3. `13-03`: Call activity records, reconnect/unload and block-during-call behavior, fixture guards, browser smoke, message-regression evidence, and summary.

## Sources

- MDN getUserMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- MDN RTCPeerConnection constructor: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection
- MDN RTCPeerConnection connectionState: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionState
- WebRTC peer connections: https://webrtc.org/getting-started/peer-connections
- Socket.IO introduction: https://socket.io/docs/v4/
- Socket.IO emit cheatsheet: https://socket.io/docs/v4/emit-cheatsheet/
- Socket.IO client API: https://socket.io/docs/v4/client-api/
- Socket.IO delivery guarantees: https://socket.io/docs/v4/delivery-guarantees
- Playwright BrowserType API: https://playwright.dev/docs/api/class-browsertype
- Playwright emulation: https://playwright.dev/docs/emulation
- WAI-ARIA modal dialog pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
