# Phase 2: Authenticated Realtime Contract - Specification

**Created:** 2026-06-08
**Ambiguity score:** 0.11 (gate: <= 0.20)
**Requirements:** 9 locked

## Goal

Socket.IO realtime chat changes from client-identified, chat-id-trusting events to session-authenticated sockets with server-side membership checks for every chat-scoped realtime action.

## Background

Phase 1 is complete per user confirmation, so Phase 2 can depend on the auth/session and test foundation being available. The current Socket.IO server in `Backend/Chatify/Config/socket.mjs` accepts a socket connection before identity is established, then trusts `user:connect(userId)` from the browser. That client-supplied id is used to populate `socketToUser`, auto-join rooms, update online status, and broadcast presence. `chat:join`, `chat:leave`, `typing:start`, `typing:stop`, and `message:delivered` accept supplied chat ids without a centralized membership check. `message:send` can broadcast an arbitrary message payload over a supplied room even though canonical message creation is handled by the authenticated HTTP controller.

The frontend hook in `Frontend/Chatify/src/hooks/useChatSocket.ts` currently emits `user:connect` with `user._id` after connect and emits selected room, typing, and delivery events by chat id. Existing backend tests cover auth lifecycle and HTTP message authorization, but there are no socket integration tests for authenticated handshake, forged identity rejection, room authorization, reconnect, or presence behavior.

## Requirements

1. **Verified socket identity**: Socket connections derive the authenticated user id from verified session data and never from client-supplied user ids.
   - Current: The socket server waits for `user:connect(userId)` and stores the client-provided id in `socketToUser`.
   - Target: A socket is associated with a user only after the server verifies the same authenticated session boundary used by protected cookie-authenticated HTTP requests.
   - Acceptance: A socket with a valid authenticated session is accepted and associated with the correct user; a socket without a valid session is rejected with a stable auth failure that tests can assert.

2. **Client identity payload rejection**: The realtime contract forbids client-supplied identity from establishing or changing socket identity.
   - Current: `Frontend/Chatify/src/hooks/useChatSocket.ts` emits `user:connect` with `user._id`, and the backend trusts it.
   - Target: `user:connect` is removed or treated as a compatibility no-op whose payload cannot set or override identity.
   - Acceptance: A client that emits `user:connect` with another user's id remains associated with the authenticated session user or receives a rejection; it cannot join that other user's chats or broadcast as that user.

3. **Chat room authorization**: Room join and leave behavior is authorized by server-side chat membership.
   - Current: `chat:join` joins any supplied room id and `chat:leave` leaves any supplied room id without verifying that the socket user belongs to the chat.
   - Target: The server verifies `Chats.members` for the socket user before allowing any room join or room-scoped side effect.
   - Acceptance: A chat member can join their chat room; a non-member attempting to join another chat receives a structured rejection and does not enter the Socket.IO room.

4. **Chat-scoped event authorization**: Every client-origin chat-scoped socket event is rejected unless the authenticated socket user is authorized for the referenced chat.
   - Current: Typing, delivery, and socket `message:send` events trust supplied ids or payloads enough to broadcast or mutate state.
   - Target: `typing:start`, `typing:stop`, `message:delivered`, `chat:join`, `chat:leave`, and any remaining client-origin chat-scoped socket event enforce membership before broadcast or mutation.
   - Acceptance: Tests show non-members cannot trigger typing, delivery, or message broadcasts into another chat, while authorized members can trigger allowed events.

5. **Socket message sending boundary**: Phase 2 does not introduce or preserve socket-driven message creation as a trusted path.
   - Current: `message:send` can broadcast an arbitrary message object to a supplied room without persistence or HTTP authorization.
   - Target: Message creation remains on the authenticated HTTP endpoint until Phase 3 defines canonical message state; socket `message:send` is rejected, ignored with an explicit deprecation path, or limited to already-authorized persisted messages.
   - Acceptance: A client cannot create or broadcast an unpersisted arbitrary message to a chat solely through `message:send`.

6. **Private user-specific emissions**: User-specific realtime updates are delivered only to authenticated sockets for the intended user.
   - Current: `unread:update` is emitted into the whole chat room with a target `userId` in the payload, and clients filter locally.
   - Target: Unread updates and other user-specific realtime state are emitted only to the target user's authenticated sockets.
   - Acceptance: A second chat member connected to the same room does not receive another user's unread update payload in socket integration tests.

7. **Presence privacy and lifecycle**: Presence is scoped to authorized contacts and remains correct across multi-socket connect/disconnect cycles.
   - Current: Presence is based on the client-selected identity, broadcasts to rooms for that supplied user, and marks offline when the last mapped socket disconnects.
   - Target: Presence uses verified socket identity, respects `showOnlineStatus`, is visible only to users sharing an authorized chat, keeps a user online while any authenticated socket remains connected, and marks offline only after the final socket disconnects.
   - Acceptance: Tests cover two simultaneous sockets for one user, one disconnect preserving online state, final disconnect emitting offline/lastSeen only to authorized contacts, and no presence broadcast for users with online-status privacy disabled.

8. **Reconnect reconciliation contract**: Reconnect restores realtime state from server truth rather than trusting missed socket events.
   - Current: Reconnect behavior is not covered by socket integration tests, and selected chat messages, conversation list state, unread counts, and presence may depend on client cache state.
   - Target: On socket reconnect, the app reconciles conversation list, selected chat messages, unread counts, and presence from server truth. Full message pagination redesign remains Phase 3.
   - Acceptance: A reconnect scenario causes the client/server contract to refresh or re-emit enough state for chats, active messages, unread counts, and presence to match persisted server state.

9. **Blocking socket integration verification**: Phase 2 produces automated backend socket integration coverage for the authenticated realtime contract.
   - Current: Backend Vitest tests cover HTTP auth/message authorization, but no socket integration tests cover handshake identity, unauthorized room access, unauthorized event rejection, reconnect, or presence.
   - Target: Vitest socket integration tests cover successful authenticated handshake, unauthenticated rejection, forged user id rejection, non-member room rejection, unauthorized typing/delivery/message-send rejection, authorized event delivery, reconnect reconciliation, and multi-socket presence behavior.
   - Acceptance: `npm test` from `Backend/Chatify` runs the socket integration suite and fails if any locked realtime authorization contract is violated.

## Boundaries

**In scope:**
- Authenticated Socket.IO handshake that derives identity from verified session data.
- Removal or neutralization of client-supplied realtime identity such as `user:connect(userId)`.
- Server-side membership checks for chat room joins and every client-origin chat-scoped socket event.
- Structured socket authorization failures that tests can assert without leaking private chat/message existence.
- User-specific unread updates delivered only to the intended user's authenticated sockets.
- Presence privacy and multi-socket online/offline lifecycle.
- Reconnect reconciliation for conversation list state, selected chat messages, unread counts, and presence.
- Necessary frontend socket hook alignment with the new backend contract.
- Backend socket integration tests and verification evidence for the Phase 2 contract.

**Out of scope:**
- Canonical message send, receive, edit, delete, reaction, unread-count model, and pagination redesign - Phase 3 owns message state determinism.
- Chat UI reconstruction, layout polish, visual states, and component splitting - Phase 4 owns the messenger UI.
- Conversation/contact search, message search, and conversation continuity polish - Phase 5 owns baseline completion.
- User-facing group chat expansion - v2 defers group conversations, although authorization must work for the existing `Chats.members` array.
- Push, email, or product notification features - v2 defers notifications; Phase 2 only secures any existing notification-style realtime events.
- Rebuilding Phase 1 auth/session/security foundations - Phase 2 consumes Phase 1 as complete.
- Broad rewrites of unrelated frontend files, especially the existing local work in `Frontend/Chatify/src/pages/chat/chat.tsx`.

## Constraints

- Keep the existing MERN stack, Socket.IO 4.x, Express, MongoDB/Mongoose, TanStack Query, Zustand, Tailwind, and npm package layout.
- Preserve cookie-authenticated requests and socket credentials across local Vite, Render backend, and Vercel frontend origin configuration.
- Socket identity and membership failures must not log secrets, full tokens, raw cookies, reset codes, OAuth payloads, or unnecessary user-identifying data.
- Resource-existence leakage must be minimized: unauthorized users must not learn private chat or message existence from detailed socket errors.
- Socket tests must use the existing backend Vitest test harness where practical and must not depend on production services.
- Frontend work is limited to contract alignment needed by Phase 2; frontend UI tests are required only if Phase 2 changes user-visible hook behavior beyond connection/error/reconnect handling.

## Acceptance Criteria

- [ ] A socket without a valid authenticated session is rejected before chat room or event logic runs.
- [ ] A socket with a valid authenticated session is associated with the server-verified user id.
- [ ] Emitting `user:connect` with a forged user id cannot establish or change socket identity.
- [ ] A non-member cannot join another user's chat room.
- [ ] A non-member cannot emit typing, delivery, message-send, notification-style, or other chat-scoped socket events into another user's chat.
- [ ] Authorized chat members can join rooms and receive allowed realtime events after membership is verified.
- [ ] User-specific unread updates are delivered only to the intended user's authenticated sockets.
- [ ] Presence is broadcast only to authorized contacts, respects online-status privacy, and handles multiple simultaneous sockets for one user.
- [ ] Reconnect reconciles conversation list state, selected chat messages, unread counts, and presence from server truth.
- [ ] Backend socket integration tests cover handshake, forged identity, room authorization, event authorization, reconnect, and presence lifecycle.
- [ ] `npm test` from `Backend/Chatify` passes with the Phase 2 socket integration suite included.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.92  | 0.75  | met    | Goal locks the shift from client identity to session-authenticated realtime identity. |
| Boundary Clarity    | 0.90  | 0.70  | met    | Phase 3 message state, Phase 4 UI, Phase 5 baseline features, and v2 expansion are explicitly excluded. |
| Constraint Clarity  | 0.84  | 0.65  | met    | Stack, cookie/CORS alignment, privacy, logging, and testing constraints are explicit. |
| Acceptance Criteria | 0.88  | 0.70  | met    | Pass/fail criteria cover identity, membership, event rejection, presence, reconnect, and tests. |
| **Ambiguity**       | 0.11  | <=0.20| met    | Gate passed after user approved all recommendations and confirmed Phase 1 completion. |

Status: met = met minimum, below = below minimum (planner treats as assumption).

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists in socket identity today? | Current code trusts `user:connect(userId)` and must move to verified session identity. |
| 1 | Researcher | What triggers this phase? | Existing socket joins/events can trust client-supplied ids and chat ids. |
| 2 | Simplifier | What is the irreducible Phase 2 core? | Secure handshake, room/event authorization, presence/reconnect contract, and socket integration tests. |
| 2 | Simplifier | Should socket message creation be redesigned now? | No; keep message creation on authenticated HTTP until Phase 3. |
| 3 | Boundary Keeper | What stays out of scope? | Canonical message state, UI reconstruction, search/baseline polish, group expansion, notifications, and Phase 1 rebuilds. |
| 3 | Boundary Keeper | What is the final deliverable? | Updated realtime contract, necessary frontend hook alignment, socket integration tests, and verification evidence. |
| 4 | Failure Analyst | What would make the output insecure? | Trusting client identity, allowing non-member joins/events, leaking user-specific unread/presence, or missing socket tests. |
| 4 | Failure Analyst | What should verifier rejection cover? | Any forged identity, unauthorized chat event, absent reconnect reconciliation, or absent socket integration test coverage. |
| 5 | Seed Closer | How should Phase 1 dependency be treated? | Phase 1 is complete per user confirmation and Phase 2 can depend on it. |
| 5 | Seed Closer | How should unanswered recommendations be handled? | User approved all recommendations, so all questionnaire decisions are locked. |

---

*Phase: 02-authenticated-realtime-contract*
*Spec created: 2026-06-08*
*Next step: $gsd-discuss-phase 2 - implementation decisions (how to build what is specified above)*
