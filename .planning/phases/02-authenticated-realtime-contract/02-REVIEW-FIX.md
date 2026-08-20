# Phase 02 Review Fix

## Status

Resolved on 2026-06-08.

## Findings Fixed

### CR-001: Cookie-authenticated sockets lack an Origin gate

Fixed in `Backend/Chatify/Config/socket.mjs`.

- Added `allowRequest` to Socket.IO server initialization.
- Validates browser `Origin` against the configured frontend origin used by CORS.
- Allows missing `Origin` only outside production for local non-browser clients and tests.
- Rejects hostile websocket-only handshakes before socket authentication runs.

### WR-001: DB-backed socket events have no per-socket/user rate limit

Fixed in `Backend/Chatify/Config/socket.mjs`.

- Added per-socket event windows for `chat:join`, `chat:leave`, `message:delivered`, `typing:start`, and `typing:stop`.
- Returns the structured socket error code `rate_limited` with message `Too many socket events`.
- Clears limiter state on socket disconnect and socket server shutdown.

## Tests Added

- `Backend/Chatify/test/socket/socket.auth.test.mjs`
  - Accepts a configured frontend origin.
  - Rejects a hostile websocket origin with a valid auth cookie.
- `Backend/Chatify/test/socket/socket.authorization.test.mjs`
  - Verifies repeated DB-backed socket events return `rate_limited`.
- `Backend/Chatify/test/helpers/socketClient.mjs`
  - Supports merged auth cookie and custom test headers across polling and websocket transports.

## Verification

- `cd Backend/Chatify; npm test -- --run test/socket/socket.auth.test.mjs test/socket/socket.authorization.test.mjs` - PASS, 2 files and 14 tests.
- `cd Backend/Chatify; npm test` - PASS, 5 files and 30 tests.

## Notes

- `Frontend/Chatify/src/pages/chat/chat.tsx` was intentionally not modified because it is protected pre-existing local work.
