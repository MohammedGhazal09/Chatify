# Phase 14 Live Acceptance

**Generated:** 2026-06-13T00:00:00.000Z
**Status:** blocked
**Readiness:** Blocked
**Command:** npm run test:e2e:prod -- --grep "production smoke config"
**Local git head:** 96f2cb1

## Production Target

| Field | Value |
|-------|-------|
| Frontend origin | [missing] |
| Backend origin | [missing] |
| Frontend deployed commit | [not provided] |
| Backend deployed commit | [not provided] |
| Opted in | no |
| Accounts | Smoke user A ([missing]), Smoke user B ([missing]) |
| Missing env | CHATIFY_PRODUCTION_SMOKE, CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL, CHATIFY_SMOKE_USER_A_EMAIL, CHATIFY_SMOKE_USER_A_USERNAME, CHATIFY_SMOKE_USER_A_PASSWORD, CHATIFY_SMOKE_USER_B_EMAIL, CHATIFY_SMOKE_USER_B_USERNAME, CHATIFY_SMOKE_USER_B_PASSWORD |
| Invalid URL env | CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL |

## Check Results

| Check | Status | Detail |
|-------|--------|--------|
| Phase 14 production environment contract | blocked | CHATIFY_PRODUCTION_SMOKE=1 is required for Phase 14 live acceptance. Missing Phase 14 production acceptance environment: CHATIFY_PRODUCTION_SMOKE, CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL, CHATIFY_SMOKE_USER_A_EMAIL, CHATIFY_SMOKE_USER_A_USERNAME, CHATIFY_SMOKE_USER_A_PASSWORD, CHATIFY_SMOKE_USER_B_EMAIL, CHATIFY_SMOKE_USER_B_USERNAME, CHATIFY_SMOKE_USER_B_PASSWORD. Invalid Phase 14 production URL environment: CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL. |

## Blockers

- CHATIFY_PRODUCTION_SMOKE=1 is required for Phase 14 live acceptance.
- Missing Phase 14 production acceptance environment: CHATIFY_PRODUCTION_SMOKE, CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL, CHATIFY_SMOKE_USER_A_EMAIL, CHATIFY_SMOKE_USER_A_USERNAME, CHATIFY_SMOKE_USER_A_PASSWORD, CHATIFY_SMOKE_USER_B_EMAIL, CHATIFY_SMOKE_USER_B_USERNAME, CHATIFY_SMOKE_USER_B_PASSWORD.
- Invalid Phase 14 production URL environment: CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL.

## Evidence Paths

- None yet

## Remaining Risks

- No live product readiness claim is allowed until the full Phase 14 gate passes with zero blockers.

## Final Decision

Readiness blocked: 3 blockers recorded.
