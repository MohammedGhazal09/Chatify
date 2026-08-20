# Phase 01: security-and-test-foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 01-security-and-test-foundation
**Areas discussed:** Backend test harness, CSRF enforcement, Auth and session behavior, Password reset hardening, OAuth redirect safety, Redacted logging, CI verification, Repository hygiene

---

## Backend Test Harness

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| Backend test layout | Dedicated `Backend/Chatify/test/` tree; colocated `*.test.mjs`; mixed | Dedicated `Backend/Chatify/test/` tree |
| Test bootstrap boundary | Import `app.mjs`; start `server.mjs`; controller-unit only | Import `app.mjs` |
| Database fixtures | API-only; direct Mongoose factories only; hybrid | Hybrid |

**User's choice:** Approved all recommendations.
**Notes:** This locks a route-oriented backend test foundation using app import, Supertest, in-memory MongoDB, and fixtures that can precisely express chat membership.

---

## CSRF Enforcement

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| CSRF implementation | Wire existing `csurf`; signed double-submit helper; postpone | Signed double-submit helper |
| CSRF exemptions | Many auth routes; only safe bootstrap/OAuth GET/read-only routes; route-by-route discretionary | Only safe bootstrap/OAuth GET/read-only routes |
| Frontend CSRF attachment | Per API method; axios request interceptor; manual page calls | Axios request interceptor |

**User's choice:** Approved all recommendations.
**Notes:** OWASP guidance and current Express legacy package guidance supported signed double-submit over new reliance on `csurf`.

---

## Auth and Session Behavior

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| Session refresh behavior | Decode expired JWTs; renew only valid access tokens; add full refresh-token storage | Renew only valid access tokens |
| Session-expired UX | Global toast; login-page message; no visible message | Login-page message |

**User's choice:** Approved all recommendations.
**Notes:** Full refresh-token storage is out of scope for Phase 1. Expired or invalid access tokens should become recoverable auth failures.

---

## Password Reset Hardening

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| Reset-code hashing | Argon2 hash; HMAC hash with dedicated secret; plaintext plus DB controls | HMAC hash with dedicated secret |
| Reset attempt limit | 3 attempts; 5 attempts; 10 attempts | 5 attempts |

**User's choice:** Approved all recommendations.
**Notes:** HMAC-SHA256 with `PASSWORD_RESET_SECRET` avoids plaintext storage for short reset codes while keeping verification deterministic.

---

## OAuth Redirect Safety

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| OAuth redirect config | Keep hard-coded/fallback URLs; strict frontend allowlist only; user-provided redirect params | Strict frontend allowlist only |

**User's choice:** Approved all recommendations.
**Notes:** Approved origins come from `FRONTEND_ORIGIN` and `FRONTEND_ORIGIN_DEV`; user-supplied redirect targets are ignored.

---

## Redacted Logging

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| Logging helper scope | Remove sensitive logs ad hoc; small backend/frontend helpers; full logging library | Small backend/frontend helpers |
| Sensitive log gate | Manual review only; regex/script gate; full static analyzer | Regex/script gate |

**User's choice:** Approved all recommendations.
**Notes:** The selected approach keeps Phase 1 focused while providing blocking verification against known forbidden auth/reset/token log patterns.

---

## CI Verification

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| CI workflow scope | Backend tests only; backend tests plus frontend lint/build always; path-filtered frontend checks | Backend tests plus frontend lint/build always |
| Node version for CI | Node 20; Node 22; matrix | Node 22 |

**User's choice:** Approved all recommendations.
**Notes:** Always running frontend lint/build is acceptable because the repo is small and Phase 1 touches shared frontend request/session behavior.

---

## Repository Hygiene

| Question | Options Presented | Selected |
|----------|-------------------|----------|
| `Backend/Chatify/profile.json` | Ignore; inspect/remove if generated; defer | Inspect/remove if generated |
| Frontend test scope in Phase 1 | No frontend tests; one focused axios/AuthStore test; full React Testing Library setup | One focused axios/AuthStore test |
| Planning split for roadmap plans | Keep 3 plans; merge into one; split into more | Keep 3 plans |

**User's choice:** Approved all recommendations.
**Notes:** Phase 1 should avoid editing the dirty chat page and preserve the roadmap's three-plan structure.

---

## Agent Discretion

- Exact backend test file names and helper names may be selected by the planner.
- The sensitive-log gate may be a Vitest test or an npm script if it runs in the blocking verification path.
- Dependency cleanup for unused `csurf` may be included or deferred as long as active CSRF enforcement does not rely on it.

## Deferred Ideas

None.
