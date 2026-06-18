# Runbook: Credential Rotation

**Owner:** Chatify maintainer | **Frequency:** After exposure or scheduled rotation
**Last Updated:** 2026-06-17 | **Last Run:** Not recorded

## Purpose

Rotate Chatify secrets after suspected exposure, provider changes, or routine maintenance.

## Prerequisites

- Access to the backend hosting environment.
- Access to OAuth provider dashboards.
- Access to email provider credentials.
- Ability to invalidate disposable smoke accounts.

## Rotation Targets

- `SECRET_JWT_KEY`
- `PASSWORD_RESET_SECRET`
- `CSRF_SECRET`
- `BREVO_API_KEY`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_SECRET`
- `DISCORD_CLIENT_SECRET`
- `CALL_TURN_CREDENTIAL`
- Smoke account passwords

## Procedure

### Step 1: Generate Replacement Values

Use the provider dashboard or a local secure generator. Do not paste generated values into docs, chats, commits, or phase artifacts.

**Expected result:** New values are available in the secret store only.
**If it fails:** Stop until secure generation/storage is available.

### Step 2: Update Hosted Environment

Set the replacement values in the backend hosting provider and redeploy or restart as required.

**Expected result:** The backend starts with new values.
**If it fails:** Restore the previous secret from the provider secret history if available, then investigate.

### Step 3: Invalidate Old Sessions And Smoke Secrets

Ask affected users to log in again if JWT/session secrets changed. Reset smoke account passwords if smoke secrets rotated.

**Expected result:** Old tokens and known exposed smoke credentials no longer work.
**If it fails:** Treat as a security incident and escalate.

### Step 4: Verify

```powershell
Invoke-RestMethod "$env:CHATIFY_PROD_BACKEND_URL/api/ready"
npm run smoke:prod -- --grep "Phase 14 production live acceptance"
```

**Expected result:** Readiness and smoke behavior are no worse than before rotation.
**If it fails:** Roll back the last changed secret only if it is safe to do so.

## Verification

- No rotated value appears in git, logs, screenshots, traces, or phase artifacts.
- Readiness does not expose secret values.
- Production smoke records only account labels.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| All sessions invalidated | JWT secret changed | Expected; users must log in again |
| Reset emails fail | Email provider key rotated incorrectly | Verify `BREVO_API_KEY` and sender identity in provider dashboard |
| Calls fail after rotation | TURN credential mismatch | Verify `CALL_TURN_USERNAME` and `CALL_TURN_CREDENTIAL` together |

## Escalation

| Situation | Contact | Method |
|---|---|---|
| Secret exposure is confirmed | Project maintainer | Rotate immediately and keep release blocked until evidence is clean |
