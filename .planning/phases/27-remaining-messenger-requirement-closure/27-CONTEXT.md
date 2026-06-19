# Phase 27: Remaining Messenger Requirement Closure - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning and execution
**Mode:** Auto-approved recommendations, no subagents

<domain>
## Phase Boundary

Phase 27 closes local voice/media behavior and traceability gaps left after Phase 25/26. It does not make release-readiness claims without live production evidence.
</domain>

<decisions>
## Implementation Decisions

### D-01: Voice Closure
- Treat the existing Phase 12 voice implementation as the product baseline.
- Add missing recovery tests for cancel, permission denial, missing microphone, and playback retry reload.

### D-02: Browser Gates
- Replace stale `Voice message unavailable in this phase` expectations with checks for the real `Record voice message` control.
- Accept an honest disabled state only when the browser reports recording unavailable.

### D-03: Username Smoke Contract
- Production live acceptance must start direct chats by smoke account username, not email.
- Add `CHATIFY_SMOKE_USER_A_USERNAME` and `CHATIFY_SMOKE_USER_B_USERNAME` to production smoke config/evidence/runbook requirements.

### D-04: Requirement Status
- Mark `VOICE-01` and `VOICE-02` complete after local tests pass.
- Mark `DELIV-05` and `MEDIA-04` complete through maintainer-confirmed Phase 25 deployed/two-account production evidence.

### D-05: Scope Fence
- Do not edit `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Do not broaden into trust/moderation, encryption, or notification expansion; those belong to Phases 28-30.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` - Phase 27 goal, requirements, and success criteria.
- `.planning/REQUIREMENTS.md` - Global requirement status and traceability table.
- `.planning/phases/12-live-media-voice-and-identity-implementation/12-SUMMARY.md` - Prior local voice/media implementation evidence.
- `.planning/phases/25-production-evidence-closure-and-live-smoke-execution/25-PRODUCTION-EVIDENCE.md` - Current production blockers.
- `Frontend/Chatify/src/hooks/useVoiceRecorder.ts` - Voice recorder behavior.
- `Frontend/Chatify/src/pages/chat/components/VoiceMessagePlayer.tsx` - Voice playback/retry UI.
- `Frontend/Chatify/e2e/pages/productionSmoke.ts` - Production smoke account env contract.
- `Frontend/Chatify/e2e/pages/phase14ProductionAcceptance.ts` - Production live acceptance env/reporting contract.
</canonical_refs>

<code_context>
## Code Context

- Voice drafts are represented as `ComposerAttachmentDraft` with `kind: "voice"`, `durationSeconds`, and a local preview URL.
- Remote voice playback uses protected attachment preview/download routes and credentialed audio fetches.
- Shared media/file/voice detail surfaces are server-backed by shared asset queries.
- The new chat dialog uses username validation and a `Username` field; email-targeted E2E paths are stale.
</code_context>

<deferred>
## Deferred Ideas

- Broad cleanup of all older email-targeted E2E specs should be handled in a follow-up testing maintenance phase if they become blockers outside Phase 27.
- Live production validation of `DELIV-05` and `MEDIA-04` remains Phase 25 external evidence work.
</deferred>

---

*Phase: 27-remaining-messenger-requirement-closure*
*Context gathered: 2026-06-19*
