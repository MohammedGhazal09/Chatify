---
phase: 03
slug: canonical-message-state
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-08
---

# Phase 03 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Backend Vitest; frontend Vitest to be added in Plan 03-02 |
| Config file | `Backend/Chatify/vitest.config.mjs`; frontend config created by Plan 03-02 |
| Quick run command | `cd Backend/Chatify; npm test -- <target test file>` or `cd Frontend/Chatify; npm test -- --run <target test file>` |
| Full suite command | `cd Backend/Chatify; npm test`; `cd Frontend/Chatify; npm test -- --run`; `cd Frontend/Chatify; npm run lint`; `cd Frontend/Chatify; npm run build` |
| Estimated runtime | Backend target tests under 60s each; full backend/frontend verification under 3 minutes locally |

## Sampling Rate

- After every backend task commit: run the task's focused backend Vitest command.
- After every frontend task commit: run the focused frontend Vitest command once Plan 03-02 creates the runner.
- After every plan wave: run that wave's full listed verification.
- Before `$gsd-verify-work`: backend full suite, frontend tests, frontend lint, and frontend build must be green.
- Max feedback latency: 90 seconds for focused checks.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | MSG-01 MSG-07 | T-03-01 | Schema/index contract prevents duplicate persisted identities and aligned validation drift. | backend unit/integration | `cd Backend/Chatify; npm test -- test/message/message.idempotency.test.mjs` | W0 | pending |
| 03-01-02 | 01 | 1 | MSG-01 MSG-05 | T-03-02 | Duplicate create does not forge sender, duplicate rows, or re-emit side effects. | backend integration/socket | `cd Backend/Chatify; npm test -- test/message/message.idempotency.test.mjs test/socket/socket.message-state.test.mjs` | W0 | pending |
| 03-01-03 | 01 | 1 | MSG-01 MSG-05 | T-03-03 | Status/read transitions are monotonic and unread counts are per-user. | backend integration | `cd Backend/Chatify; npm test -- test/message/message.status-unread.test.mjs` | W0 | pending |
| 03-01-04 | 01 | 1 | MSG-03 MSG-04 MSG-07 | T-03-04 | Edit/delete/reaction routes enforce membership, sender ownership, visibility, bounds, and tombstone rules. | backend integration | `cd Backend/Chatify; npm test -- test/message/message.mutations.test.mjs` | W0 | pending |
| 03-02-01 | 02 | 2 | MSG-02 | T-03-05 | Frontend test runner exists before cache helper work lands. | frontend setup | `cd Frontend/Chatify; npm test -- --run` | No | pending |
| 03-02-02 | 02 | 2 | MSG-01 MSG-02 | T-03-06 | API/types stop trusting client sender and model canonical payloads. | frontend unit/typecheck | `cd Frontend/Chatify; npm test -- --run; npm run build` | No | pending |
| 03-02-03 | 02 | 2 | MSG-01 MSG-02 MSG-05 | T-03-07 | Optimistic, HTTP, socket, and refetch payloads converge without duplicate or lost messages. | frontend unit | `cd Frontend/Chatify; npm test -- --run src/hooks/messageCache.test.ts` | No | pending |
| 03-02-04 | 02 | 2 | MSG-02 MSG-05 | T-03-08 | Socket/unread events apply server truth without per-page merge drift. | frontend unit/build | `cd Frontend/Chatify; npm test -- --run; npm run build` | No | pending |
| 03-03-01 | 03 | 3 | MSG-03 MSG-06 | T-03-09 | Cursor history is stable and filters user-deleted messages. | backend integration | `cd Backend/Chatify; npm test -- test/message/message.pagination.test.mjs` | W0 | pending |
| 03-03-02 | 03 | 3 | MSG-03 MSG-06 | T-03-10 | Frontend cursor prepend dedupes and avoids offset state. | frontend unit | `cd Frontend/Chatify; npm test -- --run src/hooks/messageCache.test.ts` | No | pending |
| 03-03-03 | 03 | 3 | MSG-04 MSG-07 | T-03-11 | Create/edit/reaction boundaries are consistent across backend model/controller/frontend helper rules. | backend/frontend | `cd Backend/Chatify; npm test -- test/message/message.mutations.test.mjs; cd ../../Frontend/Chatify; npm test -- --run` | Mixed | pending |
| 03-03-04 | 03 | 3 | MSG-01 MSG-02 MSG-03 MSG-04 MSG-05 MSG-06 MSG-07 | T-03-12 | Full state contract is regression-tested before phase completion. | full suite | `cd Backend/Chatify; npm test; cd ../../Frontend/Chatify; npm test -- --run; npm run lint; npm run build` | Mixed | pending |

## Wave 0 Requirements

- [ ] `Backend/Chatify/test/message/message.idempotency.test.mjs`
- [ ] `Backend/Chatify/test/message/message.status-unread.test.mjs`
- [ ] `Backend/Chatify/test/message/message.mutations.test.mjs`
- [ ] `Backend/Chatify/test/message/message.pagination.test.mjs`
- [ ] `Backend/Chatify/test/socket/socket.message-state.test.mjs`
- [ ] `Frontend/Chatify/vitest.config.ts` or equivalent frontend Vitest config
- [ ] `Frontend/Chatify/src/hooks/messageCache.test.ts` or equivalent focused helper test file

## Manual-Only Verifications

All Phase 3 behaviors have automated verification targets. Manual browser review is optional after execution because Phase 4 owns visual reconstruction.

## Validation Sign-Off

- [x] All tasks have automated verify commands or Wave 0 setup tasks.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all missing frontend/backend test file references.
- [x] No watch-mode flags.
- [x] Feedback latency target is under 90 seconds for focused checks.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** planned 2026-06-08

