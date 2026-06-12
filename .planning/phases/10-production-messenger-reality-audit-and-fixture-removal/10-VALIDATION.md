---
phase: 10
slug: production-messenger-reality-audit-and-fixture-removal
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-13
---

# Phase 10 - Validation Strategy

> Per-phase validation contract for production-reality auditing, fixture removal, and desktop/mobile detail parity.

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest, Testing Library, Playwright |
| **Config file** | `Frontend/Chatify/vitest.config.ts`, `Frontend/Chatify/playwright.config.ts` |
| **Quick run command** | `cd Frontend/Chatify; npm test -- --run src/pages/chat/fixtureLeakGuard.test.ts src/pages/chat/components/ChatContextRail.test.tsx src/pages/chat/components/ConversationDetailDrawer.test.tsx` |
| **Full suite command** | `cd Frontend/Chatify; npm run lint; npm run build; npm run test:ui -- --grep "Phase 10 production messenger reality"` |
| **Production smoke command** | `cd Frontend/Chatify; $env:CHATIFY_PRODUCTION_SMOKE='1'; npm run test:ui -- --grep "Phase 10 production smoke"` |
| **Estimated runtime** | Quick: under 30 seconds. Full local gate: 2-5 minutes. Production smoke: environment-dependent. |

## Sampling Rate

- **After every task commit:** Run the quick Vitest command for the touched rail/drawer/guard surface.
- **After every plan wave:** Run lint, build, and the matching Playwright grep for that wave.
- **Before `$gsd-verify-work`:** Full local gate must be green, and production smoke must be either green or explicitly blocked by missing smoke credentials/production availability.
- **Max feedback latency:** 5 minutes for local validation. Production smoke may exceed this only when production services are slow or unavailable.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | PROD-01, TEST-05 | T-10-01, T-10-02 | Production smoke credentials stay env-only; live smoke cannot use mocked Chatify routes | e2e | `npm run test:ui -- --grep "Phase 10 production smoke"` | W0 | pending |
| 10-01-02 | 01 | 1 | PROD-01, PROD-02 | T-10-02, T-10-06 | Live audit records real production status and redacts private data | artifact | manual review of `10-PRODUCTION-AUDIT.md` | W0 | pending |
| 10-02-01 | 02 | 2 | PROD-03, PARITY-01 | T-10-05 | Desktop rail closes, reopens, handles Escape, and returns focus | component/e2e | `npm test -- --run src/pages/chat/components/ChatContextRail.test.tsx` | W0 | pending |
| 10-02-02 | 02 | 2 | PARITY-02, TEST-05 | T-10-05 | Mobile drawer remains closeable with focus return and shared content parity | component/e2e | `npm test -- --run src/pages/chat/components/ConversationDetailDrawer.test.tsx` | W0 | pending |
| 10-02-03 | 02 | 2 | PROD-03, PARITY-01, PARITY-02 | T-10-03, T-10-04 | Detail content renders server-backed data states and honest unavailable controls | component/e2e | `npm run test:ui -- --grep "Phase 10 production messenger reality"` | W0 | pending |
| 10-03-01 | 03 | 3 | PROD-02, TEST-05 | T-10-03, T-10-04 | Runtime source cannot reference historical fixtures, private storage internals, or living visual terms | unit | `npm test -- --run src/pages/chat/fixtureLeakGuard.test.ts` | W0 | pending |
| 10-03-02 | 03 | 3 | PROD-01, PROD-03 | T-10-02, T-10-05, T-10-06 | Final audit evidence distinguishes production defects from unsupported/future workflows | artifact/e2e | production smoke plus audit review | W0 | pending |

Status: pending until execution.

## Wave 0 Requirements

Existing infrastructure covers all Phase 10 requirements:

- `Frontend/Chatify/vitest.config.ts`
- `Frontend/Chatify/playwright.config.ts`
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts`
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.test.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailDrawer.test.tsx`
- `Frontend/Chatify/e2e/chat-quality-gate.spec.ts`
- `Frontend/Chatify/e2e/pages/chatPage.ts`

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Production deployment availability | PROD-01 | Vercel/Render may be unavailable or credentials may be absent in local execution | Confirm production frontend and backend URLs are reachable before running production smoke |
| Smoke account credential validity | PROD-01 | Credentials must stay outside git and cannot be inferred from repo files | Set the six Phase 10 env vars in the shell only; do not commit them |
| Delivery-defect baseline | PROD-01, PROD-03 | Phase 10 documents the duplicate-send/stale-recipient bug but does not repair transport | Run two smoke accounts, send one message, record duplicate-send and recipient-live-update behavior in `10-PRODUCTION-AUDIT.md` |

## Validation Sign-Off

- [x] All tasks have automated verify commands or explicit production/manual gates.
- [x] Sampling continuity avoids three consecutive tasks without automated verification.
- [x] Wave 0 has existing test infrastructure.
- [x] No watch-mode flags are used.
- [x] Feedback latency target is defined.
- [x] `nyquist_compliant: true` is set in frontmatter.

Approval: pending execution.
