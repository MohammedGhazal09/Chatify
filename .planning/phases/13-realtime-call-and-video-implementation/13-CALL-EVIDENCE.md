---
phase: 13-realtime-call-and-video-implementation
artifact: call-evidence
completed: 2026-06-13
---

# Phase 13 Call Evidence

## Implementation Evidence

- Backend call authority: committed in `4973172`.
- Frontend call UI, lifecycle cleanup, call activity rendering, fixture guards, and browser smoke: committed in `334b427`.
- Call controls now route through one shared frontend controller from header, detail rail/drawer, and More menu.
- Incoming, outgoing, connecting, connected, reconnecting, failed, rejected, missed, busy, and permission-denied call states render through route-level `CallOverlay`.
- Call activity history renders as centered system timeline rows, not normal user message bubbles.
- WebRTC signaling payloads remain transient socket events. Persisted call activity stores only call id, participants, mode, result, timestamps, and duration.

## Verification Commands

- `cd Frontend/Chatify; npm test -- --run` - passed, 28 files / 112 tests.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed.
- `cd Backend/Chatify; npm test -- --run test/socket/socket.calls.test.mjs test/socket/socket.call-auth.test.mjs test/socket/socket.call-blocking.test.mjs test/message/message.call-activity.test.mjs test/message/message.idempotency.test.mjs test/socket/socket.message-state.test.mjs` - passed, 6 files / 26 tests.
- `cd Backend/Chatify; npm test -- --run` - passed, 24 files / 112 tests.
- `cd Frontend/Chatify; npm run test:ui -- --grep "Phase 13 call"` - passed with 1 smoke test passed and 1 live two-party smoke skipped.

## Browser Smoke

- Passing smoke: `Phase 13 call visible control reports unavailable realtime honestly`.
- Captured artifact: `13-call-unavailable-smoke.png`.
- Skipped smoke: `Phase 13 call live two-party fake-media happy path requires explicit smoke environment`.
- Skip reason: `CHATIFY_CALL_SMOKE=1` was not provided with a live backend, two authenticated accounts, and socket/TURN configuration. This is recorded as a Phase 14 production-live boundary, not a Phase 13 completion claim.

## Dependency Gates

- Phase 10.1 message delivery regressions: backend idempotency and socket message-state tests passed in the Phase 13 targeted backend gate.
- Phase 11 conversation controls: block-control route test passes in full backend suite, and blocking an active call is covered by socket call-blocking tests.
- Phase 12 media/detail baseline: frontend fixture guard, shared media/detail component tests, full frontend test suite, lint, and build passed after call UI changes.

## Privacy And Redaction

- Evidence does not include credentials, emails, cookies, JWTs, SDP, ICE candidates, device labels, media data, or private message text.
- Call activity serialization test checks serialized call activity does not include `sdp`, `ice`, `candidate`, `device`, `microphone`, `camera`, `token`, or `cookie`.

## Production Boundary

- TURN readiness was not verified in this local execution because no production TURN credentials were provided.
- Final deployed production acceptance remains Phase 14. Required production evidence: deployed frontend/backend URLs, two test accounts or approved test auth path, socket credentials/cookies, and TURN configuration.
