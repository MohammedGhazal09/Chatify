# Runbook: Production Smoke

**Owner:** Chatify maintainer | **Frequency:** Before release claims
**Last Updated:** 2026-06-17 | **Last Run:** Not recorded

## Purpose

Run the production acceptance suite against real deployed origins and disposable accounts.

## Prerequisites

- Production frontend and backend deployments are live.
- Two disposable smoke accounts exist and can be reset safely.
- Smoke secrets are set only in the local shell or secret store.

## Required Environment

```powershell
$env:CHATIFY_PRODUCTION_SMOKE="1"
$env:CHATIFY_PROD_FRONTEND_URL="https://frontend.example.test"
$env:CHATIFY_PROD_BACKEND_URL="https://backend.example.test"
$env:CHATIFY_SMOKE_USER_A_EMAIL="<smoke-user-a-email>"
$env:CHATIFY_SMOKE_USER_A_PASSWORD="<smoke-user-a-password>"
$env:CHATIFY_SMOKE_USER_B_EMAIL="<smoke-user-b-email>"
$env:CHATIFY_SMOKE_USER_B_PASSWORD="<smoke-user-b-password>"
```

For production call readiness, the backend host must also have:

```powershell
CALL_TURN_URLS="<turn-urls>"
CALL_TURN_USERNAME="<turn-username>"
CALL_TURN_CREDENTIAL="<turn-credential>"
```

## Procedure

### Step 1: Confirm Readiness

```powershell
Invoke-RestMethod "$env:CHATIFY_PROD_BACKEND_URL/api/ready"
```

**Expected result:** Readiness is `ok` or reports explicit blockers.
**If it fails:** Do not run release smoke as a pass gate; fix or record the blocker first.

### Step 2: Run Production Acceptance

```powershell
npm run smoke:prod -- --grep "Phase 14 production live acceptance|Phase 15"
```

**Expected result:** Tests pass or write blocked evidence with missing env names.
**If it fails:** Preserve the Playwright trace and phase artifact, then triage the first failed workflow.

## Verification

- Artifacts reference smoke account labels only.
- No raw email, password, cookie, token, reset code, SDP, or ICE candidate is committed.
- Phase 17 remains blocked unless all production smoke blockers are gone.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Test skips immediately | One or more smoke env vars are missing | Recheck the Required Environment section |
| Calls fail only in production | TURN is missing or unreachable | Verify backend `CALL_TURN_*` env and provider firewall rules |
| Messages require refresh | Delivery reliability regression | Keep release blocked and inspect Phase 10.1 delivery evidence |

## Rollback

If production smoke finds a regression, rollback the frontend or backend deployment that introduced it, then rerun this runbook.

## Escalation

| Situation | Contact | Method |
|---|---|---|
| Smoke accounts may be exposed | Project maintainer | Rotate credentials immediately, then record the incident |

