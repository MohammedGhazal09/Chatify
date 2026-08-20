---
phase: 4
slug: messenger-ui-reconstruction
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-08
---

# Phase 04 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.8 |
| **Config file** | `Frontend/Chatify/vite.config.ts` after Plan 04-03 adds `test` config |
| **Quick run command** | `cd Frontend/Chatify; npm test -- --run src/hooks/messageCache.test.ts` |
| **Full suite command** | `cd Frontend/Chatify; npm test` |
| **Estimated runtime** | ~1-5 seconds for tests before DOM suite growth |

## Sampling Rate

- **After every task commit:** Run the task-specific verify command from the active PLAN.md.
- **After every plan wave:** Run `cd Frontend/Chatify; npm test`, `npm run lint`, and `npm run build`.
- **Before `$gsd-verify-work`:** Full frontend test, lint, build, and smoke evidence must be green or explicitly documented as skipped with reason.
- **Max feedback latency:** 120 seconds for automated commands.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | UI-06 | T-04-01 | Preserve Query-owned message state while extracting UI state | source/build | `cd Frontend/Chatify; npm run build` | yes | pending |
| 04-01-02 | 01 | 1 | UI-01, UI-04, UI-06 | T-04-01 | Component props do not expose unauthorized data beyond existing hooks | source/build | `cd Frontend/Chatify; npm run build` | yes | pending |
| 04-01-03 | 01 | 1 | UI-01, UI-06 | T-04-01 | No backend/API contract changes | lint/build/test | `cd Frontend/Chatify; npm test; npm run lint; npm run build` | yes | pending |
| 04-02-01 | 02 | 2 | UI-01, UI-05 | T-04-02 | Layout does not hide private state behind overlapping UI | lint/build | `cd Frontend/Chatify; npm run lint; npm run build` | yes | pending |
| 04-02-02 | 02 | 2 | UI-02, UI-03 | T-04-02 | Failed/session/offline states remain visible and recoverable | lint/build | `cd Frontend/Chatify; npm run lint; npm run build` | yes | pending |
| 04-02-03 | 02 | 2 | UI-04, UI-05 | T-04-03 | Actions are keyboard-accessible and not hover-only | lint/build | `cd Frontend/Chatify; npm run lint; npm run build` | yes | pending |
| 04-03-01 | 03 | 3 | TEST-03 | T-04-04 | Test runtime isolates DOM assertions from live auth/socket services | test | `cd Frontend/Chatify; npm test` | no until task | pending |
| 04-03-02 | 03 | 3 | TEST-03, UI-02, UI-03, UI-04 | T-04-04 | Tests cover failed-send/session/action regressions | test | `cd Frontend/Chatify; npm test` | no until task | pending |
| 04-03-03 | 03 | 3 | UI-01, UI-05, TEST-03 | T-04-04 | Smoke evidence records desktop/mobile layout result | test/lint/build | `cd Frontend/Chatify; npm test; npm run lint; npm run build` | no until task | pending |

*Status: pending, green, red, flaky.*

## Wave 0 Requirements

- Existing `Frontend/Chatify/src/hooks/messageCache.test.ts` covers Phase 3 helper behavior before Phase 4 starts.
- Plan 04-03 installs `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, and `jsdom` before any DOM component tests are required.
- No separate Wave 0 plan is required because existing frontend `npm test`, `npm run lint`, and `npm run build` are green before planning.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop visual framing | UI-01, UI-05 | jsdom cannot measure real viewport overlap | Run the frontend at about 1440px width and verify sidebar, header, message list, composer, and actions are visible without overlap. |
| Mobile drawer/composer framing | UI-01, UI-04, UI-05 | jsdom cannot verify actual drawer geometry | Run the frontend at about 390px width and verify drawer open/close, composer visibility, and action menu placement. |

## Validation Sign-Off

- [x] All tasks have automated verify commands or a documented setup dependency in Plan 04-03.
- [x] Sampling continuity: no 3 consecutive tasks without automated verification.
- [x] Existing helper test infrastructure covers Phase 3 canonical behavior before DOM test setup.
- [x] No watch-mode flags are required.
- [x] Feedback latency target is under 120 seconds for automated commands.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** approved 2026-06-08
