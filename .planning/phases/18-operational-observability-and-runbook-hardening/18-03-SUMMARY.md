---
phase: 18
plan: 18-03
status: complete
completed_at: 2026-06-17T10:48:20+03:00
tags: [operations, runbooks, npm-scripts]
key_files:
  - package.json
  - README.md
  - docs/operations/local-startup.md
  - docs/operations/deployment-verification.md
  - docs/operations/production-smoke.md
  - docs/operations/incident-triage.md
  - docs/operations/rollback.md
  - docs/operations/credential-rotation.md
---

# 18-03 Summary: Quality Scripts And Operational Runbooks

## Completed

- Replaced the root placeholder test command with `npm run quality`.
- Added root scripts for backend tests, frontend tests, frontend lint, frontend build, full quality, local smoke, production smoke, and ops checks.
- Added operator runbooks for local startup, deployment verification, production smoke, incident triage, rollback, and credential rotation.
- Updated README with root operations commands and runbook index.

## Verification

| Check | Result |
|---|---|
| Root script parse | passed: `test`, `quality`, `quality:backend`, `quality:frontend`, `quality:frontend:test`, `quality:frontend:lint`, `quality:frontend:build`, `smoke:local`, `smoke:prod`, `ops:check` present |
| Runbook inventory | passed: 6 markdown runbooks under `docs/operations/` |
| Targeted privacy scan | expected placeholder-only match for `CALL_TURN_CREDENTIAL="<turn-credential>"` |

## Notes

- `ops:check` is wired to `scripts/ops-check.mjs`; the script itself is implemented by 18-04.
- The runbooks preserve the blocked production readiness stance until production smoke and TURN evidence exist.
