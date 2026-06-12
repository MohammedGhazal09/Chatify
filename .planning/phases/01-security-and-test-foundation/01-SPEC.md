# Phase 1: Security And Test Foundation - Specification

**Created:** 2026-06-08
**Ambiguity score:** 0.11 (gate: <= 0.20)
**Requirements:** 10 locked

## Goal

Chatify gains enforceable auth/security controls and deterministic automated tests that block regressions before realtime and message reconstruction continue.

## Background

Phase 1 is the first phase of the Chatify reconstruction roadmap. The existing backend has Express security middleware, cookie-authenticated routes, CSRF token creation, auth/reset flows, message authorization checks, and Socket.IO wiring, but the automated test foundation is missing. `Backend/Chatify/package.json` has a placeholder `test` script that exits with failure, the frontend has lint/build scripts but no test script, and no test files were found. CSRF enforcement is currently commented out in `Backend/Chatify/app.mjs`, while the frontend fetches a CSRF token during auth initialization without a visible guarantee that unsafe mutations attach a token header. Password reset codes are stored as plaintext values with expiry but no attempt-limit tracking. Auth, token, reset, request, and frontend auth flows include debug logs that can expose user-identifying data, token metadata, cookie options, or raw errors. No sanitized `.env.example` files were found.

The roadmap also maps deep Socket.IO identity and message lifecycle reconstruction to later phases. Phase 1 therefore creates the security and test foundation, fixes auth/session/reset/OAuth/logging/env safety, and adds HTTP message authorization regression coverage without rebuilding the realtime or canonical message systems.

## Requirements

1. **Backend test harness**: The backend must have a deterministic security-focused test harness.
   - Current: `Backend/Chatify/package.json` has `test` set to `echo "Error: no test specified" && exit 1`, and no backend tests were found.
   - Target: Backend tests run with Vitest, Supertest, and `mongodb-memory-server`, using isolated in-memory persistence and mocked external services.
   - Acceptance: Running `npm test` from `Backend/Chatify` executes the test suite and exits with code 0 when auth, CSRF, reset, and message authorization regression tests pass.

2. **Blocking verification gate**: Security verification must block regressions locally and in repository automation.
   - Current: There is no GitHub Actions workflow under `.github`, and no verified test gate exists.
   - Target: Package scripts and a GitHub Actions workflow install dependencies and run the Phase 1 backend test suite, with frontend lint/build included when frontend files are affected by Phase 1 work.
   - Acceptance: The workflow fails on a broken backend security test and passes when Phase 1 tests, frontend lint, and frontend build are green.

3. **Server-side CSRF policy**: Unsafe cookie-authenticated REST methods must enforce CSRF protection unless explicitly exempted.
   - Current: `Backend/Chatify/app.mjs` exposes `/api/csrf-token`, but the broader CSRF enforcement middleware is commented out.
   - Target: Unsafe methods such as POST, PUT, PATCH, and DELETE require a valid CSRF token for cookie-authenticated REST routes, with only documented safe exemptions such as CSRF token creation and OAuth GET callbacks.
   - Acceptance: Tests prove unsafe requests without a valid CSRF token are rejected, valid-token requests succeed, and every exemption is listed in code or documentation with a reason.

4. **Frontend CSRF requests**: Frontend unsafe mutations must reliably send the CSRF token expected by the backend.
   - Current: `Frontend/Chatify/src/hooks/useAuthQuery.ts` fetches a CSRF token during auth initialization, but mutation calls do not visibly guarantee token attachment before unsafe requests.
   - Target: The shared frontend request path ensures unsafe methods include the CSRF header after obtaining a token and can recover by refetching the token when needed.
   - Acceptance: Frontend request behavior is covered by a focused unit/integration check or equivalent verification showing unsafe mutations include the CSRF header and retry/refetch the token only through the shared client path.

5. **Auth and session lifecycle**: Signup, login, logout, refresh failure, expired sessions, and remember-me behavior must be predictable and tested.
   - Current: Auth routes exist, but refresh can decode expired access tokens and issue a new cookie without a separate refresh-token contract; frontend 401 handling retries refresh but does not define a clear recoverable expired-session state.
   - Target: Invalid or expired access tokens produce a recoverable auth failure, logout clears the access cookie, session checks are stable, and remember-me keeps its current longer-lived cookie behavior with explicit tests for max age and cookie options.
   - Acceptance: Tests cover signup, login, logout, is-authenticated, invalid token, expired token, refresh failure, normal cookie options, and remember-me cookie max age/options.

6. **Password reset safety**: Password reset codes must be safe to store, bounded, single-use, and non-enumerating.
   - Current: `PasswordReset` stores plaintext `token` values with expiry; `forgotPassword` deletes previous tokens and creates a new code, but there is no attempt-limit field or hashed code storage.
   - Target: Reset codes are stored hashed, only one active reset code exists per user, codes expire after 5 minutes, failed verification attempts are limited, successful reset deletes the code, and responses do not reveal whether an email exists.
   - Acceptance: Tests prove reset requests do not enumerate accounts, stored reset records do not contain the raw code, expired codes fail, too many failed attempts fail, verified reset changes the password, and a used code cannot be reused.

7. **OAuth redirect safety**: OAuth callbacks must redirect only to approved frontend origins.
   - Current: OAuth callback behavior derives `FRONTEND_URL` from environment or fallback values, and provider callback base URLs are hard-coded for local or Render backend origins.
   - Target: OAuth success and failure redirects use a strict allowlist derived from sanitized environment values and never honor user-supplied redirect targets.
   - Acceptance: Tests or controller-level verification prove success and failure redirects use only approved frontend origins and reject or ignore unapproved redirect destinations.

8. **Redacted operational logging**: Auth, token, OAuth, reset, request, socket, and frontend auth/reset logs must not expose secrets or user-identifying data by default.
   - Current: Token generation and route protection logs include user ids, emails, token length/previews, and cookie options; frontend auth/reset flows log raw data or errors in several places.
   - Target: Logs are structured and redacted so tokens, token previews, reset codes, cookies, raw emails, OAuth profiles, request bodies with secrets, and full user identifiers are not written by default.
   - Acceptance: A code scan or automated assertion confirms no Phase 1 auth/reset/token/frontend logging path logs raw secrets, raw emails, token previews, reset codes, or raw cookie metadata.

9. **Sanitized environment examples**: Required backend and frontend environment variables must be documented without secrets.
   - Current: Backend and frontend `.env` files exist locally, but no `.env.example` files were found.
   - Target: `Backend/Chatify/.env.example` and `Frontend/Chatify/.env.example` list required variables with safe placeholder values and notes for local Render/Vercel alignment where relevant.
   - Acceptance: Both example files exist, contain every environment variable referenced by Phase 1 code, contain no real secrets, and are safe to commit.

10. **HTTP message authorization regression coverage**: Phase 1 must pin existing HTTP message authorization boundaries without rebuilding message state.
    - Current: `Backend/Chatify/Controller/messageController.mjs` checks `req.userId`, chat id validity, and chat membership for message endpoints, but there are no tests proving non-members are rejected.
    - Target: Backend tests cover protected HTTP message endpoints for unauthenticated access, invalid ids, non-member chat access, and allowed member access for representative read/write operations.
    - Acceptance: Tests fail if a non-member can fetch, create, read, edit, delete, react to, or query unread counts for messages/chats they are not authorized to access.

## Boundaries

**In scope:**
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

**Out of scope:**
- Socket.IO handshake authentication and server-derived socket identity - Phase 2 owns the authenticated realtime contract.
- Socket room membership checks and socket event authorization - Phase 2 owns realtime authorization.
- Message send/receive lifecycle, duplicate merging, unread reconciliation, edit/delete/reaction semantics, and pagination redesign - Phase 3 owns canonical message state.
- Chat page visual reconstruction or component split - Phase 4 owns messenger UI reconstruction.
- Conversation/message search and baseline messenger polish - Phase 5 owns final baseline features.
- Group chats, attachments, notifications, moderation/admin tooling, native apps, and end-to-end encryption - deferred to v2 or later roadmap work.
- Introducing a full refresh-token persistence architecture - keep existing remember-me behavior and test it unless a later phase explicitly replaces the session model.
- Editing `Frontend/Chatify/src/pages/chat/chat.tsx` - existing local work in that file must not be overwritten in Phase 1.

## Constraints

- Keep the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO, TanStack Query, Zustand, Tailwind, and npm package layout.
- Use deterministic tests with in-memory MongoDB and mocked OAuth/email providers; tests must not require real secrets, real OAuth credentials, Brevo, Render, Vercel, or a developer's local `.env` files.
- Preserve cross-domain cookie behavior for Render/Vercel deployment: production cookies remain secure and aligned with configured frontend origins.
- Do not log secrets, token previews, raw emails, OAuth payloads, reset codes, raw cookies, or request bodies containing credentials.
- Do not overwrite existing local work in `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Prefer focused fixes and regression tests over broad architecture rewrites.

## Acceptance Criteria

- [ ] `npm test` from `Backend/Chatify` runs a Vitest/Supertest test suite against isolated in-memory MongoDB and exits 0 when tests pass.
- [ ] GitHub Actions exists and fails when backend security tests fail.
- [ ] Unsafe cookie-authenticated REST requests without a valid CSRF token are rejected.
- [ ] Valid unsafe REST requests with a CSRF token succeed, and every CSRF exemption is documented.
- [ ] Frontend unsafe mutations attach the CSRF header through the shared request path.
- [ ] Auth tests cover signup, login, logout, session check, invalid token, expired token, refresh failure, and remember-me cookie options.
- [ ] Password reset tests prove raw codes are not stored, expiry is enforced, failed attempts are limited, successful reset is single-use, and responses do not enumerate accounts.
- [ ] OAuth callback tests or verification prove redirects use only approved frontend origins.
- [ ] Sensitive backend and frontend auth/reset logs are removed or redacted.
- [ ] `Backend/Chatify/.env.example` and `Frontend/Chatify/.env.example` exist with safe placeholders for all Phase 1 referenced env vars.
- [ ] HTTP message authorization tests reject unauthenticated users and non-members for representative protected message routes.
- [ ] Phase 1 verification does not edit or overwrite `Frontend/Chatify/src/pages/chat/chat.tsx`.

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes |
|--------------------|-------|-------|--------|-------|
| Goal Clarity       | 0.92  | 0.75  | PASS   | Security controls plus blocking tests are the locked deliverable. |
| Boundary Clarity   | 0.88  | 0.70  | PASS   | Socket, message lifecycle, UI reconstruction, and dirty chat page edits are out of scope. |
| Constraint Clarity | 0.82  | 0.65  | PASS   | Test stack, env, logging, cookies, and no-secret constraints are explicit. |
| Acceptance Criteria| 0.86  | 0.70  | PASS   | Pass/fail checks cover scripts, CI, CSRF, auth, reset, OAuth, logging, env docs, and message auth. |
| **Ambiguity**      | 0.11  | <=0.20| PASS   | Gate passed after approving recommendations. |

Status: PASS = met minimum, WARN = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today for Phase 1? | No tests exist, CSRF enforcement is commented out, reset codes are plaintext, logs expose sensitive data, and env examples are missing. |
| 1 | Researcher | What should Phase 1 primarily deliver? | Security controls plus blocking tests, not tests-only or fixes-only. |
| 2 | Simplifier | What should Phase 1 avoid from later phases? | Deep socket and canonical message reconstruction stay in Phase 2 and Phase 3. |
| 2 | Simplifier | What test stack should establish the backend foundation? | Vitest, Supertest, and `mongodb-memory-server` with mocked external services. |
| 3 | Boundary Keeper | What counts as blocking verification? | Local scripts plus GitHub Actions. |
| 3 | Boundary Keeper | Should the dirty chat page be edited? | No edits to `Frontend/Chatify/src/pages/chat/chat.tsx`. |
| 4 | Failure Analyst | What security failures would reject the phase? | Missing CSRF enforcement, unsafe session refresh, plaintext reusable reset codes, unsafe OAuth redirects, sensitive logs, or missing auth/message tests. |
| 5 | Seed Closer | Which recommendations were approved? | User approved all recommendations, locking the final requirement set. |

---

*Phase: 01-security-and-test-foundation*
*Spec created: 2026-06-08*
*Next step: $gsd-discuss-phase 1 - implementation decisions (how to build what is specified above)*
