# Runbook: Rollback

**Owner:** Chatify maintainer | **Frequency:** As needed
**Last Updated:** 2026-06-17 | **Last Run:** Not recorded

## Purpose

Return Chatify to the last known acceptable deployment after a production regression.

## Prerequisites

- Access to Vercel frontend deployment history.
- Access to Render backend deployment history.
- Current failing evidence has been captured without secrets.

## Procedure

### Step 1: Record The Failing State

```powershell
Invoke-RestMethod "$env:CHATIFY_PROD_BACKEND_URL/api/ready"
npm run smoke:prod -- --grep "Phase 14 production live acceptance"
```

**Expected result:** A blocked or failed artifact records the failing workflow.
**If it fails:** Save provider logs and deploy ids manually.

### Step 2: Roll Back The Changed Service

Use the hosting dashboard to redeploy the last known good frontend or backend deployment.

**Expected result:** Provider status shows the older deploy serving traffic.
**If it fails:** Stop and escalate; do not stack additional config changes blindly.

### Step 3: Re-Verify

```powershell
Invoke-RestMethod "$env:CHATIFY_PROD_BACKEND_URL/api/ready"
npm run smoke:prod -- --grep "Phase 14 production live acceptance"
```

**Expected result:** The original incident symptom is gone or the remaining blocker is clearly different.
**If it fails:** The rollback target was not actually good or the incident is config/provider-level.

## Verification

- Rollback notes include service name, old deploy id, new active deploy id, readiness status, smoke status, and residual blockers.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Rollback did not change behavior | Wrong service rolled back | Compare frontend and backend deploy ids |
| Readiness still blocked | Environment or provider issue | Fix env/provider layer before code changes |
| Smoke still fails after readiness ok | Product-level regression remains | Continue incident triage with trace evidence |

## Escalation

| Situation | Contact | Method |
|---|---|---|
| No known good deploy exists | Project maintainer | Keep release blocked and create a repair phase |

