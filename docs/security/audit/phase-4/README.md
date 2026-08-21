# Security Audit Phase 4 — Dependencies and Supply Chain

Phase 4 makes dependency trust and update evidence a fail-closed repository control for both Chatify npm applications. It separates deterministic committed policy from time-varying network evidence so reviewers can reproduce structural decisions without treating yesterday's advisory response as current.

## Permanent controls

| Control | Location | Purpose |
| --- | --- | --- |
| Dependency-policy engine | `scripts/security/lib/dependency-policy.mjs` | Reads manifests, lockfiles, workflows, Dependabot, install-script policy, and exceptions without loading dependency code. |
| Live evidence engine | `scripts/security/lib/live-supply-chain.mjs` | Verifies lockfile-backed install-script coverage and runs registry-signature, production-audit, and CycloneDX SBOM commands while storing sanitized artifacts. |
| Policy tests | `scripts/security/__tests__/phase4-dependency-policy.test.mjs` | Prove unsafe sources, integrity gaps, stale lockfiles, mutable actions, invalid exceptions, and script-policy drift fail closed. |
| Live evidence tests | `scripts/security/__tests__/phase4-live-supply-chain.test.mjs` | Prove exact command selection, sanitization, advisory matching, and failure aggregation. |
| Reproduction runner | `scripts/security/phase4-reproduce.mjs` | Performs clean installs, live evidence, inherited security gates, application quality, and operations checks with command-level evidence. |
| Generated policy | `dependency-policy.json` and `dependency-policy.md` | Deterministic dependency graph, integrity/source coverage, lifecycle scripts, action pins, update coverage, violations, and exit gates. |
| Exceptions | `dependency-exceptions.json` | Exact, owned, controlled, noncritical advisory exceptions expiring within 90 days. |
| Install scripts | `install-script-policy.json` and each project `allowScripts` field | Records version-pinned approvals and name-wide denials for dependency lifecycle scripts. |
| Automated updates | `.github/dependabot.yml` | Weekly npm updates for both applications and immutable GitHub Action updates. |
| Permanent workflow | `.github/workflows/security-phase-4-supply-chain.yml` | Read-only verification with pinned actions and always-uploaded evidence. |

## Deterministic structural gate

Run:

```bash
npm run security:phase4:test
npm run security:phase4:generate
npm run security:phase4:check
```

The gate rejects:

- package-lock formats other than v3 or stale root manifest metadata;
- non-exact installed versions;
- Git, local-file, link, mutable-tag, plain-HTTP, unknown, or unapproved remote-tarball sources;
- independently fetched registry artifacts without Subresource Integrity metadata; explicitly bundled children inherit source and integrity from their verified parent artifact;
- lifecycle scripts not represented by a reviewed policy decision;
- stale or broad lifecycle-script approvals;
- deprecated direct dependencies;
- remote GitHub Actions not pinned to a complete commit SHA;
- missing Dependabot coverage;
- wildcard, vague, unowned, expired, long-lived, duplicate, or critical advisory exceptions.

## Live network gate

For each npm application, the permanent workflow runs:

```bash
npm ci --strict-allow-scripts
npm audit signatures --json
npm audit --omit=dev --json
npm sbom --package-lock-only --sbom-format=cyclonedx --sbom-type=application
```

The live gate passes only when no install script remains pending, registry signatures and available provenance attestations verify, no unsuppressed high or critical production advisory remains, and a CycloneDX application SBOM is generated.

The reproduction runner writes only command names, exit codes, durations, deterministic file hashes, sanitized parsed reports, and gate states. It does not store command stderr, npm configuration, environment values, registry credentials, or authentication headers.

## Install-script decisions

Approvals are version-pinned because a script change in a future package release requires a new review. Denials are package-name-wide so a previously rejected optional or eager-download script is not silently executed after an update. After any dependency change, run `npm ci --strict-allow-scripts` and `npm install-scripts prune --dry-run`; update both the project `allowScripts` field and `install-script-policy.json` together.

## Advisory exceptions

An exception must identify one project, exact package version, exact GHSA or CVE, severity, owner, specific rationale, compensating controls, and a future expiry no more than 90 days away. Critical advisories cannot be excepted. The live audit matcher requires exact project, package, installed version, and advisory identity; a package-wide or range-wide suppression is not possible.

## Evidence interpretation

A clean structural report proves the reviewed repository tree obeys the committed dependency policy. A green live workflow proves the registry and advisory services returned acceptable results for that workflow run and commit. Neither proves that dependency source code is nonmalicious. Native binaries, maintainership changes, package behavior, and material release changes still require human review.

## Administrator-owned settings

Repository automation cannot safely create branch protection or organization-wide rules. An administrator should require the foundation and Phase 1–4 checks on protected branches, prevent direct pushes, require review for dependency and workflow changes, enable secret scanning and dependency graph features, and restrict workflow-token permissions to read-only by default.
