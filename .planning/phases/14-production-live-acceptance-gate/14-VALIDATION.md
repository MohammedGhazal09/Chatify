---
phase: 14-production-live-acceptance-gate
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-13
---

# Phase 14 Validation Plan

## Validation Goal

Phase 14 is valid only when the deployed Chatify frontend and backend pass a production live acceptance gate with real authenticated accounts, real persisted data, no fixture bypass, and sanitized evidence. Missing production configuration is a blocked result, not a pass.

## Test Infrastructure

| Layer | Tooling | Planned Command | Purpose |
|-------|---------|-----------------|---------|
| Production Playwright config | Playwright | `cd Frontend/Chatify; npm run test:e2e:prod -- --grep "Phase 14 production live acceptance"` | Run the deployed live acceptance gate with explicit production env vars. |
| Production config no-env behavior | Playwright | `cd Frontend/Chatify; npm run test:e2e:prod -- --grep "production smoke config"` | Prove missing or invalid production env produces a clear blocked/skipped result. |
| Frontend unit/regression | Vitest | `cd Frontend/Chatify; npm test` | Preserve existing React/helper behavior while adding E2E harness code. |
| Frontend lint | ESLint | `cd Frontend/Chatify; npm run lint` | Enforce TypeScript/React lint rules. |
| Frontend build | Vite/TypeScript | `cd Frontend/Chatify; npm run build` | Prove production frontend build still compiles. |
| Artifact redaction | ripgrep | `rg -n "CHATIFY_SMOKE_USER|password|accessToken|refreshToken|Set-Cookie|Cookie:|Authorization:" .planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md` | Fail if the acceptance artifact contains obvious secrets or raw credentials. |

## Plan-To-Verification Map

### 14-01: Production Harness, Environment Contract, And Evidence Reporter

Verification:

- `cd Frontend/Chatify; npm run test:e2e:prod -- --grep "production smoke config"`
- `cd Frontend/Chatify; npm test`
- `cd Frontend/Chatify; npm run lint`
- `cd Frontend/Chatify; npm run build`
- Inspect generated or blocked `14-LIVE-ACCEPTANCE.md` for redacted origins, redacted account labels, missing-env names only, and no secrets.

Acceptance:

- Production config starts no local web server.
- Missing env vars produce an explicit blocked/skipped result.
- Invalid local or malformed URLs are rejected for production acceptance.
- Phase 10 and 10.1 artifact behavior remains stable.
- No raw credentials, cookies, tokens, full emails, request bodies, or private payloads are written.

### 14-02: Live Messaging, Controls, Attachments, And Static-Content Acceptance

Verification:

- `CHATIFY_PRODUCTION_SMOKE=1 CHATIFY_PROD_FRONTEND_URL=... CHATIFY_PROD_BACKEND_URL=... CHATIFY_SMOKE_USER_A_EMAIL=... CHATIFY_SMOKE_USER_A_PASSWORD=... CHATIFY_SMOKE_USER_B_EMAIL=... CHATIFY_SMOKE_USER_B_PASSWORD=... npm run test:e2e:prod -- --grep "Phase 14 production live acceptance"`
- Confirm `14-LIVE-ACCEPTANCE.md` includes message, recipient realtime, reload parity, detail surface, search, More, block/unblock, attachment, shared files/media, and static denylist rows.
- Confirm screenshots/traces are captured only after successful interactions.

Acceptance:

- One send action creates exactly one sender bubble and one persisted message.
- Recipient sees the unique marker through Socket.IO without refresh.
- Sender and recipient remain correct after reload.
- Delivered/read indicators are not falsely claimed from sender-only success.
- Detail rail/drawer/menu/search panels open, close, Escape/dismiss, restore focus, and reopen.
- Enabled visible controls perform real behavior.
- Unsupported controls are hidden or disabled with accessible reason.
- Generated image and text/document attachments render in messages and shared surfaces after reload.
- Static demo content denylist does not appear as conversation truth.

### 14-03: Call/Video, Deployment Evidence, And Final Readiness Gate

Verification:

- `cd Frontend/Chatify; npm run test:e2e:prod -- --grep "Phase 14 production live acceptance"`
- `cd Frontend/Chatify; npm test`
- `cd Frontend/Chatify; npm run lint`
- `cd Frontend/Chatify; npm run build`
- Review `14-LIVE-ACCEPTANCE.md` blocker table and final readiness line.

Acceptance:

- Enabled call and video controls complete a two-account fake-media path: outgoing, incoming, accept, connected, end, and cleanup.
- Disabled call/video controls expose an accessible production reason.
- API, Socket.IO, auth cookie, file access, and call signaling evidence points to configured deployed origins.
- No CORS, socket, auth, file, or session blocker remains.
- The final artifact records command lines, origins, optional deployed commit ids, redacted account labels, evidence paths, pass/fail table, blockers, and remaining risks.
- Chatify is not called functionally ready unless all blocker-grade checks pass.

## Manual Production Setup

The executor needs these environment variables at runtime:

- `CHATIFY_PRODUCTION_SMOKE=1`
- `CHATIFY_PROD_FRONTEND_URL`
- `CHATIFY_PROD_BACKEND_URL`
- `CHATIFY_SMOKE_USER_A_EMAIL`
- `CHATIFY_SMOKE_USER_A_PASSWORD`
- `CHATIFY_SMOKE_USER_B_EMAIL`
- `CHATIFY_SMOKE_USER_B_PASSWORD`

Optional evidence variables:

- `CHATIFY_PROD_FRONTEND_COMMIT`
- `CHATIFY_PROD_BACKEND_COMMIT`

Recommendation: use disposable production-safe accounts that can be polluted with timestamped Phase 14 markers. Do not use real user accounts or shared personal accounts.

## Blocker Conditions

The phase fails if any of these are observed:

- Missing required production env vars when trying to run the live gate.
- Invalid frontend/backend origin or local fallback.
- Auth failure or missing authenticated UI shell.
- Duplicate sender message for one send action.
- Recipient does not receive the marker without refresh.
- False delivered/read status.
- Dead enabled visible control.
- Non-closable rail, drawer, modal, menu, or overlay.
- Static fixture/demo data appears as conversation truth.
- Attachment upload/download/shared surface failure.
- Voice, call, or video entry point is enabled but nonfunctional.
- CORS, cookie, socket, file access, or call signaling production-origin failure.
- Acceptance artifact leaks credentials, cookies, tokens, full emails, raw request bodies, or private payloads.

## Sign-Off Criteria

- [ ] `14-01-PLAN.md` executed and verified.
- [ ] `14-02-PLAN.md` executed and verified.
- [ ] `14-03-PLAN.md` executed and verified.
- [ ] `14-LIVE-ACCEPTANCE.md` exists and is sanitized.
- [ ] All blocker rows are pass or honestly blocked with follow-up phase needed.
- [ ] No readiness claim is made unless blocker count is zero.
