---
phase: 01-security-and-test-foundation
plan: 02
subsystem: security
tags: [csrf, password-reset, hmac, axios, env-example, vitest]
requires:
  - phase: 01-01
    provides: Backend security test harness
provides:
  - Signed CSRF tokens
  - CSRF enforcement on unsafe chat/message routes
  - Password reset HMAC storage and attempt invalidation
  - Sanitized backend/frontend env examples
affects: [auth, chat, messages, frontend-api, security]
tech-stack:
  added: []
  patterns: [signed double-submit CSRF, HMAC reset-code storage, focused route regression tests]
key-files:
  created:
    - Backend/Chatify/test/security/csrf.test.mjs
    - Backend/Chatify/test/auth/reset.security.test.mjs
    - Backend/Chatify/.env.example
    - Frontend/Chatify/.env.example
  modified:
    - Backend/Chatify/app.mjs
    - Backend/Chatify/Middlewares/csrfProtection.mjs
    - Backend/Chatify/Controller/authController.mjs
    - Backend/Chatify/Models/passwordResetModel.mjs
    - Backend/Chatify/test/helpers/authAgent.mjs
key-decisions:
  - "Use signed CSRF tokens and accept the existing X-CSRF-Token/X-XSRF-Token headers."
  - "Mount CSRF after protect for chat/message routes so unauthenticated failures remain 401."
  - "Store password reset codes as HMAC digests with a five-attempt invalidation limit."
patterns-established:
  - "Test helpers auto-attach CSRF only for chat/message unsafe routes to avoid weakening existing negative CSRF tests."
requirements-completed: [SEC-01, SEC-03, SEC-04, AUTH-01, AUTH-02, TEST-01, TEST-04]
duration: same session
completed: 2026-06-17
---

# Phase 1 Plan 02 Summary

**Signed CSRF enforcement for protected REST mutations plus HMAC password reset storage**

## Performance

- **Completed:** 2026-06-17
- **Tasks:** 4 gap-closure tasks
- **Files modified:** 10 core files plus new tests/env examples

## Accomplishments

- `/api/chat` and `/api/message` unsafe routes now compose `protect` with `csrfProtection`.
- CSRF tokens are signed with HMAC and validated before accepting unsafe requests.
- Backend tests prove missing CSRF fails and valid CSRF reaches normal chat/message behavior.
- Password reset records now store `tokenHash` and `attempts`, not raw reset codes.
- Reset tests cover non-enumeration, no raw storage, expiry, five failed attempts, password change, and single-use behavior.
- Backend and frontend `.env.example` files document current required variables with placeholders only.

## Task Commits

No git commit was created in this run.

## Files Created/Modified

- `Backend/Chatify/Middlewares/csrfProtection.mjs` - signed CSRF token creation and validation.
- `Backend/Chatify/app.mjs` - CSRF mounted for protected chat/message REST routes.
- `Backend/Chatify/test/security/csrf.test.mjs` - CSRF regression coverage.
- `Backend/Chatify/Controller/authController.mjs` - HMAC reset-code verification and failed-attempt invalidation.
- `Backend/Chatify/Models/passwordResetModel.mjs` - `tokenHash` and `attempts` fields.
- `Backend/Chatify/test/auth/reset.security.test.mjs` - password reset security coverage.
- `Backend/Chatify/.env.example` and `Frontend/Chatify/.env.example` - safe config examples.

## Decisions Made

- Preserve the current persisted refresh-session model and avoid reverting to the stale older plan.
- Keep frontend CSRF behavior in the shared Axios path; no page-level workarounds were added.
- Use `PASSWORD_RESET_SECRET` as the reset-code HMAC secret.

## Deviations from Plan

The stale Plan 02 said not to introduce persisted refresh tokens. The current repo already has refresh sessions, so the refresh corrected the plan direction: preserve and verify current architecture.

## Issues Encountered

None after focused test iteration. New targeted tests passed before the full suite.

## User Setup Required

Production/staging environments should set the new documented `CSRF_SECRET` and `PASSWORD_RESET_SECRET` values. Local tests set safe test values automatically.

## Next Phase Readiness

Plan 03 privacy/logging cleanup can rely on signed CSRF and reset-code hashing being in place.

---
*Phase: 01-security-and-test-foundation*
*Completed: 2026-06-17*
