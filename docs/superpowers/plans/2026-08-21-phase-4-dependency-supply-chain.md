# Phase 4 Dependency and Supply-Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a green, reproducible dependency and supply-chain gate for both Chatify npm applications while removing current high/critical production advisories and the unmaintained Discord OAuth package.

**Architecture:** A dependency-policy library reads manifests, lockfiles, workflow YAML, install-script policy, and exception policy without importing application code. A CLI generates deterministic committed JSON/Markdown and fails closed on structural policy violations. Time-varying npm audit, signature, and SBOM commands run in a read-only workflow and a reproduction runner; dependency updates and the Discord strategy are verified through focused tests plus the full repository suite.

**Tech Stack:** Node.js 24.19.0 built-ins, npm 11.17.0, package-lock v3, Vitest/Node test runner, Passport OAuth2, GitHub Actions, CycloneDX SBOM.

**Spec:** `docs/plans/2026-08-21-phase-4-dependency-and-supply-chain.md`

## Global Constraints

- Do not add a second JavaScript package manager or a third-party policy scanner.
- Never serialize registry credentials, environment values, package tarball contents, or npm configuration secrets.
- Keep deterministic committed evidence separate from time-varying network evidence.
- Fail on any unsuppressed high or critical production advisory; critical exceptions are forbidden.
- Require exact owned exceptions with compensating controls and expiry at most 90 days in the future.
- Require full 40-character SHA pins for every remote GitHub Action.
- Preserve Phase 1, Phase 2, and Phase 3 checks and evidence.
- Follow red-green-refactor for production behavior and policy logic.

---

### Task 1: Lockfile, workflow, and policy test contract

**Files:**
- Create: `scripts/security/__tests__/phase4-dependency-policy.test.mjs`
- Create: `docs/security/audit/phase-4/dependency-exceptions.json`
- Create: `docs/security/audit/phase-4/install-script-policy.json`

**Interfaces:**
- Consumes: temporary fixture repositories written by the test.
- Produces: the expected public API for `buildDependencyPolicy`, `validateDependencyExceptions`, `validateInstallScriptPolicy`, `renderDependencyPolicyMarkdown`, `writeGeneratedDependencyPolicy`, `checkGeneratedDependencyPolicy`, and `assertPhase4ExitGate`.

- [ ] **Step 1: Write failing tests for valid lockfiles and deterministic output**

Create a fixture with two lockfile-v3 projects and pinned workflow actions. Assert that the report records exact direct/transitive counts, integrity coverage, production/dev classification, action pins, and zero structural violations.

- [ ] **Step 2: Write failing tests for unsafe dependency sources**

Add fixture entries using `git+https`, `file:`, `link:`, plain HTTP, mutable tags, missing `integrity`, and non-exact lockfile versions. Assert each condition is named in `violations` and fails the exit gate.

- [ ] **Step 3: Write failing tests for exception validation**

Assert rejection of wildcard package names, version ranges, missing `GHSA-`/`CVE-` identity, absent owner, reason shorter than 20 characters, absent compensating controls, expiry over 90 days, expired entries, duplicates, and critical severity.

- [ ] **Step 4: Write failing tests for install-script policy**

Assert that required lifecycle-script packages must have either a version-pinned approval or name-wide denial; broad `true` approvals, stale versions, duplicate entries, and unexplained entries fail.

- [ ] **Step 5: Write failing tests for workflow action pins and Dependabot coverage**

Assert remote `uses:` entries must end in a 40-hex SHA while `./local-action` is allowed. Assert backend npm, frontend npm, and `github-actions` Dependabot entries are present.

- [ ] **Step 6: Run the tests and verify RED**

Run: `node --test scripts/security/__tests__/phase4-dependency-policy.test.mjs`

Expected: failure because `scripts/security/lib/dependency-policy.mjs` does not exist.

- [ ] **Step 7: Commit the test contract**

```bash
git add scripts/security/__tests__/phase4-dependency-policy.test.mjs docs/security/audit/phase-4
git commit -m "test(security): define Phase 4 dependency policy"
```

### Task 2: Deterministic dependency-policy implementation

**Files:**
- Create: `scripts/security/lib/dependency-policy.mjs`
- Create: `scripts/security/phase4-dependency-policy.mjs`
- Test: `scripts/security/__tests__/phase4-dependency-policy.test.mjs`

**Interfaces:**
- Consumes: repository root plus optional `now`, manifest/lockfile paths, exception path, and install-script path.
- Produces:
  - `buildDependencyPolicy(root, options): Promise<DependencyPolicyReport>`
  - `validateDependencyExceptions(raw, options): Map<string, ExceptionRecord>`
  - `validateInstallScriptPolicy(raw): InstallScriptPolicy`
  - `renderDependencyPolicyMarkdown(report): string`
  - `writeGeneratedDependencyPolicy(root, report): Promise<{files: string[]}>`
  - `checkGeneratedDependencyPolicy(root, report): Promise<boolean>`
  - `assertPhase4ExitGate(report): true`

- [ ] **Step 1: Implement strict JSON loaders and normalized package identities**

Read only regular files; require lockfile version 3 and a root package entry; normalize package names for scoped and nested lockfile paths without executing modules.

- [ ] **Step 2: Implement manifest/lockfile agreement checks**

Compare root dependency/devDependency selectors exactly, classify lock packages by production/dev/optional state, and flag missing root declarations or stale lockfile metadata.

- [ ] **Step 3: Implement source and integrity classification**

Accept registry artifacts only when `resolved` is HTTPS npm-registry content (or npm's registry-relative representation), `integrity` is SRI, and `version` is exact. Record and reject Git, local, link, HTTP, mutable tag, and remote-tarball sources.

- [ ] **Step 4: Implement lifecycle-script policy checks**

Read each lock entry's `hasInstallScript`; require an exact approved `name@version` or a denied package name. Reject policy entries that match no installed script package.

- [ ] **Step 5: Implement workflow and Dependabot checks**

Scan all workflow YAML files line by line for `uses:` and record owner/repository/ref. Require a full SHA for remote actions. Parse `.github/dependabot.yml` with a small bounded parser for package ecosystem and directory entries.

- [ ] **Step 6: Implement exception policy validation and exit gates**

Validate exact advisory/package/version fields, severity, ownership, rationale, compensating controls, and expiry. Build exit fields for lockfiles, sources, integrity, scripts, actions, Dependabot, deprecated direct packages, exceptions, and evidence generation.

- [ ] **Step 7: Implement deterministic JSON/Markdown generation and CLI modes**

Support `--write`, `--check`, and `--json`. Generated paths are `docs/security/audit/phase-4/dependency-policy.json` and `.md`; no timestamps appear in committed output.

- [ ] **Step 8: Run focused tests and verify GREEN**

Run: `node --test scripts/security/__tests__/phase4-dependency-policy.test.mjs`

Expected: all Phase 4 policy tests pass.

- [ ] **Step 9: Commit implementation**

```bash
git add scripts/security/lib/dependency-policy.mjs scripts/security/phase4-dependency-policy.mjs scripts/security/__tests__/phase4-dependency-policy.test.mjs
git commit -m "feat(security): add deterministic dependency policy gate"
```

### Task 3: Replace the unmaintained Discord strategy

**Files:**
- Create: `Backend/Chatify/Config/discordOAuthStrategy.mjs`
- Create: `Backend/Chatify/test/auth/discord-oauth-strategy.test.mjs`
- Modify: `Backend/Chatify/Config/passport.mjs`
- Modify: `Backend/Chatify/package.json`
- Modify: `Backend/Chatify/package-lock.json`

**Interfaces:**
- Consumes: `passport-oauth2` and Discord OAuth configuration.
- Produces: `DiscordStrategy extends OAuth2Strategy`, named `discord`, with `userProfile(accessToken, done)` returning the fields already consumed by `handleOAuthUser`.

- [ ] **Step 1: Write focused tests before production code**

Test the authorization URL, token URL, scope separator, profile endpoint, JSON mapping for `id`, `username`, `global_name`, `email`, `verified`, and `avatar`, malformed JSON behavior, provider errors, and non-2xx profile failures.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm --prefix Backend/Chatify test -- --run test/auth/discord-oauth-strategy.test.mjs`

Expected: failure because the local strategy module does not exist.

- [ ] **Step 3: Implement the minimal local strategy**

Subclass `passport-oauth2`. Configure Discord's `/oauth2/authorize`, `/api/oauth2/token`, and `/api/users/@me` endpoints. Set `name = 'discord'`, `scopeSeparator = ' '`, and map only the required provider profile fields.

- [ ] **Step 4: Replace the import in Passport configuration**

Import the local strategy and preserve the existing callback, scopes, callback URL, and account-linking behavior.

- [ ] **Step 5: Replace dependency declaration**

Remove `passport-discord`; declare `passport-oauth2` directly. Regenerate the lockfile without `--force` and verify the removed package is absent.

- [ ] **Step 6: Run focused and existing OAuth tests**

Run:

```bash
npm --prefix Backend/Chatify test -- --run test/auth/discord-oauth-strategy.test.mjs
npm --prefix Backend/Chatify test -- --run test/auth/oauth-account-linking.test.mjs test/auth/oauth-config.test.mjs
```

Expected: all pass.

- [ ] **Step 7: Commit the replacement**

```bash
git add Backend/Chatify/Config Backend/Chatify/test/auth Backend/Chatify/package.json Backend/Chatify/package-lock.json
git commit -m "fix(auth): replace unmaintained Discord OAuth package"
```

### Task 4: Remediate dependency advisories and govern lifecycle scripts

**Files:**
- Modify: `Backend/Chatify/package.json`
- Modify: `Backend/Chatify/package-lock.json`
- Modify: `Frontend/Chatify/package.json`
- Modify: `Frontend/Chatify/package-lock.json`
- Modify: `docs/security/audit/phase-4/install-script-policy.json`

**Interfaces:**
- Consumes: npm advisory remediation within declared semver ranges.
- Produces: lockfiles for which both `npm audit --omit=dev --audit-level=high` commands exit zero and `npm install-scripts ls --json` reports no unreviewed scripts.

- [ ] **Step 1: Capture pre-remediation audit JSON**

Run both production audits with `--json`, preserving only local temporary files for comparison.

- [ ] **Step 2: Apply non-force lockfile remediation**

Run `npm audit fix --package-lock-only` in each application. Do not use `--force`; direct major changes require explicit manifest review.

- [ ] **Step 3: Review direct version changes**

Update manifest minimum ranges only when needed to describe the fixed compatible version selected by the lockfile. Keep package.json and root lock metadata identical.

- [ ] **Step 4: Add project `allowScripts` policy**

Approve version-pinned scripts required by native/build packages. Explicitly deny unnecessary name-wide scripts such as eager development binary downloads when runtime test behavior remains correct. Mirror the rationale in `install-script-policy.json`.

- [ ] **Step 5: Verify clean installs and pending scripts**

Run:

```bash
npm --prefix Backend/Chatify ci
npm --prefix Backend/Chatify install-scripts ls --json
npm --prefix Frontend/Chatify ci
npm --prefix Frontend/Chatify install-scripts ls --json
```

Expected: installs succeed and no pending script is reported.

- [ ] **Step 6: Verify production audits**

Run:

```bash
npm --prefix Backend/Chatify audit --omit=dev --audit-level=high
npm --prefix Frontend/Chatify audit --omit=dev --audit-level=high
```

Expected: both exit zero.

- [ ] **Step 7: Run backend/frontend tests, lint, and build**

Run `npm run quality`.

Expected: all application quality commands pass.

- [ ] **Step 8: Commit dependency remediation**

```bash
git add Backend/Chatify/package.json Backend/Chatify/package-lock.json Frontend/Chatify/package.json Frontend/Chatify/package-lock.json docs/security/audit/phase-4/install-script-policy.json
git commit -m "fix(security): remediate production dependency advisories"
```

### Task 5: Supply-chain CI, action pins, and automated updates

**Files:**
- Create: `.github/workflows/security-phase-4-supply-chain.yml`
- Create: `.github/dependabot.yml`
- Modify: `.github/workflows/security-and-test-foundation.yml`
- Delete: `.github/workflows/security-phase-3-finalizer.yml`
- Delete: `.github/workflows/security-phase-3-hardening-materialize.yml`

**Interfaces:**
- Consumes: root Phase 4 scripts and both npm projects.
- Produces: read-only Phase 4 verification plus Dependabot coverage.

- [ ] **Step 1: Pin every remote action in the foundation workflow**

Use the already-reviewed immutable SHAs for checkout, setup-node, and upload-artifact. Move audits after tests/build so a newly published advisory cannot suppress functional test evidence.

- [ ] **Step 2: Add Dependabot coverage**

Configure weekly npm updates for `/Backend/Chatify` and `/Frontend/Chatify`, and weekly GitHub Actions updates for `/`. Limit open PRs and add dependency/security labels.

- [ ] **Step 3: Add the permanent Phase 4 workflow**

Use `contents: read`, pinned actions, Node/npm versions from the repository, clean installs, pending-script checks, `npm audit signatures`, production audits, CycloneDX SBOM generation, Phase 4 reproduction, and always-uploaded evidence artifacts.

- [ ] **Step 4: Remove Phase 3 bootstrap residue**

Delete temporary Phase 3 finalizer/materializer workflows from the stacked tree.

- [ ] **Step 5: Run Phase 4 workflow-policy tests**

Run the focused Phase 4 test and generated-policy check; verify the action and Dependabot exit fields pass.

- [ ] **Step 6: Commit CI governance**

```bash
git add .github
git commit -m "ci(security): enforce Phase 4 supply-chain gates"
```

### Task 6: Reproduction runner and root command surface

**Files:**
- Create: `scripts/security/lib/phase4-reproduction.mjs`
- Create: `scripts/security/__tests__/phase4-reproduction.test.mjs`
- Create: `scripts/security/phase4-reproduce.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces root commands `security:phase4:test`, `security:phase4:generate`, `security:phase4:check`, and `security:phase4:reproduce`.

- [ ] **Step 1: Write failing command-plan test**

Assert exact ordered commands for clean installs, pending scripts, signature verification, production audits, SBOM generation, inherited Phase 1–3 gates, Phase 4 tests/check, full quality, and operations.

- [ ] **Step 2: Verify RED**

Run: `node --test scripts/security/__tests__/phase4-reproduction.test.mjs`

Expected: missing reproduction module.

- [ ] **Step 3: Implement command plan and evidence runner**

Record repository/runtime metadata, command strings, exit codes, duration, lock/evidence hashes, deterministic Phase 4 exit fields, and intentionally unexecuted external controls. Do not capture command stdout containing registry configuration.

- [ ] **Step 4: Add root scripts**

Wire the four Phase 4 commands without changing existing Phase 1–3 commands.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```bash
npm run security:phase4:test
npm run security:phase4:generate
npm run security:phase4:check
```

Expected: all pass.

- [ ] **Step 6: Commit reproduction surface**

```bash
git add package.json scripts/security
git commit -m "feat(security): add Phase 4 reproduction evidence"
```

### Task 7: Documentation and deterministic evidence

**Files:**
- Create: `docs/security/audit/phase-4/README.md`
- Create: `docs/security/audit/phase-4/dependency-policy.json`
- Create: `docs/security/audit/phase-4/dependency-policy.md`
- Create: `docs/security/audit/phase-4/dependency-update-procedure.md`
- Modify: `docs/plans/2026-08-21-phase-4-dependency-and-supply-chain.md`
- Modify: Phase 1 and Phase 2 generated evidence files as required by repository changes.

**Interfaces:**
- Consumes: generated report and verified command surface.
- Produces: operator/reviewer documentation and current deterministic evidence.

- [ ] **Step 1: Document evidence interpretation and limitations**

Explain structural versus live evidence, source/integrity policy, install-script decisions, exception lifecycle, action pins, SBOM/signature limitations, and manual review responsibilities.

- [ ] **Step 2: Document controlled dependency updates**

Require a linked advisory/update reason, lockfile diff review, lifecycle-script review, audit/signature/SBOM commands, focused/full tests, generated evidence, rollback, and exception expiry.

- [ ] **Step 3: Generate Phase 4 evidence**

Run `npm run security:phase4:generate`, then `npm run security:phase4:check`.

- [ ] **Step 4: Regenerate inherited deterministic evidence**

Run Phase 1 generate/check, Phase 2 generate/check, Phase 3 generate/check, and repeat Phase 1 if its tracked-file inventory changed during generation.

- [ ] **Step 5: Commit documentation and evidence**

```bash
git add docs package.json
git commit -m "docs(security): record Phase 4 supply-chain evidence"
```

### Task 8: Full verification, review, cleanup, and stacked pull request

**Files:**
- Review all Phase 4 changed files.
- Ensure no temporary Phase 4 source-export/materialization/finalizer workflow remains.

**Interfaces:**
- Produces a draft stacked PR from `security/phase-4-dependency-supply-chain` to `security/phase-3-secret-exposure`.

- [ ] **Step 1: Run syntax and focused verification**

Run `node --check` for every new Phase 4 module and the local Discord strategy, then all Phase 4 tests and Discord/OAuth tests.

- [ ] **Step 2: Run complete reproduction**

Run `npm run security:phase4:reproduce` on a clean checkout with network access.

Expected: every command exits zero and a Phase 4 runtime evidence artifact is written.

- [ ] **Step 3: Run independent diff review**

Review every changed source and workflow file against the Phase 4 contract. Fix critical or important findings with regression tests.

- [ ] **Step 4: Verify final tree hygiene**

Confirm only permanent workflows remain, no source bundles or temporary scripts are tracked, generated evidence is current, and `git diff --check` passes.

- [ ] **Step 5: Open a draft stacked pull request**

Create a draft PR titled `security: implement Phase 4 dependency and supply-chain controls`, targeting `security/phase-3-secret-exposure`. Include exact audit counts, tests, lockfile changes, install-script decisions, action pins, evidence artifacts, and known limitations.

- [ ] **Step 6: Inspect final GitHub checks**

Require permanent Phase 1, Phase 2, Phase 3, Phase 4, and foundation workflows against the same head commit. Do not mark the PR ready or claim completion while any required check is pending or failed.
