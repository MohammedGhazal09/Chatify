# Phase 50: Release Candidate Evidence And Production Smoke Refresh - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 50 refreshes release-candidate evidence by reusing the current smoke, production evidence, operations, and browser visual QA tooling. It records current blockers truthfully and does not add product features.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `50-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `50-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Add a Phase 50 evidence command that reuses the existing production evidence checker.
- Generate a current sanitized release-candidate evidence artifact.
- Rerun production smoke config, operations guard, and focused browser visual QA.
- Write Phase 50 summaries, visual QA, UI review, code review, and verification artifacts.

**Out of scope (from SPEC.md):**
- Supplying or storing production credentials - secrets must stay outside the repo.
- Running destructive production admin actions - smoke must remain bounded to existing safe test flows.
- Changing deployment infrastructure - Phase 50 reports readiness, it does not deploy.
- Adding new product features - later phases cover admin hub, encryption hardening, privacy workers, and bots.

</spec_lock>

<decisions>
## Implementation Decisions

### Evidence Command
- **D-01:** Reuse `scripts/production-evidence-check.mjs` with a Phase 50 profile instead of creating a second checker.
- **D-02:** Keep `npm run evidence:production` writing the Phase 25 artifact; add `npm run evidence:release-candidate` for Phase 50.
- **D-03:** Missing smoke or TURN env remains `blocked`, not `passed`, because this shell does not own production credentials.

### Verification Scope
- **D-04:** Rerun `production-smoke-config.spec.ts`, `ops:check`, and the new evidence command as the local release-candidate gate.
- **D-05:** Use focused Playwright fallback visual QA for the existing chat and admin delivery-health routes. This is the correct fallback because the Hercules local runners require external provider setup or subagent-style runners.

### Privacy And Reporting
- **D-06:** Reports may list env var names and sanitized origins only; they must not store raw credentials, cookies, emails, messages, SDP, ICE, or TURN credential values.
- **D-07:** Phase 50 verification must state that hosted/provider success is not claimed unless current live smoke and TURN checks pass.

### the agent's Discretion
- Choose the smallest focused command set that proves the release evidence boundary without rerunning the entire suite when narrower checks cover the requirement.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/phases/50-release-candidate-evidence-and-production-smoke-refresh/50-SPEC.md` - locked Phase 50 requirements and boundaries.
- `.planning/STATE.md` - release-candidate rerun todo and production smoke blocker history.
- `.planning/REQUIREMENTS.md` - traceability for PROD, DELIV, TEST, and v2 evidence boundaries.

### Existing Evidence Tooling
- `package.json` - root quality, smoke, evidence, and operations scripts.
- `scripts/production-evidence-check.mjs` - sanitized production evidence contract.
- `scripts/ops-check.mjs` - operations readiness guard.
- `Frontend/Chatify/e2e/production-smoke-config.spec.ts` - production smoke environment config tests.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` - deterministic chat visual smoke.
- `Frontend/Chatify/e2e/admin-delivery-health.spec.ts` - deterministic admin delivery-health visual smoke.

### Prior Evidence
- `.planning/phases/25-production-evidence-closure-and-live-smoke-execution/25-PRODUCTION-EVIDENCE.md` - previous evidence artifact shape.
- `.planning/phases/25-production-evidence-closure-and-live-smoke-execution/25-VERIFICATION.md` - historical user-confirmed production boundary.
- `.planning/phases/26-ci-quality-parity-and-release-gate-automation/26-VERIFICATION.md` - CI quality gate and release evidence policy.
- `.planning/phases/49-delivery-health-dashboard/49-VISUAL-QA.md` - visual QA report format and Hercules fallback note.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/production-evidence-check.mjs`: already has env contract checks, artifact status parsing, sanitized report writing, and nonzero exit on blocked evidence.
- `scripts/ops-check.mjs`: already validates root scripts, env examples, runbooks, readiness components, and obvious secret leaks.
- Existing Playwright specs: already provide deterministic mocked browser surfaces with screenshots and no real credentials.

### Established Patterns
- Release evidence records blockers as markdown artifacts instead of hiding missing secrets.
- Playwright fallback visual QA is acceptable when Hercules cannot run without provider keys or subagents.
- Root npm scripts proxy into frontend/backend package scripts instead of duplicating command logic.

### Integration Points
- Root `package.json` scripts.
- `.planning/phases/50-release-candidate-evidence-and-production-smoke-refresh/` for all Phase 50 evidence artifacts.
- Existing Playwright screenshot artifact paths can be redirected with `HERCULES_ARTIFACT_DIR` for admin delivery-health and `CHATIFY_CHAT_SMOKE_ARTIFACT_DIR` for chat smoke.

</code_context>

<specifics>
## Specific Ideas

Use the existing evidence checker as the single source of truth and parameterize only the report profile.

</specifics>

<deferred>
## Deferred Ideas

- Actual live production smoke with real accounts and TURN secrets remains deferred to a secret-bearing shell or CI release context.
- Release deployment, branch protection, and provider configuration changes remain outside Phase 50.

</deferred>

---

*Phase: 50-release-candidate-evidence-and-production-smoke-refresh*
*Context gathered: 2026-07-01*
