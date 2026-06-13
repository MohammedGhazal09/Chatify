# Phase 15: Investigate And Fix Audio And Video Call Reliability - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 15 investigates why Chatify audio and video calls are still unreliable or unaccepted, then repairs only the direct-message one-to-one call stack and proves it with local two-account fake-media automation plus configured production smoke. The phase is investigation-first: no implementation change can be claimed as complete unless it maps to a reproduced failure, a blocked evidence item, or a documented reliability gap.

This phase may redesign any call-related UI surface needed for reliable, truthful, professional calling, but it must not become a broad chat redesign or a new calling-feature expansion. Group calls, screen share, recording, transcription, push notifications, native app calling, device picker, and stack replacement remain out of scope.

</domain>

<spec_lock>
## Requirements Locked By SPEC.md

**15 requirements are locked.** See `15-SPEC.md` for full requirements, boundaries, constraints, and acceptance criteria.

Downstream agents MUST read `15-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**Implementation discussion scope:** This context locks how to investigate, repair, test, document, and gate the existing Phase 15 requirements. It does not reopen whether audio/video call repair, local fake-media acceptance, production smoke/blocking, TURN readiness, UI repair, security/privacy boundaries, messenger regression protection, and final readiness artifacts are required.

</spec_lock>

<decisions>
## Implementation Decisions

### Investigation And Traceability
- **D-01:** Start Phase 15 with an investigation pass, not direct implementation.
- **D-02:** Create `.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-FAILURE-REPORT.md` before claiming fixes.
- **D-03:** The failure report must classify both audio and video behavior by layer: media permission, WebRTC peer connection, ICE/TURN, Socket.IO signaling, backend session state, presence/reachability, UI state, CORS/cookies, deployment configuration, or accepted path.
- **D-04:** Every implementation fix in the final summary must map to a reproduction finding, a blocked evidence item, or a documented reliability gap.
- **D-05:** Fixes without a direct reproduced failure are allowed only as preventive hardening when paired with a concrete test proving the gap.

### Local Acceptance Harness
- **D-06:** Local two-account fake-media Playwright acceptance is mandatory and blocking.
- **D-07:** Local acceptance must use a real local backend, real authenticated sockets, and a real direct chat. Static fixtures cannot count as the call source of truth.
- **D-08:** Prefer deterministic API or database setup helpers for disposable users and a direct chat, then exercise the visible UI and real socket/WebRTC paths.
- **D-09:** Local test data must be timestamped or phase-prefixed and cleaned up best-effort where safe.
- **D-10:** Phase 13's skipped `CHATIFY_CALL_SMOKE=1` placeholder must be replaced or supplemented with a deterministic local full-stack call smoke that runs through the normal local Playwright path or a clearly documented targeted command.

### Production Smoke And Readiness
- **D-11:** Reuse the Phase 14 production smoke environment contract: `CHATIFY_PRODUCTION_SMOKE`, `CHATIFY_PROD_FRONTEND_URL`, `CHATIFY_PROD_BACKEND_URL`, `CHATIFY_SMOKE_USER_A_EMAIL`, `CHATIFY_SMOKE_USER_A_PASSWORD`, `CHATIFY_SMOKE_USER_B_EMAIL`, and `CHATIFY_SMOKE_USER_B_PASSWORD`.
- **D-12:** Do not invent a parallel production credential contract unless a specific missing prerequisite cannot be expressed through the existing names.
- **D-13:** When production env is configured, run production two-account fake-media audio and video acceptance against the deployed Vercel frontend and Render backend origins.
- **D-14:** When production env is missing or invalid, write an explicit blocked production readiness result instead of marking the phase failed.
- **D-15:** Production readiness status must be one of `local_ready`, `production_ready`, `production_blocked`, or `failed`; do not collapse this into a single boolean.
- **D-16:** Production artifacts must redact credentials, cookies, account identifiers, SDP, ICE candidates, media data, and private message content.

### TURN And ICE Readiness
- **D-17:** Production readiness requires working TURN configuration or an explicit honest blocker/unavailable state.
- **D-18:** STUN-only production behavior can be observed but must not be accepted as production-ready, even if it works once.
- **D-19:** Verify that `CALL_TURN_URLS`, `CALL_TURN_USERNAME`, and `CALL_TURN_CREDENTIAL` are honored when configured.
- **D-20:** If TURN is missing in production, either disable call readiness with a clear reason or block the acceptance report; do not make a false readiness claim.
- **D-21:** Local development may continue using the existing STUN fallback where it supports deterministic local fake-media tests.

### WebRTC Negotiation And Media Behavior
- **D-22:** Preserve server-authoritative call sequencing: caller starts, callee accepts, server emits connected/sync, then the caller creates and sends the WebRTC offer.
- **D-23:** Do not create or send offers before the callee accepts the server-owned call session.
- **D-24:** Add per-call ICE candidate buffering on the frontend so early ICE candidates are queued until the peer session exists, then drained.
- **D-25:** Keep the current short socket disconnect grace policy at 15 seconds unless reproduction proves it must change.
- **D-26:** Do not implement ICE renegotiation in this phase unless the failure report proves it is required for the accepted path.
- **D-27:** Keep the 20 second setup timeout, but prove it ends/fails cleanly, stops media tracks, updates UI state, informs the server when possible, and allows retry.
- **D-28:** Video camera failure must not silently become an audio call. The video request should fail with clear copy and an explicit user action to start audio instead.
- **D-29:** Explicit user-selected audio retry after a failed video camera request is allowed, but no audio invite should be sent until the user chooses it.

### Reachability And Multi-Tab Truth
- **D-30:** Preserve Phase 13's multi-tab policy: ring all authenticated callee sockets, first accept wins, all other tabs receive sync and clean up.
- **D-31:** Offline recipients must not appear to ring.
- **D-32:** Do not create missed-call activity when no authenticated callee socket actually received the invite.
- **D-33:** Backend and Playwright evidence must cover online, offline, multi-tab, duplicate/busy, stale, and cleanup states with truthful UI outcomes.

### Call UI Repair And Redesign
- **D-34:** Redesign any call-related surface that blocks reliable, truthful, accessible, responsive, or professional call use.
- **D-35:** Allowed call-related surfaces include conversation header buttons, detail rail/drawer actions, More menu actions, disabled reasons, incoming overlay, outgoing/connecting panel, connected controls, video surfaces, failure states, retry states, and cleanup states.
- **D-36:** Do not perform unrelated chat UI redesign in Phase 15.
- **D-37:** `Frontend/Chatify/src/pages/chat/chat.tsx` may be edited only for call-related route integration and must preserve unrelated local work.
- **D-38:** Every enabled visible call/video control must either complete its supported workflow or expose a blocking failure in tests; unsupported controls must be disabled with accessible reasons.
- **D-39:** Desktop and mobile call states must avoid trapped overlays, unclosable rails/drawers, overlapping text, and stale modals after end, failure, or reload.

### Diagnostics, Privacy, And Security
- **D-40:** Diagnostics may record sanitized event names, lifecycle statuses, error codes, configured origins, readiness booleans, and redacted IDs.
- **D-41:** Diagnostics and artifacts must not record SDP bodies, ICE candidate strings, media bytes, device labels, cookies, JWTs, passwords, full emails, raw account identifiers, or private message content.
- **D-42:** Call repair must preserve authenticated socket identity, direct-chat membership checks, block enforcement, stale-call rejection, cross-chat rejection, and rate limits for every `call:*` event.
- **D-43:** Privacy checks must scan Phase 15 artifacts and persisted call activity for prohibited sensitive terms and payload shapes.

### Verification Matrix
- **D-44:** Backend verification must include valid lifecycle, signaling, offline callee, busy user, multi-tab first-accept-wins, stale call, blocked conversation, unauthorized socket, cross-chat attempt, invalid payload, oversized payload, timeout, disconnect cleanup, and activity message behavior.
- **D-45:** Frontend Vitest verification must cover media success/failure, explicit video camera failure handling, acknowledgements, offer/answer/ICE handling, early ICE buffering, setup timeout, reconnect timeout, beforeunload cleanup, block/auth loss cleanup, terminal retry, and stale stream cleanup.
- **D-46:** Playwright verification must include complete local audio and video flows: outgoing, incoming, accept, connected, end, and reload cleanup. Video must also prove local preview on both participants.
- **D-47:** Chromium fake-media is the mandatory browser target. Firefox/WebKit are optional unless they are cheap and deterministic with fake media.
- **D-48:** Include at least one mobile call overlay/cleanup proof, either through Playwright or component-level evidence. A full two-page mobile call path is non-blocking if it is flaky.
- **D-49:** Add an optional manual real microphone/camera checklist as supporting evidence only; automated fake-media remains the blocking gate.
- **D-50:** Messenger regression verification must include targeted message delivery/state, block/unblock, call activity timeline rows, attachments/shared surfaces, frontend lint, frontend build, and at least one behavior-first messenger smoke.

### Artifact Strategy
- **D-51:** Create `15-FAILURE-REPORT.md` for reproduction and layer classification.
- **D-52:** Create `15-CALL-ACCEPTANCE.md` for final local/production readiness, evidence paths, blockers, and command results.
- **D-53:** The final Phase 15 implementation summary must include a fix-to-finding table.
- **D-54:** Reuse and refactor Phase 14's `exerciseCallMode` helper logic where practical instead of duplicating divergent audio/video smoke behavior.
- **D-55:** Keep artifacts sanitized and durable enough for a verifier to decide whether calls are locally accepted, production accepted, failed, or externally blocked.

### Work Shape
- **D-56:** Plan Phase 15 in three waves: investigation and harness; signaling/media/UI repairs; acceptance, regression, and evidence.
- **D-57:** Do not use subagents for this phase work in this Codex thread.
- **D-58:** Preserve unrelated dirty work in auth, production smoke, socket, and chat files. Stage and commit only Phase 15 planning artifacts unless the user explicitly expands scope.

### the agent's Discretion
- The planner/executor may choose exact helper names, fixture names, test file names, Playwright project naming, marker format, artifact table shape, and selector strategy if the contracts above are preserved.
- The planner/executor may decide whether the local harness starts backend/frontend through Playwright `webServer`, npm scripts, or documented pre-run commands, as long as the command is deterministic and reproducible.
- The planner/executor may decide whether ICE buffering lives in `useCallController.ts`, `webrtcCallSession.ts`, or a small focused helper, as long as tests cover early/late candidates.
- The planner/executor may choose exact UI copy for call states, camera failure, retry, TURN-unavailable, and production-blocked states if the copy is truthful, accessible, and specific.

</decisions>

<specifics>
## Specific Ideas

- The user approved all recommendations from the Phase 15 one-shot questionnaire on 2026-06-14.
- The user specifically reported that the prior call and video-call fix attempt did not succeed; Phase 15 should treat calls as unaccepted until two-account evidence proves otherwise.
- Current code scouting found a concrete mismatch: `requestCallMedia('video')` can silently fall back to audio and `useCallController.test.tsx` currently expects that behavior. Phase 15 must reverse this behavior to match `15-SPEC.md`.
- Current code scouting found another likely reliability gap: `handleCallIceCandidate` currently drops ICE candidates when no peer session exists. Phase 15 should add buffering rather than assuming event order.
- Existing production acceptance already has `exerciseCallMode` paths in `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`; reuse/refactor them for Phase 15 instead of writing an unrelated second implementation.
- The last Phase 14 live acceptance artifact was blocked before calls because production smoke environment values were missing. Phase 15 must not claim production readiness if the same prerequisite is still missing.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-SPEC.md` - locked Phase 15 requirements, boundaries, constraints, and acceptance criteria. MUST read before planning.
- `.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-CONTEXT.md` - implementation decisions captured by this discussion.
- `.planning/ROADMAP.md` - Phase 15 position, dependency on Phase 14, and milestone context.
- `.planning/REQUIREMENTS.md` - CALL-01 through CALL-04, BLOCK-02, PROD-04, TEST-02, and TEST-05 traceability.
- `.planning/PROJECT.md` - core value, brownfield constraints, no-subagent preference, repository hygiene, deployment references, and security posture.
- `.planning/STATE.md` - current continuity record and production/live readiness blockers.

### Prior Phase Contracts
- `.planning/phases/14-production-live-acceptance-gate/14-CONTEXT.md` - production smoke env contract, production call/video acceptance shape, artifact/reporting rules, and live readiness policy.
- `.planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md` - current blocked production readiness evidence due missing smoke env.
- `.planning/phases/13-realtime-call-and-video-implementation/13-CONTEXT.md` - original one-to-one call architecture, server-authoritative signaling, WebRTC controller, UI, and verification contracts.
- `.planning/phases/12-live-media-voice-and-identity-implementation/12-CONTEXT.md` - media/voice/privacy decisions and explicit call deferral to Phase 13.
- `.planning/phases/11-conversation-controls-and-user-safety-implementation/11-CONTEXT.md` - block/unblock and conversation-control behavior that calls must preserve.
- `.planning/phases/10.1-production-message-delivery-reliability-repair/10.1-CONTEXT.md` - one-send/one-message, realtime receive, and server-truth delivery contract that call fixes must not regress.
- `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-CONTEXT.md` - fixture/static-control denial and production reality audit standards.
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` - canonical message state and socket/query cache contracts.
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` - authenticated Socket.IO identity, membership checks, targeted emits, reconnect, and presence privacy.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - HTTP/API/query/socket layering, controller/model responsibilities, and anti-patterns around page-owned socket logic.
- `.planning/codebase/STACK.md` - React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, npm, Vercel, and Render stack.
- `.planning/codebase/CONVENTIONS.md` - TypeScript, ESM, naming, import, error handling, logging, and local style conventions.
- `.planning/codebase/TESTING.md` - historical testing map; planners must verify current package scripts because Vitest and Playwright now exist.

### Backend Runtime And Tests
- `Backend/Chatify/Config/socket.mjs` - `call:*` Socket.IO handlers, reachability, timeouts, disconnect cleanup, rate limits, and signaling forwarding.
- `Backend/Chatify/Utils/callSessionState.mjs` - server-owned call lifecycle, activity records, direct-chat authorization, busy/offline/stale handling.
- `Backend/Chatify/Utils/callSocketContract.mjs` - call event names and acknowledgement payload shape.
- `Backend/Chatify/Utils/callIceConfig.mjs` - STUN/TURN parsing, `turnReady`, `productionReady`, and warning behavior.
- `Backend/Chatify/Models/callSessionModel.mjs` - persisted call session metadata contract.
- `Backend/Chatify/Utils/conversationControls.mjs` - block/capability helper that call start and signaling must preserve.
- `Backend/Chatify/test/socket/socket.calls.test.mjs` - existing lifecycle, multi-tab, offline, disconnect, signaling, and invalid-payload tests.
- `Backend/Chatify/test/socket/socket.call-auth.test.mjs` - socket auth and call config tests.
- `Backend/Chatify/test/socket/socket.call-blocking.test.mjs` - block-safe call behavior tests.
- `Backend/Chatify/test/socket/socket.message-state.test.mjs` - message delivery/state regression coverage.
- `Backend/Chatify/test/socket/socket.attachments-pins.test.mjs` - attachments/pins regression coverage.

### Frontend Runtime And Tests
- `Frontend/Chatify/src/hooks/useCallController.ts` - call state machine, media requests, WebRTC session lifecycle, timeout/reconnect cleanup, and socket action integration.
- `Frontend/Chatify/src/utils/webrtcCallSession.ts` - `getUserMedia`, `RTCPeerConnection`, local/remote stream handling, ICE, and peer state mapping.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - Socket.IO lifecycle, `call:*` event routing, call acknowledgements, and call config propagation.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - route-level call orchestration and overlay mounting; preserve unrelated local work.
- `Frontend/Chatify/src/pages/chat/components/CallOverlay.tsx` - incoming/outgoing/connected/failure UI, video surfaces, controls, focus behavior, and cleanup visibility.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - header call/video entry points.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` - detail rail/drawer call/video entry points.
- `Frontend/Chatify/src/pages/chat/components/ConversationMoreMenu.tsx` - More menu call/video entry points.
- `Frontend/Chatify/src/hooks/useCallController.test.tsx` - current frontend call-controller tests, including the old silent audio fallback expectation that must change.
- `Frontend/Chatify/src/hooks/useChatSocket.test.tsx` - socket event and acknowledgement tests.
- `Frontend/Chatify/src/pages/chat/components/CallOverlay.test.tsx` - call overlay component tests.

### Browser And Production Acceptance
- `Frontend/Chatify/playwright.config.ts` - local Playwright fake-media configuration.
- `Frontend/Chatify/playwright.production.config.ts` - production Playwright fake-media configuration.
- `Frontend/Chatify/e2e/chat-calls.spec.ts` - Phase 13 local unavailable-control smoke and skipped live fake-media placeholder.
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts` - Phase 14 production audio/video `exerciseCallMode` behavior to reuse/refactor.
- `Frontend/Chatify/e2e/pages/productionSmoke.ts` - production smoke env parsing, redaction, and API login helpers.
- `Frontend/Chatify/e2e/pages/phase14ProductionAcceptance.ts` - Phase 14 production acceptance config/report helpers and static-content denial.
- `Frontend/Chatify/package.json` - frontend scripts for test, lint, build, local Playwright, and production Playwright.
- `Backend/Chatify/package.json` - backend Vitest scripts.

### Supporting Skills Used For Discussion
- `C:/Users/saieh/.agents/skills/find-skills/SKILL.md` - skill discovery and reporting requirement.
- `C:/Users/saieh/.codex/skills/gsd-discuss-phase/SKILL.md` - one-shot questionnaire and context-writing workflow.
- `C:/Users/saieh/.agents/skills/webrtc/SKILL.md` - WebRTC, signaling, ICE/STUN/TURN, and media anti-pattern guidance.
- `C:/Users/saieh/.agents/skills/websocket-engineer/SKILL.md` - Socket.IO authentication, rooms, acknowledgements, reconnect, and event-boundary guidance.
- `C:/Users/saieh/.agents/skills/vitest/SKILL.md` - Vitest test framework guidance.
- `C:/Users/saieh/.agents/skills/react19-test-patterns/SKILL.md` - React 19 testing patterns.
- `C:/Users/saieh/.agents/skills/playwright-e2e-tester/SKILL.md` - deterministic Playwright E2E guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Backend/Chatify/Config/socket.mjs`: Already owns authenticated socket identity, rooms, rate limits, call start/accept/reject/end/sync, signaling forwarding, ring timeout, and disconnect cleanup. Phase 15 should repair within this boundary instead of adding UI-owned socket logic.
- `Backend/Chatify/Utils/callSessionState.mjs`: Already centralizes direct-chat checks, active-call constraints, terminal state transitions, call activity creation, and missed/offline distinctions.
- `Backend/Chatify/Utils/callIceConfig.mjs`: Already exposes `turnReady` and `productionReady`; Phase 15 should use those booleans in tests, reports, and honest production gating.
- `Frontend/Chatify/src/hooks/useCallController.ts`: Already owns call availability, media request, start/accept/end, peer creation, reconnect timeout, setup timeout, and cleanup. This is the likely main frontend repair surface.
- `Frontend/Chatify/src/utils/webrtcCallSession.ts`: Already wraps native WebRTC APIs. It currently retries video capture as audio; this must change to explicit audio retry.
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`: Already has a production two-page fake-media call exercise function; reuse/refactor it for Phase 15 acceptance.
- `Frontend/Chatify/e2e/pages/productionSmoke.ts` and `phase14ProductionAcceptance.ts`: Already provide production env parsing, redaction, login, and report helpers that Phase 15 should reuse rather than duplicating.

### Established Patterns
- Backend Socket.IO events must use authenticated socket identity from the handshake. Client-supplied user IDs are not trusted.
- Direct-chat and block-safe behavior must reuse existing membership and `conversationControls` helpers.
- Frontend socket transport belongs in `useChatSocket`; presentational components receive state and callbacks.
- Route orchestration can live in `chat.tsx`, but WebRTC details belong in focused hooks/utilities.
- Unsupported or unavailable controls must be honestly disabled with accessible reasons. Enabled no-op controls are blocker-grade.
- Production acceptance is opt-in and fail-closed. Missing env produces a blocked artifact, not a local fallback.
- Artifacts are sanitized markdown with command lines, redacted environment status, pass/fail/blocker rows, evidence paths, and final readiness decisions.
- Tests should prefer role/name selectors and deterministic fake media; static demo fixtures cannot count as product behavior.

### Integration Points
- Add or revise local Playwright helpers for disposable two-account full-stack setup.
- Update `requestCallMedia` and call-controller tests to remove hidden video-to-audio downgrade.
- Add ICE candidate buffering near the frontend call controller or WebRTC wrapper.
- Extend or refactor Phase 14 production call exercise helpers for Phase 15 local and production acceptance.
- Add Phase 15 artifacts under `.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/`.
- Update call overlay/component tests for redesigned failure/retry/mobile cleanup states if UI changes are needed.
- Preserve unrelated dirty work in auth, production smoke, and socket files while planning and implementing.

</code_context>

<deferred>
## Deferred Ideas

- Group calls and multi-party rooms remain out of scope.
- Screen sharing remains out of scope.
- Recording, transcription, captions, and call summaries remain out of scope.
- Push notifications and native background calling remain out of scope.
- Native iOS/Android call integration remains out of scope.
- Device picker and mid-call audio/video upgrade or downgrade remain out of scope, except a minimal explicit audio retry after video camera failure.
- Redis Socket.IO adapter, horizontal scaling, and sticky-session infrastructure are not Phase 15 deliverables unless current deployment is proven multi-instance and blocking the accepted path.

</deferred>

---

*Phase: 15-investigate-and-fix-audio-and-video-call-reliability*
*Context gathered: 2026-06-14*
