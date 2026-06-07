# Phase 01: security-and-test-foundation - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the security and test foundation for Chatify: deterministic backend/security tests, CSRF enforcement, predictable auth/session behavior, hardened password reset handling, OAuth redirect safety, redacted logging, sanitized environment examples, and CI verification. It does not rebuild Socket.IO identity, canonical message state, the chat UI, or baseline messenger search features.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `01-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `01-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Add backend test dependencies, scripts, setup files, fixtures, and deterministic security regression tests.
- Add or update package scripts and GitHub Actions workflow needed to run the Phase 1 verification gate.
- Enforce REST CSRF policy for unsafe cookie-authenticated methods with documented exemptions.
- Update the shared frontend request path so unsafe mutations send CSRF headers.
- Stabilize and test signup, login, logout, session check, refresh failure, expired-token, and remember-me cookie behavior.
- Harden password reset code storage, expiry, single-use behavior, and attempt limits.
- Restrict OAuth callback redirects to approved frontend origins.
- Replace sensitive backend and frontend auth/reset debug logs with redacted operational logging.
- Add sanitized backend and frontend environment example files.
- Add HTTP message authorization regression coverage as a safety fence for later message phases.

**Out of scope (from SPEC.md):**
- Socket.IO handshake authentication and server-derived socket identity - Phase 2 owns the authenticated realtime contract.
- Socket room membership checks and socket event authorization - Phase 2 owns realtime authorization.
- Message send/receive lifecycle, duplicate merging, unread reconciliation, edit/delete/reaction semantics, and pagination redesign - Phase 3 owns canonical message state.
- Chat page visual reconstruction or component split - Phase 4 owns messenger UI reconstruction.
- Conversation/message search and baseline messenger polish - Phase 5 owns final baseline features.
- Group chats, attachments, notifications, moderation/admin tooling, native apps, and end-to-end encryption - deferred to v2 or later roadmap work.
- Introducing a full refresh-token persistence architecture - keep existing remember-me behavior and test it unless a later phase explicitly replaces the session model.
- Editing `Frontend/Chatify/src/pages/chat/chat.tsx` - existing local work in that file must not be overwritten in Phase 1.

</spec_lock>

<decisions>
## Implementation Decisions

### Backend Test Harness
- **D-01:** Use a dedicated `Backend/Chatify/test/` tree with `setup`, `fixtures`, and route test suites.
- **D-02:** Test HTTP behavior by importing `Backend/Chatify/app.mjs` with Supertest. Do not start `Backend/Chatify/server.mjs` in Phase 1 tests.
- **D-03:** Use hybrid fixtures: direct Mongoose factories for precise users/chats/messages, and API flows for public auth lifecycle behavior.
- **D-04:** Keep Phase 1 message authorization coverage at HTTP route boundaries; do not add socket integration tests in this phase.

### CSRF Enforcement
- **D-05:** Implement CSRF with a signed double-submit helper tied to authenticated session data, using a readable CSRF cookie plus an `X-XSRF-TOKEN` request header.
- **D-06:** Do not build new Phase 1 CSRF enforcement on `csurf`. It can be removed or left unused depending on planner impact, but active enforcement should be the signed helper.
- **D-07:** Exempt only `GET /api/csrf-token`, OAuth GET initiators/callbacks, and read-only GET requests. Unsafe login, logout, refresh, reset, chat, and message methods require CSRF unless a future plan documents a narrow exemption.
- **D-08:** Attach CSRF headers in the shared frontend Axios request path for unsafe methods, not per page or per API method.

### Auth and Session Behavior
- **D-09:** Renew only valid access tokens. Expired or invalid access tokens return `401` and should clear frontend auth state.
- **D-10:** Do not introduce a persisted refresh-token architecture in Phase 1.
- **D-11:** Keep existing remember-me behavior, but test cookie max age and cookie options.
- **D-12:** Implement minimal session-expired UX as a login-page message via route/search state plus a cleared auth store, avoiding edits to the dirty chat page.

### Password Reset Hardening
- **D-13:** Store reset codes using HMAC-SHA256 with a new `PASSWORD_RESET_SECRET`, not plaintext.
- **D-14:** Allow 5 failed attempts per active reset code. After that, invalidate the reset record.
- **D-15:** Keep one active reset record per user, preserve 5-minute expiry, prevent account enumeration, and delete the reset record after successful password reset.

### OAuth Redirect Safety
- **D-16:** Use a strict frontend origin allowlist derived from `FRONTEND_ORIGIN` and `FRONTEND_ORIGIN_DEV`.
- **D-17:** Ignore user-provided redirect targets in Phase 1 OAuth callbacks.

### Redacted Logging
- **D-18:** Add small local redaction helpers for backend and frontend auth/reset logging instead of adding a full logging library.
- **D-19:** Replace direct sensitive auth/reset/token logs rather than only hiding them behind `NODE_ENV`.
- **D-20:** Add a lightweight regex/script or test gate that fails on known forbidden auth/reset/token log patterns.

### CI and Verification
- **D-21:** Add GitHub Actions that runs backend tests plus frontend lint/build on every PR/push.
- **D-22:** Use Node 22 as the single CI Node version.
- **D-23:** Keep the roadmap's 3-plan split for Phase 1: test harness/coverage, security controls, redacted logging.

### Repository Hygiene
- **D-24:** Inspect `Backend/Chatify/profile.json` and remove or ignore it if it is generated OAuth/profile data.
- **D-25:** Keep frontend Phase 1 test scope narrow: one focused axios/AuthStore-style verification for CSRF header attachment or session-expired behavior.
- **D-26:** Do not edit or overwrite `Frontend/Chatify/src/pages/chat/chat.tsx` in Phase 1.

### Agent Discretion
- Planners may choose exact file names under `Backend/Chatify/test/` as long as the test tree has clear setup, fixtures, and route-focused suites.
- Planners may decide whether the sensitive log gate is a Vitest test or an npm script, as long as it is part of the blocking verification path.
- Planners may decide whether to remove unused `csurf` dependency in Phase 1 or defer dependency cleanup, as long as active CSRF enforcement does not rely on it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Requirements
- `.planning/phases/01-security-and-test-foundation/01-SPEC.md` - locked Phase 1 requirements, boundaries, constraints, and acceptance criteria.
- `.planning/ROADMAP.md` - Phase 1 plan split and phase order.
- `.planning/REQUIREMENTS.md` - SEC, AUTH, and TEST requirement traceability.
- `.planning/PROJECT.md` - project core value, constraints, and security posture.
- `.planning/STATE.md` - current GSD state and known dirty chat page concern.

### Codebase Maps
- `.planning/codebase/TESTING.md` - existing absence of test runner, scripts, and test organization.
- `.planning/codebase/CONVENTIONS.md` - naming, error handling, import, logging, and lint/build conventions.
- `.planning/codebase/STRUCTURE.md` - where backend, frontend, test, route, model, and workflow files belong.
- `.planning/codebase/CONCERNS.md` - security concerns, known auth/session issues, CSRF gap, log leakage, and test gaps.

### External Guidance Considered
- OWASP CSRF Prevention Cheat Sheet - supports signed double-submit CSRF recommendation for stateless CSRF validation.
- Express 2025 legacy package cleanup note - supports avoiding new active reliance on `csurf`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Backend/Chatify/app.mjs`: Express app export is the right Supertest target for HTTP integration tests.
- `Backend/Chatify/Routes/authRouter.mjs`: Central route list for signup, login, logout, refresh, and reset route coverage.
- `Backend/Chatify/Routes/messageRouter.mjs`: Representative HTTP message authorization route surface.
- `Backend/Chatify/Models/userModel.mjs`, `chatModel.mjs`, `messageModel.mjs`, `passwordResetModel.mjs`: Fixture factories should mirror these Mongoose schemas.
- `Backend/Chatify/Utils/tokenCookieGenerator.mjs`: Cookie option behavior and sensitive logging replacement point.
- `Frontend/Chatify/src/api/axios.ts`: Shared request/response interceptor path for CSRF header attachment and session-expired handling.
- `Frontend/Chatify/src/store/authstore.ts`: Auth state clearing target for expired/invalid session behavior.

### Established Patterns
- Backend uses ESM `.mjs`, named controller exports, `asyncErrHandler`, and `CustomError`.
- Backend models use Mongoose defaults/indexes and should be exercised against in-memory MongoDB rather than fully mocked for route coverage.
- Frontend API calls should use the shared `axiosInstance`; do not create per-page transport clients.
- Frontend quality checks already exist as `npm run lint` and `npm run build`; Phase 1 should reuse those in CI.

### Integration Points
- CSRF middleware/helper should be mounted after cookie parsing and before unsafe route handling in `Backend/Chatify/app.mjs`.
- Password reset hashing and attempt limits connect `Backend/Chatify/Controller/authController.mjs` with `Backend/Chatify/Models/passwordResetModel.mjs`.
- OAuth redirect allowlist connects `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Config/passport.mjs`, and environment examples.
- Redacted logging touches `Backend/Chatify/Middlewares/protectRoutes.mjs`, `Backend/Chatify/Utils/tokenCookieGenerator.mjs`, `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Services/emailService.mjs`, `Backend/Chatify/Config/passport.mjs`, `Frontend/Chatify/src/pages/login/login.tsx`, and `Frontend/Chatify/src/pages/forgotPassword/forgotPassword.tsx`.
- CI should be added under `.github/workflows/`.

</code_context>

<specifics>
## Specific Ideas

- User approved every recommended implementation decision from the one-shot questionnaire.
- Keep Phase 1 narrow and security-first; later phases own realtime identity, message lifecycle, UI reconstruction, and baseline search/polish.
- Use deterministic tests with no real MongoDB, OAuth provider, Brevo, Render, Vercel, or local `.env` dependency.
- Install/copy support skills found during discussion: `vitest`, `node`, `csrf-protection`, and `ci-cd`.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 01-security-and-test-foundation*
*Context gathered: 2026-06-08*
