# Phase 14 Research: Production Live Acceptance Gate

**Researched:** 2026-06-13
**Mode:** Inline research, no subagents
**Phase:** 14-production-live-acceptance-gate
**Status:** Complete

## Research Objective

Design a Phase 14 execution plan that proves the deployed Chatify frontend and backend are functionally ready through real production-like acceptance evidence, not local fixtures, static screenshots, or optimistic UI assumptions.

## Skills Used

- `gsd-plan-phase`: phase planning workflow, plan file expectations, roadmap/state updates, and research/validation requirements.
- `find-skills`: skill selection for this planning task.
- `e2e-testing-patterns`: deterministic Playwright coverage, stable selectors, evidence collection, and avoiding brittle visual-only checks.
- `websocket-engineer`: Socket.IO credentialed origins, room/event verification, reconnect/reload truth, and realtime failure modes.
- `api-testing`: deployed HTTP auth, cookie, request/response, status, and privacy-safe integration assertions.
- `deployment-procedures`: Vercel/Render production environment and deployment evidence boundaries.

## Local Sources Read

- `.planning/phases/14-production-live-acceptance-gate/14-SPEC.md`
- `.planning/phases/14-production-live-acceptance-gate/14-CONTEXT.md`
- `.planning/phases/14-production-live-acceptance-gate/14-DISCUSSION-LOG.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `Frontend/Chatify/e2e/pages/productionSmoke.ts`
- `Frontend/Chatify/e2e/production-smoke-config.spec.ts`
- `Frontend/Chatify/e2e/chat-production-reality.spec.ts`
- `Frontend/Chatify/e2e/chat-production-delivery-reliability.spec.ts`
- `Frontend/Chatify/e2e/chat-calls.spec.ts`
- `Frontend/Chatify/playwright.config.ts`
- `Frontend/Chatify/package.json`
- `Frontend/Chatify/src/pages/chat/chat.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationMoreMenu.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx`
- `Frontend/Chatify/src/pages/chat/components/CallOverlay.tsx`
- `Frontend/Chatify/src/hooks/useCallController.ts`
- `Frontend/Chatify/src/hooks/useChatSocket.ts`
- `Frontend/Chatify/src/hooks/useChatQueries.ts`
- `Frontend/Chatify/src/api/axios.ts`
- `Frontend/Chatify/src/api/chatApi.ts`
- `Frontend/Chatify/src/api/messageApi.ts`
- `Backend/Chatify/app.mjs`
- `Backend/Chatify/Config/socket.mjs`
- `Backend/Chatify/Utils/tokenCookieGenerator.mjs`

## External Research Findings

### Playwright Authentication And Isolation

Official Playwright guidance says tests execute in isolated browser contexts and that saved browser state can contain sensitive cookies or headers. Playwright also supports API-request based setup for authentication.

Source: https://playwright.dev/docs/auth

**Recommendation:** Phase 14 should use two isolated browser contexts in one browser, log in through the deployed backend API, inject authenticated cookies into each context, and verify the deployed UI is authenticated. Do not commit or write storage-state files, cookies, tokens, or raw account identifiers.

### Playwright Projects, Devices, And Evidence

Playwright projects are intended to group configurations such as browsers, devices, and environment-specific settings. Playwright can record screenshots, videos, and traces from configuration. Locators should prefer user-facing roles, labels, text, placeholders, titles, and test ids only where appropriate.

Sources:
- https://playwright.dev/docs/test-projects
- https://playwright.dev/docs/test-use-options
- https://playwright.dev/docs/locators

**Recommendation:** Add a separate production Playwright config with no local `webServer`. Use projects for desktop/mobile and light/dark coverage, capture screenshots/traces after real interactions, and prefer accessible role/name selectors for every visible control.

### Playwright File Upload

Playwright supports file upload through `locator.setInputFiles()`, including generated files or buffers.

Source: https://playwright.dev/docs/input

**Recommendation:** Generate tiny Phase 14-owned image and text/document attachments at runtime, upload them through the real composer, and verify the resulting message and shared surfaces. Do not rely on committed demo assets or previous screenshot fixtures.

### Socket.IO Credentials, CORS, Rooms, And Recovery

Socket.IO client `withCredentials` defaults to false; credentialed cross-origin sockets require matching server CORS credentials and cannot use wildcard origins. Socket.IO rooms allow targeted emits to joined clients. Socket.IO also documents that disconnection recovery is not guaranteed, so applications must reconcile state after reload/reconnect.

Sources:
- https://socket.io/docs/v4/client-options/
- https://socket.io/docs/v4/server-options/
- https://socket.io/docs/v4/server-api/
- https://socket.io/docs/v4/connection-state-recovery

**Recommendation:** The production gate must observe the configured backend origin for API and socket traffic, verify credentialed socket connection, prove recipient realtime receive without refresh, then prove reload parity from server truth. Passing sender-only optimistic UI is not enough.

### Vercel And Render Deployment Environment

Vercel environment variable changes apply to new deployments. Render recommends environment variables for secrets and notes that saved variable changes do not affect running services until a deploy happens. Both platforms warn against committing secret environment files.

Sources:
- https://vercel.com/docs/environment-variables/managing-environment-variables
- https://render.com/docs/configure-environment-variables

**Recommendation:** `14-LIVE-ACCEPTANCE.md` should record the configured deployed origins and optional frontend/backend deployed commit ids when provided by env. If origins, credentials, or deployed configuration are missing, the gate must record a blocked result instead of passing against local or stale assumptions.

## Codebase Findings

### Existing Production Smoke Helper

`Frontend/Chatify/e2e/pages/productionSmoke.ts` already provides the core pieces Phase 14 needs: production env parsing, URL validation, account redaction, API login, cookie parsing, and authenticated browser context seeding.

**Recommendation:** Reuse and extend this helper carefully. Preserve Phase 10 and 10.1 artifact paths, but add Phase 14-specific artifact writing, blocker aggregation, generated marker helpers, filtered network observation, and final report sections.

### Existing Production Specs Are Too Narrow

`chat-production-delivery-reliability.spec.ts` checks the urgent Phase 10.1 path: one sender marker, no-refresh recipient receive, reload parity, and no false HTTP delivered claim. `chat-production-reality.spec.ts` checks only a narrower Phase 10 smoke. `chat-calls.spec.ts` still has a skipped live fake-media production placeholder.

**Recommendation:** Add `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts` as the Phase 14 source of truth rather than stretching old phase smoke specs. It should integrate the reliable-message checks but also cover controls, media/detail surfaces, call/video, deployment evidence, and final readiness artifact.

### Production Playwright Config Is Missing

`Frontend/Chatify/playwright.config.ts` starts local Vite and is appropriate for local UI tests, not deployed acceptance.

**Recommendation:** Add `Frontend/Chatify/playwright.production.config.ts` and `npm run test:e2e:prod`. The production config must not define a local `webServer`, must use `CHATIFY_PROD_FRONTEND_URL`, and must skip/block cleanly when `CHATIFY_PRODUCTION_SMOKE=1` and required credentials are absent.

### Chat Controls Have Selectable Runtime Surfaces

The current chat UI exposes accessible labels for call, video call, search messages, More, details, composer attachment, voice, send, and call overlay controls. Some unavailable controls already expose disabled reasons, such as voice messaging and call availability.

**Recommendation:** Phase 14 should test every visible control as the user sees it. Enabled controls must perform a real behavior. Disabled or hidden controls must have an accessible reason. A non-closable detail rail, dead More menu, dead search, static shared surfaces, or enabled call button with no real two-account event is blocker-grade.

### Static Content Must Be Denied Centrally

Known demo values have previously appeared in live-looking UI: `IN-8B21`, `message-states-spec.pdf`, `delivery-metrics.xlsx`, `retry-logic-notes.txt`, placeholder media tiles, fixture screenshots, and earlier phase labels.

**Recommendation:** Add a central Phase 14 denylist with a live-marker allowlist. The gate should fail if known fixture or placeholder content appears as conversation truth unless that exact marker was created by the current run.

## Validation Architecture

Nyquist validation is enabled for this plan phase. The validation map should be explicit before execution:

- Wave 1 validates harness/config/reporting without production credentials and with redaction checks.
- Wave 2 validates real messaging, controls, attachments, shared surfaces, and static-content denial against deployed origins.
- Wave 3 validates call/video or honest disabled states, deployment evidence, and final readiness reporting.

**Recommendation:** Create `14-VALIDATION.md` with per-plan verification commands, blocker gates, manual production setup needs, and final sign-off criteria. Treat missing production credentials as a blocked gate, not a test pass.

## Plan Recommendations

### 14-01: Production Harness, Environment Contract, And Evidence Reporter

Create the production Playwright runtime, focused npm script, env validation, Phase 14 helper/reporting, blocker aggregation, redaction rules, and no-env blocked behavior.

**Why first:** Without a strict harness and sanitized artifact, later product checks can accidentally become screenshot-only or fixture-backed again.

### 14-02: Live Messaging, Controls, Attachments, And Static-Content Acceptance

Implement the main two-account production acceptance workflow: authenticated UI, conversation creation/selection, unique message send, no-refresh realtime receive, reload parity, details open/close/Escape/focus, search, More, block/unblock restore, generated attachment upload, shared file/media truth, and static denylist checks.

**Why second:** This wave directly addresses the user-reported live failures: duplicate sends, missing realtime delivery, stuck right rail, dead controls, static messages/files/media, and static attachment behavior.

### 14-03: Call/Video, Deployment Evidence, And Final Readiness Gate

Run fake-media live call/video acceptance when controls are enabled, verify deployment origin/cookie/socket evidence, consolidate `14-LIVE-ACCEPTANCE.md`, and run the final quality gate.

**Why third:** Call/video acceptance and final readiness claims depend on the production harness and main chat workflow being stable first.

## Risks And Mitigations

- **Risk:** Production credentials or deployed origins are unavailable.
  - **Recommendation:** Gate fails closed and writes a blocked artifact with missing env names only, never values.
- **Risk:** Live app has product bugs larger than harness fixes.
  - **Recommendation:** Record blockers in `14-LIVE-ACCEPTANCE.md` and do not broaden Phase 14 into feature implementation unless the fix is tiny and directly required to run the gate.
- **Risk:** Evidence leaks secrets or user data.
  - **Recommendation:** Redact full emails, passwords, tokens, cookies, request bodies, and private payloads. Avoid full HAR capture.
- **Risk:** Realtime checks pass due to optimistic UI only.
  - **Recommendation:** Use two isolated authenticated contexts, require recipient no-refresh receive, then reload both views and compare server truth.
- **Risk:** Static fixture content appears after previous visual phases.
  - **Recommendation:** Centralize denylist checks and require current-run markers for any content counted as live proof.

## Research Conclusion

Phase 14 should be planned as a strict production acceptance gate with three waves: harness/reporting, live chat/control/media behavior, and final deployment/call readiness. The phase should not claim Chatify is functionally ready unless the deployed Vercel/Render product passes with real accounts, real data, no fixture bypass, sanitized evidence, and zero blocker-grade failures.

Research complete.
