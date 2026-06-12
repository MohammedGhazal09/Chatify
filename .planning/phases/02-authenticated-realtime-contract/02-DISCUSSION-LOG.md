# Phase 02: authenticated-realtime-contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 02-authenticated-realtime-contract
**Areas discussed:** Phase State, Socket Handshake, Authorization Contract, Rooms And Events, Private Emissions And Presence, Reconnect, Frontend Contract, Testing, Operational Safety

---

## Phase State

| Option | Description | Selected |
|--------|-------------|----------|
| Trust latest user confirmation | Treat Phase 1 as complete by user confirmation and note STATE.md as stale until workflow update. | Yes |
| Follow stale STATE.md | Block Phase 2 discussion because STATE.md still says Phase 1 is executing. | |

**User's choice:** Approved recommendation.
**Notes:** User explicitly said Phase 1 had already been finished before this discuss-phase run.

---

## Socket Handshake

| Option | Description | Selected |
|--------|-------------|----------|
| Verify accessToken cookie | Authenticate sockets using the existing cookie session in Socket.IO middleware. | Yes |
| Pass JWT in auth payload | Send a token through Socket.IO `auth`. | |
| Support both | Support cookie and auth payload. | |
| socket.data.userId | Store canonical verified identity on `socket.data.userId`. | Yes |
| existing socketToUser map | Keep current map as the canonical source. | |
| Keep user:connect as no-op | Preserve event compatibility but never use its payload for identity. | Yes |
| Remove user:connect immediately | Remove the old event without compatibility. | |
| Reject user:connect with error | Explicitly reject the old event. | |

**User's choice:** Approved recommendations.
**Notes:** Official Socket.IO docs support connection middleware, `socket.handshake`, and `socket.data`; the project already uses cookie auth.

---

## Authorization Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Reusable helper module | Centralize chat id validation and membership checks for sockets and future controller alignment. | Yes |
| Helper in socket.mjs | Keep helper local to socket server only. | |
| Inline per handler | Repeat membership checks in every handler. | |
| Connection plus per-event membership | Verify identity on connection and chat membership for every chat-scoped event. | Yes |
| Connection only | Trust room/event authorization after handshake. | |
| Ack callback plus socket:error | Return structured event errors without forcing disconnect for normal authorization failures. | Yes |
| Disconnect on every failure | Disconnect whenever an unauthorized event is attempted. | |
| Generic private-resource errors | Avoid leaking whether a chat or message exists. | Yes |
| Detailed resource errors | Return exact not-found/forbidden details. | |

**User's choice:** Approved recommendations.
**Notes:** This keeps tests deterministic while preserving the privacy boundary from the SPEC.

---

## Rooms And Events

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid room strategy | Auto-join authorized background rooms and still verify selected active chat joins. | Yes |
| Auto-join all only | Join all rooms and remove selected room semantics. | |
| Selected chat only | Join only the active chat room. | |
| Reject/deprecate message:send | Do not allow direct socket message creation or arbitrary payload broadcast. | Yes |
| Allow persisted message ids | Allow socket message events only for already-persisted messages. | |
| Derive delivery chat from messageId | Resolve message, derive chat, and verify membership before status emit. | Yes |
| Trust client chatId | Use chat id supplied by the browser. | |
| Validate chat:leave by actual room membership | Only leave rooms the socket is in and avoid side effects for arbitrary ids. | Yes |

**User's choice:** Approved recommendations.
**Notes:** Message creation remains HTTP until Phase 3 defines canonical message state.

---

## Private Emissions And Presence

| Option | Description | Selected |
|--------|-------------|----------|
| Direct target user sockets | Emit unread/private state only to the intended user's authenticated sockets. | Yes |
| Whole room with userId | Broadcast private state to all chat room members and rely on client filtering. | |
| Per-user socket-count presence | Online while at least one authenticated socket exists; offline after final disconnect. | Yes |
| Per-socket presence | Online/offline per browser tab or connection. | |
| Short offline debounce | Delay offline broadcast by roughly 3-5 seconds. | Yes |
| Immediate offline | Broadcast offline immediately on final disconnect. | |
| Server-side showOnlineStatus enforcement | Prevent hidden presence payloads from being emitted. | Yes |
| Client-side filtering | Emit and rely on clients not to show hidden status. | |

**User's choice:** Approved recommendations.
**Notes:** These decisions reduce cross-user data leakage and reconnect flicker.

---

## Reconnect

| Option | Description | Selected |
|--------|-------------|----------|
| Client refetch from server truth | Refetch/invalidate chats, unread counts, active messages, and presence on reconnect. | Yes |
| Server snapshot | Emit a large server-side snapshot after reconnect. | |
| Both | Combine refetch and snapshot. | |
| Defer Socket.IO connection state recovery | Do not enable packet replay/state recovery unless tests prove it is needed. | Yes |
| Enable recovery now | Enable Socket.IO connection state recovery during Phase 2. | |

**User's choice:** Approved recommendations.
**Notes:** TanStack Query already owns server-state refresh, and the SPEC prioritizes server-truth reconciliation.

---

## Frontend Contract

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal hook alignment | Update `useChatSocket.ts` for auth contract, errors, and reconnect invalidation only. | Yes |
| Broad frontend refactor | Rework chat page/UI around the socket changes. | |
| Keep transport policy | Preserve `withCredentials: true` and `['websocket', 'polling']` unless tests find CORS/cookie issues. | Yes |
| Change transport policy | Redesign transport order/options now. | |

**User's choice:** Approved recommendations.
**Notes:** Phase 4 owns UI reconstruction, and the project has protected dirty work in `Frontend/Chatify/src/pages/chat/chat.tsx`.

---

## Testing

| Option | Description | Selected |
|--------|-------------|----------|
| Test HTTP server from app.mjs | Create a test HTTP server from the Express app and initialize Socket.IO in tests. | Yes |
| Start server.mjs | Start the production server entry point in tests. | |
| Mock Socket.IO | Unit-test handlers without real client/server sockets. | |
| Real cookie from auth helpers | Authenticate socket clients using cookies from signup/login helpers. | Yes |
| Fake token | Bypass normal auth helpers. | |
| Full Phase 2 blocking suite | Cover handshake, forged identity, non-member events, direct unread, presence, and reconnect. | Yes |
| Minimal handshake only | Cover only socket auth success/failure. | |

**User's choice:** Approved recommendations.
**Notes:** This extends the Phase 1 Vitest/Supertest/MongoDB Memory Server approach with real Socket.IO client/server integration.

---

## Operational Safety

| Option | Description | Selected |
|--------|-------------|----------|
| Use existing/local redacted logs | Reuse Phase 1 helpers if present or add small socket-local redaction. | Yes |
| Add logging library | Add a general logging framework now. | |
| Document single-process limitation | Note the current in-memory presence limitation and defer Redis adapter. | Yes |
| Implement Redis adapter now | Add shared Socket.IO adapter infrastructure in Phase 2. | |

**User's choice:** Approved recommendations.
**Notes:** Keeps Phase 2 scoped to the security contract while preserving a clear scaling note.

---

## Agent Discretion

- Exact helper names and module placement for chat membership authorization.
- Exact stable `socket:error` payload shape.
- Exact TanStack Query invalidation/refetch mechanics for reconnect.

## Deferred Ideas

- Redis adapter or shared Socket.IO presence store - deferred to a later scaling/deployment phase.
