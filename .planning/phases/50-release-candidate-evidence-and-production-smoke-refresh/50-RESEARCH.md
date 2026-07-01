# Phase 50 Research

## Question

How should Chatify refresh release-candidate evidence without adding new tooling or falsely claiming production readiness?

## Current State

- Root `package.json` already defines `quality`, `smoke:local`, `smoke:prod`, `evidence:production`, and `ops:check`.
- `scripts/production-evidence-check.mjs` already validates production, local call/profile, and TURN env contracts, reads prior evidence artifact statuses, writes sanitized markdown, and exits nonzero when blocked.
- Production smoke config tests already verify missing env, invalid URLs, local production URL rejection, Socket.IO rewrite ordering, and static-content leak detection.
- Prior Phase 25 evidence is user-confirmed but stale for a new release candidate.
- Prior Phase 49 visual QA establishes the accepted Playwright fallback when Hercules cannot run without provider keys or subagents.

## Recommendation

Parameterize the existing evidence checker with a Phase 50 report profile and add a root `evidence:release-candidate` script. Then run the current focused release checks and write a Phase 50 visual QA/report closeout.

## Rejected Alternatives

- Copy `production-evidence-check.mjs` into a new script: rejected because duplicated env contract logic would drift.
- Add a new runner dependency: rejected because Playwright is already installed and sufficient for deterministic local visual evidence.
- Mark Phase 50 complete only on live production smoke success: rejected for this environment because secrets are intentionally unavailable; the correct local deliverable is a current blocker artifact.

## Implementation Split

1. `50-01`: Evidence command and release-candidate artifact.
2. `50-02`: Production config, ops, and visual QA refresh.
3. `50-03`: Review, verification, traceability, and no-readiness-claim closeout.
