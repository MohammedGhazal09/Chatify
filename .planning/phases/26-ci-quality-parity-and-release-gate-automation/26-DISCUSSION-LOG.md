# Phase 26: CI Quality Parity And Release Gate Automation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 26-ci-quality-parity-and-release-gate-automation
**Areas discussed:** CI scope, audit thresholds, production evidence behavior, browser smoke selection

---

## CI Scope

| Option | Description | Selected |
|---|---|---|
| Add a second workflow | Leaves existing workflow weaker and duplicates setup | |
| Upgrade existing workflow | Keeps one source of truth for required checks | yes |
| Only document local commands | No automated parity | |

**User's choice:** Auto-approved recommendation: upgrade existing workflow.

---

## Audit Threshold

| Option | Description | Selected |
|---|---|---|
| Fail on any audit advisory | Blocks on low dev-server advisories | |
| Fail on high production dependency advisories | Blocks serious runtime risk while keeping low advisory visible | yes |
| Disable audit | Leaves dependency security out of CI | |

**User's choice:** Auto-approved recommendation: high severity production dependency gate.

---

## Production Evidence In CI

| Option | Description | Selected |
|---|---|---|
| Always fail when evidence is blocked | Breaks ordinary PRs without live secrets | |
| Warn/upload on PRs, fail only with release variable | Honest and usable | yes |
| Skip evidence in CI | CI can look green while release evidence is unknown | |

**User's choice:** Auto-approved recommendation: warning on PR, blocking on release opt-in.

---

## Browser Smoke Selection

| Option | Description | Selected |
|---|---|---|
| Full local smoke suite | Requires backend/accounts and may be flaky without env | |
| Production smoke config spec | Stable config/browser gate with no live secrets | yes |
| No browser gate | Fails Phase 26 browser smoke criterion | |

**User's choice:** Auto-approved recommendation: production smoke config spec.

---

## the agent's Discretion

- Exact artifact names.
- Exact aggregate gate job implementation.
- README wording.

## Deferred Ideas

- Branch protection enforcement.
- Action SHA pinning.
- Full live production smoke in release CI.

---

*Phase: 26-ci-quality-parity-and-release-gate-automation*
*Discussion log generated: 2026-06-19*
