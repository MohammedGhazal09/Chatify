# Phase 50: Release Candidate Evidence And Production Smoke Refresh - Specification

**Created:** 2026-07-01
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 5 locked

## Goal

Refresh release-candidate evidence by producing a current, sanitized evidence artifact and local/browser verification record without claiming hosted readiness when smoke or TURN secrets are absent.

## Background

Phase 25 closed production evidence by maintainer-confirmed historical smoke. `scripts/production-evidence-check.mjs` currently writes only a Phase 25 artifact, root `package.json` exposes `smoke:prod`, `smoke:local`, `evidence:production`, and `ops:check`, and `STATE.md` explicitly says the next release candidate should rerun production/local smoke and TURN checks in a secret-bearing shell. Phase 50 exists to refresh that evidence boundary.

## Requirements

1. **Release-candidate artifact**: A root command writes a current Phase 50 sanitized evidence report.
   - Current: `npm run evidence:production` writes `.planning/phases/25-production-evidence-closure-and-live-smoke-execution/25-PRODUCTION-EVIDENCE.md`.
   - Target: `npm run evidence:release-candidate` writes `.planning/phases/50-release-candidate-evidence-and-production-smoke-refresh/50-RELEASE-CANDIDATE-EVIDENCE.md` without changing the Phase 25 default.
   - Acceptance: Running the command creates the Phase 50 report and records missing or invalid env as blockers without leaking secret values.

2. **Production smoke config remains guarded**: Production smoke still refuses missing, invalid, or local production origins.
   - Current: `Frontend/Chatify/e2e/production-smoke-config.spec.ts` tests the Phase 10/14 production config boundary.
   - Target: Phase 50 verification reruns that config gate as release-candidate evidence.
   - Acceptance: `npm --prefix Frontend/Chatify run test:e2e:prod -- e2e/production-smoke-config.spec.ts --workers=1` passes.

3. **Local visual QA refresh**: Release-critical mocked browser surfaces are rechecked visually.
   - Current: Prior phases have Playwright visual evidence for chat quality and delivery-health admin surfaces.
   - Target: Phase 50 reruns a focused Playwright fallback visual matrix for chat UI and admin delivery health under the `hercules-visual-qa` coverage contract.
   - Acceptance: A Phase 50 visual QA report lists every tested/blocked route, viewport, workflow, screenshot path, console/network result, and runner limitation.

4. **Operations guard refresh**: Repository release scripts and operations runbooks remain internally consistent.
   - Current: `npm run ops:check` validates scripts, env examples, runbooks, readiness components, and scanned secrets.
   - Target: Phase 50 reruns the guard and records the result.
   - Acceptance: `npm run ops:check` exits 0 or the Phase 50 verification records a blocking failure.

5. **No false readiness claim**: Evidence docs distinguish local/config proof from live hosted/provider success.
   - Current: Phase 25 and Phase 26 docs preserve the secret-gated production boundary.
   - Target: Phase 50 closeout repeats that boundary with current command output.
   - Acceptance: Phase 50 verification says hosted/provider success is not claimed unless live smoke and TURN evidence pass in the current environment.

## Boundaries

**In scope:**
- Add a Phase 50 evidence command that reuses the existing production evidence checker.
- Generate a current sanitized release-candidate evidence artifact.
- Rerun production smoke config, operations guard, and focused browser visual QA.
- Write Phase 50 summaries, visual QA, UI review, code review, and verification artifacts.

**Out of scope:**
- Supplying or storing production credentials - secrets must stay outside the repo.
- Running destructive production admin actions - smoke must remain bounded to existing safe test flows.
- Changing deployment infrastructure - Phase 50 reports readiness, it does not deploy.
- Adding new product features - later phases cover admin hub, encryption hardening, privacy workers, and bots.

## Constraints

- Reports must redact or omit raw emails, passwords, tokens, cookies, reset codes, SDP, ICE candidates, TURN credentials, private messages, and private account identifiers.
- Missing production smoke or TURN env is a blocker, not a pass.
- Use existing Node, npm, Vitest, and Playwright tooling; no new dependencies.
- Use `hercules-visual-qa` runner order, with Playwright fallback clearly labeled when Hercules cannot run without subagents or provider keys.

## Acceptance Criteria

- [ ] `npm run evidence:release-candidate` writes `50-RELEASE-CANDIDATE-EVIDENCE.md`.
- [ ] Phase 25 evidence command behavior remains backward-compatible.
- [ ] Production smoke config test passes.
- [ ] Operations guard passes or blocker is recorded.
- [ ] Focused visual QA report includes coverage ledger, screenshots, logic checks, console/network evidence, and runner note.
- [ ] Phase 50 docs do not claim launch readiness without current live smoke/TURN evidence.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---:|---:|---|---|
| Goal Clarity | 0.95 | 0.75 | met | Output is a current evidence artifact and verification record. |
| Boundary Clarity | 0.95 | 0.70 | met | No credentials, deployment, or feature work. |
| Constraint Clarity | 0.85 | 0.65 | met | Privacy and no-new-dependency constraints are explicit. |
| Acceptance Criteria | 0.85 | 0.70 | met | Commands and files are named. |
| **Ambiguity** | **0.10** | **<=0.20** | met | Auto-approved recommendations. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|---|---|---|---|
| 1 | Researcher | What exists today for release evidence? | Reuse root smoke/evidence/ops scripts and prior Phase 25/26 gates. |
| 2 | Simplifier | What is the irreducible Phase 50 core? | Produce current evidence, visual QA, and explicit blockers; no new feature work. |
| 3 | Boundary Keeper | What is out of scope? | No credentials in repo, no deployment changes, no readiness claim without live evidence. |
| 4 | Failure Analyst | What would make verification reject this phase? | Secret leakage, overwritten Phase 25 artifact, or missing blocker language. |

---

*Phase: 50-release-candidate-evidence-and-production-smoke-refresh*
*Spec created: 2026-07-01*
*Next step: $gsd-discuss-phase 50*
