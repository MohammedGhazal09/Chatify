# Phase 13: realtime-call-and-video-implementation - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 13 turns Chatify's dead call and video controls into real authenticated one-to-one audio and video call workflows. Users can start, receive, accept, reject, and end calls from the conversation header, detail rail/drawer, and More menu. The implementation must use server-authoritative Socket.IO signaling, browser WebRTC media, permission/device handling, blocked-user safety, accessible responsive call UI, and evidence-backed tests.

This phase does not implement group calls, screen share, recording, transcription, captions, push notifications, native background calling, call analytics, E2EE media, arbitrary media relay infrastructure, or final deployed production acceptance. Phase 14 owns final Vercel/Render production acceptance.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**15 requirements are locked.** See `13-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `13-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
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

**Out of scope (from SPEC.md):**
- Multi-party rooms.
- Device picker.
- Mid-call upgrade from audio to video or downgrade from video to audio.
- Screen share.
- Recording.
- Real media relay implementation inside Chatify.
- Native mobile background call handling.
- Push notification ringing when the recipient is offline.

</spec_lock>

<decisions>
## Implementation Decisions

### Dependency And Phase Boundaries
- **D-01:** Phase 13 execution may start after planning, but completion must be gated on final evidence from Phases 10.1, 11, and 12. Phase 13 cannot claim production-ready behavior until those dependency findings are checked and recorded.
- **D-02:** Keep Phase 13 scoped to direct-message audio/video calling. Group calls, screen share, recording, transcription, push notifications, native background calling, analytics, E2EE media, and final production acceptance remain out of scope.
- **D-03:** Preserve the existing stack: React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, and npm package layout.
- **D-04:** Do not use subagents for Phase 13 work in this Codex thread.

### Call Session Persistence And History
- **D-05:** Add a lightweight backend `CallSession` persistence contract or equivalent Mongoose model for safe lifecycle metadata. Minimum fields should include `callId`, `chatId`, `callerId`, `calleeId`, `mode`, `status`, `startedAt`, `ringingAt`, `answeredAt`, `endedAt`, and `endedReason`.
- **D-06:** Persist safe call activity as system timeline records for missed, rejected, failed, and ended calls. Store duration only for connected calls.
- **D-07:** Keep SDP bodies, ICE candidates, media streams, device labels, and raw WebRTC payloads transient. They must not be persisted in MongoDB or written to logs.

### Socket Contract And Server Authority
- **D-08:** Use a dedicated `call:*` Socket.IO event family. Recommended events: `call:start`, `call:incoming`, `call:accept`, `call:reject`, `call:end`, `call:offer`, `call:answer`, `call:ice-candidate`, and `call:sync`.
- **D-09:** Every client call action must use a server acknowledgement with a structured payload such as `{ ok, code, callId, status }`. UI state must not assume success without an acknowledgement or server sync event.
- **D-10:** The server is authoritative for call creation, state transitions, timeout, busy state, blocked-user rejection, stale call ids, and cross-chat rejection.
- **D-11:** For simultaneous call attempts between the same two users, the first server-accepted call session wins. The competing attempt receives `busy` or syncs to the existing session when appropriate.
- **D-12:** For multi-tab or multi-device users, ring all authenticated sockets for the callee. The first accept/reject/end action wins and all other sockets receive `call:sync`.
- **D-13:** Extend the existing socket event rate-limit pattern with call limits. Recommended baseline: per-socket limits for call events plus a per-user call-start cooldown such as 5 starts per minute.

### WebRTC And ICE Configuration
- **D-14:** Use native browser WebRTC APIs through a focused local service/hook wrapper. Do not add a WebRTC abstraction dependency unless implementation research proves native wrapping cannot meet the phase contract.
- **D-15:** Deliver ICE configuration from backend-controlled environment values through a safe config endpoint or authenticated socket-ready payload. A frontend env fallback is acceptable for local development only.
- **D-16:** Do not hardcode STUN/TURN credentials in frontend source. Production readiness remains blocked if TURN configuration is missing, undocumented, or unverifiable.
- **D-17:** Map browser `RTCPeerConnection.connectionState` values into Chatify call states. `connecting` maps to connecting, `connected` maps to connected, `disconnected` may map to reconnecting during a short grace window, and `failed` or `closed` must end or fail the call safely.

### Permissions, Devices, And Browser Support
- **D-18:** Request required media permission before sending an outgoing invite and before accepting an incoming invite. Audio requires microphone permission. Video requires microphone and camera permission.
- **D-19:** If a video call cannot get camera access but microphone access is available, show a recoverable error and offer audio call as fallback without sending a failed video invite.
- **D-20:** If microphone access is denied or unavailable, move to `permission_denied` or `failed` with a clear recoverable message.
- **D-21:** If the browser lacks secure-context media support, `navigator.mediaDevices.getUserMedia`, or `RTCPeerConnection`, call/video controls must be disabled with an explicit reason across header, detail rail/drawer, and More menu.

### Frontend Ownership And Integration
- **D-22:** Add a focused frontend call controller hook or service, such as `useCallSession` or `useCallController`, to own call state, media permissions, peer connection lifecycle, cleanup, and call actions.
- **D-23:** Keep `useChatSocket` as the socket transport boundary. It may register and emit `call:*` events, but presentational components must not create sockets or own socket listeners.
- **D-24:** Keep `chat.tsx` as the orchestration point only. It should wire selected chat, controls, and overlays without absorbing WebRTC details.
- **D-25:** Conversation header buttons, detail rail/drawer actions, and More menu items must all invoke the same call controller path.

### Call UI And Accessibility
- **D-26:** Incoming calls should use a global route-level overlay or banner, not the right detail rail. The call must remain visible even when the detail rail is closed or unavailable.
- **D-27:** Active audio calls should use a compact centered panel. Active video calls should use a larger centered panel with remote stream state and local preview. Mobile incoming and active calls should use a full-screen overlay.
- **D-28:** Active call controls for Phase 13 are end call, mute/unmute microphone, camera on/off for video, local preview, remote stream state, and elapsed time. Screen share, recording, captions, device picker, and mode switching remain out of scope.
- **D-29:** Do not force-close the detail rail during calls. The rail/drawer must remain closable, and the call overlay should sit above the messenger surface without trapping unrelated navigation.
- **D-30:** Call overlays and banners must be keyboard reachable, restore focus predictably, expose visible or accessible labels, and announce status changes with `aria-live` or equivalent.
- **D-31:** Call UI must use Chatify's abstract non-living visual language. Do not introduce humans, animals, plants, mascots, portraits, silhouettes, or realistic life imagery.

### Lifecycle Edge Cases
- **D-32:** If the callee is offline or has no reachable authenticated socket, the caller sees unavailable or failed. Do not create a recipient missed-call record unless an incoming call was actually delivered to a reachable socket.
- **D-33:** If either participant blocks the other during an active call, the active call must end immediately, further signaling must be rejected, and allowed sockets must receive a final ended or blocked sync.
- **D-34:** Page refresh, tab close, logout, prolonged disconnect, and fatal socket disconnect must stop local media tracks and safely end or fail the active call when possible.
- **D-35:** Preserve one active or ringing call per user. Ring timeout remains 30 seconds unless a later plan records a tested reason to adjust it.

### Verification And Evidence
- **D-36:** Backend socket tests must cover start, incoming, accept, reject, end, timeout, busy, offline, blocked, unauthorized, stale call id, cross-chat signaling, multi-socket sync, and rate-limit paths.
- **D-37:** Frontend tests must mock `navigator.mediaDevices.getUserMedia`, permission denial, missing devices, and `RTCPeerConnection` behavior. Tests should cover state transitions, header/detail/menu call entry points, overlay controls, detail rail closing, and cleanup.
- **D-38:** Playwright fake-media smoke should cover at least one happy path and one permission or unsupported path. If fake-media browser support blocks a path, the limitation must be recorded with a fallback proof.
- **D-39:** Extend static fixture guards so Phase 13 cannot reintroduce screenshot/demo-only call cards, fake shared files/media, fake voice controls, or static call history into production runtime.
- **D-40:** Phase 13 verification must also prove message sending still creates one message, recipient realtime receive still works, and delivered/read status remains server-truth based after call socket changes.
- **D-41:** Phase 13 summary must record exact backend test, frontend test, Playwright, lint, build, fixture-guard, and dependency-gate outcomes. Final deployed production acceptance remains Phase 14.

### the agent's Discretion
- The planner may choose exact helper, model, hook, component, route, socket event payload, and test filenames if the contracts above are preserved.
- The planner may decide whether ICE config is delivered by a small HTTP endpoint, socket-ready payload, or both, as long as production credentials are not bundled into frontend source.
- The planner may decide whether call activity records are represented as a system message subtype or a separate call activity projection, as long as timeline rendering is safe and no media/signaling payloads are stored.
- The planner may choose exact copy for call states, permission errors, busy/offline states, and block endings if copy remains truthful, recoverable, and accessible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/13-realtime-call-and-video-implementation/13-SPEC.md` - locked Phase 13 requirements, boundaries, constraints, and acceptance criteria.
- `.planning/phases/13-realtime-call-and-video-implementation/13-CONTEXT.md` - implementation decisions captured by this discussion.
- `.planning/ROADMAP.md` - Phase 13 goal, dependencies, success criteria, and Phase 14 production acceptance boundary.
- `.planning/REQUIREMENTS.md` - CALL-01 through CALL-04, BLOCK-02, RT-01, RT-02, TEST-02, TEST-05 traceability.
- `.planning/PROJECT.md` - core value, brownfield constraints, security posture, repository hygiene, and deployment origins.
- `.planning/STATE.md` - current continuity and dependency warnings.

### Prior Phase Contracts
- `.planning/phases/12-live-media-voice-and-identity-implementation/12-CONTEXT.md` - Phase 12 media/voice/identity decisions and explicit call deferral to Phase 13.
- `.planning/phases/11-conversation-controls-and-user-safety-implementation/11-CONTEXT.md` - block/unblock, `conversationControls`, More menu, and future call-attempt enforcement decisions.
- `.planning/phases/10.1-production-message-delivery-reliability-repair/10.1-CONTEXT.md` - one-send/one-message, realtime receive, and server-truth delivered/read contract that call socket changes must not regress.
- `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-CONTEXT.md` - no static production controls/content and detail rail/drawer close behavior.
- `.planning/phases/09-messenger-interaction-quality-gate/09-CONTEXT.md` - behavior-first Playwright, accessibility, fixture, and screenshot evidence standards.
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` - TanStack Query ownership, canonical message state, idempotency, and retry/receipt behavior.
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` - authenticated Socket.IO identity, membership checks, targeted emits, reconnect, and presence privacy.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - frontend/backend layering, API/hook/socket boundaries, and anti-patterns.
- `.planning/codebase/STACK.md` - React, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, npm, Vercel, and Render stack.
- `.planning/codebase/CONVENTIONS.md` - TypeScript, ESM, naming, error handling, logging, import, and module-boundary conventions.
- `.planning/codebase/TESTING.md` - historical testing map; planners must verify live package scripts because test infrastructure now exists.

### Backend Runtime And Test Files
- `Backend/Chatify/Config/socket.mjs` - authenticated socket connection, rooms, presence, message events, rate limiting, block checks, and call event insertion point.
- `Backend/Chatify/Utils/chatAccess.mjs` - chat and message membership helpers to reuse for call authorization.
- `Backend/Chatify/Utils/conversationControls.mjs` - block/capability helpers that Phase 13 must reuse for call attempts and signaling.
- `Backend/Chatify/Models/chatModel.mjs` - direct-message membership model for call chat scope.
- `Backend/Chatify/Models/messageModel.mjs` - possible system activity record integration if call activity is represented as message subtype.
- `Backend/Chatify/test/helpers/socketClient.mjs` - authenticated socket test helper for call socket integration tests.
- `Backend/Chatify/test/helpers/socketServer.mjs` - socket server test helper for lifecycle tests.
- `Backend/Chatify/test/socket/*.test.mjs` - existing socket auth, authorization, presence, blocking, and message-state test patterns to extend.
- `Backend/Chatify/test/chat/chat.block-controls.test.mjs` - block-control behavior that future call rejection should respect.

### Frontend Runtime And Test Files
- `Frontend/Chatify/src/types/chat.ts` - add call session, call event, call status, and call capability types.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - socket transport boundary for `call:*` event registration and emission.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - query invalidation and state preservation boundary that calls must not regress.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - selected-chat orchestration and call overlay mounting point. Preserve unrelated local work.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - header call/video buttons currently disabled; must use shared call controller.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` - detail rail/drawer Call and Video call actions currently disabled; must use shared call controller.
- `Frontend/Chatify/src/pages/chat/components/ConversationMoreMenu.tsx` - More menu Call and Video call items currently disabled; must use shared call controller.
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.test.tsx` - current tests assert call/video disabled; replace with behavior tests.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.test.tsx` - current tests assert call/video disabled; replace with behavior tests.
- `Frontend/Chatify/src/hooks/useChatSocket.test.tsx` - add call socket event and sync tests.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` - extend static/demo runtime guard for call UI/history.
- `Frontend/Chatify/e2e/*.spec.ts` - Playwright behavior, fake media, and production-smoke patterns.

### Current Official Docs Checked During Discussion
- `https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia` - permission and secure-context behavior for microphone/camera access.
- `https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/RTCPeerConnection` - peer connection constructor and ICE server configuration.
- `https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/connectionstatechange_event` - browser connection state changes to map to Chatify call states.
- `https://webrtc.org/getting-started/peer-connections` - ICE, STUN, and TURN usage context for production connectivity.

### Supporting Skills Used For This Discussion
- `C:/Users/saieh/.agents/skills/websocket-engineer/SKILL.md` - Socket.IO auth, rooms, acknowledgements, reconnect, rate limits, and event-boundary guidance.
- `C:/Users/saieh/.agents/skills/react-testing/SKILL.md` - behavior-focused React hook/component test guidance.
- `C:/Users/saieh/.agents/skills/e2e-testing-patterns/SKILL.md` - Playwright behavior and deterministic smoke-test guidance.
- `C:/Users/saieh/.agents/skills/accessibility/SKILL.md` - keyboard, focus, labels, live region, and modal/overlay accessibility guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Backend/Chatify/Config/socket.mjs`: Existing authenticated Socket.IO handshake, chat rooms, event acknowledgements, rate-limit scaffolding, block checks, and presence state should be extended for calls.
- `Backend/Chatify/Utils/chatAccess.mjs`: Existing membership helpers should be reused for every call session and signaling event.
- `Backend/Chatify/Utils/conversationControls.mjs`: Existing blocked-conversation helpers should reject call attempts and signaling when direct-message activity is unavailable.
- `Frontend/Chatify/src/hooks/useChatSocket.ts`: Existing socket lifecycle and query invalidation boundary should carry call events rather than adding listeners inside UI components.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx`: Header call/video controls exist but are disabled; wire them to shared call actions.
- `ConversationDetailContent.tsx` and `ConversationMoreMenu.tsx`: Detail and More call/video actions exist but are disabled; wire them to the same call controller.
- `Frontend/Chatify/src/test/setup.ts`: Existing frontend test setup can be extended with `mediaDevices` and `RTCPeerConnection` mocks.
- `Backend/Chatify/test/helpers/socketClient.mjs`: Existing authenticated socket test helper is the right base for call lifecycle tests.

### Established Patterns
- Backend routers stay thin; controllers/helpers/models own validation, authorization, persistence, response shaping, and socket side effects.
- Socket.IO identity is derived from cookie-authenticated handshake data. Client-supplied user ids must not be trusted.
- Chat-scoped behavior must pass membership checks and block checks before persistence or emits.
- Frontend API clients and hooks own transport/query behavior; presentational components receive callbacks and render state.
- Durable chat state is owned by TanStack Query; socket handlers update/invalidate through hooks rather than direct component listeners.
- Unsupported controls must be hidden or honestly disabled with reasons; enabled no-op controls are blocking failures.
- Production runtime must not synthesize static detail, media, voice, call, or identity content as if it were real data.
- Visual identity remains abstract and non-living.

### Integration Points
- Add call session metadata model/helper and call state transition validation.
- Add `call:*` socket handlers to or adjacent to `socket.mjs`, reusing membership, block, rate-limit, and user-socket helpers.
- Add frontend call types to `types/chat.ts` or a focused call types module.
- Add a focused call controller hook/service for media permissions, `RTCPeerConnection`, cleanup, state mapping, and call actions.
- Wire header, detail rail/drawer, and More menu call controls to the shared controller.
- Mount incoming/active call overlays at the chat route level.
- Add call activity system records to the message timeline or a safe activity projection.
- Extend backend socket tests, frontend hook/component tests, Playwright fake-media smoke, and fixture guards.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly wants Chatify to stop shipping static-looking messenger features. Phase 13 must be a real calling implementation, not a screenshot-like UI.
- Call and video controls must become functional from every visible surface, or disabled with an honest reason when browser/support/relationship state prevents calling.
- The right detail rail/drawer must remain closable and must not become a call trap.
- Existing message reliability must not regress while adding call socket events.
- Offline call behavior must be truthful: no false ringing or delivered claim.
- Production call readiness depends on TURN configuration and belongs to Phase 14 for final live proof.

</specifics>

<deferred>
## Deferred Ideas

- Group calls.
- Screen share.
- Recording.
- Transcription, captions, or AI call summaries.
- Push notifications or native background calling.
- Device picker.
- Mid-call audio/video upgrade or downgrade.
- End-to-end encrypted media beyond standard WebRTC transport security.
- Call analytics dashboard.
- Final deployed Vercel/Render acceptance, owned by Phase 14.

</deferred>

---

*Phase: 13-realtime-call-and-video-implementation*
*Context gathered: 2026-06-13*
