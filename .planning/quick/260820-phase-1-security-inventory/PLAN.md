# Phase 1 Security Inventory — Quick Plan

## Objective

Complete and verify repository-wide Phase 1 inventory and reproducibility controls on `security/phase-1-repository-inventory` without implementing later audit phases.

## Tasks

1. Establish failing regression tests for tracked-file completeness, Express route chains, and parser false positives.
2. Separate complete tracked-file hashing from safe runtime-content parsing.
3. Correct HTTP, Socket.IO, and service-worker entry-point discovery.
4. Regenerate deterministic JSON/Markdown evidence after every tracked source and documentation change.
5. Pin CI actions and Node, run clean reproduction, inspect the artifact, and update PR #2.

## Verification

```bash
npm run security:phase1:test
npm run security:phase1:generate
npm run security:phase1:check
npm run doctor
npm run security:phase1:reproduce
```

## Boundaries

Dependency vulnerability remediation belongs to Phase 4. Production-only smoke tests require an authorized deployed topology and are recorded as not executed by Phase 1 rather than represented as passing.

## Execution state

The final bootstrap is committed and must delete its temporary workflow and payload after applying the remaining parser hardening and regenerating evidence.
