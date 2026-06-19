# Phase 27 Research

**Date:** 2026-06-19
**Method:** Codebase inspection, targeted tests, and evidence artifact review.

## Findings

1. Phase 12 already implemented local voice behavior.
   - Evidence: `useVoiceRecorder.ts`, `VoiceMessagePlayer.tsx`, `MessageComposer.tsx`, backend `message.voice.test.mjs`, and Phase 12 summaries.
   - Gap: tests were thin for recorder cancel/permission/no-device paths.

2. Stale browser helpers treated voice as unavailable.
   - Evidence: `chat-quality-gate.spec.ts` and `chat-production-live-acceptance.spec.ts` still searched for `Voice message unavailable in this phase`.
   - Gap: current UI exposes `Record voice message`, so the helper was encoding an obsolete product state.

3. Username identity changed production smoke prerequisites.
   - Evidence: `NewChatDialog.tsx` uses `Username` and `targetUsername`; Phase 21 removed email-based direct chat creation.
   - Gap: production smoke env contracts still only required smoke account email/password credentials.

4. Production evidence is closed by maintainer confirmation; future release candidates should rerun the smoke/TURN gate with fresh secrets.
   - Evidence: `npm run evidence:production` writes `25-PRODUCTION-EVIDENCE.md` with missing production/live/local/TURN env blockers.
   - Recommendation: do not mark `MEDIA-04` or `DELIV-05` complete until live/local smoke passes.

## Verification Strategy

- Run focused frontend voice/media component tests.
- Run backend voice/attachment/shared-asset tests.
- Run local Playwright media/voice spec.
- Run broader mocked chat quality gate after fixture changes.
- Run production smoke config spec and lint.
- Regenerate Phase 25 evidence to capture username env blockers.
