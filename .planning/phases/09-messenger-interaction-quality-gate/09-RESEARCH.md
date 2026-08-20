# Phase 09 Research: Messenger Interaction Quality Gate

**Phase:** 09-messenger-interaction-quality-gate
**Date:** 2026-06-12
**Mode:** inline research, no subagents

## Research Goal

Define the safest implementation plan for a blocking v1 messenger interaction quality gate that proves Chatify behaves like a working messenger across desktop, mobile, light theme, dark theme, media/detail surfaces, accessibility, keyboard operation, layout stability, fixture isolation, privacy guardrails, and durable evidence.

## Skills Used

- `webapp-testing`: behavior-first web quality gates, smoke/e2e boundaries, and evidence quality.
- `e2e-testing-patterns`: Playwright page-object, deterministic fixture, locator, waiting, screenshot, and accessibility patterns.
- `accessibility`: keyboard/focus, accessible names, disabled semantics, and WCAG-oriented assembled-page checks.
- `react-best-practices`: keep React state and behavior in existing components/hooks instead of adding test-only runtime paths.
- `vitest`: deterministic one-shot frontend/backend test commands and config-aware test execution.

## Current Codebase Findings

Phase 09 starts from a stronger base than the earlier static UI pass:

- `Frontend/Chatify/playwright.config.ts` already runs Playwright from `Frontend/Chatify/e2e`, serializes workers, uses Chrome, starts Vite on `127.0.0.1:4177`, and records traces on first retry.
- `Frontend/Chatify/e2e/chat-functional-parity.spec.ts` proves Phase 07 behavior for conversation search, message search, send, retry, dismiss, mobile drawer navigation, auth-expired cleanup, disabled controls, overflow checks, composer overlap checks, and after-interaction screenshots.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` proves Phase 08 media/detail UI behavior, but it still imports `phase06VisualFixture`. That is acceptable as historical Phase 08 evidence, but it must not be the final Phase 09 gate source.
- `Frontend/Chatify/e2e/pages/chatPage.ts` has useful helpers for mocked API setup, chat opening, overflow checks, composer overlap checks, and visible realtime updates. It is currently Phase 07-specific and hardcodes Phase 07 artifact paths.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` blocks Phase 06 visual fixture identifiers and known reference-demo file names from production chat runtime, but it does not yet cover Phase 07 or Phase 09 fixture leakage, broader living-being terms, or private asset leak patterns.
- Frontend component tests already cover important keyboard and behavior contracts: composer Enter and Shift+Enter behavior, attachment selection/removal, invalid attachment blocking, action-menu Escape/focus return, new-chat dialog semantics/focus trap, detail drawer Escape/action wiring, unsupported/security rail states, shared asset and pin query hooks, socket invalidation, and protected attachment API URL generation.
- Backend tests already provide the best backend/API-backed proof candidates for the Phase 08 residual risk: attachment creation/idempotency/cleanup/validation, preview/download authorization, shared asset filtering, pinned-message behavior, attachment filename search, and attachment/pin socket room scoping.
- `@axe-core/playwright` is not installed in the frontend package today. `npm view @axe-core/playwright version peerDependencies dependencies --json` returned version `4.11.3`, peer dependency `playwright-core >= 1.0.0`, and dependency `axe-core ~4.11.4`, which is compatible with the current Playwright package shape.

## External Research

### Playwright Accessibility

Source: https://playwright.dev/docs/accessibility-testing

Playwright's official accessibility guidance uses axe through `@axe-core/playwright` and recommends treating automated scans as one part of an accessibility strategy. The docs show `AxeBuilder({ page }).analyze()` and scoping/disabling only when there are known, documented issues.

Recommendation: add `@axe-core/playwright` in Phase 09 execution if installation is clean, run it against at least one desktop and one mobile assembled messenger state, and do not treat it as a substitute for explicit keyboard/focus assertions.

### Playwright Locators

Source: https://playwright.dev/docs/locators

Playwright recommends user-facing locators such as roles and text where semantics matter, with `data-testid` as a stable fallback for non-semantic or highly dynamic surfaces.

Recommendation: keep role/name locators for real user workflows and use focused `data-testid` locators only for structural assertions such as `chat-root`, `conversation-pane`, `chat-sidebar`, and `chat-context-rail`.

### Playwright Screenshots

Source: https://playwright.dev/docs/screenshots

The official screenshot API supports viewport/full-page/element screenshots through `page.screenshot({ path })`. Phase 09 only needs artifact screenshots after behavior assertions, not pixel-diff snapshots.

Recommendation: capture four named screenshot artifacts in `.planning/phases/09-messenger-interaction-quality-gate/` after send/search/detail/media/drawer interactions pass.

### Playwright Trace Viewer

Source: https://playwright.dev/docs/trace-viewer

Playwright traces are intended for debugging failed CI/browser tests after execution. The existing config already uses `trace: 'on-first-retry'`.

Recommendation: keep trace-on-first-retry and do not add custom trace plumbing unless Phase 09 execution exposes flaky failure modes.

### Vitest CLI And Config

Sources:
- https://vitest.dev/guide/cli
- https://vitest.dev/config/

Vitest's official CLI docs define `vitest run` as a single-run mode, and the config docs confirm Vitest can reuse Vite config or dedicated config files.

Recommendation: keep frontend `npm test` and backend `npm test` as the authoritative one-shot local quality commands, and use targeted `npm test -- --run <files>` commands only during debugging.

### axe-core Playwright Package

Source: https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/README.md

The official package README describes a chainable API that injects/configures/analyzes axe with Playwright.

Recommendation: use a small wrapper helper in the Phase 09 Playwright spec if needed, but avoid over-abstracting the scan. The evidence artifact should record which page states were scanned and whether any rules were disabled.

## Planning Decisions

1. Create a dedicated Phase 09 Playwright gate instead of extending Phase 07 or Phase 08 specs in place.
   - Rationale: Phase 09 must be identifiable as the blocking v1 gate and must not pass by replaying historical Phase 06/07 data.

2. Create new Phase 09 fixtures with abstract non-living identities/media.
   - Rationale: the gate must avoid humans, animals, plants, profile photos, realistic avatars, and old reference copy.

3. Keep deterministic browser API mocks for the four UI variants, paired with backend/API-backed media/detail proof.
   - Rationale: deterministic UI screenshots are stable, while backend tests already prove protected media/detail contracts more reliably than a live browser upload round trip.

4. Add `@axe-core/playwright` during execution if install/build remains clean.
   - Rationale: official Playwright accessibility docs support this path, and the current package peer dependency is compatible.

5. Expand fixture/privacy static scans instead of relying only on browser assertions.
   - Rationale: fixture leakage and private asset patterns are easiest to catch before runtime and should block production chat runtime regressions.

6. Make layout checks automated and tied to interactions.
   - Rationale: visual review alone cannot reliably catch horizontal overflow, drawer bounds, composer overlap, or enabled dead controls.

## Recommended Plan Shape

### Wave 1: Behavior Gate Foundation

Build Phase 09 fixture data, shared test helpers, and a dedicated `chat-quality-gate.spec.ts` that covers the critical workflow matrix with deterministic UI mocks and post-interaction screenshots.

### Wave 2: Accessibility, Keyboard, Layout, Privacy

Install/add axe integration if compatible, extend the Playwright gate with assembled-shell accessibility checks, expand keyboard/focus coverage, add drawer/detail geometry checks, and strengthen static fixture/privacy guardrails.

### Wave 3: Evidence And Readiness Record

Run backend tests, frontend tests, lint, build, Playwright gate, fixture/privacy scans, and screenshot generation. Fix blockers in scope and write `09-BEHAVIOR-GATE.md` with exact commands, outcomes, screenshots, fixed blockers, and residual risks.

## Risks And Mitigations

- Risk: adding `@axe-core/playwright` changes the frontend lockfile and may expose pre-existing accessibility failures.
  - Mitigation: keep the dependency addition in Wave 2, run focused Playwright accessibility checks first, fix real assembled-shell issues, and document any explicitly accepted non-blocking axe rule suppressions.

- Risk: Phase 09 Playwright coverage becomes too broad and flaky.
  - Mitigation: use one dedicated gate spec with deterministic route mocks, semantic waits, `expect.poll` for geometry, serial execution, and no arbitrary sleeps as primary stabilization.

- Risk: mocked UI evidence does not prove backend media/detail behavior.
  - Mitigation: require backend/API tests for attachment creation, preview/download authorization, shared assets, pins, filename search, and socket scoping in the evidence artifact.

- Risk: historical Phase 06 and Phase 07 fixtures remain in tests and confuse production guardrails.
  - Mitigation: allow historical fixture references only in `Frontend/Chatify/e2e/fixtures` and historical e2e specs, while blocking those references in production runtime and in the Phase 09 final gate data source.

- Risk: privacy scan terms such as `avatar`, `profile`, or file names may appear legitimately in test files.
  - Mitigation: scope static scans to production runtime for hard failures, and document test/evidence allowlists only where they are intentional and non-user-facing.

## Verification Commands For Phase 09 Execution

Recommended full gate:

```powershell
cd Backend\Chatify
npm test
cd ..\..\Frontend\Chatify
npm test
npm run lint
npm run build
npm run test:ui -- --grep "Phase 09"
```

Recommended focused debug commands:

```powershell
cd Frontend\Chatify
npm test -- --run src/pages/chat/fixtureLeakGuard.test.ts
npm test -- --run src/pages/chat/components/MessageComposer.test.tsx src/pages/chat/components/MessageActionMenu.test.tsx src/pages/chat/components/NewChatDialog.test.tsx src/pages/chat/components/ConversationDetailDrawer.test.tsx
npm test -- --run src/api/messageApi.test.ts src/hooks/useChatQueries.test.tsx src/hooks/useChatSocket.test.tsx
```

Recommended backend/API proof subset:

```powershell
cd Backend\Chatify
npm test -- --run test/message/message.attachments.test.mjs test/message/message.attachment-authorization.test.mjs test/message/message.shared-assets.test.mjs test/message/message.pins.test.mjs test/message/message.search.test.mjs test/socket/socket.attachments-pins.test.mjs
```

## Research Conclusion

Phase 09 should be planned as a release-blocking quality gate, not a new feature phase. The most reliable approach is a dedicated Phase 09 Playwright gate with new non-living fixtures, deterministic UI mocks, post-interaction screenshots, explicit accessibility/keyboard/layout checks, expanded static privacy/fixture scans, and backend/API test proof for the media/detail contracts that deterministic browser mocks cannot prove alone.
