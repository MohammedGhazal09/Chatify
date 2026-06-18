# Phase 15 Call Acceptance

**Generated:** 2026-06-17T09:55:37.263Z
**Status:** production_blocked
**Command:** npm run test:ui -- --grep "Phase 15"

## Local Target

| Field | Value |
|-------|-------|
| Frontend origin | [missing] |
| Backend origin | [missing] |
| Opted in | no |
| Accounts | Local smoke user A ([missing]), Local smoke user B ([missing]) |
| Missing env | CHATIFY_LOCAL_CALL_SMOKE, CHATIFY_LOCAL_FRONTEND_URL, CHATIFY_LOCAL_BACKEND_URL, CHATIFY_LOCAL_USER_A_EMAIL, CHATIFY_LOCAL_USER_A_PASSWORD, CHATIFY_LOCAL_USER_B_EMAIL, CHATIFY_LOCAL_USER_B_PASSWORD |
| Invalid URL env | CHATIFY_LOCAL_FRONTEND_URL, CHATIFY_LOCAL_BACKEND_URL |

## Production Target

| Field | Value |
|-------|-------|
| Frontend origin | [missing] |
| Backend origin | [missing] |
| Opted in | no |
| Missing env | CHATIFY_PRODUCTION_SMOKE, CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL, CHATIFY_SMOKE_USER_A_EMAIL, CHATIFY_SMOKE_USER_A_PASSWORD, CHATIFY_SMOKE_USER_B_EMAIL, CHATIFY_SMOKE_USER_B_PASSWORD |
| Invalid URL env | CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL |

## Check Results

| Check | Status | Detail |
|-------|--------|--------|
| Phase 15 local two-account environment contract | blocked | CHATIFY_LOCAL_CALL_SMOKE=1 is required for Phase 15 local two-account call acceptance. Missing Phase 15 local call environment: CHATIFY_LOCAL_CALL_SMOKE, CHATIFY_LOCAL_FRONTEND_URL, CHATIFY_LOCAL_BACKEND_URL, CHATIFY_LOCAL_USER_A_EMAIL, CHATIFY_LOCAL_USER_A_PASSWORD, CHATIFY_LOCAL_USER_B_EMAIL, CHATIFY_LOCAL_USER_B_PASSWORD. Invalid Phase 15 local URL environment: CHATIFY_LOCAL_FRONTEND_URL, CHATIFY_LOCAL_BACKEND_URL. |
| Phase 15 production smoke environment contract | blocked | CHATIFY_PRODUCTION_SMOKE=1 is required for Phase 14 live acceptance. Missing Phase 14 production acceptance environment: CHATIFY_PRODUCTION_SMOKE, CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL, CHATIFY_SMOKE_USER_A_EMAIL, CHATIFY_SMOKE_USER_A_PASSWORD, CHATIFY_SMOKE_USER_B_EMAIL, CHATIFY_SMOKE_USER_B_PASSWORD. Invalid Phase 14 production URL environment: CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL. |

## Blockers

- CHATIFY_LOCAL_CALL_SMOKE=1 is required for Phase 15 local two-account call acceptance.
- Missing Phase 15 local call environment: CHATIFY_LOCAL_CALL_SMOKE, CHATIFY_LOCAL_FRONTEND_URL, CHATIFY_LOCAL_BACKEND_URL, CHATIFY_LOCAL_USER_A_EMAIL, CHATIFY_LOCAL_USER_A_PASSWORD, CHATIFY_LOCAL_USER_B_EMAIL, CHATIFY_LOCAL_USER_B_PASSWORD.
- Invalid Phase 15 local URL environment: CHATIFY_LOCAL_FRONTEND_URL, CHATIFY_LOCAL_BACKEND_URL.
- CHATIFY_PRODUCTION_SMOKE=1 is required for Phase 14 live acceptance.
- Missing Phase 14 production acceptance environment: CHATIFY_PRODUCTION_SMOKE, CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL, CHATIFY_SMOKE_USER_A_EMAIL, CHATIFY_SMOKE_USER_A_PASSWORD, CHATIFY_SMOKE_USER_B_EMAIL, CHATIFY_SMOKE_USER_B_PASSWORD.
- Invalid Phase 14 production URL environment: CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL.

## Evidence Paths

- None yet

## Remaining Risks

- Local audio/video readiness cannot be accepted until the full two-account fake-media workflow passes.
- Production readiness remains separate and requires production smoke plus TURN evidence.

## Final Recommendation

Recommendation: keep Phase 15 readiness blocked until the listed prerequisites pass with zero call blockers.
