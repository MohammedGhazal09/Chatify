# Chatify Security Audit Phase 4 — Dependency and Supply-Chain Contract

> Execution date: 2026-08-21
> Base branch: `security/phase-3-secret-exposure`

## Goal

Eliminate known high and critical production dependency advisories, replace unmaintained direct dependencies, and establish durable controls for lockfile integrity, install-time scripts, GitHub Actions references, dependency exceptions, automated updates, live advisory checks, registry signature verification, and software bills of materials.

## Scope

Phase 4 covers both npm applications:

- `Backend/Chatify`
- `Frontend/Chatify`

It also covers every committed GitHub Actions workflow and every dependency-policy artifact used to approve an exception or install-time lifecycle script.

## Design decisions

1. Keep `package.json` plus lockfile v3 as the authoritative dependency model. CI installs with the repository-pinned Node.js and npm versions and `npm ci`.
2. Use Node.js built-ins for deterministic committed policy evidence. Live npm advisory, registry-signature, and SBOM results are time-varying and remain workflow artifacts rather than committed snapshots.
3. Fail the permanent gate for any unsuppressed high or critical production advisory. Lower-severity advisories remain visible and require normal dependency maintenance.
4. Permit a dependency exception only by exact package/advisory identity, accountable owner, specific rationale, compensating controls, and a future expiry no more than 90 days away. Critical advisories cannot be excepted.
5. Require every independently fetched registry lockfile entry to use an exact version, HTTPS registry resolution, and an integrity value. A lock entry explicitly marked `inBundle`/`bundled` may omit its own source and integrity only when its nearest independently fetched ancestor is an HTTPS npm-registry artifact with valid SRI metadata. Reject unverified bundle roots, Git, local file, link, mutable-tag, and remote-tarball dependency sources unless a separately reviewed policy explicitly permits them.
6. Require install-time lifecycle scripts to be explicitly approved or denied with npm's project `allowScripts` policy. Approvals are version-pinned; denials are name-wide. Under the pinned npm 11.17.0 toolchain, CI uses `npm ci --strict-allow-scripts` plus the deterministic lockfile policy to fail on every unreviewed script; it does not depend on the later `npm install-scripts ls` namespace.
7. Require every remote GitHub Action to be pinned to a complete 40-character commit SHA. Local actions may use repository-relative paths.
8. Remove `passport-discord`, whose installed package is unmaintained, and preserve Discord OAuth through a small repository-owned strategy built on the already-used `passport-oauth2` contract.
9. Generate CycloneDX SBOMs, run production audits, and verify npm registry signatures/provenance in the permanent Phase 4 workflow. Upload reports even when a gate fails.
10. Add Dependabot for both npm roots and GitHub Actions. Automated updates do not bypass tests, audit policy, install-script review, or human review.
11. Preserve Phase 1 through Phase 3 gates and regenerate their deterministic evidence after dependency or workflow changes.
12. Remove temporary Phase 3 materialization/finalizer workflows from the stacked Phase 4 tree; only permanent read-only security workflows may remain.

## Required implementation

### 4.1 Dependency graph and lockfile integrity

Build deterministic JSON and Markdown evidence from both manifests and lockfiles. Record direct and transitive packages, production/dev/optional classification, exact versions, integrity coverage, source types, lifecycle-script packages, deprecated packages, and policy violations without executing dependency code.

### 4.2 Advisory remediation and exception policy

Update dependency graphs until `npm audit --omit=dev --audit-level=high` succeeds for backend and frontend. Commit an empty-by-default exact exception policy. The policy validator must reject wildcard package names, ranges, missing advisory IDs, missing owners, vague reasons, absent compensating controls, invalid or excessive expiry, expired entries, duplicate entries, and all critical exceptions.

### 4.3 Install-script governance

Approve only lifecycle scripts required for supported builds and tests. Deny unnecessary scripts, including development-only pre-download behavior that can occur lazily during the controlled test command. Tests must prove unapproved, stale, broad, and mismatched approvals fail.

### 4.4 Deprecated direct dependency removal

Replace `passport-discord` with a local Discord OAuth2 strategy. Preserve profile retrieval and the fields consumed by existing account creation. Add focused tests for provider URL construction, profile parsing, malformed provider responses, and provider errors.

### 4.5 Workflow and update governance

Pin all remote actions, keep permissions read-only for verification workflows, add Phase 4 CI, and add Dependabot entries for backend npm, frontend npm, and GitHub Actions.

### 4.6 Live evidence and reproduction

The Phase 4 reproduction sequence must perform strict clean installs that reject unreviewed lifecycle scripts, deterministic install-script coverage checks, registry signature/provenance verification, production audits, CycloneDX SBOM generation, inherited Phase 1–3 checks, Phase 4 tests and drift checks, full backend/frontend quality, and the operations guard. Reports must not contain tokens, registry credentials, or environment dumps.

## Permanent evidence

- `docs/security/audit/phase-4/dependency-policy.json`
- `docs/security/audit/phase-4/dependency-policy.md`
- `docs/security/audit/phase-4/dependency-exceptions.json`
- `docs/security/audit/phase-4/install-script-policy.json`
- `docs/security/audit/phase-4/README.md`

## Runtime workflow artifacts

- backend and frontend `npm audit --json` reports
- backend and frontend registry-signature/provenance reports
- backend and frontend CycloneDX SBOMs
- Phase 4 reproduction evidence with command exit codes and file hashes

## Exit criteria

Phase 4 passes only when all of the following are true:

- backend and frontend production audits contain no unsuppressed high or critical advisory;
- every independently fetched package-lock registry artifact has an exact version, trusted HTTPS source, and integrity metadata; explicitly bundled children inherit source and integrity only through a verified registry parent artifact;
- no Git, local, link, mutable-tag, or unapproved remote-tarball dependency exists;
- direct manifest ranges and lockfile root metadata agree;
- no unreviewed install-time script remains and every approval is narrowly version-pinned;
- no unmaintained direct dependency remains without a valid expiring exception;
- every remote GitHub Action is pinned to a full commit SHA;
- the local Discord OAuth strategy passes focused tests;
- dependency exceptions are exact, accountable, controlled, and unexpired;
- Dependabot covers both npm roots and GitHub Actions;
- committed Phase 4 evidence is deterministic and current;
- live audit, signature, SBOM, inherited security, application quality, and operations commands run in the permanent read-only workflow;
- temporary source-export, materialization, and finalizer workflows are absent from the final branch.

## Explicit limitations

- npm advisory and registry-signature services are external, time-varying dependencies. A network outage must fail the evidence command rather than be reported as a clean audit.
- Registry signatures and provenance attestations prove publisher/registry metadata integrity where supplied; they do not prove package source quality or absence of malicious behavior.
- Static lockfile and workflow analysis does not replace code review of dependency behavior, native binaries, or future package updates.
- Repository automation cannot configure branch protection or organization-wide GitHub security settings; those require repository-administrator action and are documented separately.
