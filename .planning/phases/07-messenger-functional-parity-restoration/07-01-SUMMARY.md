---
phase: 07-messenger-functional-parity-restoration
plan: 01
subsystem: ui-testing
tags: [react, vite, vitest, playwright, socket-io, fixture-isolation]
requires:
  - phase: 06-messenger-visual-parity
    provides: Phase 06 visual smoke fixture data and screenshot harness
provides:
  - Phase 06 visual fixture isolated to e2e support
  - Product chat runtime without visual-smoke socket bypass
  - Static Vitest guard against fixture leakage in chat runtime source
affects: [phase-07, phase-08, chat-ui, e2e]
tech-stack:
  added: []
  patterns: [test-only visual fixtures, Vite raw-import source guard]
key-files:
  created:
    - Frontend/Chatify/e2e/fixtures/phase06VisualFixture.ts
    - Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts
  modified:
    - Frontend/Chatify/src/pages/chat/chat.tsx
    - Frontend/Chatify/e2e/chat-ui-smoke.spec.ts
    - Frontend/Chatify/src/pages/chat/components/Phase06VisualFixture.ts
    - Frontend/Chatify/src/pages/chat/components/Phase06VisualFixture.test.tsx
key-decisions:
  - "Phase 06 fixture data remains available only from the Playwright e2e fixture path."
  - "Socket enablement no longer depends on a visual-smoke query parameter."
  - "The runtime leak guard uses Vite raw imports so frontend build does not require Node type declarations."
patterns-established:
  - "Visual parity fixtures belong outside production chat component folders."
  - "Chat runtime source can be guarded with a narrow Vitest source scan."
requirements-completed: [PARITY-01, PARITY-03, UI-01, UI-05, RT-04, TEST-03, TEST-05]
duration: 12 min
completed: 2026-06-12
---

# Phase 07 Plan 01: Fixture Isolation And Runtime Guard Summary

**Phase 06 visual fixtures moved out of product chat runtime, with socket behavior restored to real auth and selected-chat state**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-12T13:35:08Z
- **Completed:** 2026-06-12T13:46:57Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Moved `Phase06VisualFixture.ts` from production chat components into `Frontend/Chatify/e2e/fixtures/phase06VisualFixture.ts`.
- Removed the `chatVisualSmoke=phase06` runtime branch from `chat.tsx`; sockets are enabled by selected chat and authenticated session state.
- Updated visual smoke to import fixture data from e2e support and open the app without the visual-smoke query flag.
- Added `fixtureLeakGuard.test.ts` to fail if non-test chat runtime files reintroduce Phase 06 fixture identifiers.

## Task Commits

1. **Tasks 1-3: Fixture move, runtime branch removal, and leak guard** - `afff6f0` (test)

**Plan metadata:** this summary commit.

## Files Created/Modified

- `Frontend/Chatify/e2e/fixtures/phase06VisualFixture.ts` - Test-only home for historical Phase 06 visual fixture data.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` - Static guard for production chat runtime fixture leakage.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - Removed visual-smoke detection and socket bypass.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` - Imports e2e fixture data and omits `chatVisualSmoke=phase06`.
- `Frontend/Chatify/src/pages/chat/components/Phase06VisualFixture.test.tsx` - Removed colocated production-component fixture test.

## Decisions Made

- Kept Phase 06 visual fixture data for historical screenshot smoke only, under e2e support.
- Kept the `chatTheme` URL override because it verifies theme behavior without changing product runtime behavior.
- Implemented the guard with `import.meta.glob(..., { query: '?raw' })` instead of Node filesystem APIs so `npm run build` stays green without adding Node types.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first guard implementation used `node:fs`, `node:path`, and `node:url`, which passed Vitest but failed frontend typechecking because app build lacks Node type declarations. The guard was changed to Vite raw source imports and verified again.

## Verification

- `cd Frontend/Chatify; npm test -- --run src/pages/chat/fixtureLeakGuard.test.ts src/pages/chat/hooks/useChatTheme.test.tsx src/hooks/useChatSocket.test.tsx` - passed, 3 files and 5 tests.
- `cd Frontend/Chatify; npm test -- --run src/pages/chat` - passed, 16 files and 45 tests.
- `cd Frontend/Chatify; npm run lint` - passed.
- `cd Frontend/Chatify; npm run build` - passed.
- `rg -n "Phase06VisualFixture|PHASE06_|phase06|chatVisualSmoke" Frontend/Chatify/src/pages/chat --glob "!**/*.test.*"` - no production runtime matches.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for `07-02`: production chat runtime no longer has a fixture-mode bypass, so live-state and disabled-control repairs can be validated without static Phase 06 masking.

---
*Phase: 07-messenger-functional-parity-restoration*
*Completed: 2026-06-12*
