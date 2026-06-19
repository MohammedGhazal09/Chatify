# Phase 27 Discussion Log

**Date:** 2026-06-19
**Mode:** Auto-approved recommendations

## Questions And Decisions

| Area | Options considered | Approved recommendation | Rationale |
|---|---|---|---|
| Voice scope | Rebuild voice, close test gaps, or defer | Close test gaps | Source already has recorder, preview, protected playback, persistence, and retry surfaces. |
| Production media status | Mark complete, mark blocked, or split status | Mark `MEDIA-04` complete after Phase 25 closure | Requirement explicitly says production; Phase 25 evidence is accepted by maintainer confirmation. |
| Delivery status | Mark complete or keep pending | Mark `DELIV-05` complete after Phase 25 closure | Two-account deployed/local smoke evidence is accepted by maintainer confirmation. |
| Smoke identity | Keep email env only or require username env | Require username env | Direct chat creation is now username-based, so smoke accounts need known usernames. |
| UI review | Visual redesign or current UI review | Current UI review only | Phase 27 is closure, not a new UI surface. |

## Auto-Approved Recommendations

- Use existing local skills: `find-skills`, GSD workflow skills, `react-testing`, `frontend-accessibility`, `playwright-e2e-tester`, `api-sec`, and `code-review`.
- Do not install low-quality external skills because local skills already cover the task.
- Preserve production evidence blockers and avoid release-readiness claims.

## Deferred

- Older E2E specs outside the Phase 27 verification path still contain email-field expectations. They should be cleaned when those suites are brought back into the active gate.
