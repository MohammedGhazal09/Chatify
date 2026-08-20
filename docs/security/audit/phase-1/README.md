# Security Audit Phase 1 — Repository Inventory and Reproducibility

Phase 1 turns the repository inventory into a repeatable security control. The generated files are not a vulnerability report and do not assert that later security phases have passed.

## Evidence produced

| Evidence | Location | Purpose |
| --- | --- | --- |
| Machine-readable inventory | `inventory.json` | Complete tracked-file hashes and structured Phase 1 inventories |
| Reviewer inventory | `inventory.md` | Human-readable routes, events, models, integrations, and configuration map |
| Runtime reproduction record | GitHub Actions artifact `phase-1-reproduction-evidence` | Commit-specific runtime, lockfile hashes, commands, outcomes, and durations |
| Parser regression tests | `scripts/security/__tests__/phase1-inventory.test.mjs` | Prevent silent discovery and redaction regressions |
| Implementation plan | `docs/plans/2026-08-20-phase-1-repository-inventory.md` | Design, scope, verification, and exit criteria |

## Commands

```bash
npm run bootstrap:full
npm run security:phase1:test
npm run security:phase1:generate
npm run security:phase1:check
npm run doctor
npm run security:phase1:reproduce
```

`security:phase1:generate` updates the committed JSON and Markdown. `security:phase1:check` exits nonzero when either file is absent or stale. `security:phase1:reproduce` performs clean workspace installs and the repository validation sequence, then writes runtime evidence under `.artifacts/security/phase-1/`.

## Phase mapping

### Phase 1.1 — Clean reproduction

- Backend and frontend package directories are discovered from manifests.
- `npm ci` is used only where a committed lockfile exists.
- Node/npm versions, commit SHA, lockfile hashes, command outcomes, durations, and worktree status are recorded in CI evidence.
- Browser and production smoke tests remain separately gated because they require a live topology or production authorization. The evidence records them as intentionally not executed rather than implying they passed.

### Phase 1.2 — Component inventory

Every tracked file receives a SHA-256 hash and one or more classifications, including backend, frontend, routes, controllers, middleware, models, services, configuration, utilities, tests, workflows, deployment, PWA/service worker, documentation/runbooks, and generated/development-only material.

### Phase 1.3 — Entry points

The scanner inventories:

- Express direct routes and mounted routers, including resolved paths and source lines.
- Literal and statically resolvable Socket.IO events in both client and server directions.
- Unresolved dynamic event expressions without executing application code.
- Service-worker lifecycle, push, notification, fetch, and message handlers.
- Timer/scheduler candidates.
- Every package script as a CLI or operational entry point.

### Phase 1.4 — Data models

For each model source file, the scanner records model names, top-level schema fields, sensitive/ownership/role/lifecycle candidates, references, indexes, unique and TTL candidates, timestamps, hashing/encryption signals, consumer files, request-body candidates, response-field candidates, and deletion operations.

These are static candidates. Later authorization and data-flow phases must verify what clients can actually submit or receive and whether deletion cascades are complete.

### Phase 1.5 — External communications

Known providers and generic outbound HTTP use are mapped to source evidence, environment-variable names, static destination hosts, timeout/redirect/size/retry signals, and possible user-controlled destination expressions. Runtime-only provider settings require later validation.

### Phase 1.6 — Sensitive configuration

Committed environment templates and static references through `process.env`, `import.meta.env`, GitHub Actions secrets, and GitHub Actions variables are classified. Secret-like example values are replaced with `<redacted>`, and live environment values are never read.

## Updating the inventory

After changing routes, events, models, package manifests, environment references, workflows, integrations, or repository structure:

```bash
npm run security:phase1:generate
npm run security:phase1:test
npm run security:phase1:check
```

Commit both generated files with the source change. CI rejects stale inventory.

## Limitations

The scanner is deliberately non-executing and dependency-free. Dynamic registrations, runtime-computed destinations, infrastructure configuration, effective provider settings, and source-to-sink authorization are not proven by this phase. The generated JSON marks heuristic fields so later phases can validate them rather than treating static guesses as confirmed behavior.
