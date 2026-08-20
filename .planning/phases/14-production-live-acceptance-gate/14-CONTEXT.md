# Phase 14: production-live-acceptance-gate - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 14 creates the final production live acceptance gate for Chatify. It proves the deployed Vercel frontend and Render backend work with real authenticated accounts, real persisted data, deployed API/socket origins, and every visible chat control either functioning or honestly unavailable. It is gate-first: the phase may add production test harness, evidence, reporting, and tiny harness/config fixes, but it must not become a broad product feature implementation phase.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**12 requirements are locked.** See `14-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `14-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**

- A live production acceptance gate for the deployed Vercel frontend and Render backend.
- Two-account email/password authentication using disposable test accounts provided through environment variables.
- Real persisted conversation data created or exercised through deployed API/UI paths.
- Message send/receive/reload verification with duplicate-send and false-delivery blockers.
- Conversation selection, detail rail/drawer open/close/Escape/focus behavior, message search, More actions, block/unblock, attachments, shared media/files, pinned/security surfaces, voice controls, call controls, video controls, logout, and session recovery.
- Production fixture/static-content denial checks.
- Production CORS, cookie, Socket.IO, file access, and call signaling evidence.
- Desktop/mobile and light/dark post-interaction screenshots/traces.
- A sanitized `14-LIVE-ACCEPTANCE.md` acceptance artifact.
- Small test-harness or documentation changes required to run and report the gate.

**Out of scope (from SPEC.md):**

- Broad product feature implementation inside Phase 14 - discovered product failures should normally block the gate and feed follow-up phases unless the fix is small and required to run the acceptance harness.
- OAuth/social login acceptance - Phase 14 focuses on email/password chat readiness, avoiding third-party provider instability.
- Native mobile apps - the milestone is web-first.
- Group chats, notifications, moderation, admin tooling, and end-to-end encryption - these remain v2/out-of-scope requirements.
- Large-file stress testing - Phase 14 uses small representative attachments to prove the production path without polluting production storage.
- Permanent production data cleanup tooling - cleanup is desirable where supported, but disposable accounts and timestamped markers are acceptable if cleanup APIs are not available.
- CI scheduling as a blocking deliverable - the gate must be CI-ready through environment variables, but a scheduled CI job is not required in this phase.

</spec_lock>

<decisions>
## Implementation Decisions

### Production Gate Shape
- **D-01:** Add a dedicated production acceptance spec, recommended filename `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`, instead of extending Phase 10 or Phase 10.1 smoke specs.
- **D-02:** Add shared Phase 14 production helper code adjacent to the existing `e2e/pages/productionSmoke.ts` helper or extend that helper in a way that keeps Phase 10/10.1 artifact paths stable.
- **D-03:** Phase 14 evidence must be written to `.planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md`, not appended into Phase 10 or 10.1 documents.
- **D-04:** The acceptance report should be structured markdown with a compact JSON-like run summary table, pass/fail table, blocker list, sanitized account labels, configured origins, command lines, evidence paths, and remaining risks.

### Production Playwright Runtime
- **D-05:** Add a separate production Playwright config for Phase 14 that does not start the local Vite dev server.
- **D-06:** Keep the local Playwright config intact for normal local UI tests. The production config should point directly at `CHATIFY_PROD_FRONTEND_URL` and never silently fall back to local route mocks.
- **D-07:** Run Phase 14 as one serial suite with clear `test.step` sections and a final blocker aggregation instead of scattered independent tests.
- **D-08:** The suite should collect as much evidence as possible, then fail at the end if any blocker is present. Hard setup failures such as missing credentials, failed login, invalid URL config, or unreachable deployed app may stop early after writing a blocked artifact.

### Credentials, Auth, And Browser Isolation
- **D-09:** Reuse the existing production smoke env contract: `CHATIFY_PRODUCTION_SMOKE`, `CHATIFY_PROD_FRONTEND_URL`, `CHATIFY_PROD_BACKEND_URL`, `CHATIFY_SMOKE_USER_A_EMAIL`, `CHATIFY_SMOKE_USER_A_PASSWORD`, `CHATIFY_SMOKE_USER_B_EMAIL`, and `CHATIFY_SMOKE_USER_B_PASSWORD`.
- **D-10:** New alias names may be added later, but Phase 14 should not rename the existing variables as part of the first implementation.
- **D-11:** Use backend API login to seed authenticated browser contexts, then verify that the deployed UI is authenticated and renders the chat shell.
- **D-12:** Never write raw credentials, cookies, tokens, full emails, request bodies, or private payloads to traces, logs, artifacts, or committed files.
- **D-13:** Use two isolated browser contexts in one Playwright browser to represent the two production test accounts. Do not share storage/cookies between users.

### Live Data, Markers, And Cleanup
- **D-14:** Use UI flows for user-visible behavior under test, including starting/continuing chats, sending messages, opening controls, and interacting with details.
- **D-15:** API helpers are allowed only for deterministic setup, safe cleanup, or metadata checks that are not themselves the user-visible behavior under test.
- **D-16:** Generate unique timestamped Phase 14 markers for messages, files, attachments, screenshots, and report rows so the gate can distinguish live data created by the run from stale/static content.
- **D-17:** Use best-effort cleanup for Phase 14-owned test markers when safe APIs exist. If cleanup is unavailable or risky, leave labeled test data in disposable accounts rather than attempting destructive cleanup.
- **D-18:** Generate tiny image and text/document fixtures during the test run with unique names. Do not rely on committed demo assets, remote sample assets, or older phase fixture filenames as proof of live production behavior.

### Workflow Coverage
- **D-19:** The core two-account workflow must cover conversation creation/selection, one-message send, one recipient realtime receive without refresh, sender/recipient reload parity, and server-truth delivered/read behavior.
- **D-20:** The conversation details surface must be opened, closed, dismissed with Escape where applicable, focus-restored, reopened, and verified on desktop rail and mobile drawer paths.
- **D-21:** Every visible enabled control must perform a real action or open a real state. Unsupported controls must be hidden or disabled with an accessible reason.
- **D-22:** Test block/unblock late in the suite and restore the accounts to unblocked state in `finally` where possible.
- **D-23:** If audio or video call controls are enabled, run a deterministic fake-microphone/fake-camera two-account call/video path. If the controls are disabled, assert a clear production disabled reason.
- **D-24:** Run the full core workflow on desktop dark and mobile light. Capture post-interaction screenshots/evidence for desktop light, desktop dark, mobile light, and mobile dark.
- **D-25:** Include targeted accessibility checks for accessible names, disabled reasons, focus return, Escape/dismiss behavior, keyboard menu behavior, and non-trapping overlays. Do not require a full axe sweep in Phase 14 unless planning finds it cheap and stable.

### Fixture, Network, And Deployment Evidence
- **D-26:** Add a central Phase 14 static-content denylist covering known fixture filenames, demo names, placeholder media, placeholder shared files, prior phase fixture text, and screenshot-only labels.
- **D-27:** The denylist must have a live-marker allowlist so Phase 14-generated names do not self-fail the run.
- **D-28:** Collect filtered network, console, API-origin, socket-origin, and response observations. Avoid full HAR or full request/response capture unless secrets can be reliably redacted.
- **D-29:** Record evidence that API requests target the configured backend origin, Socket.IO connects to the configured backend/socket origin, auth cookies are present after login, and no CORS errors are observed.
- **D-30:** Record local `git rev-parse HEAD`, configured production origins, and optional `CHATIFY_PROD_FRONTEND_COMMIT` / `CHATIFY_PROD_BACKEND_COMMIT` values if they are provided by the run environment.

### Command And Failure Policy
- **D-31:** Add a focused frontend npm script such as `test:e2e:prod` that invokes the production Playwright config. Do not require a long raw Playwright command for normal acceptance runs.
- **D-32:** Missing env vars, invalid production URLs, failed auth, unreachable deployed app, duplicate sends, missing realtime receive, false delivery/read status, dead enabled controls, non-closable panels, static fake content, broken upload/download, broken voice/call/video entry points, auth/session failures, and production CORS/socket errors are blocker-grade outcomes.
- **D-33:** Phase 14 may fix harness, reporting, config, selector, redaction, or evidence issues. Product failures should remain blockers and feed follow-up phases unless the fix is tiny and directly required for the gate to run.
- **D-34:** Do not claim Chatify is functionally ready in any artifact or summary unless the Phase 14 gate passes with no blocker-grade failures.

### the agent's Discretion
- The planner/executor may choose exact helper names, Playwright fixture organization, `test.step` names, artifact table shape, screenshot filenames, and marker formats if the contracts above are preserved.
- The planner/executor may decide whether to extend `productionSmoke.ts` or create a Phase 14-specific helper module, as long as older Phase 10 and Phase 10.1 artifact behavior is not broken.
- The planner/executor may choose exact selectors if they prefer accessible roles first and stable `data-testid` only where role/name selectors are insufficient.
- The planner/executor may add optional alias env vars for clarity if the existing `CHATIFY_SMOKE_*` variables keep working.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/14-production-live-acceptance-gate/14-SPEC.md` - locked Phase 14 requirements, boundaries, constraints, acceptance criteria, and blocker policy.
- `.planning/phases/14-production-live-acceptance-gate/14-CONTEXT.md` - implementation decisions captured by this discussion.
- `.planning/ROADMAP.md` - Phase 14 goal, dependency on Phase 13, and success criteria.
- `.planning/REQUIREMENTS.md` - PROD-01, PROD-02, PROD-03, PROD-04, TEST-01, TEST-02, TEST-05, plus related pending production/control/media/voice/identity traceability.
- `.planning/PROJECT.md` - core value, brownfield constraints, deployment references, security posture, and no-subagent preference.
- `.planning/STATE.md` - continuity record, production-live blocker context, and dirty-worktree hygiene note.

### Prior Phase Contracts
- `.planning/phases/13-realtime-call-and-video-implementation/13-CONTEXT.md` - call/video implementation boundary, fake-media smoke expectations, and Phase 14 final production acceptance handoff.
- `.planning/phases/12-live-media-voice-and-identity-implementation/12-CONTEXT.md` - voice, attachment, shared asset, and identity decisions that Phase 14 must verify or honestly gate.
- `.planning/phases/11-conversation-controls-and-user-safety-implementation/11-CONTEXT.md` - More/search/block/unblock/detail-control behavior and block-safe call/message expectations.
- `.planning/phases/10.1-production-message-delivery-reliability-repair/10.1-CONTEXT.md` - one-send/one-message, realtime receive, and server-truth delivery contract.
- `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-CONTEXT.md` - production fixture/static-control correction and live reality audit expectations.
- `.planning/phases/09-messenger-interaction-quality-gate/09-CONTEXT.md` - behavior-first Playwright, accessibility, fixture, and screenshot evidence standards.
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` - canonical message state, idempotency, retry, receipt, unread, pagination, and delete visibility contracts.
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` - authenticated Socket.IO identity, membership checks, targeted emits, reconnect, and presence privacy.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - HTTP/API/query/socket layering and anti-patterns around page-owned API/socket logic.
- `.planning/codebase/INTEGRATIONS.md` - Vercel, Render, CORS/cookies, Socket.IO, Axios, auth, and environment-variable integration points.
- `.planning/codebase/TESTING.md` - historical testing map; planners must verify current scripts because Vitest/Playwright now exist.
- `.planning/codebase/CONVENTIONS.md` - TypeScript, ESM, import, error-handling, logging, and module-boundary conventions.

### Current Production Smoke And E2E Files
- `Frontend/Chatify/playwright.config.ts` - current local Playwright config starts Vite and must not be reused unchanged for production acceptance.
- `Frontend/Chatify/package.json` - frontend script boundary for adding a focused production E2E command.
- `Frontend/Chatify/e2e/pages/productionSmoke.ts` - existing production smoke env parsing, redaction, API login, cookie injection, and artifact helpers.
- `Frontend/Chatify/e2e/production-smoke-config.spec.ts` - existing env validation tests for production smoke config.
- `Frontend/Chatify/e2e/chat-production-reality.spec.ts` - Phase 10 live two-account production audit scaffold.
- `Frontend/Chatify/e2e/chat-production-delivery-reliability.spec.ts` - Phase 10.1 deployed delivery reliability smoke scaffold.
- `Frontend/Chatify/e2e/chat-calls.spec.ts` - Phase 13 fake-media call production-smoke placeholder and local unavailable-control smoke.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts`, `Frontend/Chatify/e2e/chat-functional-parity.spec.ts`, and `Frontend/Chatify/e2e/chat-quality-gate.spec.ts` - local behavior, fixture, and screenshot patterns to reuse carefully without importing fixture data into production acceptance.

### Frontend Runtime Surfaces To Exercise
- `Frontend/Chatify/src/pages/chat/chat.tsx` - chat route orchestrator and production shell under test.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - header call/video/search/more/detail entry points.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` - desktop rail/mobile drawer actions, shared files/media, pinned messages, and security rows.
- `Frontend/Chatify/src/pages/chat/components/ConversationMoreMenu.tsx` - More menu behavior and block/call/search/detail actions.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - text send, attachment, voice, disabled states, and retry surfaces.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - client Socket.IO lifecycle and realtime event surface.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - message, chat, search, shared asset, pin, block, and send state/query surface.
- `Frontend/Chatify/src/api/axios.ts`, `Frontend/Chatify/src/api/chatApi.ts`, `Frontend/Chatify/src/api/messageApi.ts`, and `Frontend/Chatify/src/api/userApi.ts` - production HTTP transport and typed API boundaries.

### Backend Runtime Surfaces To Observe
- `Backend/Chatify/app.mjs` - production CORS, cookies, middleware, auth routes, and API routing.
- `Backend/Chatify/Config/socket.mjs` - Socket.IO CORS, authenticated connection, rooms, message events, call events, and reconnect behavior.
- `Backend/Chatify/Controller/messageController.mjs` - canonical message creation, attachment handling, shared assets, receipts, search, and socket emits.
- `Backend/Chatify/Controller/chatController.mjs` - direct chat creation/continuation, chat serialization, and controls/block state.
- `Backend/Chatify/Utils/tokenCookieGenerator.mjs` - production auth cookie flags.
- `Backend/Chatify/Middlewares/protectRoutes.mjs` - cookie-authenticated route protection.

### Supporting Skills Used For This Discussion
- `C:/Users/saieh/.agents/skills/e2e-testing-patterns/SKILL.md` - Playwright behavior, deterministic E2E, stable selectors, and evidence practices.
- `C:/Users/saieh/.agents/skills/websocket-engineer/SKILL.md` - Socket.IO auth, rooms, acknowledgements, reconnect, and live event-boundary guidance.
- `C:/Users/saieh/.agents/skills/api-testing/SKILL.md` - HTTP auth, cookie, response, error, and integration testing guidance.
- `C:/Users/saieh/.agents/skills/react-best-practices/SKILL.md` - React hook/component boundary and UI state guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Frontend/Chatify/e2e/pages/productionSmoke.ts`: Already parses production smoke env vars, redacts account labels, validates URLs, performs API login, parses auth cookies, and exposes append helpers for Phase 10/10.1 artifacts. Reuse the env/auth/redaction pieces, but redirect Phase 14 evidence to the Phase 14 artifact.
- `Frontend/Chatify/e2e/chat-production-delivery-reliability.spec.ts`: Already verifies one sender marker, no refresh for recipient, reload parity, and HTTP create response not claiming recipient delivery. Use this as the reliability baseline inside the broader Phase 14 gate.
- `Frontend/Chatify/e2e/chat-production-reality.spec.ts`: Already has production detail-surface and two-account smoke scaffolding, but it is too narrow and currently expects some controls to be disabled.
- `Frontend/Chatify/e2e/production-smoke-config.spec.ts`: Existing env validation tests should be preserved and expanded if Phase 14 adds aliases or artifact paths.
- `Frontend/Chatify/e2e/chat-calls.spec.ts`: Existing fake-media call placeholder shows where Phase 14 must stop skipping live call/video acceptance when controls are enabled.
- `Frontend/Chatify/playwright.config.ts`: Current config is local-dev oriented and starts Vite on `127.0.0.1:4177`; production acceptance needs a separate config with no local web server.

### Established Patterns
- E2E tests use Playwright roles and `data-testid` selectors, with browser fake media flags already present in local config.
- Production smoke is opt-in through environment variables and skips/blocks when credentials or URLs are missing.
- Existing smoke helpers redact account emails before writing artifacts; Phase 14 must extend this no-secret artifact pattern.
- Current production smoke writes human-readable markdown observations. Phase 14 should make this complete and structured enough for readiness decisions.
- Prior phases require behavior-first screenshots after interactions, not initial-render visual proofs.
- Existing frontend architecture expects API calls through typed API clients/hooks and socket behavior through `useChatSocket`; tests should validate product behavior rather than adding UI-owned socket logic.

### Integration Points
- Add a Phase 14 production Playwright config under `Frontend/Chatify`, likely next to `playwright.config.ts`.
- Add a focused npm script in `Frontend/Chatify/package.json`, recommended `test:e2e:prod`.
- Add or extend production smoke helper functions for Phase 14 artifact paths, run summaries, markers, generated attachment fixtures, filtered network observations, screenshot paths, and blocker aggregation.
- Add the main Phase 14 live acceptance spec in `Frontend/Chatify/e2e`.
- Capture evidence under `.planning/phases/14-production-live-acceptance-gate/`, including `14-LIVE-ACCEPTANCE.md` and post-interaction screenshots/traces.
- Ensure the production config does not start the local Vite dev server and does not route through local fixtures.

</code_context>

<specifics>
## Specific Ideas

- The user approved all Phase 14 discuss recommendations on 2026-06-13.
- The gate should treat the deployed app as the product, not the local implementation.
- Production acceptance should be strict: an enabled visible control that does nothing is a blocker.
- The right rail/drawer close behavior is a named production pain point and should be explicitly tested.
- Duplicate message send, missing realtime recipient receive, and false delivered status remain blocker-grade checks.
- The final report must be useful enough to answer: what was run, where, with which redacted accounts, what evidence exists, and whether Chatify is allowed to be called functionally ready.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within Phase 14 scope.

</deferred>

---

*Phase: 14-production-live-acceptance-gate*
*Context gathered: 2026-06-13*
