# Phase 9: Messenger Interaction Quality Gate - Specification

**Created:** 2026-06-12
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 10 locked

## Goal

Chatify v1 messenger readiness is blocked until critical desktop, mobile, light-theme, dark-theme, media, detail, accessibility, keyboard, and verification workflows pass behavior-first automated checks with durable evidence.

## Background

Phase 6 produced reference-driven desktop and mobile light/dark visual parity, but screenshot parity alone did not prove that the messenger behaved like a real product. Phase 7 restored production-backed chat state, search, send/retry, navigation, theme behavior, and fixture guardrails. Phase 8 added real attachment storage, protected preview/download, shared media/files, pinned messages, detail panels, socket invalidation, and behavior-backed screenshots.

The current codebase already has backend Vitest tests, frontend Vitest tests, Playwright smoke tests, fixture leak guardrails, and Phase 8 behavior evidence. The remaining gap is a final blocking quality gate that proves the rebuilt messenger stays functional after interactions across the real v1 workflows, not only at initial render or under narrow fixture paths. Phase 9 must not add broad new product features; it must certify or repair the existing v1 messenger workflows and record exact release-readiness evidence.

## Requirements

1. **Blocking v1 readiness gate**: Phase 9 must treat failing critical messenger workflows as blockers for v1 readiness.
   - Current: Phase 8 has behavior evidence, but Phase 9 has no spec, plans, quality-gate artifact, or release-blocking pass/fail record.
   - Target: Any failure in the locked critical workflow matrix, accessibility/keyboard matrix, privacy guardrails, screenshot evidence, lint, build, backend tests, frontend tests, or Playwright gate blocks completion until fixed or explicitly documented as non-blocking.
   - Acceptance: Phase 9 summary or quality-gate artifact lists each gate, its pass/fail status, the exact command or evidence path, and any deferred item with a non-blocking rationale.

2. **Critical workflow matrix**: End-to-end checks must cover the approved v1 messenger workflows through user-observable behavior.
   - Current: Existing Playwright tests cover many Phase 7 and Phase 8 flows, but the full Phase 9 matrix is not locked as a single required gate.
   - Target: The gate covers login or session recovery, selected-chat restore, conversation selection, send success, retry, dismiss failed send, conversation search, message search, read/delivery status, typing/presence state, theme switching, mobile drawer navigation, attachment upload or selection, protected preview/download, pinned messages, shared files/media, and detail rail/drawer behavior.
   - Acceptance: Playwright or equivalent browser evidence exercises every listed workflow at least once and fails if the UI only renders static/demo content without performing the supported action.

3. **Post-interaction four-variant evidence**: Screenshots must prove the real UI remains aligned after behavior interactions across desktop/mobile and light/dark themes.
   - Current: Phase 8 screenshots are captured after media/detail behavior assertions, but Phase 9 has no dedicated final screenshots or artifact paths.
   - Target: Phase 9 captures desktop light, desktop dark, mobile light, and mobile dark screenshots only after behavior assertions mutate the UI state.
   - Acceptance: Four screenshot artifacts exist under `.planning/phases/09-messenger-interaction-quality-gate/`, are referenced by the quality-gate artifact, and are captured after interactions such as search, send/retry, detail panel, attachment, or drawer flows.

4. **Layout and responsive stability**: The messenger must avoid interaction-time layout failures across the approved viewport matrix.
   - Current: Existing tests check horizontal overflow and composer overlap in some flows, but Phase 9 has not locked those checks as release gates.
   - Target: Desktop and mobile checks prove no horizontal page overflow, no composer overlap on the newest visible message, bounded mobile sidebar/drawer geometry, bounded detail drawer geometry, stable touch targets, and no incoherent overlap after send/search/detail interactions.
   - Acceptance: Automated checks fail when document/body horizontal overflow appears, when the composer overlaps the latest visible message, when mobile drawers are outside their expected viewport bounds, or when detail panels obscure controls incoherently.

5. **Accessibility and keyboard coverage**: The chat shell, composer, actions, drawers, panels, media/file controls, and disabled states must be keyboard-operable and accessible enough for the v1 gate.
   - Current: Many components have accessible labels, focus behavior, and unit tests, but no Phase 9 gate covers the assembled messenger shell.
   - Target: Phase 9 verifies Tab order, visible focus, Enter-to-send, Shift+Enter newline, Escape close for search/menu/drawer/dialog surfaces, focus return after close, no keyboard traps, accessible names for icon buttons/links, and disabled-state announcements or labels for unsupported controls.
   - Acceptance: Automated browser or component tests prove the listed keyboard/focus behaviors, and an accessibility check or documented manual checklist records pass/fail coverage for the assembled messenger shell.

6. **Fixture isolation and production-data guardrails**: Test fixtures must remain centralized and separated from production runtime paths.
   - Current: Phase 7 introduced fixture leak guardrails and Phase 8 strengthened scans, while Playwright still has historical Phase 6 and Phase 7 fixture files.
   - Target: Phase 9 uses centralized Phase 9 e2e fixtures/page helpers or clearly named shared test helpers, and production chat runtime files do not import e2e fixtures, Phase 6 visual constants, Phase 7 behavior fixtures, or static fake media/pin data.
   - Acceptance: A static guard or documented scan fails on forbidden fixture identifiers in production chat runtime files while allowing expected matches in test/e2e fixture paths.

7. **Media/detail backend-backed proof**: The gate must close the remaining risk that media/detail browser evidence is only mocked.
   - Current: Phase 8 backend contracts are tested and Phase 8 Playwright media/detail checks use deterministic mocked API fixtures for repeatable UI behavior.
   - Target: Phase 9 includes at least one backend-backed or API-contract-backed proof for attachment send/upload, protected preview/download, shared assets, or pinned/detail behavior in addition to deterministic UI matrix tests.
   - Acceptance: Evidence shows a real backend/API contract path passed for media or detail behavior, and deterministic Playwright checks still cover the four UI variants.

8. **Honest unsupported controls**: Visible unsupported controls must remain hidden, disabled, or clearly unavailable.
   - Current: Call, video, voice, favorite, and some "more" controls exist as disabled or unavailable surfaces in the UI.
   - Target: Phase 9 asserts unsupported controls do not appear enabled or actionable unless the underlying feature is actually implemented.
   - Acceptance: Tests fail if call, video, voice, favorite, or unsupported "more" controls are enabled without a real supported action, or if their accessible names do not communicate unavailable state where needed.

9. **Privacy and non-living visual constraints**: The final gate must preserve Chatify privacy and abstract visual identity rules.
   - Current: Phase 6-8 adopted abstract identity tiles and protected media/file routes, with no living-being fixtures in the media evidence.
   - Target: Phase 9 checks that messenger runtime and evidence use abstract non-living identity/media fixtures only, do not display profile photos or realistic avatars, and do not expose private attachments or unauthorized conversation assets.
   - Acceptance: Static scans and/or browser assertions show no humans, faces, portraits, silhouettes, hands, bodies, animals, pets, birds, insects, plants, flowers, trees, mascots, profile photos, realistic avatars, unauthorized private attachment URLs, object keys, GridFS ids, or private file hashes in the user-facing runtime or evidence.

10. **Full verification record**: Phase 9 must produce a durable quality-gate artifact with exact commands, counts, screenshots, and residual risks.
    - Current: Prior phases have individual summaries and smoke evidence, but Phase 9 has no final v1 readiness record.
    - Target: Phase 9 records the exact outcomes for backend tests, frontend tests, frontend lint, frontend build, Playwright UI tests, fixture/privacy scans, accessibility/keyboard checks, and screenshot creation.
    - Acceptance: A Phase 9 evidence artifact exists and includes exact commands, pass/fail counts where available, artifact paths, any fixed blocking failures, and any residual non-blocking risks.

## Boundaries

**In scope:**
- A blocking v1 messenger interaction quality gate for Phase 9.
- Behavior-first Playwright or equivalent browser coverage for critical messenger workflows.
- Desktop light, desktop dark, mobile light, and mobile dark post-interaction screenshot evidence.
- Accessibility, keyboard, focus, disabled-state, and responsive interaction checks for the assembled chat UI.
- Fixture isolation, static guardrails, and scans that keep test/demo data out of production chat runtime.
- At least one backend-backed or API-contract-backed proof for media/detail behavior beyond deterministic mocked Playwright UI fixtures.
- Fixes required to make locked Phase 9 gates pass for existing v1 messenger workflows.
- A durable Phase 9 quality-gate/evidence artifact that records commands, counts, screenshots, and residual risks.

**Out of scope:**
- New voice call, video call, favorite, or rich "more actions" features - unsupported controls should remain honest until a dedicated feature phase exists.
- Group chat, push/email notifications, moderation/admin tooling, and end-to-end encryption - these remain v2 or deferred roadmap items.
- Major redesign of the messenger reference UI - Phase 9 certifies and repairs interactions, not a new visual direction.
- Native mobile app coverage - this phase is web-first and covers responsive browser viewports only.
- Full production environment certification on Render/Vercel - deployment verification can follow separately; Phase 9 focuses on repo-local quality gates.
- Pixel-perfect visual diff thresholds - screenshots and layout assertions are required, but exact pixel-diff tooling is not required unless later planning chooses it.

## Constraints

- Preserve the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO realtime layer, TanStack Query, Zustand, Tailwind, npm package layout, Vitest, and Playwright stack.
- Keep execution inline in the current Codex thread; do not use subagents.
- Preserve unrelated local work and do not stage unrelated planning/image artifacts.
- Do not weaken cookie-authenticated request handling, Socket.IO identity, message privacy, protected attachment access, or authorization checks.
- Theme switching must remain token-driven and must not fork workflows between desktop/mobile or light/dark variants.
- Test fixtures must be deterministic, named, centralized, and test-only.
- Evidence media and identity fixtures must be abstract and non-living.
- Phase completion should prefer fixing critical gate failures over documenting them, except for explicitly non-blocking residual risks.

## Acceptance Criteria

- [ ] A Phase 9 quality-gate artifact records every locked gate with exact command/evidence outcomes.
- [ ] Browser tests exercise login/session recovery, selected-chat restore, conversation selection, send success, retry, dismiss failed send, conversation search, message search, read/delivery state, typing/presence, theme switching, mobile drawer navigation, attachments, preview/download, pinned messages, shared files/media, and detail rail/drawer behavior.
- [ ] Desktop light, desktop dark, mobile light, and mobile dark screenshots exist under the Phase 9 directory and were captured after behavior interactions.
- [ ] Automated layout checks prove no horizontal overflow, no composer overlap, bounded mobile drawer/detail geometry, and no incoherent overlap after interactions.
- [ ] Keyboard/focus checks cover Tab navigation, visible focus, Enter-to-send, Shift+Enter newline, Escape close, focus return, and no keyboard traps for key chat surfaces.
- [ ] Accessibility checks or a documented manual checklist cover accessible names, disabled-state semantics, focus visibility, and dynamic status surfaces for the assembled messenger.
- [ ] Fixture guardrails fail on production chat runtime imports or references to e2e fixtures, Phase 6 visual fixture identifiers, Phase 7 behavior fixtures, or hardcoded fake media/detail data.
- [ ] Media/detail evidence includes at least one backend-backed or API-contract-backed proof beyond mocked Playwright UI fixtures.
- [ ] Unsupported controls remain hidden, disabled, or explicitly unavailable and are not exposed as enabled dead actions.
- [ ] Privacy and visual scans/assertions show no living-being imagery, profile-photo/realistic-avatar usage, unauthorized asset exposure, storage ids, object keys, file hashes, or private attachment metadata in user-facing runtime evidence.
- [ ] `Backend/Chatify` full test suite passes.
- [ ] `Frontend/Chatify` full test suite, lint, build, and Playwright UI gate pass.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.93 | 0.75 | Met | Blocking v1 interaction quality gate is locked. |
| Boundary Clarity | 0.90 | 0.70 | Met | In-scope certification/fixes and out-of-scope feature expansion are explicit. |
| Constraint Clarity | 0.87 | 0.65 | Met | Stack, fixture, privacy, theme, no-subagent, and evidence constraints are locked. |
| Acceptance Criteria | 0.90 | 0.70 | Met | Pass/fail command, browser, screenshot, accessibility, layout, and privacy criteria are explicit. |
| **Ambiguity** | 0.10 | <=0.20 | Met | Approved recommendations resolve the discovery gaps. |

Status: Met = dimension meets minimum, Below minimum = planner treats as assumption.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | Phase 9 purpose | Blocking v1 readiness gate, not report-only audit. |
| 1 | Researcher | What happens to bugs found by the gate | Fix all blocking failures and document only explicit non-blockers. |
| 1 | Researcher | Browser test data strategy | Hybrid deterministic UI fixtures plus at least one backend/API contract proof for media/detail. |
| 2 | Simplifier | Critical workflow matrix | Lock login/session, selected chat, send/retry, search, status, theme, mobile, media, pinned, shared assets, and details. |
| 2 | Simplifier | Viewport and theme matrix | Lock desktop light/dark and mobile light/dark, primarily `1440x900` and `390x844`. |
| 2 | Simplifier | Screenshot timing | Capture screenshots after behavior interactions only. |
| 3 | Boundary Keeper | Accessibility standard | Combined keyboard/focus checks plus accessibility scan or documented checklist. |
| 3 | Boundary Keeper | Keyboard/focus scope | Lock Tab, focus, Enter, Shift+Enter, Escape, focus return, and no keyboard traps. |
| 3 | Boundary Keeper | Fixture boundary | Use centralized Phase 9/test fixtures and guard production runtime against fixture leaks. |
| 3 | Boundary Keeper | Unsupported controls | Keep unsupported controls hidden, disabled, or clearly unavailable. |
| 4 | Failure Analyst | Privacy and imagery constraints | Keep non-living abstract visuals and prevent unauthorized private asset exposure. |
| 4 | Failure Analyst | Layout quality checks | Lock overflow, composer overlap, drawer bounds, touch targets, and overlap checks. |
| 5 | Seed Closer | Test command gate | Require backend tests, frontend tests, lint, build, Playwright, scans, and screenshots. |
| 5 | Seed Closer | Evidence artifact | Require a durable Phase 9 behavior/quality-gate artifact. |
| 5 | Seed Closer | Out-of-scope boundaries | Exclude new product features and major redesign; include only fixes needed for v1 gate failures. |

---

*Phase: 09-messenger-interaction-quality-gate*
*Spec created: 2026-06-12*
*Next step: $gsd-discuss-phase 9 - implementation decisions (how to build what's specified above)*
