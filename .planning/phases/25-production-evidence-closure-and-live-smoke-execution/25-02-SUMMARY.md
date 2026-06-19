---
phase: 25
plan: 25-02
subsystem: smoke-evidence
status: complete
key_files:
  modified:
    - .planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md
    - .planning/phases/16-profile-picture-upload-and-shared-avatar-visibility/16-PROFILE-IMAGE-ACCEPTANCE.md
    - .planning/phases/25-production-evidence-closure-and-live-smoke-execution/25-PRODUCTION-EVIDENCE.md
metrics:
  production_smoke_skipped: 1
  local_smoke_skipped: 3
---

# 25-02 Summary: Smoke Evidence Refresh

## Work Completed

- Ran the existing production smoke command in the current environment.
- Ran the existing local Phase 15/16 smoke command in the current environment.
- Regenerated the consolidated Phase 25 evidence artifact after smoke runs.

## Command Results

| Command | Result | Notes |
|---|---|---|
| `npm run smoke:prod -- --grep "Phase 14 production live acceptance|Phase 15" --workers=1` | passed command, 1 skipped test | Production env is absent, so the Phase 14 live gate did not claim readiness. |
| `npm run smoke:local -- --grep "Phase 15|Phase 16" --workers=1` | passed command, 3 skipped tests | Local smoke env/accounts are absent, so call/profile-image browser acceptance remains blocked. |
| `npm run evidence:production` | blocked, exit 1 | Consolidated evidence still records 14 release blockers. |

## Deviations

None. The no-env skipped tests are expected current-state evidence, not release acceptance.

## Self-Check

PASSED for evidence refresh scope. Hosted/provider and local two-account success are not claimed.
