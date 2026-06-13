---
phase: 13-realtime-call-and-video-implementation
review_fix: 13
status: fixed
source_review: 13-REVIEW.md
fixed_findings:
  critical: 1
  warning: 1
verification:
  - "Frontend/Chatify: npm test -- --run src/hooks/useChatSocket.test.tsx src/hooks/useCallController.test.tsx -> passed"
  - "Backend/Chatify: npm test -- --run test/socket/socket.calls.test.mjs -> passed"
  - "Backend/Chatify: npm test -- --run test/socket/socket.calls.test.mjs test/socket/socket.call-auth.test.mjs test/socket/socket.call-blocking.test.mjs -> passed"
  - "Frontend/Chatify: npm run lint -> passed"
  - "Frontend/Chatify: npm run build -> passed"
  - "Frontend/Chatify: npm test -- --run -> passed"
  - "Backend/Chatify: npm test -- --run -> passed"
---

# Phase 13 Review Fix

## Fix Summary

Resolved all findings from `13-REVIEW.md`.

### CR-01: Active calls could be orphaned after socket disconnect

Fixed.

- Added explicit `isSocketConnected` state to `useChatSocket`.
- Updated `ChatPage` call availability, reconnect UI, detail rail, and drawer props to use that explicit state instead of the mutable `socket.connected` field.
- Blocked call action emits while the socket is disconnected, returning `socket_unavailable` immediately.
- Added backend participant disconnect cleanup with a grace period. If the user's last socket stays disconnected, the active call is marked failed, participant sockets receive `call:sync`, and a call activity message is emitted.
- Added regression coverage for frontend disconnect state and backend accepted-call cleanup.

### WR-01: Call signaling accepted unvalidated payloads

Fixed.

- Added backend validation for `call:offer`, `call:answer`, and `call:ice-candidate`.
- Forwarded only sanitized, bounded WebRTC signal fields to the peer.
- Added `invalid_call_signal` acknowledgement copy.
- Added backend regression coverage proving malformed and oversized signals are rejected before peer delivery.

## Verification Results

```powershell
cd Frontend/Chatify
npm test -- --run src/hooks/useChatSocket.test.tsx src/hooks/useCallController.test.tsx
```

Result: passed, 2 test files, 14 tests.

```powershell
cd Backend/Chatify
npm test -- --run test/socket/socket.calls.test.mjs
```

Result: passed, 1 test file, 7 tests.

```powershell
cd Backend/Chatify
npm test -- --run test/socket/socket.calls.test.mjs test/socket/socket.call-auth.test.mjs test/socket/socket.call-blocking.test.mjs
```

Result: passed, 3 test files, 12 tests.

```powershell
cd Frontend/Chatify
npm run lint
```

Result: passed.

```powershell
cd Frontend/Chatify
npm run build
```

Result: passed.

```powershell
cd Frontend/Chatify
npm test -- --run
```

Result: passed, 28 test files, 113 tests.

```powershell
cd Backend/Chatify
npm test -- --run
```

Result: passed, 24 test files, 114 tests.
