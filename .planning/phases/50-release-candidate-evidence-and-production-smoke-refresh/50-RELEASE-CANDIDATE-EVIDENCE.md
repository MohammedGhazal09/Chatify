---
phase: 50-release-candidate-evidence-and-production-smoke-refresh
artifact: production-evidence
status: blocked
generated_at: 2026-07-01T04:16:03.956Z
privacy: sanitized
---

# Phase 50 Release Candidate Evidence

## Decision

Release-candidate evidence gate remains blocked. Do not claim launch readiness, v1 readiness, or hosted/provider success.

## Environment Contracts

| Contract | Status | Origins | Detail |
|---|---|---|---|
| Production live smoke | blocked | CHATIFY_PROD_FRONTEND_URL: [missing]; CHATIFY_PROD_BACKEND_URL: [missing] | CHATIFY_PRODUCTION_SMOKE=1 is required. Missing env: CHATIFY_PRODUCTION_SMOKE, CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL, CHATIFY_SMOKE_USER_A_EMAIL, CHATIFY_SMOKE_USER_A_USERNAME, CHATIFY_SMOKE_USER_A_PASSWORD, CHATIFY_SMOKE_USER_B_EMAIL, CHATIFY_SMOKE_USER_B_USERNAME, CHATIFY_SMOKE_USER_B_PASSWORD. Invalid URL env: CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL. |
| Local two-account call smoke | blocked | CHATIFY_LOCAL_FRONTEND_URL: [missing]; CHATIFY_LOCAL_BACKEND_URL: [missing] | CHATIFY_LOCAL_CALL_SMOKE=1 is required. Missing env: CHATIFY_LOCAL_CALL_SMOKE, CHATIFY_LOCAL_FRONTEND_URL, CHATIFY_LOCAL_BACKEND_URL, CHATIFY_LOCAL_USER_A_EMAIL, CHATIFY_LOCAL_USER_A_PASSWORD, CHATIFY_LOCAL_USER_B_EMAIL, CHATIFY_LOCAL_USER_B_PASSWORD. Invalid URL env: CHATIFY_LOCAL_FRONTEND_URL, CHATIFY_LOCAL_BACKEND_URL. |
| Local profile-image cross-user smoke | blocked | CHATIFY_LOCAL_BACKEND_URL: [missing]; VITE_BACKEND_URL: [missing] | CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE=1 is required. Missing env: CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE, CHATIFY_LOCAL_BACKEND_URL, VITE_BACKEND_URL, CHATIFY_LOCAL_USER_A_EMAIL, CHATIFY_LOCAL_USER_A_PASSWORD, CHATIFY_LOCAL_USER_B_EMAIL, CHATIFY_LOCAL_USER_B_PASSWORD. Invalid URL env: CHATIFY_LOCAL_BACKEND_URL, VITE_BACKEND_URL. |
| Production TURN readiness | blocked | No URL env in this contract. | Missing env: CALL_TURN_URLS, CALL_TURN_USERNAME, CALL_TURN_CREDENTIAL. |

## Evidence Artifacts

| Artifact | Status | Path | Detail |
|---|---|---|---|
| Phase 14 production live acceptance | passed_user_confirmed | .planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md | Acceptable for this gate. |
| Phase 15 call acceptance | production_ready_user_confirmed | .planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-CALL-ACCEPTANCE.md | Acceptable for this gate. |
| Phase 16 profile image acceptance | passed_user_confirmed | .planning/phases/16-profile-picture-upload-and-shared-avatar-visibility/16-PROFILE-IMAGE-ACCEPTANCE.md | Acceptable for this gate. |
| Phase 17 v1 readiness decision | ready_user_confirmed | .planning/phases/17-v1-readiness-closure-and-release-gate/17-V1-READINESS.md | Acceptable for this gate. |
| Phase 24 group call verification | passed | .planning/phases/24-group-message-sender-names-and-group-voice-video-calls/24-VERIFICATION.md | Acceptable for this gate. |

## Blockers

- Production live smoke: CHATIFY_PRODUCTION_SMOKE=1 is required.
- Production live smoke: Missing env: CHATIFY_PRODUCTION_SMOKE, CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL, CHATIFY_SMOKE_USER_A_EMAIL, CHATIFY_SMOKE_USER_A_USERNAME, CHATIFY_SMOKE_USER_A_PASSWORD, CHATIFY_SMOKE_USER_B_EMAIL, CHATIFY_SMOKE_USER_B_USERNAME, CHATIFY_SMOKE_USER_B_PASSWORD.
- Production live smoke: Invalid URL env: CHATIFY_PROD_FRONTEND_URL, CHATIFY_PROD_BACKEND_URL.
- Local two-account call smoke: CHATIFY_LOCAL_CALL_SMOKE=1 is required.
- Local two-account call smoke: Missing env: CHATIFY_LOCAL_CALL_SMOKE, CHATIFY_LOCAL_FRONTEND_URL, CHATIFY_LOCAL_BACKEND_URL, CHATIFY_LOCAL_USER_A_EMAIL, CHATIFY_LOCAL_USER_A_PASSWORD, CHATIFY_LOCAL_USER_B_EMAIL, CHATIFY_LOCAL_USER_B_PASSWORD.
- Local two-account call smoke: Invalid URL env: CHATIFY_LOCAL_FRONTEND_URL, CHATIFY_LOCAL_BACKEND_URL.
- Local profile-image cross-user smoke: CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE=1 is required.
- Local profile-image cross-user smoke: Missing env: CHATIFY_LOCAL_PROFILE_IMAGE_ACCEPTANCE, CHATIFY_LOCAL_BACKEND_URL, VITE_BACKEND_URL, CHATIFY_LOCAL_USER_A_EMAIL, CHATIFY_LOCAL_USER_A_PASSWORD, CHATIFY_LOCAL_USER_B_EMAIL, CHATIFY_LOCAL_USER_B_PASSWORD.
- Local profile-image cross-user smoke: Invalid URL env: CHATIFY_LOCAL_BACKEND_URL, VITE_BACKEND_URL.
- Production TURN readiness: Missing env: CALL_TURN_URLS, CALL_TURN_USERNAME, CALL_TURN_CREDENTIAL.

## Required Commands

- `npm run evidence:production`
- `npm run smoke:prod -- --grep "Phase 14 production live acceptance|Phase 15" --workers=1`
- `npm run smoke:local -- --grep "Phase 15|Phase 16" --workers=1`
- `npm run ops:check`

## Privacy Rules

- This artifact records environment variable names, status, and sanitized origins only.
- It must not contain raw emails, passwords, cookies, tokens, reset codes, SDP, ICE candidates, or TURN credentials.
- Missing credentials are release blockers, not test passes.
