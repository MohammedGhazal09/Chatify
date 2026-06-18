# Runbook: Deployment Verification

**Owner:** Chatify maintainer | **Frequency:** Every deployment
**Last Updated:** 2026-06-17 | **Last Run:** Not recorded

## Purpose

Verify that the deployed frontend and backend are aligned before any readiness claim.

## Prerequisites

- Access to the frontend and backend hosting dashboards.
- Deployed frontend URL in `CHATIFY_PROD_FRONTEND_URL`.
- Deployed backend URL in `CHATIFY_PROD_BACKEND_URL`.
- Disposable smoke accounts stored outside git.

## Procedure

### Step 1: Check Backend Health

```powershell
Invoke-RestMethod "$env:CHATIFY_PROD_BACKEND_URL/api/health"
Invoke-RestMethod "$env:CHATIFY_PROD_BACKEND_URL/api/ready"
```

**Expected result:** Health is `ok`; readiness is `ok` or explicitly identifies blocked components.
**If it fails:** Capture the component status and hosting deploy id before changing configuration.

### Step 2: Verify Frontend Origin

```powershell
$env:CHATIFY_PROD_FRONTEND_URL
$env:CHATIFY_PROD_BACKEND_URL
```

**Expected result:** Values are HTTPS origins for the deployed Vercel frontend and Render backend.
**If it fails:** Correct the local smoke environment before running browser checks.

### Step 3: Run Production Smoke

```powershell
npm run smoke:prod -- --grep "Phase 14 production live acceptance"
```

**Expected result:** The smoke suite either passes with evidence or writes a blocked artifact naming missing prerequisites.
**If it fails:** Keep release blocked and triage the first failed production workflow.

## Verification

- Production readiness evidence references commands and sanitized artifact paths.
- No smoke password, auth cookie, bearer token, reset code, SDP, or ICE candidate appears in logs or artifacts.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `/api/ready` is blocked for TURN | Production call readiness is not configured | Set `CALL_TURN_URLS`, `CALL_TURN_USERNAME`, and `CALL_TURN_CREDENTIAL` in the backend host |
| Browser auth succeeds locally but fails hosted | Cookie/CORS origin mismatch | Align `FRONTEND_ORIGIN`, secure cookie settings, and hosted frontend URL |
| Smoke suite skips | Required smoke env is missing | Fill the production smoke env names from `production-smoke.md` |

## Rollback

Use the hosting provider rollback feature or revert the deployment commit, then rerun `/api/ready` and the failed smoke command.

## Escalation

| Situation | Contact | Method |
|---|---|---|
| Hosted smoke remains blocked after env alignment | Project maintainer | Current Codex thread or issue tracker |

