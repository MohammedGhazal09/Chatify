# Phase 02 Research: Authenticated Realtime Contract

**Created:** 2026-06-08
**Phase:** 02-authenticated-realtime-contract

## Research Questions

1. How should Socket.IO authenticate cookie-backed browser clients before any event handler runs?
2. Where should trusted socket identity live after authentication?
3. How should event-level authorization failures be reported without leaking private chat existence?
4. How should backend socket integration tests carry the existing `accessToken` cookie?
5. Which skills should shape the implementation plan?

## Sources Consulted

- Socket.IO middlewares: https://socket.io/docs/v4/middlewares/
- Socket.IO server socket instance: https://socket.io/docs/v4/server-socket-instance/
- Socket.IO client options: https://socket.io/docs/v4/client-options/
- Local skill: `C:\Users\saieh\.agents\skills\websocket-engineer\SKILL.md`
- Local skill: `C:\Users\saieh\.agents\skills\node\SKILL.md`
- Local skill: `C:\Users\saieh\.agents\skills\vitest-testing\SKILL.md`
- Local skill: `C:\Users\saieh\.agents\skills\jwt-security\SKILL.md`

## Findings

### Socket.IO connection middleware is the right handshake gate

Socket.IO `io.use((socket, next) => ...)` runs once per incoming connection before the socket reaches `io.on('connection')`. If middleware calls `next(new Error(...))`, the connection is refused and the client receives a `connect_error` event. This fits Phase 2's requirement that unauthenticated sockets fail before room or event logic runs.

**Recommendation:** Add socket authentication middleware inside `initSocket(server)` before the connection handler. The middleware should parse `socket.handshake.headers.cookie`, verify the existing `accessToken` with the same JWT secret used by protected HTTP requests, and reject missing or invalid cookies with stable error codes such as `socket_auth_required` and `socket_auth_invalid`.

### Trusted identity belongs on `socket.data`

Socket.IO exposes `socket.handshake` for request metadata and `socket.data` for application metadata attached to a server-side socket. Socket IDs are ephemeral and should not be used as durable user identity.

**Recommendation:** Store the verified user id as `socket.data.userId`. Keep `socketToUser` and `userToSockets` only as derived lookup indexes for presence and targeted user emissions.

### Browser cookie credentials require aligned client and server CORS

The Socket.IO client option `withCredentials: true` sends cookies and other credentials on cross-site requests. The server must use credentialed CORS with an explicit origin, not `origin: '*'`. The Node.js client also honors `withCredentials` in current Socket.IO 4.x, and Node test clients can send explicit headers through `extraHeaders`.

**Recommendation:** Preserve `withCredentials: true` and `transports: ['websocket', 'polling']` in `Frontend/Chatify/src/hooks/useChatSocket.ts`. Backend socket CORS should stay aligned with Express CORS via `FRONTEND_ORIGIN` and `FRONTEND_ORIGIN_DEV`. Socket integration helpers should pass `extraHeaders: { Cookie: accessTokenCookie }` from signup/login responses.

### Event authorization should be per event, not just per connection

Handshake authentication proves who the socket belongs to; it does not prove the user may act on a supplied chat or message id. The current socket handlers accept chat ids from clients, so membership must be checked every time a chat-scoped event is processed.

**Recommendation:** Add a small `chatAccess` helper that validates ObjectId shape, loads the chat or message-derived chat, checks `Chats.members`, and returns generic `forbidden_or_not_found` failures. Use it from `chat:join`, `chat:leave`, `typing:start`, `typing:stop`, `message:delivered`, and any remaining client-origin chat-scoped events.

### Acknowledgments plus fallback errors make tests stable

Socket.IO supports callbacks for acknowledgments. Fire-and-forget browser emits may not pass callbacks, so server-side failures still need a fallback event.

**Recommendation:** Implement a shared socket failure helper that calls the ack callback when provided and otherwise emits `socket:error` with `{ code, event, message }`. Use generic messages for private resources.

### Presence remains single-process until a later scaling phase

The existing app stores online socket mappings in memory. That is acceptable for a Phase 2 correctness contract on one Node process but not sufficient for horizontal scaling.

**Recommendation:** Keep the single-process map for Phase 2, add multi-socket lifecycle tests, document the limitation, and defer Redis adapter/shared presence state until after the contract is secure and tested.

## Skill Discovery And Use

`find-skills` search results found these useful skills:

- `jeffallan/claude-skills@websocket-engineer` - best match for Socket.IO authentication, rooms, presence, and realtime testing; installed/copied locally for this run.
- `mcollina/skills@node` - best match for Node.js backend execution and deterministic resource teardown; an installed `node` skill was used.
- `secondsky/claude-skills@vitest-testing` and the installed local `vitest-testing` skill - used for backend integration test organization.
- Existing `jwt-security` skill - used to shape cookie/JWT verification boundaries and avoid accepting unverified client identity.

## Planning Recommendations

1. Split Phase 2 into three sequential waves because later work depends on trusted socket identity:
   - Wave 1: authenticated handshake and frontend identity-emission removal.
   - Wave 2: chat membership authorization and targeted private emits.
   - Wave 3: reconnect reconciliation, privacy-aware presence, and full socket integration verification.
2. Add `socket.io-client` as a backend dev dependency so `Backend/Chatify` can run socket integration tests without relying on frontend dependencies.
3. Keep `message:send` rejected or explicitly deprecated in Phase 2. Canonical message creation remains on the authenticated HTTP endpoint until Phase 3.
4. Avoid `Frontend/Chatify/src/pages/chat/chat.tsx`; align frontend behavior through `useChatSocket.ts`, typed events, query invalidation, and presence store only.
