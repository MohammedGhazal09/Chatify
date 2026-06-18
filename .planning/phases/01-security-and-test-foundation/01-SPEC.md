# Phase 1: Security And Test Foundation - Specification

**Created:** 2026-06-08
**Updated:** 2026-06-17
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 9 locked

## Goal

Chatify has enforceable cookie-authenticated security controls, deterministic automated tests, and safe configuration/logging defaults before deeper realtime and messenger reconstruction continue.

## Background

Phase 1 was originally planned when the project had no usable test harness. The current repository has since gained backend Vitest/Supertest/memory-Mongo tests, frontend Vitest support, auth/session tests, message authorization tests, and a GitHub Actions security/test workflow. The remaining Phase 1 work is therefore gap closure against the current repo, not a from-scratch harness.

Current verified gaps as of 2026-06-17:

- `/api/auth` and selected `/api/user` unsafe routes enforce CSRF, but `/api/chat` and `/api/message` unsafe cookie-authenticated routes were not globally protected.
- The CSRF token path existed but needed to stay aligned with signed double-submit behavior.
- Password reset records still stored raw six-digit codes and did not enforce failed-attempt invalidation.
- Sanitized `.env.example` files were missing.
- `Backend/Chatify/profile.json` was a tracked generated profile-shaped artifact.
- The existing Phase 1 planning docs still described pre-harness assumptions that no longer match the codebase.

## Requirements

1. **Blocking test foundation is preserved and expanded.**
   - Current: Backend Vitest, Supertest, `mongodb-memory-server`, frontend Vitest, and GitHub Actions exist.
   - Target: Keep the harness green while adding regression coverage for any remaining Phase 1 security fixes.
   - Acceptance: `npm test` from `Backend/Chatify` passes and includes auth lifecycle, CSRF, reset, and HTTP message authorization coverage.

2. **Unsafe cookie-authenticated REST mutations enforce CSRF.**
   - Current: CSRF was active for `/api/auth` and selected `/api/user` routes, but not globally for `/api/chat` and `/api/message`.
   - Target: Unsafe POST, PUT, PATCH, and DELETE requests under cookie-authenticated auth/user/chat/message surfaces require a valid CSRF token unless the route is a safe documented exemption.
   - Acceptance: Tests prove unsafe auth/chat/message requests without CSRF fail, valid-token requests reach normal route behavior, and safe GET routes remain exempt.

3. **Shared frontend CSRF behavior remains the only client transport path.**
   - Current: `Frontend/Chatify/src/api/axios.ts` reads the `XSRF-TOKEN` cookie and attaches `X-CSRF-Token` for unsafe methods.
   - Target: Keep frontend mutations on the shared Axios client and avoid per-page CSRF workarounds.
   - Acceptance: Existing frontend CSRF tests pass and no Phase 1 work adds a second transport path.

4. **Auth and session lifecycle stays predictable under the current refresh-token architecture.**
   - Current: The repo now has persisted opaque refresh sessions with rotation and replay detection.
   - Target: Preserve and test the current refresh-token model rather than reverting to the older access-token-only plan.
   - Acceptance: Auth lifecycle tests cover signup, login, logout, authenticated checks, refresh rotation, replay rejection, invalid credentials, OAuth handoff, and remember-me behavior.

5. **Password reset codes are safe to store and bounded.**
   - Current: `PasswordReset` stored raw `token` values.
   - Target: Store only HMAC-SHA256 digests using `PASSWORD_RESET_SECRET`, keep one active reset per user, expire records after 5 minutes, delete used records, and invalidate after 5 failed attempts.
   - Acceptance: Tests prove forgot-password does not enumerate accounts, raw codes are not stored, expired codes fail, 5 failed attempts invalidate the record, successful reset changes the password, and a used code cannot be reused.

6. **OAuth redirect behavior uses approved first-party origins.**
   - Current: OAuth handoff/finalize flow exists and is covered by tests.
   - Target: Keep redirect construction constrained to configured first-party frontend origins and ignore user-controlled redirect targets.
   - Acceptance: OAuth tests continue to prove success and failure redirects use approved destinations.

7. **Sensitive artifacts and logs are redacted or removed.**
   - Current: Several operational `console` calls remain, but Phase 1 must block known auth/reset/token/profile leaks.
   - Target: Remove generated profile artifacts, avoid logging raw reset/email/token/cookie details, and keep development error payloads sanitized.
   - Acceptance: `Backend/Chatify/profile.json` is removed and ignored, reset email errors do not log raw messages or recipients, development error bodies remove password/code/token/email fields, and code scan shows no known forbidden Phase 1 leak patterns.

8. **Sanitized environment examples document required variables.**
   - Current: Local `.env` files exist, but safe examples were missing.
   - Target: Add backend and frontend `.env.example` files with placeholders for current env references only.
   - Acceptance: Examples include backend auth/session/CSRF/reset/OAuth/email/socket/call variables and frontend API/socket variables without real secrets.

9. **Phase 1 does not overwrite protected chat-page work.**
   - Current: Project instructions protect `Frontend/Chatify/src/pages/chat/chat.tsx`.
   - Target: Avoid editing that file during Phase 1 security foundation work.
   - Acceptance: `git status --short` shows no Phase 1 edits to `Frontend/Chatify/src/pages/chat/chat.tsx`.

## Boundaries

**In scope:**

- Backend security regression tests for CSRF and password reset.
- CSRF enforcement on unsafe protected REST routes.
- Shared Axios CSRF compatibility verification.
- Password reset hashing, expiry, attempts, and single-use behavior.
- OAuth/session behavior verification against the current refresh-token model.
- Redacted reset/error logging cleanup and generated profile artifact removal.
- Sanitized env examples.
- Planning artifact refresh where stale docs would mislead execution.

**Out of scope:**

- Rebuilding Socket.IO identity or socket authorization.
- Rebuilding canonical message state, unread reconciliation, edit/delete/reaction semantics, or pagination.
- Chat page visual reconstruction.
- New notification, moderation, admin, mobile, or encryption features.
- Reverting the current persisted refresh-session architecture.
- Editing `Frontend/Chatify/src/pages/chat/chat.tsx`.

## Acceptance Criteria

- [ ] Backend full suite passes from `Backend/Chatify`.
- [ ] Frontend lint, build, and tests pass from `Frontend/Chatify`.
- [ ] Unsafe auth/chat/message requests without CSRF are rejected.
- [ ] Valid CSRF tokens allow chat/message mutations to reach normal route behavior.
- [ ] Password reset records do not store raw codes.
- [ ] Password reset expiry, 5 failed attempts, successful reset, and single-use behavior are tested.
- [ ] OAuth/session tests remain green under the current refresh-token model.
- [ ] `.env.example` files exist and contain no real secrets.
- [ ] `Backend/Chatify/profile.json` is removed and ignored.
- [ ] `Frontend/Chatify/src/pages/chat/chat.tsx` is untouched by this phase.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.94 | 0.75 | PASS | Current task is Phase 1 gap closure against live code. |
| Boundary Clarity | 0.90 | 0.70 | PASS | Later socket/message/UI work is fenced out. |
| Constraint Clarity | 0.86 | 0.65 | PASS | Current stack, refresh-session model, and protected chat page are explicit. |
| Acceptance Criteria | 0.88 | 0.70 | PASS | Criteria map to tests, scans, and file evidence. |
| **Ambiguity** | 0.10 | <=0.20 | PASS | Recommendations are approved by the active goal. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Refresh | Should Phase 1 restart from old assumptions or reconcile current code? | Reconcile current code and close remaining gaps. |
| 2 | Security | Should chat/message unsafe routes be CSRF protected? | Yes, protected unsafe REST routes require CSRF. |
| 3 | Session | Should the current refresh-token architecture be preserved? | Yes, treat it as current architecture and keep tests green. |
| 4 | Reset | How should reset codes be stored and bounded? | HMAC digests with `PASSWORD_RESET_SECRET`, 5 failed attempts, single-use. |
| 5 | Hygiene | How should generated profile/env artifacts be handled? | Remove generated profile data, ignore future dumps, add safe env examples. |

---

*Phase: 01-security-and-test-foundation*
*Spec updated: 2026-06-17*
*Next step: execute remaining gap-closure plans and verify*
