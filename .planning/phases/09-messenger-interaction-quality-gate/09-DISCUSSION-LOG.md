# Phase 09: Messenger Interaction Quality Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 09-messenger-interaction-quality-gate
**Areas discussed:** Gate structure and fixture strategy, Backend-backed media/detail proof, Accessibility and keyboard gate, Post-interaction evidence and layout stability, Privacy/fixture isolation/unsupported controls, Verification record and planning hygiene

---

## Gate Structure And Fixture Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| New Phase 09 Playwright spec | Add a dedicated final quality-gate spec while reusing helpers. | Yes |
| Expand existing specs | Put the final gate into current Phase 07/08 specs. | |
| Both | Add a new spec and also heavily rewrite older smoke tests. | |

**User's choice:** Approved recommendation.
**Notes:** The final v1 gate should be clearly separable from historical Phase 07 and Phase 08 evidence.

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 6/7 fixtures | Keep current historical fixture data as the final gate data. | |
| Create Phase 9 fixtures | Use new abstract production-shaped Phase 09 data. | Yes |
| Combine | Mix historical and new fixture data. | |

**User's choice:** Approved recommendation.
**Notes:** Current Phase 08 smoke still imports Phase 06 fixture data, so Phase 09 should avoid reference-fixture dependence.

---

## Backend-Backed Media/Detail Proof

| Option | Description | Selected |
|--------|-------------|----------|
| Backend Vitest only | Prove media/detail contracts only through backend tests. | |
| Playwright mocked UI only | Keep deterministic browser checks as the only proof. | |
| Hybrid | Pair deterministic browser UI with backend/API-backed proof. | Yes |

**User's choice:** Approved recommendation.
**Notes:** This directly addresses the Phase 08 residual risk that Playwright media/detail checks use mocked API fixtures.

---

## Accessibility And Keyboard Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Manual checklist only | Document accessibility review without automated scanner. | |
| Keyboard checks only | Use explicit browser/component keyboard assertions without scanner. | |
| Axe plus keyboard checks | Add `@axe-core/playwright` if compatible and keep targeted keyboard checks. | Yes |

**User's choice:** Approved recommendation.
**Notes:** Automated accessibility scanning is useful, but it does not replace behavior and focus assertions.

| Option | Description | Selected |
|--------|-------------|----------|
| Component-only | Rely only on existing component tests. | |
| Browser-only | Move all keyboard evidence into Playwright. | |
| Layered | Preserve component tests and add assembled browser coverage. | Yes |

**User's choice:** Approved recommendation.
**Notes:** Existing component tests already cover composer, action menu, new chat dialog, and detail drawer focus behavior.

---

## Post-Interaction Evidence And Layout Stability

| Option | Description | Selected |
|--------|-------------|----------|
| First paint | Capture screenshots immediately after render. | |
| After one interaction | Capture after one simple UI action. | |
| After workflow mutations | Capture after representative search, send/retry, detail, attachment, or drawer flows. | Yes |

**User's choice:** Approved recommendation.
**Notes:** The phase exists because static-looking screenshots were insufficient.

| Option | Description | Selected |
|--------|-------------|----------|
| `1440x900` and `390x844` | Keep the prior desktop/mobile matrix as required. | Yes |
| Add more | Require more viewport sizes. | |
| Responsive sweep | Broad viewport scan. | |

**User's choice:** Approved recommendation.
**Notes:** Optional `430x932` can be added if cheap, but is not required.

| Option | Description | Selected |
|--------|-------------|----------|
| Visual screenshots only | Rely on screenshot review for layout stability. | |
| Automated geometry assertions | Assert overflow, composer overlap, drawer/detail bounds, and touch-target stability. | Yes |

**User's choice:** Approved recommendation.
**Notes:** Automated geometry checks should gate interaction-time layout failures.

---

## Privacy, Fixture Isolation, And Unsupported Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Hide all unsupported controls | Remove unsupported controls from the UI. | |
| Allow disabled controls | Keep them only if truly disabled and accessible. | Yes |
| Allow inert buttons | Let enabled controls exist without supported behavior. | |

**User's choice:** Approved recommendation.
**Notes:** Hidden or disabled are both acceptable; enabled dead controls are not.

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime only | Scan production runtime files only. | |
| Evidence only | Scan evidence fixtures only. | |
| Both | Scan runtime and e2e evidence fixtures. | Yes |

**User's choice:** Approved recommendation.
**Notes:** The scan must cover living imagery, realistic avatars/profile photos, and private asset leak patterns.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current guard | Leave the fixture leak guard as-is. | |
| Expand guard | Extend the existing Vitest guard and document `rg` evidence. | Yes |
| Replace with script | Replace the guard with a separate scan script. | |

**User's choice:** Approved recommendation.
**Notes:** The existing guard is a good base but Phase 09 needs broader terms.

---

## Verification Record And Planning Hygiene

| Option | Description | Selected |
|--------|-------------|----------|
| Tolerate retries | Let retries compensate for unstable tests. | |
| Use arbitrary waits | Use sleeps to smooth flaky behavior. | |
| Strict deterministic interactions | Use semantic selectors, test ids when needed, `expect.poll`, and screenshot-after-assertion rules. | Yes |

**User's choice:** Approved recommendation.
**Notes:** Keep trace on first retry, but do not make retries the success strategy.

| Option | Description | Selected |
|--------|-------------|----------|
| Summary only | Put final evidence only in the phase summary. | |
| `09-BEHAVIOR-GATE.md` | Create a dedicated durable evidence artifact. | Yes |
| Many split docs | Split gate evidence across multiple documents. | |

**User's choice:** Approved recommendation.
**Notes:** `09-BEHAVIOR-GATE.md` should exist before final summary.

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend only | Run only frontend checks. | |
| Backend only | Run only backend checks. | |
| Full stack | Run backend tests, frontend tests, lint, build, Playwright, scans, and screenshots. | Yes |

**User's choice:** Approved recommendation.
**Notes:** Phase 09 is a release gate, not a narrow UI smoke.

| Option | Description | Selected |
|--------|-------------|----------|
| Document failures | Record failures without fixing. | |
| Fix all blockers | Repair blocking failures in scope and document only non-blockers. | Yes |
| Classify only | Sort failures before deciding later. | |

**User's choice:** Approved recommendation.
**Notes:** The SPEC makes critical failures blockers for v1 readiness.

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore roadmap drift | Leave `STATE.md` and `ROADMAP.md` inconsistency untouched. | |
| Reconcile during planning | Have Phase 09 planning explicitly account for the Phase 08 status drift. | Yes |

**User's choice:** Approved recommendation.
**Notes:** `STATE.md` says Phase 08 is complete while `ROADMAP.md` still shows Phase 08 unchecked.

| Option | Description | Selected |
|--------|-------------|----------|
| Stage all local changes | Include all dirty files in the workflow commit. | |
| Isolate Phase 09 | Commit only Phase 09 artifacts and normal state update. | Yes |

**User's choice:** Approved recommendation.
**Notes:** The worktree already had unrelated dirty screenshot/config/.gitkeep changes.

---

## the agent's Discretion

- Exact Phase 09 Playwright helper names and fixture names.
- Exact axe test placement if `@axe-core/playwright` is added.
- Exact backend/API-backed proof path for media/detail behavior.
- Exact screenshot names if the four variants live under the Phase 09 directory and are after-interaction captures.

## Deferred Ideas

None.
