---
phase: 17-v1-readiness-closure-and-release-gate
artifact: validation
status: complete
created_at: 2026-06-17T10:23:02+03:00
---

# Phase 17 Validation

## Required Commands

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
cd Frontend/Chatify
npm run test:ui -- --grep "Phase 15|Phase 13 call|Phase 14"
```

```powershell
cd Frontend/Chatify
npm run test:e2e:prod -- --grep "Phase 14 production live acceptance|Phase 15"
```

## Privacy Scan

Run targeted scans against readiness artifacts and touched files for raw auth headers, bearer tokens, cookie headers, JWT-shaped strings, password assignments, SDP, and ICE candidate payloads. Expected false positives from env variable names and test placeholder strings must be manually reviewed.

## Completion Rule

Phase 17 may complete with `blocked` readiness. It must not complete with `ready` unless all release-blocking commands and production smoke gates have zero blockers.
