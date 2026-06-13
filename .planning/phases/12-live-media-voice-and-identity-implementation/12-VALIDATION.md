---
phase: 12
slug: live-media-voice-and-identity-implementation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-13
blocked_by_ui_spec: true
---

# Phase 12 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Gate Status

Validation architecture is drafted from research, but it cannot be final until `12-UI-SPEC.md` and concrete `12-xx-PLAN.md` files exist.

Recommendation: after `$gsd-ui-phase 12`, update this file with exact plan task IDs and mark `nyquist_compliant: true` only after every task has automated verification or an explicit Wave 0 dependency.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Backend framework | Vitest, Supertest, mongodb-memory-server |
| Backend config file | `Backend/Chatify/vitest.config.mjs` |
| Backend quick command | `npm test -- test/message/message.attachments.test.mjs` from `Backend/Chatify` as the current pattern; replace the file with the targeted Phase 12 test per task |
| Backend full command | `npm test` from `Backend/Chatify` |
| Frontend framework | Vitest, Testing Library, jsdom |
| Frontend config file | `Frontend/Chatify/vite.config.ts` / Vitest through Vite |
| Frontend quick command | `npm run test -- src/pages/chat/components/MessageComposer.test.tsx` from `Frontend/Chatify` as the current pattern; replace the file with the targeted Phase 12 test per task |
| Frontend full command | `npm run test` from `Frontend/Chatify` |
| Frontend lint command | `npm run lint` from `Frontend/Chatify` |
| Frontend build command | `npm run build` from `Frontend/Chatify` |
| Browser smoke command | targeted `npm run test:ui -- <spec>` from `Frontend/Chatify`, then full `npm run test:ui` before summary when practical |
| Estimated quick feedback | 30-120 seconds depending on targeted suite |

## Sampling Rate

- After every backend contract task: run the targeted backend Vitest file first, then `npm test` before the slice completes.
- After every frontend hook/component task: run the targeted Vitest file first, then `npm run test` before the slice completes.
- After every browser-facing UX task: run a mocked-media component test immediately, then a targeted Playwright smoke when the UI is wired.
- After every plan slice: run backend full tests, frontend full tests, lint, and build unless the slice is documentation-only.
- Before `$gsd-verify-work`: backend tests, frontend tests, lint, build, static fixture guard, and targeted browser smoke must be green or documented with an approved blocker.
- Max feedback gap: no more than two implementation tasks without an automated check.

## Per-Slice Verification Map

| Slice | Requirement | Secure behavior | Test type | Automated command | Status |
|-------|-------------|-----------------|-----------|-------------------|--------|
| 12-01 identity | ID-01 | Identity mark persists and propagates to all chat surfaces without arbitrary URL input | backend + frontend component | targeted user controller/API/auth store/settings tests | pending |
| 12-01 identity privacy | ID-02 | Invalid/living/default identity payloads are rejected or absent; deterministic abstract fallback exists | backend + fixture guard | backend identity validation + `npm run test -- fixtureLeakGuard` equivalent | pending |
| 12-02 upload send state | MEDIA-01 | Progress, cancel, abort, failed, and retry states do not create duplicate persisted messages | frontend hook + backend idempotency | send hook tests + message idempotency tests | pending |
| 12-02 protected media/file | MEDIA-02 | Protected preview/download remain membership-checked after contract changes | backend request | attachment authorization tests | pending |
| 12-02 voice contract | VOICE-01 | Voice message persists as `kind: "voice"` with duration and protected asset metadata | backend + frontend types/API | voice create/history/realtime tests | pending |
| 12-02 voice failures | VOICE-02 | Unsupported type, oversize, over-duration, permission, upload, retry, and playback errors recover safely | backend + frontend component | voice validation + recorder/player tests | pending |
| 12-03 shared asset truth | MEDIA-04 | Shared media/files/voice are server-derived only and update after send/reload/search/pagination/realtime | backend + frontend + browser | shared asset tests + socket invalidation + Playwright smoke | pending |
| 12-03 block/delete/privacy | Phase 11 dependency + MEDIA/VOICE | Blocked or unauthorized users cannot send/play/download; delete visibility is enforced | backend + socket + frontend | blocking, delete, protected asset, and UI disabled-state tests | pending |
| 12-03 production boundary | TEST-05 | Desktop/mobile/light/dark behavior has evidence, but live production acceptance is not claimed | browser + docs | targeted Playwright + lint/build + summary evidence | pending |

## Wave 0 Requirements

- [ ] Add exact plan task IDs after `12-xx-PLAN.md` files exist.
- [ ] Replace the placeholder targeted backend/frontend quick commands with the exact Phase 12 test files after plan tasks exist.
- [ ] Add or extend frontend test utilities for mocked `MediaRecorder`, mocked `navigator.mediaDevices.getUserMedia`, and synthetic `Blob`/`File` objects.
- [ ] Add upload-progress and abort-controller mocks around `messageApi.createMessage` and `useSendMessage`.
- [ ] Add fixture/static guard patterns for static voice assets, hardcoded shared cards, first-party living-being identity defaults, public storage keys, raw hashes, and protected URL leakage.
- [ ] Verify Phase 11 completion evidence or require `11-SUMMARY.md` before block-dependent Phase 12 execution claims.
- [ ] Run `$gsd-ui-phase 12` and attach UI acceptance expectations before implementation planning.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Final deployed Vercel/Render product acceptance | Phase 14 boundary | Production-live acceptance is explicitly deferred from Phase 12 | Do not claim in Phase 12. Record remaining live production validation for Phase 14. |

All Phase 12 implementation behavior should otherwise have automated coverage through backend, frontend, mocked browser media, or static guard tests.

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies.
- [ ] Sampling continuity: no three consecutive tasks without automated verify.
- [ ] Wave 0 covers all missing test infrastructure.
- [ ] No watch-mode flags in recorded verification commands.
- [ ] Feedback latency stays within the agreed 30-120 second quick-check range where possible.
- [ ] `nyquist_compliant: true` is set after concrete task mapping exists.

**Approval:** pending UI spec and Phase 12 plan files.
