# Phase 02: authenticated-realtime-contract - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers Chatify's authenticated realtime contract: Socket.IO connections derive identity from the verified cookie session, every chat-scoped socket event is authorized against server-side membership, private realtime emissions are targeted to the intended user, presence is privacy-aware across reconnects and multiple sockets, and backend socket integration tests block regressions. It does not redesign canonical message state, rebuild the chat UI, add search, or introduce new product notification/group features.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**9 requirements are locked.** See `02-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `02-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Authenticated Socket.IO handshake that derives identity from verified session data.
- Removal or neutralization of client-supplied realtime identity such as `user:connect(userId)`.
- Server-side membership checks for chat room joins and every client-origin chat-scoped socket event.
- Structured socket authorization failures that tests can assert without leaking private chat/message existence.
- User-specific unread updates delivered only to the intended user's authenticated sockets.
- Presence privacy and multi-socket online/offline lifecycle.
- Reconnect reconciliation for conversation list state, selected chat messages, unread counts, and presence.
- Necessary frontend socket hook alignment with the new backend contract.
- Backend socket integration tests and verification evidence for the Phase 2 contract.

**Out of scope (from SPEC.md):**
- Canonical message send, receive, edit, delete, reaction, unread-count model, and pagination redesign - Phase 3 owns message state determinism.
- Chat UI reconstruction, layout polish, visual states, and component splitting - Phase 4 owns the messenger UI.
- Conversation/contact search, message search, and conversation continuity polish - Phase 5 owns baseline completion.
- User-facing group chat expansion - v2 defers group conversations, although authorization must work for the existing `Chats.members` array.
- Push, email, or product notification features - v2 defers notifications; Phase 2 only secures any existing notification-style realtime events.
- Rebuilding Phase 1 auth/session/security foundations - Phase 2 consumes Phase 1 as complete.
- Broad rewrites of unrelated frontend files, especially the existing local work in `Frontend/Chatify/src/pages/chat/chat.tsx`.

</spec_lock>

<decisions>
## Implementation Decisions

### Phase State
- **D-01:** Treat Phase 1 as complete by explicit user confirmation and treat the current `.planning/STATE.md` Phase 1 execution status as stale until the workflow state is updated.

### Socket Handshake
- **D-02:** Authenticate Socket.IO connections by verifying the existing `accessToken` cookie in Socket.IO connection middleware.
- **D-03:** Keep the normal production/client contract cookie-based. Test clients may pass cookie headers explicitly so socket integration tests exercise the same session boundary.
- **D-04:** Store canonical verified identity on `socket.data.userId`; keep `socketToUser` and `userToSockets` only as derived lookup indexes for presence and targeted emits.
- **D-05:** Keep `user:connect(userId)` temporarily as a no-op or structured deprecation response, but it must never set or override socket identity.

### Authorization Contract
- **D-06:** Create a small reusable chat-access helper for validating chat ids and server-side membership. Use it from socket handlers and, where practical, align future controller membership checks with it.
- **D-07:** Verify identity once during connection, but verify chat membership on every client-origin chat-scoped event.
- **D-08:** Return stable authorization failures through ack callback errors when the client provided a callback, plus a stable `socket:error` fallback event for fire-and-forget emissions.
- **D-09:** Disconnect immediately only for handshake authentication failure or repeated abusive unauthorized behavior, not for ordinary event-level authorization mistakes.
- **D-10:** Use generic private-resource errors such as `forbidden_or_not_found`; do not reveal whether a private chat or message id exists to unauthorized users.

### Rooms And Events
- **D-11:** Use a hybrid room strategy: after authentication, auto-join rooms needed for inbox, unread, chat-created, and background realtime updates; still require verified selected-room joins for active chat behavior.
- **D-12:** Reject or deprecate direct socket `message:send` in Phase 2. Message creation remains on the authenticated HTTP endpoint until Phase 3 defines canonical message state.
- **D-13:** Do not trust client-supplied `chatId` for `message:delivered`. Resolve the message by `messageId`, derive the chat id from the persisted message, verify membership, then emit status updates.
- **D-14:** For `chat:leave`, validate payload shape and allow leaving only rooms the socket is actually in. It must not trigger unauthorized side effects for arbitrary chat ids.

### Private Emissions And Presence
- **D-15:** Emit `unread:update` and other user-specific realtime state only to the intended user's authenticated sockets, not to the whole chat room with client-side filtering.
- **D-16:** Presence is per authenticated user, not per socket: a user remains online while at least one authenticated socket exists and goes offline only after the final socket disconnects.
- **D-17:** Use a short offline debounce of roughly 3-5 seconds to avoid online/offline flicker during reconnects.
- **D-18:** Enforce `showOnlineStatus` privacy server-side before every presence broadcast. Clients should never receive hidden presence payloads.

### Reconnect
- **D-19:** On reconnect, the frontend should refetch or invalidate chats, unread counts, selected chat messages, and presence from server truth. The server may emit a lightweight `socket:ready` event after authenticated setup.
- **D-20:** Do not enable Socket.IO connection state recovery in Phase 2 unless tests prove it is necessary. Reconciliation should come from server truth, not packet replay.

### Frontend Contract
- **D-21:** Keep frontend work limited to `useChatSocket.ts` and nearby typed event contracts where possible: remove identity emission, handle `connect_error` and `socket:error`, trigger reconnect invalidations, and keep visible UI changes minimal.
- **D-22:** Preserve `withCredentials: true` and the current transport order `['websocket', 'polling']` unless integration tests reveal cookie/CORS problems.
- **D-23:** Do not rewrite or overwrite the dirty local `Frontend/Chatify/src/pages/chat/chat.tsx` as part of Phase 2 planning unless the user explicitly authorizes it.

### Testing
- **D-24:** Socket integration tests should create a test HTTP server from `Backend/Chatify/app.mjs` and initialize Socket.IO for the test process. Do not start production `server.mjs`.
- **D-25:** Socket integration clients should authenticate by using existing signup/login helpers to obtain the `accessToken` cookie, then pass that cookie to the Socket.IO client request.
- **D-26:** The minimum blocking socket suite covers authenticated handshake success, unauthenticated handshake failure, forged `user:connect`, non-member join rejection, unauthorized typing rejection, unauthorized delivery rejection, `message:send` rejection, direct unread emissions, multi-socket presence, and reconnect invalidation.
- **D-27:** Prefer real Socket.IO clients and MongoDB-memory-backed fixtures over mocking Socket.IO for contract tests.

### Operational Safety
- **D-28:** Do not add a general logging library in Phase 2. Use Phase 1 redaction helpers if present; otherwise add small local redacted socket logs.
- **D-29:** Document the current single-process Socket.IO presence limitation and defer a Redis adapter or shared presence store to a later scaling phase.

### Agent Discretion
- Planners may choose exact helper names and module placement for chat membership authorization, as long as socket handlers do not duplicate unsafe ad hoc checks.
- Planners may choose whether `socket:error` payloads use `code`, `event`, and `message` fields or an equivalent stable shape, as long as tests assert it and private resource existence is not leaked.
- Planners may choose the exact reconnect invalidation mechanism in TanStack Query, as long as chats, unread counts, active messages, and presence refresh from server truth.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Requirements
- `.planning/phases/02-authenticated-realtime-contract/02-SPEC.md` - locked Phase 2 requirements, boundaries, constraints, and acceptance criteria.
- `.planning/phases/01-security-and-test-foundation/01-CONTEXT.md` - Phase 1 decisions establishing the backend test harness, cookie/session baseline, and explicit handoff of socket auth to Phase 2.

### Project Planning
- `.planning/ROADMAP.md` - Phase 2 plan split and dependency on Phase 1.
- `.planning/REQUIREMENTS.md` - RT-01 through RT-05 and TEST-02 requirement traceability.
- `.planning/PROJECT.md` - project core value, brownfield constraints, security posture, and dirty chat page warning.
- `.planning/STATE.md` - current GSD state; note that Phase 1 status may be stale relative to the user's confirmation.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - realtime flow, socket singleton pattern, auth boundary, and frontend hook layering.
- `.planning/codebase/INTEGRATIONS.md` - Socket.IO client/server integration, CORS credentials, auth cookie, and required env vars.
- `.planning/codebase/CONCERNS.md` - socket identity, room authorization, presence, and socket test gaps.

### External Guidance Considered
- `https://socket.io/docs/v4/middlewares/` - Socket.IO connection middleware, auth errors, and Express middleware compatibility.
- `https://socket.io/docs/v4/server-socket-instance/` - `socket.handshake`, `socket.data`, and server-side socket middleware behavior.
- `https://socket.io/docs/v4/client-options/#withcredentials` - credentialed Socket.IO client cookies and non-wildcard CORS requirement.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Backend/Chatify/app.mjs`: Express app export should be reused to create a test HTTP server for socket integration tests.
- `Backend/Chatify/Config/socket.mjs`: Current Socket.IO singleton owns handshake, room joins, presence maps, typing, delivery, and helper exports; this is the primary Phase 2 implementation target.
- `Backend/Chatify/Middlewares/protectRoutes.mjs`: Existing JWT cookie verification behavior can guide extraction of a shared socket-safe token verification helper.
- `Backend/Chatify/Controller/messageController.mjs`: Existing `loadChatForUser()` pattern demonstrates server-side membership checks that Phase 2 should centralize or mirror safely.
- `Backend/Chatify/Controller/chatController.mjs`: Uses `getUserSockets()`, `joinUserToChat()`, and `removeUserFromChat()`; those helpers need to remain compatible with the new verified identity maps.
- `Backend/Chatify/test/helpers/authAgent.mjs`: Signup/login helpers can produce authenticated cookies for socket integration clients.
- `Backend/Chatify/test/fixtures/users.mjs`, `chats.mjs`, `messages.mjs`: Fixture factories can create members, outsiders, chats, and messages for authorization tests.
- `Frontend/Chatify/src/hooks/useChatSocket.ts`: Frontend contract target for removing `user:connect(user._id)`, handling errors, and triggering reconnect invalidation.
- `Frontend/Chatify/src/store/presenceStore.ts`: Existing presence state consumer should remain the frontend target for authorized presence updates.

### Established Patterns
- Backend uses ESM `.mjs`, named controller/helper exports, Mongoose models, and explicit route/controller layering.
- Backend tests now use Vitest, Supertest, and MongoDB Memory Server; Phase 2 should extend that test stack rather than introduce a second test framework.
- Frontend realtime wiring belongs in `useChatSocket.ts`, not directly in UI components.
- Frontend server state should refresh through TanStack Query invalidation/refetch, not by adding broad local state patches in the chat page.
- Socket.IO rooms are chat-id rooms today; Phase 2 should preserve that concept but only after server-side membership verification.

### Integration Points
- Socket auth middleware should be installed inside `initSocket(server)` before `io.on('connection', ...)`.
- Socket CORS in `Backend/Chatify/Config/socket.mjs` must stay aligned with Express CORS in `Backend/Chatify/app.mjs`.
- Verified socket identity must feed `socketToUser`, `userToSockets`, `isUserOnline()`, `getOnlineUsers()`, `getUserSockets()`, `joinUserToChat()`, and `removeUserFromChat()`.
- `messageController.mjs` emits `message:new`, `unread:update`, `message:read`, `messages:read-batch`, `message:deleted`, `message:edited`, and `message:reaction`; Phase 2 should secure user-specific emits without redesigning message state semantics.
- Reconnect behavior connects `useChatSocket.ts` with query keys from `useChatQueries.ts`, especially chats, messages, and unread counts.

</code_context>

<specifics>
## Specific Ideas

- User approved all recommended implementation decisions in the one-shot questionnaire.
- Keep the Phase 2 implementation security-first and contract-focused; avoid broad UI reconstruction.
- Use official Socket.IO connection middleware and `socket.data` as the basis for authenticated socket identity.
- Prefer targeted user socket emissions for unread/private state over room-wide payloads that clients filter locally.
- Treat Socket.IO connection state recovery as unnecessary for this phase unless tests prove otherwise.

</specifics>

<deferred>
## Deferred Ideas

- Redis adapter or shared Socket.IO presence store - defer to a later scaling/deployment phase after the single-process contract is correct and tested.

</deferred>

---

*Phase: 02-authenticated-realtime-contract*
*Context gathered: 2026-06-08*
