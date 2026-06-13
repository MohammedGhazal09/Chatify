---
phase: 14-production-live-acceptance-gate
status: incomplete
created: 2026-06-13
---

# Phase 14 User Setup

Phase 14 live acceptance requires explicit deployed origins and two disposable production-safe smoke accounts. Set these values only in the local shell, CI secret store, or deployment secret manager. Do not commit real values.

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `CHATIFY_PRODUCTION_SMOKE` | Must be `1` to opt into the live production acceptance gate. |
| `CHATIFY_PROD_FRONTEND_URL` | Deployed Vercel frontend URL. |
| `CHATIFY_PROD_BACKEND_URL` | Deployed Render backend URL. |
| `CHATIFY_SMOKE_USER_A_EMAIL` | Disposable smoke account A email. |
| `CHATIFY_SMOKE_USER_A_PASSWORD` | Disposable smoke account A password. |
| `CHATIFY_SMOKE_USER_B_EMAIL` | Disposable smoke account B email. |
| `CHATIFY_SMOKE_USER_B_PASSWORD` | Disposable smoke account B password. |

## Optional Evidence Variables

| Variable | Purpose |
|----------|---------|
| `CHATIFY_PROD_FRONTEND_COMMIT` | Deployed frontend commit id, when known. |
| `CHATIFY_PROD_BACKEND_COMMIT` | Deployed backend commit id, when known. |

## Verification Commands

```powershell
cd Frontend\Chatify
$env:CHATIFY_PRODUCTION_SMOKE='1'
$env:CHATIFY_PROD_FRONTEND_URL='[deployed frontend URL]'
$env:CHATIFY_PROD_BACKEND_URL='[deployed backend URL]'
$env:CHATIFY_SMOKE_USER_A_EMAIL='[smoke account A email]'
$env:CHATIFY_SMOKE_USER_A_PASSWORD='[smoke account A password]'
$env:CHATIFY_SMOKE_USER_B_EMAIL='[smoke account B email]'
$env:CHATIFY_SMOKE_USER_B_PASSWORD='[smoke account B password]'
npm run test:e2e:prod -- --grep "Phase 14 production live acceptance"
```

For no-env harness validation:

```powershell
cd Frontend\Chatify
npm run test:e2e:prod -- --grep "production smoke config"
```

## Expected Handling

- Missing values create or update `14-LIVE-ACCEPTANCE.md` with a blocked setup result.
- Live production readiness is not allowed unless the full Phase 14 gate passes with zero blockers.
- Artifacts may list variable names and redacted account labels, but must never include raw passwords, cookies, tokens, full emails, or private payloads.
