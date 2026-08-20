---
phase: 18-operational-observability-and-runbook-hardening
artifact: validation
status: complete
created_at: 2026-06-17T10:33:18+03:00
---

# Phase 18 Validation

## Required Commands

```powershell
cd Backend/Chatify
npm test -- --run test/observability/observability-logger.test.mjs test/observability/health-readiness.test.mjs
```

```powershell
cd Backend/Chatify
npm test -- --run
```

```powershell
cd Frontend/Chatify
npm test -- --run
npm run lint
npm run build
```

```powershell
npm run quality
```

```powershell
npm run ops:check
```

## Privacy Scan

Run targeted scans against Phase 18 docs, logger code, readiness code, tests, and operational runbooks for raw auth headers, bearer tokens, cookie headers, JWT-shaped strings, password assignments, reset codes, SDP, ICE candidates, and committed smoke account values. Expected matches for environment variable names and placeholder examples must be manually reviewed.

## Completion Rule

Phase 18 may complete as operationally hardened only if local tests/scripts pass and the final evidence artifact clearly preserves production/live blockers from Phase 14, Phase 15, and Phase 17.
