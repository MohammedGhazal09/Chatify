---
phase: 02-authenticated-realtime-contract
status: resolved
depth: standard
files_reviewed: 14
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
reviewed_at: 2026-06-08
resolved_at: 2026-06-08
skills_used:
  - gsd-code-review
  - find-skills
  - websocket-engineer
  - websocket-security
  - vitest-testing
  - code-review-security
  - review-security
---

# Phase 02 Code Review

Reviewed Phase 2 source/test scope inline because no subagent was explicitly requested. Scope was resolved from the three Phase 2 summary artifacts and excluded planning docs plus `package-lock.json`.

## Skill Discovery And Review Inputs

- `jeffallan/claude-skills@websocket-engineer` — selected for Socket.IO lifecycle, room, reconnection, and scaling review; 4.2K installs; copied locally, with a non-blocking PromptScript global-install warning.
- `yaklang/hack-skills@websocket-security` — selected for CSWSH, Origin, event abuse, and Socket.IO-specific security checks; 1.1K installs; copied locally, with a reported critical risk in the skill package scan, so used as checklist guidance only.
- `secondsky/claude-skills@vitest-testing` — selected for Vitest integration test review; 435 installs; copied locally, with a non-blocking PromptScript global-install warning.
- Local `code-review-security` and `review-security` skills were also used for OWASP access-control checks and evidence-based auth/state/config/DoS patterns.

## Files Reviewed

- `Backend/Chatify/Config/socket.mjs`
- `Backend/Chatify/Controller/chatController.mjs`
- `Backend/Chatify/Controller/messageController.mjs`
- `Backend/Chatify/Middlewares/protectRoutes.mjs`
- `Backend/Chatify/Utils/authToken.mjs`
- `Backend/Chatify/Utils/chatAccess.mjs`
- `Backend/Chatify/package.json`
- `Backend/Chatify/test/helpers/socketClient.mjs`
- `Backend/Chatify/test/helpers/socketServer.mjs`
- `Backend/Chatify/test/socket/socket.auth.test.mjs`
- `Backend/Chatify/test/socket/socket.authorization.test.mjs`
- `Backend/Chatify/test/socket/socket.presence-reconnect.test.mjs`
- `Frontend/Chatify/src/hooks/useChatSocket.ts`
- `Frontend/Chatify/src/store/presenceStore.ts`

## Findings

### CR-001: Cookie-authenticated sockets lack an Origin gate, leaving CSWSH open

**Severity:** Critical  
**Category:** WebSocket security / OWASP A01 broken access control  
**Files:** `Backend/Chatify/Config/socket.mjs:215`, `Frontend/Chatify/src/hooks/useChatSocket.ts:103`

`initSocket()` configures Socket.IO with `cors.origin`, then authenticates the socket solely from the `accessToken` cookie. The browser client connects with `withCredentials: true` and WebSocket-first transports. Socket.IO's own docs state that CORS only applies to HTTP long-polling and WebSocket connections are not subject to CORS restrictions; they recommend `allowRequest` when you need to restrict who can reach the server.

That means a malicious origin can attempt a WebSocket-only Socket.IO connection from a victim browser. Because Chatify production auth cookies use cross-site cookies for the Vercel/Render deployment, the victim cookie can authenticate the socket. On connect, the server auto-joins all of the victim's chat rooms and emits `socket:ready` plus later `message:new`, presence, unread, and chat lifecycle events to that attacker-controlled page.

**Recommendation:** Add a handshake-level `allowRequest` or equivalent Engine.IO gate that validates `req.headers.origin` against the same explicit frontend-origin allowlist used by Express CORS. Allow no-origin requests only for trusted non-browser clients/tests if needed. Add socket tests for:

- hostile `Origin` + valid cookie is rejected;
- allowed frontend origin + valid cookie is accepted;
- missing `Origin` behavior is intentional and documented.

**Suggested implementation shape:**

```js
const getAllowedSocketOrigins = () => {
  const origins = [getCorsOrigin()].filter(Boolean)
  return new Set(origins)
}

const isAllowedSocketRequest = (req) => {
  const origin = req.headers.origin
  if (!origin) return process.env.NODE_ENV !== 'production'
  return getAllowedSocketOrigins().has(origin)
}

io = new Server(server, {
  cors: { origin: getCorsOrigin(), credentials: true, methods: [...] },
  allowRequest: (req, callback) => callback(null, isAllowedSocketRequest(req)),
})
```

### WR-001: DB-backed socket events have no per-socket/user rate limit

**Severity:** Warning  
**Category:** Denial of service resistance  
**File:** `Backend/Chatify/Config/socket.mjs:276`

The Phase 2 handlers correctly authorize `chat:join`, `typing:start`, `typing:stop`, and `message:delivered`, but every event can perform database work: `assertChatMember()` queries chats, typing additionally loads the user, delivery loads a message and chat, and join can update delivered status for many messages. HTTP routes have `express-rate-limit`, but Socket.IO events bypass those HTTP limiters and there is no socket-side token bucket, cooldown, or repeated-abuse disconnect.

A single authenticated user can flood these events and generate amplified database reads/writes even when every request is authorized or cleanly rejected.

**Recommendation:** Add a small per-socket or per-user event limiter around DB-backed socket handlers. Keep limits event-specific, for example stricter for typing, moderate for join/leave, and separate for delivery. Return the existing structured `socket:error` payload with a stable `rate_limited` code and add Vitest coverage for burst rejection.

## Verification

- `cd Backend/Chatify; npm test -- test/socket/socket.auth.test.mjs test/socket/socket.authorization.test.mjs test/socket/socket.presence-reconnect.test.mjs` — PASS, 3 files and 15 tests.
- `rg -n "allowRequest|cors:|rate|limit|maxHttpBufferSize|typing:start|message:delivered|chat:join|socket:error|Origin|origin" Backend/Chatify/Config/socket.mjs Backend/Chatify/test/socket Backend/Chatify/test/helpers` — reviewed; no `allowRequest` or socket event rate limit exists.
- `git status --short --branch` — only the protected pre-existing `Frontend/Chatify/src/pages/chat/chat.tsx` remains dirty outside this review artifact.

## Resolution

- `CR-001` resolved in `Backend/Chatify/Config/socket.mjs` by adding a handshake-level `allowRequest` gate that validates `req.headers.origin` against the configured frontend origin. No-origin requests remain allowed outside production for local tools and tests; production fails closed when an origin is missing or unrecognized.
- `WR-001` resolved in `Backend/Chatify/Config/socket.mjs` by adding per-socket, event-specific limits around DB-backed socket handlers and returning the structured `rate_limited` socket error.
- Coverage added in `Backend/Chatify/test/socket/socket.auth.test.mjs`, `Backend/Chatify/test/socket/socket.authorization.test.mjs`, and `Backend/Chatify/test/helpers/socketClient.mjs`.

## Verdict

**PASS WITH REMEDIATIONS** - CR-001 and WR-001 are fixed and covered by targeted socket tests. Full backend Vitest is passing.
