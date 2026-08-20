---
phase: 10-production-messenger-reality-audit-and-fixture-removal
status: incomplete
created: 2026-06-13
---

# Phase 10 User Setup

Production smoke requires real smoke accounts and deployed URLs. Set these values only in the local shell or a local secret store. Do not commit real values.

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `CHATIFY_PRODUCTION_SMOKE` | Must be `1` to opt into live production smoke. |
| `CHATIFY_PROD_FRONTEND_URL` | Deployed frontend URL, currently expected to be `https://chatify-ten-rho.vercel.app`. |
| `CHATIFY_PROD_BACKEND_URL` | Deployed backend URL, currently expected to be `https://chatify-ckmn.onrender.com`. |
| `CHATIFY_SMOKE_USER_A_EMAIL` | Smoke sender email. |
| `CHATIFY_SMOKE_USER_A_PASSWORD` | Smoke sender password. |
| `CHATIFY_SMOKE_USER_B_EMAIL` | Smoke recipient email. |
| `CHATIFY_SMOKE_USER_B_PASSWORD` | Smoke recipient password. |

## Verification Command

```powershell
cd Frontend\Chatify
$env:CHATIFY_PRODUCTION_SMOKE='1'
$env:CHATIFY_PROD_FRONTEND_URL='https://chatify-ten-rho.vercel.app'
$env:CHATIFY_PROD_BACKEND_URL='https://chatify-ckmn.onrender.com'
$env:CHATIFY_SMOKE_USER_A_EMAIL='[real smoke account A email]'
$env:CHATIFY_SMOKE_USER_A_PASSWORD='[real smoke account A password]'
$env:CHATIFY_SMOKE_USER_B_EMAIL='[real smoke account B email]'
$env:CHATIFY_SMOKE_USER_B_PASSWORD='[real smoke account B password]'
npm run test:ui -- --grep "Phase 10 production smoke"
```

## Expected Handling

- A live run appends redacted observations to `10-PRODUCTION-AUDIT.md`.
- Missing values keep production smoke blocked.
- A blocked smoke is not a Chatify production pass.
