# Phase 25: Production Evidence Closure And Live Smoke Execution - Specification

**Created:** 2026-06-19
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 5 locked

## Goal

Chatify release readiness changes from "locally verified but externally blocked" to either "passed with live evidence" or "blocked with a single sanitized Phase 25 evidence artifact naming every remaining release blocker."

## Background

Phase 14 already has a production-only Playwright gate and writes `14-LIVE-ACCEPTANCE.md`. Phase 15 has call acceptance artifacts and a detailed failure report. Phase 16 has profile-image local acceptance, Phase 17 records the v1 readiness decision, and Phase 24 locally verified group call entry behavior. Those artifacts are useful, but the project lacks one current release gate that reconciles production smoke, local two-account browser smoke, TURN readiness, and the v1 decision in one place.

## Requirements

1. **Consolidated release evidence**: Phase 25 must create a sanitized evidence artifact that reconciles Phase 14, 15, 16, 17, and 24 evidence.
   - Current: Evidence exists in separate phase artifacts and Phase 17 stays blocked.
   - Target: `25-PRODUCTION-EVIDENCE.md` lists current pass/fail/blocker status by gate.
   - Acceptance: Running `npm run evidence:production` writes the Phase 25 artifact and exits nonzero when release evidence is blocked.

2. **No-secret environment contract**: The gate must inspect only environment variable presence, opt-in flags, and sanitized URL origins.
   - Current: Existing phase artifacts avoid secrets, but no single checker enforces Phase 25 privacy rules.
   - Target: Phase 25 reports missing variable names and sanitized origins without raw credentials.
   - Acceptance: The generated artifact contains no raw emails, passwords, tokens, cookies, reset codes, SDP, ICE candidates, or TURN credentials.

3. **Live smoke commands remain authoritative**: Existing Playwright smoke gates must still be the source of browser behavior evidence.
   - Current: Phase 14/15/16 tests can produce blocked artifacts when env is absent.
   - Target: Phase 25 reruns those gates or records why they cannot produce live pass evidence.
   - Acceptance: Verification records the exact production and local smoke commands and their current results.

4. **Readiness cannot be overstated**: Missing credentials, origins, deploy refs, or TURN provider state must block release claims.
   - Current: Phase 17 is blocked, but later feature phases could obscure that state.
   - Target: Phase 25 repeats the release decision clearly and keeps v1 readiness blocked until all live gates pass.
   - Acceptance: `25-PRODUCTION-EVIDENCE.md` and `25-VERIFICATION.md` both state no hosted/provider success is claimed in this environment.

5. **Group call and profile-image evidence are included**: The gate must include Phase 24 group call verification and Phase 16 profile-image acceptance status.
   - Current: Phase 24 is passed locally; Phase 16 implementation is complete but local cross-user acceptance is blocked by env.
   - Target: Phase 25 shows the mixed state instead of collapsing it into a vague release blocker.
   - Acceptance: Evidence matrix includes Phase 24 as acceptable local evidence and Phase 16 as blocked local cross-user evidence.

## Boundaries

**In scope:**
- A root script for consolidated production evidence.
- A generated sanitized Phase 25 evidence artifact.
- Rerun or record production/local smoke command outcomes.
- Update Phase 25 planning, execution, verification, and review artifacts.

**Out of scope:**
- Creating or storing smoke account credentials - requires user-owned secrets.
- Claiming production readiness without live deployed evidence - violates Phase 17.
- Rewriting existing Phase 14/15/16 harnesses unless a concrete bug is found.
- Changing messenger UI behavior - this phase validates evidence, not product UX.
- Implementing CI automation - Phase 26 owns CI parity.

## Constraints

- Preserve unrelated local work and do not edit `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Keep all artifacts sanitized.
- Use the existing React/Vite, Express, MongoDB, Socket.IO, TanStack Query, Zustand, Tailwind, npm, Playwright, and GSD layout.
- Treat absent smoke credentials as a release blocker, not a test pass.

## Acceptance Criteria

- [ ] `npm run evidence:production` exists and writes `.planning/phases/25-production-evidence-closure-and-live-smoke-execution/25-PRODUCTION-EVIDENCE.md`.
- [ ] The evidence script exits nonzero while any production/local/TURN/readiness blocker remains.
- [ ] Production smoke command is run or blocked with current no-env evidence.
- [ ] Local Phase 15/16 smoke command is run or blocked with current no-env evidence.
- [ ] Phase 25 verification names exact blockers and refuses hosted/provider success claims.
- [ ] UI review records no new runtime UI surface when the phase only adds operational/evidence artifacts.
- [ ] Code review covers the phase-scoped source changes.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---:|---:|---|---|
| Goal Clarity | 0.95 | 0.75 | PASS | One release evidence decision artifact is the goal. |
| Boundary Clarity | 0.95 | 0.70 | PASS | No credential creation or UI redesign. |
| Constraint Clarity | 0.90 | 0.65 | PASS | Privacy and no-overclaiming rules are explicit. |
| Acceptance Criteria | 0.90 | 0.70 | PASS | Commands and artifacts are testable. |
| **Ambiguity** | 0.10 | <=0.20 | PASS | External credentials are the only blocker. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|---|---|---|---|
| 1 | Researcher | Should Phase 25 duplicate Phase 14/15/16 harnesses or consolidate them? | Auto-selected consolidation; existing harnesses stay authoritative. |
| 2 | Security | How should secrets be handled? | Report names/status/origins only; never write credentials or raw account identifiers. |
| 3 | Boundary Keeper | Should missing env pass as "skipped"? | Auto-selected blocked; missing live setup blocks release claims. |
| 4 | Product | Is this a UI phase? | No new runtime UI; only evidence artifacts and existing smoke surfaces are exercised. |
| 5 | Planner | Should CI be included here? | No; Phase 26 owns CI parity and automation. |

---

*Phase: 25-production-evidence-closure-and-live-smoke-execution*
*Spec created: 2026-06-19*
*Next step: $gsd-discuss-phase 25 - implementation decisions*
