# Controlled Dependency Update Procedure

Use this procedure for Dependabot pull requests, manual package upgrades, advisory remediations, lockfile refreshes, and GitHub Action updates.

## 1. Establish the update reason

Record the package or action, current and proposed versions, advisory or maintenance reason, affected runtime surface, and rollback owner. For a security advisory, include every GHSA/CVE represented by the installed dependency chain.

## 2. Review the manifest and lockfile diff

Confirm that:

- direct selectors changed only where intended;
- the root lockfile metadata exactly matches `package.json`;
- no new Git, local, link, mutable-tag, HTTP, unknown, or unreviewed tarball source appears;
- every independently fetched registry package retains an integrity value; explicitly bundled children remain attributable to a verified registry parent artifact rather than self-declaring trust;
- transitive additions and removals are explainable;
- deprecated or abandoned direct dependencies are not introduced;
- no unexpected package gains `hasInstallScript`.

Never use `npm audit fix --force` as an approval shortcut. Major upgrades require explicit compatibility review.

## 3. Review install-time code

Run in each affected project:

```bash
npm ci --strict-allow-scripts
npm run security:phase4:check
npm install-scripts prune --dry-run
```

For every new or changed lifecycle script, inspect the published package metadata and source. Add a version-pinned approval only when the script is required and its behavior is understood. Add a name-wide denial when the script is optional or should not execute. Update `docs/security/audit/phase-4/install-script-policy.json` in the same commit.

## 4. Verify registry and advisory evidence

After a clean install, run:

```bash
npm audit signatures --json
npm audit --omit=dev --json
npm sbom --package-lock-only --sbom-format=cyclonedx --sbom-type=application
```

A network or registry error is not a clean result. High and critical production advisories block the update unless an exact, noncritical, controlled exception is approved and committed. Critical advisories cannot be excepted.

## 5. Run focused and full verification

Run tests for the changed integration or package first. Then run:

```bash
npm run security:phase4:test
npm run security:phase4:generate
npm run security:phase4:check
npm run quality
npm run ops:check
```

Changes to dependencies, workflows, or security scripts also require regeneration and checks for inherited Phase 1–3 evidence.

## 6. Review software-bill-of-material changes

Compare the new CycloneDX SBOM with the previous workflow artifact. Investigate new components, license changes, unexpected duplicate versions, native components, and packages whose publisher or source repository changed.

## 7. Merge and monitor

Require the permanent foundation and Phase 1–4 workflows on the same head commit. After deployment, monitor authentication, messaging, notification, file handling, and realtime error rates relevant to the updated package.

## 8. Roll back when necessary

Revert the manifest and lockfile together, restore the previous install-script decisions, run `npm ci`, repeat the Phase 1–4 and application gates, and redeploy the last verified commit. Do not hand-edit transitive lockfile entries as a rollback technique.

## Exception closure

Before an exception expires, either update/remove the vulnerable dependency or renew it through a new review with current evidence. Remove the exception immediately after remediation and confirm the live audit remains green without it.
