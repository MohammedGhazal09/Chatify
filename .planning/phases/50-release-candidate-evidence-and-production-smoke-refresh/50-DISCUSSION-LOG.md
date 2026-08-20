# Phase 50 Discussion Log

**Phase:** 50-release-candidate-evidence-and-production-smoke-refresh
**Mode:** auto-approved recommendations
**Date:** 2026-07-01

| Area | Options considered | Recommendation approved | Why |
|---|---|---|---|
| Evidence command | New checker; duplicate script; parameterize existing checker | Parameterize existing checker | Shortest diff, preserves Phase 25 behavior, avoids two sources of truth. |
| Production credentials | Ask user now; record missing env; skip production evidence | Record missing env as blocker | Secrets must not be requested or stored in repo artifacts. |
| Visual QA runner | Hercules provider runner; local agent runner; Playwright fallback | Playwright fallback with Hercules report contract | Local Hercules paths require external provider or subagent-style runner, while subagents are disallowed. |
| Scope | Product changes; deployment changes; evidence-only | Evidence-only | Phase 51-54 handle product capabilities; Phase 50 is release evidence. |
| Readiness language | Claim ready if local checks pass; claim partial; only claim what was checked | Only claim what was checked | Avoids repeating historical false readiness drift. |

## Auto-Approved Recommendations

- Add `npm run evidence:release-candidate`.
- Keep `npm run evidence:production` backward-compatible.
- Treat missing smoke/TURN env as a blocker.
- Reuse existing Playwright visual specs and redirect screenshots to Phase 50.
- Write explicit no-launch-claim language in verification.

## Deferred

- Secret-bearing production smoke and TURN validation in CI or a trusted local shell.
