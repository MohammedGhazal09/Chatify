# Phase 10 Production Audit

## Status

Local Phase 10 repairs verified. Live production smoke remains blocked pending smoke credentials.

## Environment Contract

Production smoke is opt-in and must use real deployed Chatify traffic. It must not use local Playwright route mocks or fixture-backed API responses.

Required shell-only environment variables:

| Variable | Status |
|----------|--------|
| `CHATIFY_PRODUCTION_SMOKE` | Required value: `1` |
| `CHATIFY_PROD_FRONTEND_URL` | Required |
| `CHATIFY_PROD_BACKEND_URL` | Required |
| `CHATIFY_SMOKE_USER_A_EMAIL` | Required, redacted in artifacts |
| `CHATIFY_SMOKE_USER_A_PASSWORD` | Required, never written to artifacts |
| `CHATIFY_SMOKE_USER_B_EMAIL` | Required, redacted in artifacts |
| `CHATIFY_SMOKE_USER_B_PASSWORD` | Required, never written to artifacts |

Default deployment origins documented for reference only:

- Frontend: `https://chatify-ten-rho.vercel.app`
- Backend: `https://chatify-ckmn.onrender.com`

## Command

```powershell
cd Frontend\Chatify
$env:CHATIFY_PRODUCTION_SMOKE='1'
$env:CHATIFY_PROD_FRONTEND_URL='https://chatify-ten-rho.vercel.app'
$env:CHATIFY_PROD_BACKEND_URL='https://chatify-ckmn.onrender.com'
$env:CHATIFY_SMOKE_USER_A_EMAIL='[redacted]'
$env:CHATIFY_SMOKE_USER_A_PASSWORD='[redacted]'
$env:CHATIFY_SMOKE_USER_B_EMAIL='[redacted]'
$env:CHATIFY_SMOKE_USER_B_PASSWORD='[redacted]'
npm run test:ui -- --grep "Phase 10 production smoke"
```

## Current Evidence

| Area | Result | Notes |
|------|--------|-------|
| Live auth | Blocked | Requires smoke credentials. |
| Chat list | Blocked | Requires live auth. |
| Detail surface | Blocked | Production smoke will verify server-backed pinned, shared file, shared media, and security rows. |
| Attachment/media | Blocked | Production smoke will observe live UI; no mocked attachment rows are accepted as production evidence. |
| Message search | Blocked | Production smoke will verify search action is enabled from the detail surface. |
| Send/receive baseline | Blocked | Production smoke will record duplicate sender bubbles and recipient no-refresh behavior without repairing delivery. |
| Unsupported controls | Verified locally | Call, video, voice, favorite, in-panel More, and block remain unavailable unless later phases implement real contracts. |

## Automated Local Evidence

Executed on 2026-06-13.

| Command | Result | Evidence |
|---------|--------|----------|
| `npm test -- --run src/pages/chat/components/ChatContextRail.test.tsx src/pages/chat/components/ConversationDetailDrawer.test.tsx` | Passed | 2 files, 7 tests. |
| `npm run test:ui -- --grep "Phase 10 production messenger reality"` | Passed | 2 Playwright tests. |
| `npm test -- --run src/pages/chat/fixtureLeakGuard.test.ts` | Passed | 1 file, 1 test. |
| `npm test -- --run src/pages/chat/fixtureLeakGuard.test.ts src/pages/chat/components/ChatContextRail.test.tsx src/pages/chat/components/ConversationDetailDrawer.test.tsx src/pages/chat/components/ConversationHeader.test.tsx src/pages/chat/components/ChatShell.test.tsx` | Passed | 5 files, 10 tests. |
| `npm run test:ui -- --grep "Phase 10 production smoke"` | Skipped/blocked | 1 skipped because live production smoke env vars are absent. |
| `npm run lint` | Passed | ESLint completed without errors. |
| `npm run build` | Passed | TypeScript and Vite production build completed. |

## Local Fix Evidence

- Desktop conversation details rail is closeable with a visible close button.
- Desktop rail reopens from the existing header details control.
- Desktop rail closes from Escape when focus is inside the rail.
- Focus returns to the header details control after desktop rail close.
- Mobile drawer close button, Escape, and backdrop paths remain covered.
- Detail content still renders through shared server-backed props; no runtime fixture arrays were introduced.
- Runtime leak guard now blocks Phase 10 identifiers, production screenshot fixture titles, additional static file names, private storage terms, and living visual terms from chat runtime source.

## Production Smoke Status

Production smoke did not run in this execution because the required smoke credentials were not present in the shell. This is an explicit blocked evidence gate, not a product pass.

## Delivery Reliability Handoff

Phase 10 records production delivery observations only. Duplicate sends, false delivered state, and recipient messages that require refresh are owned by Phase 10.1.

## Residual Risks

- Production smoke cannot prove live behavior until smoke credentials are provided in the shell.
- A skipped production smoke is not a product pass.
- Local mocked Playwright evidence remains useful for UI regression, but it is not production truth.
