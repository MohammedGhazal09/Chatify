# Chatify Security Audit Phase 1 Implementation Plan

> Execution date: 2026-08-20  
> Baseline branch: `main`  
> Baseline commit: `91bceade67039b4a874a5d873e2f10ef0230b117`

## Goal

Implement Phase 1 of the repository-wide security audit as durable repository controls rather than a one-time spreadsheet. The repository must be able to regenerate and verify a deterministic inventory of components, entry points, data models, external communications, sensitive configuration, and clean-build evidence.

## Design decisions

1. Use Node.js built-ins only for the inventory tooling. This avoids adding an audit-time parser dependency to the application supply chain.
2. Prefer `git ls-files` as the inventory source set so every tracked file receives a hash while untracked local dependencies and artifacts cannot pollute committed evidence. Exclude generated, vendored, documentation, and audit-output paths only from source-pattern parsing.
3. Generate both JSON and Markdown. JSON is the machine-readable audit source; Markdown is the review surface.
4. Exclude generated inventory files from their own inputs to prevent self-referential hashes and unstable output.
5. Never read live environment values. Only committed environment templates and variable references are inventoried, and secret-like example values are redacted.
6. Preserve dynamic expressions when static resolution is unsafe. Known literal constant objects are resolved without executing application code.
7. Store commit-specific command results as a CI artifact. Commit SHA, runtime versions, timestamps, runner-image metadata, and command durations are intentionally not embedded in drift-checked files.
8. Treat client fields, response fields, deletion operations, and outbound-request controls as static candidates that later phases must validate source-to-sink.
9. Pin the exact Node.js/npm toolchain, GitHub-hosted runner line, and every third-party action revision used by the Phase 1 workflow.
10. Do not suppress findings owned by later phases. Existing dependency-audit failures remain visible for Phase 4 even when the Phase 1 control itself passes.

## Work items

### Task 1 — Parser tests

**Files**

- `scripts/security/__tests__/phase1-inventory.test.mjs`

**Coverage**

- Deterministic ordering.
- Root/backend/frontend package discovery.
- Lockfile and clean-install command discovery.
- Express direct routes, mounted routers, and chained `router.route(...)` methods.
- Rejection of unrelated method calls such as outbound HTTP clients and header readers as Express routes.
- Literal and constant-backed Socket.IO events.
- Service-worker handlers.
- Background timers.
- Mongoose fields, references, indexes, TTL/unique candidates, consumers, request and response candidates.
- Environment-template redaction and missing-example drift.
- Generic outbound HTTP control signals and user-controlled destination candidates.
- Complete Git-index hashing while excluding generated, vendored, documentation, and audit paths from static source parsing.
- Generated output write/check behavior.

**Verification**

```bash
npm run security:phase1:test
```

### Task 2 — Deterministic inventory library and CLI

**Files**

- `scripts/security/lib/inventory.mjs`
- `scripts/security/phase1-inventory.mjs`

**Outputs**

- `docs/security/audit/phase-1/inventory.json`
- `docs/security/audit/phase-1/inventory.md`

**Modes**

```bash
npm run security:phase1:generate
npm run security:phase1:check
node scripts/security/phase1-inventory.mjs --json
```

### Task 3 — Reproducibility doctor

**Files**

- `.nvmrc`
- `package.json`
- `scripts/security/phase1-doctor.mjs`

**Checks**

- Exact Node.js version from `.nvmrc` and `package.json#engines.node`.
- Exact npm version from `package.json#packageManager` and `package.json#engines.npm`.
- Installed Node.js/npm versions match the declarations.
- Git availability.
- Root/backend/frontend manifests.
- Lockfile requirements.
- Required audit scripts and generated files.
- At least one committed environment template.
- Tracked live `.env` warning.

**Verification**

```bash
npm run doctor
```

### Task 4 — Clean-run evidence

**File**

- `scripts/security/phase1-reproduce.mjs`

**Commands recorded**

1. Backend `npm ci`.
2. Frontend `npm ci`.
3. Phase 1 parser tests.
4. Inventory drift check.
5. Environment doctor.
6. Existing repository quality suite.
7. Existing operations guard.

The runner writes `.artifacts/security/phase-1/run-evidence.json`, including commit/ref, expected and actual Node.js/npm versions, hosted-runner metadata, lockfile hashes, command exit codes, durations, and before/after Git status. It does not store command output or environment values.

### Task 5 — Root commands

**File**

- `package.json`

**Commands added**

- `bootstrap:backend`
- `bootstrap:frontend`
- `bootstrap:full`
- `doctor`
- `security:phase1:test`
- `security:phase1:generate`
- `security:phase1:check`
- `security:phase1:reproduce`

### Task 6 — CI enforcement

**File**

- `.github/workflows/security-phase-1-inventory.yml`

**Behavior**

- Runs for pull requests, pushes to `main`, and manual dispatch.
- Uses a full Git checkout so the evidence can pin the commit.
- Uses the exact Node.js version declared in `.nvmrc` and fixed Ubuntu 24.04 runner line.
- Pins checkout, setup-node, and artifact-upload actions to full-length commit SHAs.
- Runs the reproduction command.
- Uploads runtime evidence and the committed generated inventory even when a command fails.
- Uses read-only repository permissions.
- Fails when parser tests, clean installs, inventory drift, doctor, quality, or operations checks fail.

### Task 7 — Audit documentation

**Files**

- `docs/security/audit/phase-1/README.md`
- Generated JSON and Markdown inventory.

The README maps implementation evidence to Phase 1.1–1.6, documents the pinned toolchain and known cross-phase dependency-audit failures, and explains limitations and update procedures.

## Verification sequence

```bash
nvm use
node --check scripts/security/lib/inventory.mjs
node --check scripts/security/phase1-inventory.mjs
node --check scripts/security/phase1-doctor.mjs
node --check scripts/security/phase1-reproduce.mjs
npm run security:phase1:test
npm run security:phase1:generate
npm run security:phase1:check
npm run doctor
```

CI then performs the clean installs, existing repository quality suite, and operations guard and uploads commit-specific evidence.

## Exit criteria

- The exact Node.js/npm toolchain and Phase 1 CI action revisions are pinned and enforced.
- Generated component inventory exists and is drift checked.
- Every tracked file is hashed, including tracked generated or vendored paths, without parsing those paths as application source.
- HTTP, Socket.IO, service-worker, background-job, and package-script entry points are inventoried.
- Chained Express routes are discovered and unrelated method calls are excluded.
- Every discovered model has schema and consumer metadata candidates.
- Known external providers and generic outbound request locations are inventoried.
- Every environment-template definition and static environment-variable reference is classified without disclosing live values.
- A clean reproduction workflow produces commit-specific evidence.
- Parser tests and generated-output checks are required on every pull request.
- Dependency-audit failures remain reported for Phase 4 and are not misrepresented as Phase 1 success.
