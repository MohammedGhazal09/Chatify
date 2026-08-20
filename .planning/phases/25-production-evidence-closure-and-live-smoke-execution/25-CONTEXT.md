# Phase 25: Production Evidence Closure And Live Smoke Execution - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 25 is a release evidence gate. It does not add messenger features; it reconciles deployed production smoke, local two-account smoke, TURN readiness, profile-image visibility, direct/group call readiness, and the v1 readiness decision into one sanitized pass/fail/blocker record.

</domain>

<decisions>
## Implementation Decisions

### Evidence Model
- **D-01:** Keep Phase 14, Phase 15, Phase 16, Phase 17, and Phase 24 artifacts as canonical inputs instead of inventing a second acceptance harness.
- **D-02:** Add one root-level evidence command, `npm run evidence:production`, that writes a Phase 25 artifact and fails while any release blocker remains.
- **D-03:** Treat skipped Playwright smoke tests caused by missing env as blocked release evidence, not as passing quality evidence.

### Security And Privacy
- **D-04:** The evidence script may read environment variables only to determine presence, opt-in status, URL validity, and sanitized URL origins.
- **D-05:** The Phase 25 artifact must never contain raw emails, passwords, cookies, tokens, reset codes, SDP, ICE candidates, or TURN credentials.
- **D-06:** The release decision must keep v1 readiness blocked until live deployed evidence and local cross-user evidence pass with zero blockers.

### Test And Operations
- **D-07:** Run the existing production smoke command and local smoke command during verification, even when they are expected to skip because env is absent.
- **D-08:** Keep `npm run ops:check` as the operational regression guard for runbook/env/readiness documentation.
- **D-09:** Do not modify the messenger runtime UI or `Frontend/Chatify/src/pages/chat/chat.tsx` in this phase.

### the agent's Discretion
- Exact artifact table wording, blocker grouping, and script helper names are delegated to the agent as long as they stay sanitized and falsifiable.

</decisions>

<specifics>
## Specific Ideas

- Prefer a single current Phase 25 decision artifact over another scattered checklist.
- Use existing Playwright gates as behavior truth and the new script as a release decision index.
- Keep blockers concrete enough that the user can set env and rerun without asking what is missing.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current release evidence
- `.planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md` - production smoke readiness artifact.
- `.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-CALL-ACCEPTANCE.md` - local/prod call acceptance artifact.
- `.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-FAILURE-REPORT.md` - call failure and verification map.
- `.planning/phases/16-profile-picture-upload-and-shared-avatar-visibility/16-PROFILE-IMAGE-ACCEPTANCE.md` - profile-image cross-user acceptance artifact.
- `.planning/phases/17-v1-readiness-closure-and-release-gate/17-V1-READINESS.md` - current v1 readiness decision.
- `.planning/phases/24-group-message-sender-names-and-group-voice-video-calls/24-VERIFICATION.md` - group call local verification.

### Existing implementation surfaces
- `Frontend/Chatify/e2e/pages/phase14ProductionAcceptance.ts` - production env validation and artifact writer.
- `Frontend/Chatify/e2e/pages/phase15CallAcceptance.ts` - local call env validation and artifact writer.
- `Frontend/Chatify/e2e/profile-picture.spec.ts` - Phase 16 local profile-image acceptance.
- `docs/operations/production-smoke.md` - production smoke runbook.
- `scripts/ops-check.mjs` - operational documentation and secret regression guard.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Root `package.json` already exposes `smoke:prod`, `smoke:local`, `quality`, and `ops:check`.
- Existing Phase 14 and 15 helpers already redact smoke account identifiers in their own artifacts.
- Phase 16 profile-image smoke already writes a blocked artifact when local prerequisites are missing.

### Established Patterns
- Missing env writes blocked artifacts instead of throwing unstructured failures.
- Production smoke requires explicit opt-in to avoid accidental live account usage.
- Readiness documentation must separate local test confidence from hosted/provider success.

### Integration Points
- Add the Phase 25 evidence script under `scripts/`.
- Add the root npm script to make the gate easy to run locally and from CI later.
- Feed Phase 25 verification from the generated artifact plus Playwright smoke command outcomes.

</code_context>

<deferred>
## Deferred Ideas

- CI automation for this evidence command is Phase 26.
- Fixing voice-message and shared media gaps is Phase 27.
- Abuse reporting, encryption design, and platform notification expansion belong to Phases 28-30.

</deferred>

---

*Phase: 25-production-evidence-closure-and-live-smoke-execution*
*Context gathered: 2026-06-19*
