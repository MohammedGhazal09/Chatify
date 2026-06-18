---
phase: 15-investigate-and-fix-audio-and-video-call-reliability
artifact: failure-report
status: blocked_external
created_at: 2026-06-17T10:10:00+03:00
last_updated: 2026-06-17T12:45:00+03:00
privacy: sanitized
---

# Phase 15 Failure Report

## Investigation Scope

Phase 15 treats audio and video calling as unaccepted until each layer is either accepted, resolved by a linked fix, or explicitly blocked by missing external setup. This report records only sanitized event names, files, statuses, and command summaries. It does not include cookies, tokens, SDP bodies, ICE candidate strings, media data, device labels, passwords, full emails, or production account identifiers.

## Commands Run

| Command | Result | Notes |
|---|---:|---|
| `cd Frontend/Chatify; npm test -- --run src/hooks/useCallController.test.tsx src/pages/chat/components/CallOverlay.test.tsx` | passed | 2 files, 21 tests. Covers explicit video media failure, incoming accept failure, early ICE buffering, setup timeout cleanup, auth/socket terminal cleanup, and call overlay states. |
| `cd Backend/Chatify; npm test -- --run test/socket/socket.calls.test.mjs test/socket/socket.call-auth.test.mjs test/socket/socket.call-blocking.test.mjs` | passed | 3 files, 12 tests. Covers direct-call lifecycle, offline callee, multi-tab ring/sync, signaling validation/forwarding, auth, blocking, and call config. |
| `cd Frontend/Chatify; npm run test:ui -- --grep "Phase 15"` | skipped with blocked artifact | 1 Playwright test skipped because local call smoke env is absent. `15-CALL-ACCEPTANCE.md` records exact missing local and production env prerequisites. |
| `cd Frontend/Chatify; npm test -- --run src/hooks/useCallController.test.tsx` | passed | 1 file, 17 tests. Covers the stale answer call-id guard plus call controller regressions. |
| `cd Frontend/Chatify; npm test -- --run src/hooks/useCallController.test.tsx src/pages/chat/components/CallOverlay.test.tsx src/hooks/useChatSocket.test.tsx src/hooks/messageCache.test.ts` | passed | 4 files, 60 tests. Covers call controller, overlay, socket callback routing, and message cache regression. |
| `cd Backend/Chatify; npm test -- --run test/socket/socket.calls.test.mjs test/socket/socket.call-auth.test.mjs test/socket/socket.call-blocking.test.mjs test/socket/socket.auth.test.mjs` | passed | 4 files, 21 tests. Covers call lifecycle/security plus socket auth regression. |
| `cd Frontend/Chatify; npm run lint` | passed | ESLint completed with no reported violations. |
| `cd Frontend/Chatify; npm run build` | passed | TypeScript build and Vite production build completed. |
| `cd Frontend/Chatify; npm run test:e2e:prod -- --grep "Phase 15\|Phase 14 production live acceptance"` | skipped with blocked artifact | Production Playwright gate skipped because Phase 14 production smoke env is absent; `14-LIVE-ACCEPTANCE.md` remains blocked. |
| Targeted Phase 15 secret scan | passed | No raw auth headers, bearer tokens, cookie headers, JWT-shaped strings, or password assignments were found in Phase 15 artifacts and touched call files. |

## Findings

| ID | Layer | Status | Finding | Evidence | Owner Plan | Verification |
|---|---|---|---|---|---|---|
| F-15-001 | media permission / UI state | resolved_local | Video calls previously risked silently downgrading to audio when camera capture failed. That creates false video acceptance and violates the Phase 15 no-silent-downgrade contract. | Current working tree has `requestCallMedia('video')` request audio+video once and throw on failure. `useCallController.test.tsx` now asserts `emitCallStart` is not called, mode remains `video`, and the user sees camera-specific failure copy. | 15-03 | Frontend focused command above. |
| F-15-002 | WebRTC / ICE timing | resolved_local | ICE candidates can arrive before the peer session exists or before remote description is ready. Dropping early candidates can cause intermittent call connection failure. | Current working tree has call-id keyed pending ICE in `useCallController.ts` and remote-description buffering in `webrtcCallSession.ts`. Tests assert early candidates queue before peer creation and flush after offer handling. | 15-03 | Frontend focused command above. |
| F-15-007 | WebRTC / answer scoping | resolved_local | A stale or mismatched answer event could be accepted by the current peer connection whenever a peer session existed, because answer handling did not check the active call id. | `handleCallAnswer` now requires an active session and matching `event.callId` before applying the answer. A regression test proves a stale answer is ignored while the current call answer still applies. | 15-review-fix | Frontend focused command above. |
| F-15-003 | local browser acceptance | blocked_external | Local two-account fake-media call acceptance is still not proven because no local call smoke env/accounts/origins are configured in this run. | `phase15CallAcceptance.ts` now implements the local two-account fake-media harness and writes `15-CALL-ACCEPTANCE.md`; the current run records missing `CHATIFY_LOCAL_*` prerequisites and skips without a readiness claim. | 15-01 / 15-04 | `cd Frontend/Chatify; npm run test:ui -- --grep "Phase 15"` after local env is configured. |
| F-15-004 | production deployment / TURN readiness | blocked_external | Production call readiness cannot be accepted without the Phase 14 production smoke env and TURN readiness evidence. | `15-CALL-ACCEPTANCE.md` and `14-LIVE-ACCEPTANCE.md` both record missing production smoke env. `callIceConfig` exposes `turnReady` and `productionReady`; production STUN-only cannot be accepted as ready. | 15-02 / 15-04 | `cd Frontend/Chatify; npm run test:e2e:prod -- --grep "Phase 15\|Phase 14 production live acceptance"` when env is configured; otherwise readiness remains blocked. |
| F-15-005 | call overlay / interaction quality | blocked_external | Unit coverage checks camera failure and active audio/video overlay controls, but browser-level overlay cleanup and mobile proof are blocked until local two-account call smoke can run. | `CallOverlay.test.tsx` passes for failed video state without fallback copy and active media controls. `15-CALL-ACCEPTANCE.md` records that browser evidence paths are unavailable because local smoke env is absent. | 15-03 / 15-04 | Local Phase 15 Playwright harness plus optional screenshot evidence after local env is configured. |
| F-15-006 | backend signaling / session authority | accepted_local | Backend socket call authority is locally covered for valid lifecycle, offline callee, multi-tab reachability, signal forwarding, invalid payloads, auth, and blocking. No new backend gap was exposed by this investigation pass. | Backend focused call socket command passed. Existing tests prove call start/accept, offline no missed activity, multi-tab first-accept-wins sync, peer-only signaling, invalid/oversized signal rejection, auth, and blocking. | 15-02 | Backend focused command above. |

## Fix-To-Finding Map

| Finding | Current Fix / Decision | Files |
|---|---|---|
| F-15-001 | Keep video media failure explicit; no automatic audio fallback after a video request. | `Frontend/Chatify/src/utils/webrtcCallSession.ts`, `Frontend/Chatify/src/hooks/useCallController.ts`, `Frontend/Chatify/src/hooks/useCallController.test.tsx`, `Frontend/Chatify/src/pages/chat/components/CallOverlay.test.tsx` |
| F-15-002 | Keep pending ICE buffered by call id before peer creation and inside the WebRTC wrapper until remote description is ready. | `Frontend/Chatify/src/hooks/useCallController.ts`, `Frontend/Chatify/src/utils/webrtcCallSession.ts`, `Frontend/Chatify/src/hooks/useCallController.test.tsx` |
| F-15-007 | Scope answer handling to the active call id before applying remote descriptions to the peer connection. | `Frontend/Chatify/src/hooks/useCallController.ts`, `Frontend/Chatify/src/hooks/useCallController.test.tsx` |
| F-15-003 | Added Phase 15 local acceptance helper/spec and blocked setup artifact behavior for missing local accounts/backend setup. | `Frontend/Chatify/e2e/chat-calls.spec.ts`, `Frontend/Chatify/e2e/pages/phase15CallAcceptance.ts`, `15-CALL-ACCEPTANCE.md` |
| F-15-004 | Reuse the Phase 14 production smoke contract and block production readiness when env or TURN readiness is missing. | `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`, `Frontend/Chatify/e2e/pages/phase14ProductionAcceptance.ts`, `Backend/Chatify/Utils/callIceConfig.mjs`, `15-CALL-ACCEPTANCE.md` |
| F-15-005 | Browser-level cleanup evidence is implemented in the harness but remains blocked until local smoke env can execute it. | `Frontend/Chatify/e2e/chat-calls.spec.ts`, `Frontend/Chatify/e2e/pages/phase15CallAcceptance.ts`, `15-CALL-ACCEPTANCE.md` |
| F-15-006 | Preserve existing backend call security tests; add backend tests only if later acceptance exposes a real gap. | `Backend/Chatify/test/socket/socket.calls.test.mjs`, `Backend/Chatify/test/socket/socket.call-auth.test.mjs`, `Backend/Chatify/test/socket/socket.call-blocking.test.mjs` |

## Recommendation

Keep Phase 15 readiness blocked until local `CHATIFY_LOCAL_*` smoke env and Phase 14 production smoke/TURN prerequisites are configured. The unit, backend, lint, and build layers are green; the remaining gap is external browser acceptance evidence, not another blind source-code change.
