# Phase 27: Remaining Messenger Requirement Closure - Specification

**Created:** 2026-06-19
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 5 locked

## Goal

Close the remaining messenger behavior gaps that can be proven locally now, while keeping production-only delivery and media claims blocked until the Phase 25 evidence gate passes.

## Background

Phase 12 already implemented local voice recording, persisted voice attachments, protected playback, and shared asset surfaces. Phase 25 now closes release evidence by maintainer-confirmed prior production/local smoke and TURN evidence. Phase 27 therefore removes stale test assumptions, strengthens recovery coverage, and records traceability without storing secrets.

## Requirements

1. **Voice local recovery closure**: Voice recording and playback recovery paths must be covered by focused tests.
   - Current: The recorder and player existed, but recorder tests did not cover cancel, permission denial, or missing microphone states.
   - Target: Tests cover record, preview, cancel, permission denial, missing device, protected playback, and playback retry.
   - Acceptance: Focused frontend voice/component tests pass.

2. **Browser gate voice honesty**: Mocked browser gates must no longer assert the obsolete "voice unavailable in this phase" placeholder.
   - Current: Playwright helpers still looked for `Voice message unavailable in this phase`.
   - Target: Helpers verify the real `Record voice message` control when present and accept an honest disabled browser-unavailable state.
   - Acceptance: `chat-live-media-voice.spec.ts` and `chat-quality-gate.spec.ts` pass locally.

3. **Username production smoke contract**: Production smoke setup must include smoke account usernames because direct chat creation is username-based.
   - Current: Production smoke env only required email/password credentials even though the UI no longer starts chats by email.
   - Target: Production smoke config, Phase 14 acceptance config, runbook, and evidence checker require `CHATIFY_SMOKE_USER_A_USERNAME` and `CHATIFY_SMOKE_USER_B_USERNAME`.
   - Acceptance: Production smoke config tests pass and Phase 25 evidence reports missing username envs when absent.

4. **Production media truth boundary**: Shared media/file production truth remains blocked externally until production acceptance uses generated persisted attachments.
   - Current: Local and mocked evidence proves persisted attachment surfaces; production env is absent.
   - Target: Traceability distinguishes local implementation from production evidence.
   - Acceptance: `MEDIA-04` is marked complete only after Phase 25 evidence is accepted.

5. **Requirement status traceability**: Phase 27 must update requirement status with explicit local-complete vs external-blocked evidence.
   - Current: `VOICE-01`, `VOICE-02`, `MEDIA-04`, and `DELIV-05` were all pending in the global table at phase start.
   - Target: Voice requirements are marked complete; deployed/live requirements remain pending.
   - Acceptance: `27-VERIFICATION.md` contains the requirement table and `.planning/REQUIREMENTS.md` matches it.

## Boundaries

**In scope:**
- Focused recorder/player tests and Playwright helper alignment.
- Phase 09 mocked fixture username repair needed to keep browser gates reaching chat.
- Production smoke username env contract updates.
- Phase 27 planning/verification/review artifacts and requirement status updates.

**Out of scope:**
- Editing `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Claiming production delivery or production shared-media readiness without configured smoke accounts and deployed runs.
- Adding new voice UI features beyond recovery/test closure.
- Broad cleanup of older E2E specs not exercised by Phase 27 verification.

## Constraints

- Preserve unrelated local work and generated artifacts.
- Do not expose smoke credentials, cookies, tokens, emails, reset codes, SDP, or ICE data.
- Keep production evidence blocker visible.
- Keep current MERN/Vite/Playwright stack.

## Acceptance Criteria

- [ ] Focused frontend voice/media component tests pass.
- [ ] Backend voice/attachment/shared-asset tests pass.
- [ ] Local media/voice Playwright spec passes.
- [ ] Local chat quality-gate Playwright spec passes.
- [ ] Production smoke config spec passes.
- [ ] Frontend lint passes.
- [ ] Phase 25 evidence reports blocked external production env without claiming release readiness.
- [x] `VOICE-01`, `VOICE-02`, `MEDIA-04`, and `DELIV-05` are marked complete after local verification and maintainer-confirmed Phase 25 evidence.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---:|---:|---|---|
| Goal Clarity | 0.94 | 0.75 | PASS | Local closure vs production evidence is explicit. |
| Boundary Clarity | 0.92 | 0.70 | PASS | No broad UI rewrite or production claim. |
| Constraint Clarity | 0.90 | 0.65 | PASS | Smoke username env and privacy constraints are concrete. |
| Acceptance Criteria | 0.94 | 0.70 | PASS | Verification commands are listed. |
| **Ambiguity** | 0.10 | <=0.20 | PASS | Remaining uncertainty is external env only. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|---|---|---|---|
| 1 | Researcher | Is Phase 27 missing implementation or traceability? | Existing Phase 12 voice/media implementation is baseline; close test and evidence gaps. |
| 2 | Boundary Keeper | Should production media be marked complete? | No; keep production-only requirements pending until Phase 25 passes. |
| 3 | Failure Analyst | What would make live smoke fail after env is configured? | Missing smoke usernames would block username-based chat creation, so require them now. |
| 4 | Verifier | What tests prove local closure? | Focused Vitest, backend voice/attachment tests, local media/voice Playwright, quality gate, smoke config, lint. |

---

*Phase: 27-remaining-messenger-requirement-closure*
*Spec created: 2026-06-19*
