# Phase 09: Messenger Interaction Quality Gate - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 09 is the blocking v1 messenger interaction quality gate. It proves that the rebuilt Chatify messenger behaves like a real product across desktop, mobile, light theme, dark theme, critical chat workflows, media/detail surfaces, accessibility, keyboard operation, layout stability, privacy guardrails, and verification evidence. This phase certifies and repairs existing v1 workflows; it does not introduce new product capabilities or a new visual direction.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `09-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `09-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- A blocking v1 messenger interaction quality gate for Phase 09.
- Behavior-first Playwright or equivalent browser coverage for critical messenger workflows.
- Desktop light, desktop dark, mobile light, and mobile dark post-interaction screenshot evidence.
- Accessibility, keyboard, focus, disabled-state, and responsive interaction checks for the assembled chat UI.
- Fixture isolation, static guardrails, and scans that keep test/demo data out of production chat runtime.
- At least one backend-backed or API-contract-backed proof for media/detail behavior beyond deterministic mocked Playwright UI fixtures.
- Fixes required to make locked Phase 09 gates pass for existing v1 messenger workflows.
- A durable Phase 09 quality-gate/evidence artifact that records commands, counts, screenshots, and residual risks.

**Out of scope (from SPEC.md):**
- New voice call, video call, favorite, or rich "more actions" features.
- Group chat, push/email notifications, moderation/admin tooling, and end-to-end encryption.
- Major redesign of the messenger reference UI.
- Native mobile app coverage.
- Full production environment certification on Render/Vercel.
- Pixel-perfect visual diff thresholds unless later planning chooses it.

</spec_lock>

<decisions>
## Implementation Decisions

### Gate Structure And Fixture Strategy
- **D-01:** Add a dedicated Phase 09 Playwright quality gate spec, tentatively `Frontend/Chatify/e2e/chat-quality-gate.spec.ts`. Do not make the final v1 gate indistinguishable from older Phase 07 or Phase 08 smoke specs.
- **D-02:** Reuse stable page-object/helper patterns from `Frontend/Chatify/e2e/pages/chatPage.ts`, but promote shared Phase 09 helpers only when they reduce duplication without hiding behavior assertions.
- **D-03:** Create Phase 09 e2e fixtures with new abstract identities, messages, attachments, pinned items, shared assets, and search data. Do not rely on Phase 06 reference fixture names or reference copy as the final gate data.
- **D-04:** Historical Phase 06 and Phase 07 evidence may remain in their phase directories, but Phase 09 evidence should use Phase 09 names and paths so it cannot pass by re-rendering older screenshots.

### Backend-Backed Media And Detail Proof
- **D-05:** Close the Phase 08 residual risk with a hybrid strategy: deterministic browser UI tests for the four visual variants plus at least one backend-backed or API-contract-backed proof for attachment/detail behavior.
- **D-06:** The backend/API-backed proof may be an existing or expanded backend Vitest path if it exercises real attachment, preview/download, shared asset, pinned-message, or detail contract behavior through the app/API boundary. If planning finds a reliable local browser-to-backend route, it may add that, but it is not required at the cost of flakiness.
- **D-07:** Browser tests may still use deterministic route mocks for repeatable UI matrix checks, but the final evidence artifact must explicitly link those mocked UI checks to the backend/API proof.

### Accessibility And Keyboard Gate
- **D-08:** Add `@axe-core/playwright` as a frontend dev dependency if compatible with the current Vite/Playwright setup, and run it against the assembled messenger shell in at least one representative desktop and one representative mobile state.
- **D-09:** Accessibility scanning does not replace explicit behavior checks. Keep targeted assertions for icon accessible names, disabled-state semantics, focus visibility, dialog semantics, and dynamic status surfaces.
- **D-10:** Preserve existing component-level keyboard tests for composer, message action menu, new chat dialog, and conversation detail drawer, and add assembled browser checks for Tab order, Enter-to-send, Shift+Enter newline, Escape close, focus return, and no keyboard traps.
- **D-11:** Keyboard coverage should include search, message actions, new chat dialog, mobile conversation drawer, mobile detail drawer, composer attachment controls, send/retry/dismiss controls, and unsupported disabled controls where visible.

### Post-Interaction Evidence And Layout Stability
- **D-12:** Capture all four Phase 09 screenshots only after user-observable interactions mutate the UI state. First-paint screenshots are not sufficient for this phase.
- **D-13:** Required screenshot variants are desktop light, desktop dark, mobile light, and mobile dark. Use `1440x900` for desktop and `390x844` for mobile; add `430x932` only if it is cheap and useful during planning.
- **D-14:** Required artifact paths should live under `.planning/phases/09-messenger-interaction-quality-gate/`, with names that make the interaction state clear, such as `09-ui-desktop-light-quality.png`.
- **D-15:** Layout checks must be automated, not left to visual review only. Gate no horizontal overflow, no composer overlap with the latest visible message, bounded mobile sidebar/drawer geometry, bounded detail drawer geometry, stable touch targets, and no incoherent overlap after send/search/detail/attachment interactions.
- **D-16:** Use deterministic waiting patterns such as semantic locators and `expect.poll` for settled geometry. Do not use arbitrary sleeps as the main stability mechanism.

### Privacy, Fixture Isolation, And Unsupported Controls
- **D-17:** Expand the existing fixture leak guard so production chat runtime files cannot import or reference e2e fixtures, Phase 06 visual fixture identifiers, Phase 07 behavior fixtures, static fake media/detail data, or Phase 09 test-only fixture modules.
- **D-18:** Add a documented static scan in the Phase 09 evidence artifact for forbidden visual/privacy terms and private asset leak patterns. The scan should cover production runtime and e2e evidence fixture files while allowing intentional matches in test files only when documented.
- **D-19:** Preserve the non-living visual identity rule. Runtime and evidence must avoid humans, faces, portraits, silhouettes, hands, bodies, animals, pets, birds, insects, plants, flowers, trees, mascots, profile photos, realistic avatars, and any living-being media.
- **D-20:** Abstract identity tiles, monograms, initials, encrypted-pattern tiles, geometric media, file cards, color blocks, and non-living symbolic marks remain approved.
- **D-21:** Unsupported controls such as call, video, voice, favorite, and unsupported more actions must be hidden or truly disabled with accessible unavailable semantics. Enabled inert controls are blocking failures.
- **D-22:** Privacy scans and browser assertions must also guard against unauthorized private attachment URLs, GridFS ids, storage bucket names, object keys, raw file hashes, and private metadata being exposed in user-facing runtime or evidence.

### Verification Record And Failure Policy
- **D-23:** Phase 09 execution should create `09-BEHAVIOR-GATE.md` as the durable quality-gate artifact before the final phase summary. It should list every gate, command, pass/fail count where available, screenshot path, scan command, fixed blocker, and residual non-blocking risk.
- **D-24:** Expected verification order is backend tests, frontend tests, frontend lint, frontend build, Playwright quality gate, fixture/privacy scans, and screenshot evidence.
- **D-25:** A critical workflow, accessibility/keyboard, privacy, layout, build, lint, backend, frontend, or Playwright failure blocks v1 readiness unless the user explicitly accepts it as non-blocking.
- **D-26:** Fix all blocker failures that are in Phase 09 scope. Document only residual risks that are explicitly non-blocking or outside the Phase 09 boundary.
- **D-27:** Keep Playwright interactions deterministic: semantic role/name locators first, focused `data-testid` selectors where semantics are insufficient, trace on first retry, and screenshots only after assertions pass.

### Planning And Repository Hygiene
- **D-28:** Phase 09 planning must reconcile the current planning drift: `.planning/STATE.md` says Phase 08 is completed, while `.planning/ROADMAP.md` still shows Phase 08 unchecked and Phase 09 with zero plans.
- **D-29:** Preserve unrelated local work. The current dirty `.planning/config.json`, Phase 06/07 screenshot diffs, and `.gitkeep` files are outside this discussion artifact scope unless the user explicitly asks to include them.
- **D-30:** Stage and commit only the Phase 09 discussion context/log and the normal `STATE.md` session update for this workflow.

### the agent's Discretion
- The planner may choose exact helper names, fixture names, and Playwright spec decomposition as long as the dedicated Phase 09 gate remains clear and behavior-first.
- The planner may choose whether `@axe-core/playwright` runs in one consolidated test or dedicated accessibility tests if results are recorded in `09-BEHAVIOR-GATE.md`.
- The planner may choose the exact backend/API-backed media/detail proof path if it closes the Phase 08 mocked-browser-evidence risk and stays reliable.
- The planner may choose exact screenshot names if all four variants live in the Phase 09 directory and are captured after behavior interactions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/09-messenger-interaction-quality-gate/09-SPEC.md` - locked Phase 09 requirements, boundaries, constraints, acceptance criteria, and interview decisions.
- `.planning/phases/09-messenger-interaction-quality-gate/09-CONTEXT.md` - implementation decisions captured by this discussion.
- `.planning/PROJECT.md` - project core value, brownfield constraints, collaboration preference, repository hygiene rules, and no-subagent preference.
- `.planning/REQUIREMENTS.md` - TEST-05, PARITY-01 through PARITY-03, UI, BASE, and MEDIA traceability for the quality gate.
- `.planning/ROADMAP.md` - Phase 09 goal, success criteria, dependency on Phase 08, and current status drift to reconcile.
- `.planning/STATE.md` - current continuity record saying Phase 08 completed and Phase 09 is ready.

### Prior Phase Contracts
- `.planning/phases/08-media-files-and-conversation-detail-implementation/08-CONTEXT.md` - media/detail implementation decisions, protected attachments, shared assets, pinned messages, drawer/rail behavior, and non-living fixtures.
- `.planning/phases/08-media-files-and-conversation-detail-implementation/08-BEHAVIOR-SMOKE.md` - Phase 08 evidence, command outcomes, screenshot paths, and residual risk that Playwright media/detail checks use mocked API fixtures.
- `.planning/phases/08-media-files-and-conversation-detail-implementation/08-SPEC.md` - locked Phase 08 media/detail scope and privacy constraints.
- `.planning/phases/07-messenger-functional-parity-restoration/07-CONTEXT.md` - fixture isolation, honest controls, production-backed UI behavior, and behavior-first evidence decisions.
- `.planning/phases/07-messenger-functional-parity-restoration/07-BEHAVIOR-SMOKE.md` - Phase 07 behavior coverage, after-interaction screenshots, realtime proof, and fixture isolation evidence.
- `.planning/phases/06-messenger-visual-parity/06-CONTEXT.md` - desktop/mobile light/dark visual direction, abstract identity, theme tokens, and non-living imagery constraints.
- `.planning/phases/04-messenger-ui-reconstruction/04-CONTEXT.md` - componentized chat shell, composer recovery, message actions, and accessibility/focus patterns.
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` - canonical send/retry/status/unread/delete/edit/reaction contracts.
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` - authenticated socket identity, membership checks, targeted emits, presence, and reconnect rules.

### Codebase Maps
- `.planning/codebase/TESTING.md` - historical testing map; verify live package scripts because current repo now has Vitest and Playwright.
- `.planning/codebase/CONVENTIONS.md` - frontend TypeScript, ESM, naming, lint, import, comments, and test conventions.
- `.planning/codebase/STRUCTURE.md` - frontend/backend directory structure and where new tests, fixtures, and helpers belong.

### Frontend Runtime And Test Files
- `Frontend/Chatify/package.json` - live frontend scripts: `test`, `test:ui`, `lint`, and `build`; add any accessibility dependency here if planned.
- `Frontend/Chatify/playwright.config.ts` - Playwright dev-server, serial worker, base URL, Chrome channel, and trace-on-first-retry config.
- `Frontend/Chatify/e2e/chat-functional-parity.spec.ts` - Phase 07 behavior-first browser coverage to reuse as a pattern, not as final Phase 09 evidence.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` - current Phase 08 visual/media smoke that still imports Phase 06 fixture data; planner should decide whether to retire, rename, or leave as historical while adding Phase 09 gate.
- `Frontend/Chatify/e2e/pages/chatPage.ts` - reusable Playwright helper patterns for route mocks, opening chat, overflow checks, composer-overlap checks, and visible realtime updates.
- `Frontend/Chatify/e2e/fixtures/phase06VisualFixture.ts` - historical visual fixture data that must not become the Phase 09 gate data source.
- `Frontend/Chatify/e2e/fixtures/phase07BehaviorFixture.ts` - production-shaped behavior fixture pattern to learn from, but Phase 09 should use new names/data.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` - existing static guardrail to expand for Phase 09 fixture/privacy leakage.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - assembled route orchestrator for selected chat, search, send/retry, details, drawers, session, and theme behavior.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.test.tsx` - existing Enter, Shift+Enter, attachment selection/removal, validation, and send-disabled tests.
- `Frontend/Chatify/src/pages/chat/components/MessageActionMenu.test.tsx` - existing Escape close and focus-return pattern.
- `Frontend/Chatify/src/pages/chat/components/NewChatDialog.test.tsx` - existing dialog semantics, focus trap, Escape close, and focus-return pattern.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailDrawer.test.tsx` - existing detail drawer focus and Escape behavior.
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.test.tsx` - existing real detail sections, disabled unsupported controls, and factual security row tests.
- `Frontend/Chatify/src/hooks/useChatQueries.test.tsx` - shared asset and pinned-message query key coverage.
- `Frontend/Chatify/src/hooks/useChatSocket.test.tsx` - realtime cache/detail invalidation coverage for attachment and pin events.
- `Frontend/Chatify/src/api/messageApi.test.ts` - message API multipart, shared asset, pin, preview, and download route coverage.

### Backend Runtime And Test Files
- `Backend/Chatify/package.json` - backend `npm test` command and dependencies used by the Phase 09 backend/API-backed proof.
- `Backend/Chatify/test/message/message.attachments.test.mjs` - attachment creation, idempotency, cleanup, and validation proof.
- `Backend/Chatify/test/message/message.attachment-authorization.test.mjs` - protected preview/download authorization proof.
- `Backend/Chatify/test/message/message.shared-assets.test.mjs` - shared media/file listing proof without storage internals.
- `Backend/Chatify/test/message/message.pins.test.mjs` - pinned-message list/mutation proof.
- `Backend/Chatify/test/message/message.search.test.mjs` - filename metadata search proof.
- `Backend/Chatify/test/socket/socket.attachments-pins.test.mjs` - attachment and pin event room-scoping proof.
- `Backend/Chatify/Controller/messageController.mjs` - attachment/detail HTTP behavior and authorization boundary.
- `Backend/Chatify/Config/socket.mjs` - Socket.IO room and event behavior that the gate depends on.

### External References
- `@axe-core/playwright` official usage guidance - use only during planning/execution when adding the accessibility scanner.
- Playwright official locator, screenshot, trace, and accessibility testing docs - use when implementing deterministic browser checks.

### Supporting Skills Used For This Discussion
- `C:/Users/saieh/.agents/skills/webapp-testing/SKILL.md` - behavior-first web app verification guidance.
- `C:/Users/saieh/.agents/skills/e2e-testing-patterns/SKILL.md` - Playwright reliability and evidence guidance.
- `C:/Users/saieh/.agents/skills/accessibility/SKILL.md` - WCAG, keyboard, focus, ARIA, and testing guidance.
- `C:/Users/saieh/.agents/skills/react-best-practices/SKILL.md` - React component/state and performance boundary guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Frontend/Chatify/e2e/pages/chatPage.ts`: Reuse opening, route mock, overflow, composer-overlap, and visible realtime-update helpers after adapting them for Phase 09 fixtures and artifact paths.
- `Frontend/Chatify/e2e/chat-functional-parity.spec.ts`: Reuse the behavior-first pattern covering search, send, retry, mobile drawer, auth-expired cleanup, and after-interaction screenshots.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts`: Review as a Phase 08 media/detail smoke pattern, but avoid Phase 06 fixture coupling in the Phase 09 final gate.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts`: Extend the guard to fail production runtime references to forbidden fixture, visual, privacy, and private asset leak patterns.
- `MessageComposer.test.tsx`, `MessageActionMenu.test.tsx`, `NewChatDialog.test.tsx`, and `ConversationDetailDrawer.test.tsx`: Preserve component-level keyboard/focus coverage and use them as the checklist for assembled browser coverage.
- `ChatContextRail.test.tsx`, `MessageBubble.test.tsx`, `useChatQueries.test.tsx`, `useChatSocket.test.tsx`, and `messageApi.test.ts`: Reuse current media/detail, pinned, shared asset, protected route, and socket invalidation coverage in the Phase 09 gate record.
- `Backend/Chatify/test/message/*.test.mjs` and `Backend/Chatify/test/socket/socket.attachments-pins.test.mjs`: Use as the backend/API-backed media/detail proof set.

### Established Patterns
- Browser evidence should use production-shaped mocked API data for deterministic UI interactions, but the final gate must pair mocked browser checks with backend/API contract proof.
- Screenshots are captured after behavior assertions in prior phases; Phase 09 makes that a blocking rule across all four variants.
- Chat state belongs in TanStack Query and Zustand/socket hooks; Playwright should verify user-visible behavior, not move state logic into tests or components.
- Unsupported controls are disabled or unavailable with accessible labels; enabled inert controls are not acceptable.
- The messenger visual identity uses abstract geometric tiles and non-living media fixtures only.
- Frontend quality checks are `npm test`, `npm run lint`, `npm run build`, and `npm run test:ui`; backend quality check is `npm test`.

### Integration Points
- Add a Phase 09 Playwright spec and fixtures under `Frontend/Chatify/e2e/`.
- Add or extend page-object helpers under `Frontend/Chatify/e2e/pages/` if the Phase 09 matrix needs reusable interactions or artifact path helpers.
- Add `@axe-core/playwright` to `Frontend/Chatify/package.json` if planning confirms compatibility, then import it in Phase 09 accessibility tests.
- Extend `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` or add a focused adjacent test for Phase 09 leak/privacy scans.
- Produce `.planning/phases/09-messenger-interaction-quality-gate/09-BEHAVIOR-GATE.md` during execution with exact command outcomes and screenshot paths.
- Update planning/state artifacts through GSD tools so Phase 08/09 roadmap drift is not left hidden.

</code_context>

<specifics>
## Specific Ideas

- The final gate should feel like acceptance testing for a working messenger, not a picture check.
- Use new Phase 09 abstract fixture identities and attachment names so the evidence does not depend on `IN-8B21`, `message-states-spec.pdf`, or other Phase 06 reference copy.
- Keep screenshots quiet, secure, and close to the supplied visual direction, but prioritize proof that controls actually work after interaction.
- Suggested required screenshot names: `09-ui-desktop-light-quality.png`, `09-ui-desktop-dark-quality.png`, `09-ui-mobile-light-quality.png`, and `09-ui-mobile-dark-quality.png`.
- Suggested evidence artifact: `09-BEHAVIOR-GATE.md`.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within Phase 09 scope.

</deferred>

---

*Phase: 09-messenger-interaction-quality-gate*
*Context gathered: 2026-06-12*
