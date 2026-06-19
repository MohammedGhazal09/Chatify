# Phase 26: CI Quality Parity And Release Gate Automation - Specification

**Created:** 2026-06-19
**Ambiguity score:** 0.12 (gate: <= 0.20)
**Requirements:** 5 locked

## Goal

GitHub Actions changes from a partial backend/lint/build workflow to a quality gate that matches local release checks for tests, build, operations, dependency security, browser smoke config, and Phase 25 evidence behavior.

## Background

The existing workflow ran backend tests and frontend lint/build, but it did not run frontend Vitest, root operations checks, Phase 25 evidence generation, browser smoke configuration checks, or a required aggregate gate. Phase 25 also introduced `npm run evidence:production`, which should warn on ordinary PRs without live secrets and become blocking only for release contexts.

## Requirements

1. **Frontend test parity**: CI must run frontend Vitest before merge.
   - Current: CI ran lint/build only for the frontend.
   - Target: CI runs frontend audit, Vitest, lint, and build.
   - Acceptance: Workflow contains frontend test, lint, build, and audit steps.

2. **Backend security/test parity**: CI must run backend production dependency audit and backend tests.
   - Current: CI ran backend audit and tests, but audit threshold was broad and not documented.
   - Target: CI runs `npm audit --omit=dev --audit-level=high` and backend tests.
   - Acceptance: Backend audit/test commands pass locally.

3. **Operations and evidence gate**: CI must run `ops:check` and generate Phase 25 production evidence.
   - Current: CI did not run root operations checks or Phase 25 evidence.
   - Target: Operations job runs both, uploads evidence, and only fails production evidence when `CHATIFY_CI_REQUIRE_PRODUCTION_EVIDENCE=1`.
   - Acceptance: Missing live secrets create a warning/artifact on PRs, not a false pass.

4. **Browser smoke config guard**: CI must run a stable Playwright smoke/config gate that does not require live credentials.
   - Current: Browser smoke was absent from CI.
   - Target: CI runs `production-smoke-config.spec.ts` and uploads the production Playwright report.
   - Acceptance: Local command passes with 9 tests.

5. **Documented quality gates**: Maintainers must know local equivalents, thresholds, and release-only production evidence behavior.
   - Current: README listed operations scripts but not the new evidence command or CI threshold.
   - Target: README and a CI runbook document the commands and thresholds.
   - Acceptance: `docs/operations/ci-quality-gates.md` exists and `npm run ops:check` still passes.

## Boundaries

**In scope:**
- Update `.github/workflows/security-and-test-foundation.yml`.
- Remediate high-severity frontend dependency advisories with non-force audit fix.
- Add CI quality gate runbook and README entry.
- Verify affected package tests, audits, lint, build, workflow YAML, and smoke config.

**Out of scope:**
- Requiring live production smoke secrets on every PR - release contexts opt in.
- Adding branch protection through GitHub settings - repository admin action.
- Pinning actions to commit SHAs - defer unless GitHub credentials and pinning policy are explicitly available.
- Creating a new runtime UI.

## Constraints

- Keep CI secrets out of logs and docs.
- Keep Phase 25 evidence blocker visible.
- Use existing npm package layout and package lockfiles.
- Preserve unrelated local work and do not edit `Frontend/Chatify/src/pages/chat/chat.tsx`.

## Acceptance Criteria

- [ ] Workflow YAML parses.
- [ ] Backend high-severity production audit passes.
- [ ] Backend full tests pass.
- [ ] Frontend high-severity production audit passes.
- [ ] Frontend Vitest, lint, and build pass.
- [ ] Production smoke config Playwright gate passes.
- [ ] `npm run ops:check` passes.
- [ ] `npm run evidence:production` still blocks without live env and the workflow records that as a warning unless release mode is enabled.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---:|---:|---|---|
| Goal Clarity | 0.92 | 0.75 | PASS | CI parity is concrete. |
| Boundary Clarity | 0.90 | 0.70 | PASS | Live production secrets are release-only. |
| Constraint Clarity | 0.88 | 0.65 | PASS | Threshold and secret rules are explicit. |
| Acceptance Criteria | 0.90 | 0.70 | PASS | Commands are listed. |
| **Ambiguity** | 0.12 | <=0.20 | PASS | Action pinning remains deferred. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|---|---|---|---|
| 1 | CI | Should production evidence block every PR? | Auto-selected no; warn/upload on PRs, block only with release variable. |
| 2 | Security | What audit threshold should block CI? | Auto-selected high severity for production dependencies; low advisory remains visible. |
| 3 | Testing | Which browser gate is stable in CI without secrets? | Auto-selected production smoke config spec. |
| 4 | Documentation | Where should threshold behavior live? | Auto-selected operations runbook plus README. |

---

*Phase: 26-ci-quality-parity-and-release-gate-automation*
*Spec created: 2026-06-19*
