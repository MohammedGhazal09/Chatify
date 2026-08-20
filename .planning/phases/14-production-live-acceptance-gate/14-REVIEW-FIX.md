---
phase: 14-production-live-acceptance-gate
review_fix: 14
status: fixed
source_review: 14-REVIEW.md
fixed_findings:
  critical: 4
  warning: 1
fixed_at: 2026-06-17T10:01:00+03:00
verification:
  - "Frontend/Chatify: npm run test:e2e:prod -- --grep \"production smoke config\" -> passed, 9 tests"
  - "Frontend/Chatify: npm run test:e2e:prod -- --grep \"Phase 14 production live acceptance\" -> passed with 1 expected no-env skip"
  - "Frontend/Chatify: npm test -- --run -> passed, 39 files / 202 tests"
  - "Frontend/Chatify: npm run lint -> passed"
  - "Frontend/Chatify: npm run build -> passed"
  - "rg secret/header/token scan on 14-LIVE-ACCEPTANCE.md -> no matches"
---

# Phase 14 Review Fix

## Fix Summary

Resolved all findings from `14-REVIEW.md`. The production gate remains readiness-blocked when required live env vars are absent, but the harness issues called out by the review are fixed.

### CR-01: WebSocket evidence was dropped for deployed HTTPS backends

Fixed.

- Added origin matching that treats `wss://host` as the WebSocket peer for `https://host` and `ws://host` as the peer for `http://host`.
- Updated accepted-origin checks so production traffic through either the deployed backend or a same-origin frontend proxy counts correctly.
- Added production smoke config tests for WebSocket and accepted-origin matching.

### CR-02: Config self-test could overwrite the canonical live acceptance artifact

Fixed.

- The config self-test now writes its blocked setup report to a Playwright test output path.
- The test snapshots the canonical `14-LIVE-ACCEPTANCE.md` before and after the config check and verifies it is unchanged.
- The canonical artifact remains owned by the actual live gate or explicit blocked setup reporting.

### CR-03: Pinned/security detail surfaces were not verified as server-backed truth

Fixed.

- The live acceptance spec pins the current live marker message, verifies it appears in the detail rail, jumps back to the persisted message, unpins it, and verifies the pinned row disappears.
- Security rows are checked for live auth, membership, realtime connection, protected file access, and conversation-control state.

### CR-04: Logout and session recovery were outside the live gate

Fixed.

- Added a late-run logout privacy and session recovery check.
- The gate verifies private chat content is cleared after logout, the chat root disappears, then the same smoke account re-authenticates and recovers the live conversation marker.

### WR-01: Failed call attempts could leak state into later checks

Fixed.

- Wrapped call exercise cleanup around visible call dialogs.
- The gate attempts to end, cancel, or reject active call UI and reloads both smoke pages before subsequent checks continue.

## Verification Results

```powershell
cd Frontend/Chatify
npm run test:e2e:prod -- --grep "production smoke config"
```

Result: passed, 9 tests.

```powershell
cd Frontend/Chatify
npm run test:e2e:prod -- --grep "Phase 14 production live acceptance"
```

Result: passed with 1 expected skip because the production smoke environment is not configured; `14-LIVE-ACCEPTANCE.md` records `Readiness blocked`.

```powershell
rg -n "example-secret|sender@example|recipient@example|accessToken|refreshToken|Set-Cookie|Cookie:|Authorization:|BEGIN PRIVATE|Bearer |eyJ[A-Za-z0-9_-]+" .planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md
```

Result: no matches.

Previously in this continuation, the broader frontend quality gate also passed:

- `cd Frontend/Chatify; npm test -- --run` - passed, 39 files / 202 tests.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed.

## Remaining Boundary

Phase 14 still cannot claim deployed readiness until the live gate runs with `CHATIFY_PRODUCTION_SMOKE=1`, deployed frontend/backend origins, and two disposable smoke accounts. Missing env remains a release-blocking result, not a pass.
