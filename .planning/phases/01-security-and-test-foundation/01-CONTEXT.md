# Phase 01: Security And Test Foundation - Context

**Gathered:** 2026-06-08
**Updated:** 2026-06-17
**Status:** Ready for execution refresh

<domain>
## Phase Boundary

Phase 1 closes the security/test foundation gaps that remain in the current Chatify repo: CSRF on unsafe protected REST mutations, password reset storage/attempt safety, sanitized env examples, redacted reset/error logging, and removal of generated profile data. It preserves the existing MERN stack, test harness, CI workflow, and current refresh-session architecture.

</domain>

<spec_lock>
## Requirements Locked By SPEC.md

Requirements are locked in `.planning/phases/01-security-and-test-foundation/01-SPEC.md`. Downstream work must read that file before planning or implementation. This context captures implementation decisions only.

</spec_lock>

<decisions>
## Implementation Decisions

### Test Foundation
- **D-01:** Keep the existing backend Vitest/Supertest/memory-Mongo harness and add focused regression files instead of rebuilding the harness.
- **D-02:** Keep HTTP message authorization coverage at REST route boundaries in Phase 1; deeper message lifecycle behavior stays in later phases.
- **D-03:** Use route helpers only where they reduce test churn. Auto-CSRF in tests is allowed only for `/api/chat` and `/api/message` unsafe methods so profile-image negative CSRF tests remain meaningful.

### CSRF Enforcement
- **D-04:** Use a signed double-submit token issued as readable `XSRF-TOKEN` cookie and echoed through `X-CSRF-Token` or `X-XSRF-Token`.
- **D-05:** Mount CSRF after `protect` on `/api/chat` and `/api/message` so unauthenticated requests still fail as auth failures and authenticated unsafe requests require CSRF.
- **D-06:** Keep `GET /api/csrf-token`, OAuth GET initiators/callbacks, and read-only GET requests exempt.
- **D-07:** Keep frontend CSRF behavior centralized in `Frontend/Chatify/src/api/axios.ts`; do not add page-level transport logic.

### Auth And Session
- **D-08:** Preserve the current persisted opaque refresh-token session model with rotation and replay detection. Do not revert to the older access-token-only refresh decision from the stale June context.
- **D-09:** Keep remember-me semantics in refresh-token max age and rely on existing auth lifecycle tests for coverage.

### Password Reset
- **D-10:** Store reset codes as HMAC-SHA256 digests using `PASSWORD_RESET_SECRET`; never persist raw six-digit codes.
- **D-11:** Keep one active reset record per user, preserve the 5-minute TTL, delete a used record after successful reset, and invalidate/delete after 5 failed attempts.
- **D-12:** Keep forgot-password responses non-enumerating. Existing accounts may trigger email delivery; missing accounts still receive the same public success response.

### Logging And Privacy Hygiene
- **D-13:** Remove `Backend/Chatify/profile.json` because it is a generated profile-shaped artifact, and ignore future dumps at that path.
- **D-14:** Do not log reset email recipients, raw reset codes, token previews, cookie metadata, OAuth profile payloads, or raw request bodies containing auth fields.
- **D-15:** Sanitize development error bodies for `password`, `confirmPassword`, `token`, `code`, `newPassword`, `email`, `refreshToken`, and `accessToken`.

### Environment Documentation
- **D-16:** Add backend and frontend `.env.example` files with placeholders only. Do not read, copy, quote, or transform local `.env` values.
- **D-17:** Include current backend auth/session/CSRF/reset/OAuth/email/socket/call variables and frontend API/socket variables.

### Repository Safety
- **D-18:** Do not edit `Frontend/Chatify/src/pages/chat/chat.tsx` in this phase.
- **D-19:** Do not use subagents for this project; perform GSD research, planning, execution, and review inline.

</decisions>

<specifics>
## Specific Ideas

- Treat the current repo as source of truth when it conflicts with stale June 2026 Phase 1 planning text.
- Keep tests deterministic and independent of real MongoDB, Brevo, OAuth providers, Render, Vercel, or local `.env` files.
- Prefer focused security gap closure over broad logging/observability refactors.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/phases/01-security-and-test-foundation/01-SPEC.md` - locked Phase 1 requirements and boundaries.
- `.planning/ROADMAP.md` - phase order, success criteria, and plan split.
- `.planning/REQUIREMENTS.md` - SEC, AUTH, and TEST requirement IDs.
- `.planning/PROJECT.md` - stack, delivery, and protected chat-page constraints.
- `.planning/STATE.md` - current project status.

### Current Code Surfaces
- `Backend/Chatify/app.mjs` - Express middleware order and route mounts.
- `Backend/Chatify/Middlewares/csrfProtection.mjs` - CSRF token creation and validation.
- `Backend/Chatify/Controller/authController.mjs` - auth, OAuth handoff, and password reset behavior.
- `Backend/Chatify/Models/passwordResetModel.mjs` - reset record storage contract.
- `Backend/Chatify/Utils/tokenCookieGenerator.mjs` - current refresh-token session architecture.
- `Frontend/Chatify/src/api/axios.ts` - shared frontend CSRF/header/session transport path.

### Verification Surfaces
- `Backend/Chatify/test/security/csrf.test.mjs` - CSRF coverage.
- `Backend/Chatify/test/auth/reset.security.test.mjs` - password reset safety coverage.
- `Backend/Chatify/test/auth/auth.lifecycle.test.mjs` - auth/session/OAuth lifecycle coverage.
- `Backend/Chatify/test/message/message.authorization.test.mjs` - HTTP message authorization coverage.
- `Frontend/Chatify/src/api/axios.test.ts` - shared frontend CSRF/header behavior.
- `.github/workflows/security-and-test-foundation.yml` - CI gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Backend/Chatify/test/helpers/authAgent.mjs`: Supertest agents, CSRF token retrieval, signup/login helpers.
- `Backend/Chatify/test/fixtures/*.mjs`: user/chat/message fixtures for deterministic route tests.
- `Backend/Chatify/Models/sessionModel.mjs`: current persisted refresh-session model.
- `Frontend/Chatify/src/api/axios.ts`: single client-side place for CSRF and refresh handling.

### Established Patterns
- Backend route behavior is tested by importing `app.mjs`, not starting `server.mjs`.
- Backend tests use real Mongoose models against memory Mongo.
- Frontend tests stay focused on shared transport/client behavior for Phase 1.
- Backend ESM imports include `.mjs`; frontend imports omit extensions.

### Integration Points
- CSRF must run after `cookieParser()` and before unsafe route handlers.
- Chat/message CSRF must compose with existing `protect` middleware and rate limiters.
- Password reset hashing connects `authController.mjs`, `passwordResetModel.mjs`, and mocked `emailService.mjs`.
- Env examples must track variables actually referenced by backend/frontend code.

</code_context>

<deferred>
## Deferred Ideas

- Socket.IO identity, room authorization, and reconnect behavior remain later realtime phases.
- Canonical message lifecycle, unread reconciliation, edit/delete/reaction details, and pagination remain later message phases.
- Chat UI reconstruction and visual polish remain later UI/product phases.
- Broader structured observability belongs in the operational observability phase, not Phase 1.

</deferred>

---

*Phase: 01-security-and-test-foundation*
*Context updated: 2026-06-17*
