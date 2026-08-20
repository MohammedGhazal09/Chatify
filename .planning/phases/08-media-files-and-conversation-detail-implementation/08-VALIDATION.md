---
phase: 08
slug: media-files-and-conversation-detail-implementation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-12
---

# Phase 08 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | Vitest with Supertest and mongodb-memory-server |
| **Backend config file** | `Backend/Chatify/vitest.config.mjs` |
| **Frontend framework** | Vitest, React Testing Library, Playwright |
| **Frontend config files** | `Frontend/Chatify/vitest.config.ts`, `Frontend/Chatify/playwright.config.ts` |
| **Quick run command** | `cd Backend/Chatify; npm test` and `cd Frontend/Chatify; npm run test` |
| **Full suite command** | `cd Backend/Chatify; npm test`; `cd Frontend/Chatify; npm run test`; `cd Frontend/Chatify; npm run lint`; `cd Frontend/Chatify; npm run build`; `cd Frontend/Chatify; npm run test:ui` |
| **Estimated runtime** | To be measured during execution |

---

## Sampling Rate

- **After every backend task commit:** Run `cd Backend/Chatify; npm test`
- **After every frontend task commit:** Run `cd Frontend/Chatify; npm run test`
- **After every plan wave:** Run backend tests, frontend tests, lint, and build.
- **Before `$gsd-verify-work`:** Run backend tests, frontend tests, lint, build, and Playwright UI tests.
- **Max feedback latency:** No more than one task may land without a relevant automated test command.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | MEDIA-01, MEDIA-02, MSG-03, MSG-04 | T-08-01 | Attachments require auth, membership, visibility, type, size, and count validation | backend integration | `cd Backend/Chatify; npm test` | yes | pending |
| 08-01-02 | 01 | 1 | MEDIA-01, MEDIA-02, MSG-03, MSG-04 | T-08-02 | Preview/download never exposes public URLs or private storage ids | backend integration | `cd Backend/Chatify; npm test` | yes | pending |
| 08-02-01 | 02 | 2 | MEDIA-01, PARITY-01, PARITY-02, UI-01, UI-02, UI-04, UI-05 | T-08-03 | Composer validates and recovers from attachment send failures without static fixtures | frontend component/hook | `cd Frontend/Chatify; npm run test` | yes | pending |
| 08-02-02 | 02 | 2 | MEDIA-02, MEDIA-03, PARITY-01, PARITY-02, UI-01, UI-05 | T-08-04 | Bubbles, rail, and mobile detail drawer render server-backed attachment/detail state | frontend component/hook | `cd Frontend/Chatify; npm run test` | yes | pending |
| 08-03-01 | 03 | 3 | MEDIA-02, MEDIA-03, TEST-05 | T-08-05 | Pin/detail socket events are room-scoped and unauthorized users do not receive or fetch data | backend/socket/frontend | `cd Backend/Chatify; npm test` and `cd Frontend/Chatify; npm run test` | yes | pending |
| 08-03-02 | 03 | 3 | TEST-05, PARITY-01, PARITY-02, UI-04, UI-05 | T-08-06 | Behavior-first Playwright evidence proves upload, preview, download, pin, and detail workflows across themes/viewports | e2e | `cd Frontend/Chatify; npm run test:ui` | yes | pending |

*Status: pending, green, red, flaky*

---

## Wave 0 Requirements

Existing infrastructure covers the expected Phase 08 verification paths:

- Backend Vitest/Supertest/mongodb-memory-server scripts exist in `Backend/Chatify/package.json`.
- Frontend Vitest, Playwright, lint, and build scripts exist in `Frontend/Chatify/package.json`.
- Existing message, socket, query, component, and Playwright tests provide patterns to extend.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Final screenshot review for reference visual parity | UI-01, UI-05, TEST-05 | Screenshots need a final human sanity pass for visual drift after behavior interactions | Review captured desktop/mobile light/dark screenshots after Playwright runs and compare against Phase 06 reference intent. |

---

## Validation Sign-Off

- [x] All planned task groups have an automated verification route.
- [x] Sampling continuity has no planned gap longer than one task.
- [x] Existing test infrastructure covers the phase; no Wave 0 install required.
- [x] No watch-mode commands are listed.
- [x] `nyquist_compliant: true` set in frontmatter.

**Approval:** pending execution
