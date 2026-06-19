# Phase 26: CI Quality Parity And Release Gate Automation - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 26 upgrades CI and documentation so pull requests exercise the same meaningful gates as local release checks, while preserving Phase 25's honest blocked production evidence behavior.

</domain>

<decisions>
## Implementation Decisions

### CI Structure
- **D-01:** Update the existing `security-and-test-foundation.yml` workflow instead of adding a parallel workflow.
- **D-02:** Split CI into backend, frontend, operations/evidence, browser smoke config, and aggregate required gate jobs.
- **D-03:** Keep `permissions: contents: read`, concurrency cancellation, npm cache per package lockfile, and job timeouts.

### Security Thresholds
- **D-04:** Block high-severity production dependency advisories with `npm audit --omit=dev --audit-level=high`.
- **D-05:** Keep the remaining low-severity frontend esbuild dev-server advisory visible but non-release-blocking under this phase's threshold.
- **D-06:** Use non-force `npm audit fix` only; avoid major or force dependency upgrades in this CI phase.

### Release Evidence
- **D-07:** Always generate and upload Phase 25 evidence in CI.
- **D-08:** Fail the evidence step only when repository variable `CHATIFY_CI_REQUIRE_PRODUCTION_EVIDENCE=1` is set.
- **D-09:** Use the production smoke config Playwright spec as the CI browser guard because it does not require live credentials.

### the agent's Discretion
- Exact job names and artifact names can be chosen for clarity.
- README wording can be concise as long as it points to the runbook.

</decisions>

<canonical_refs>
## Canonical References

### Workflow and package scripts
- `.github/workflows/security-and-test-foundation.yml` - CI workflow being upgraded.
- `package.json` - root local quality, smoke, operations, and evidence scripts.
- `Backend/Chatify/package.json` - backend test command and lockfile scope.
- `Frontend/Chatify/package.json` - frontend test, lint, build, and Playwright commands.

### Evidence and operations
- `.planning/phases/25-production-evidence-closure-and-live-smoke-execution/25-PRODUCTION-EVIDENCE.md` - release evidence artifact uploaded by CI.
- `docs/operations/production-smoke.md` - live smoke setup.
- `docs/operations/ci-quality-gates.md` - CI gate runbook.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Root scripts already wrap backend/frontend quality and smoke commands.
- `production-smoke-config.spec.ts` validates production env behavior without live accounts.
- `ops-check.mjs` validates runbook/env/privacy documentation.

### Integration Points
- GitHub Actions must install backend and frontend dependencies separately because lockfiles live in package roots.
- Evidence generation does not need package installation.
- Playwright production config writes report output that CI can upload as an artifact.

</code_context>

<deferred>
## Deferred Ideas

- Branch protection setup must be done in GitHub settings or a separate automation phase.
- Full live production smoke in CI requires release secrets and should remain opt-in.
- Commit-SHA action pinning can be added after deciding a repository-wide pinning policy.

</deferred>

---

*Phase: 26-ci-quality-parity-and-release-gate-automation*
*Context gathered: 2026-06-19*
