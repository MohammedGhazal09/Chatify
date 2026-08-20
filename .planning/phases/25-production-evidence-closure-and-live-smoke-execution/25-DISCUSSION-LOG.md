# Phase 25: Production Evidence Closure And Live Smoke Execution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 25-production-evidence-closure-and-live-smoke-execution
**Areas discussed:** evidence model, privacy, live smoke behavior, UI scope, phase boundary

---

## Evidence Model

| Option | Description | Selected |
|---|---|---|
| Duplicate every existing smoke harness | Build new Phase 25 Playwright flows for production, calls, and profile images | |
| Consolidate canonical artifacts | Read Phase 14/15/16/17/24 artifacts and produce one decision record | yes |
| Manual checklist only | Add docs but no executable evidence command | |

**User's choice:** Auto-approved recommendation: consolidate canonical artifacts.
**Notes:** This reduces drift and keeps existing acceptance flows authoritative.

---

## Privacy

| Option | Description | Selected |
|---|---|---|
| Include configured values for debugging | Faster debugging but risks secret exposure | |
| Include variable names, opt-in state, URL validity, and sanitized origins only | Enough to fix setup without leaking credentials | yes |
| Avoid reading env entirely | Safer but less actionable | |

**User's choice:** Auto-approved recommendation: sanitized names/status/origins only.
**Notes:** This follows existing Phase 14/15 privacy behavior and operational runbook rules.

---

## Missing Environment Behavior

| Option | Description | Selected |
|---|---|---|
| Treat missing env as skipped/pass-neutral | Avoids failing local runs but hides release blockers | |
| Treat missing env as blocked release evidence | Keeps launch decision honest | yes |
| Stop without writing artifact | Avoids stale evidence but leaves no handoff | |

**User's choice:** Auto-approved recommendation: blocked release evidence.
**Notes:** Phase 17 already requires this posture.

---

## UI Scope

| Option | Description | Selected |
|---|---|---|
| Add a release dashboard UI | New user-facing surface | |
| Use existing smoke UI only and write docs/artifacts | No product UI change | yes |
| Redesign smoke report pages | Out of scope for release evidence | |

**User's choice:** Auto-approved recommendation: no new runtime UI.
**Notes:** Phase 25 is an evidence gate; Phase 26 can expose CI artifacts if needed.

---

## the agent's Discretion

- Exact markdown table layout for `25-PRODUCTION-EVIDENCE.md`.
- Script helper names and internal parsing details.
- Whether review artifacts say "no findings" or list blockers as expected release-gate failures.

## Deferred Ideas

- CI enforcement of `npm run evidence:production` goes to Phase 26.
- Production-backed media/voice residual feature gaps go to Phase 27.

---

*Phase: 25-production-evidence-closure-and-live-smoke-execution*
*Discussion log generated: 2026-06-19*
