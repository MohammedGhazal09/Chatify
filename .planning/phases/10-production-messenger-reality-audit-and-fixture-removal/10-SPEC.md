# Phase 10: Production Messenger Reality Audit And Fixture Removal - Specification

**Created:** 2026-06-13
**Ambiguity score:** 0.09 (gate: <= 0.20)
**Requirements:** 11 locked

## Goal

The deployed Chatify messenger changes from a locally verified but production-unproven interface into a production-truth baseline where live Vercel/Render behavior is exercised with real smoke accounts, static/demo runtime fallbacks are rejected, and conversation detail panels can be opened and closed on desktop and mobile.

## Background

Phase 9 produced local behavior-first Playwright coverage, fixture guards, accessibility checks, screenshots, and frontend/backend verification, but the live deployed product still showed failures that those local gates did not catch. The reported production failures include a right-side detail rail that is open and not closable, visible controls that look functional but do not perform implemented actions, static-looking pinned messages/shared files/shared media, and static voice/media interactions.

Current frontend code already has real hooks and APIs for several surfaces. `useMessageSearch`, `useSharedAssets`, and `usePinnedMessages` query backend data. `ConversationDetailContent` renders pinned messages, shared files, shared media, and security rows from props, and disables call, video, favorite, and More controls when no action is wired. `MessageComposer` supports file attachment selection and keeps voice message disabled. The mobile `ConversationDetailDrawer` has close button, Escape, backdrop close, and focus behavior, but the desktop `ChatContextRail` is always rendered at `xl` width with no explicit close/reopen state. The existing fixture leak guard scans chat runtime source and CSS for known fixture/privacy terms, and a direct runtime scan found no current production source matches for known reference fixture names. The existing Playwright config runs a local dev server at `127.0.0.1:4177`; it does not prove deployed Vercel/Render behavior with real authenticated accounts.

The duplicate-send, false-delivered, and no-refresh recipient delivery defects are delivery-reliability failures. Phase 10 must reproduce and record them as production baseline evidence, but the repair belongs to the dedicated delivery-reliability phase that follows Phase 10.

## Requirements

1. **Production baseline audit**: Phase 10 must exercise the deployed Vercel frontend and Render backend with real authenticated smoke accounts and record the current production behavior before claiming any repair.
   - Current: Existing local Playwright and component tests rely on local dev server behavior and fixture-backed mocks; the deployed product has user-reported failures not caught by those gates.
   - Target: A production audit artifact records the live frontend URL, backend origin, commit or deployment identifiers when available, timestamp, smoke account labels, tested chat ids or anonymized conversation references, screenshots/traces, and pass/fail status for each locked production workflow.
   - Acceptance: `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-PRODUCTION-AUDIT.md` exists and includes live deployed evidence for at least desktop and mobile detail-panel behavior, conversation search/message search, detail data truthfulness, unsupported-control honesty, and the delivery-reliability baseline defect.

2. **Smoke credential safety**: Production smoke credentials must be supplied through local environment variables or an equivalent secret store and must never be committed, printed in logs, or written into phase artifacts.
   - Current: The repo has production URLs and local environment files, but no locked Phase 10 rule for safe production smoke account handling.
   - Target: Production smoke tooling reads credentials from documented environment variables such as `CHATIFY_SMOKE_USER_A`, `CHATIFY_SMOKE_PASSWORD_A`, `CHATIFY_SMOKE_USER_B`, and `CHATIFY_SMOKE_PASSWORD_B`, and artifacts reference only redacted account labels.
   - Acceptance: Source and artifact scans show no committed smoke passwords, raw emails, tokens, cookies, or reset codes; missing credentials cause the production smoke to fail closed or mark the production evidence gate blocked with a clear reason.

3. **No mocked production smoke**: Production smoke checks must not intercept or mock Chatify auth, chat, message, attachment, or Socket.IO traffic.
   - Current: Existing Playwright evidence is valuable but local; Phase 7 and Phase 9 browser tests use route mocks and fixture data for deterministic checks.
   - Target: Any production smoke script or documented manual production audit runs against the real deployed origins without `page.route` interception for `/api/auth`, `/api/chat`, `/api/message`, attachment routes, or Socket.IO traffic.
   - Acceptance: The production audit artifact states whether the run used route interception; verifier review can confirm no chat/message/socket production traffic was mocked during the live evidence run.

4. **Static/demo runtime guard**: Production chat runtime must fail tests if it imports e2e fixtures, Phase 6/7/9 fixture identifiers, or known static reference names as real product data.
   - Current: `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` already scans chat runtime source and CSS for several fixture, privacy, and living-visual terms; the guard does not yet represent Phase 10 production-live acceptance as a required gate.
   - Target: The guard or an equivalent blocking scan rejects production runtime references to fake message/file/media/detail data including `message-states-spec`, `delivery-metrics`, `retry-logic-notes`, `Phase06VisualFixture`, `chatVisualSmoke`, Phase 7 behavior fixture identifiers, and Phase 9 quality-gate identifiers outside test/e2e-only paths.
   - Acceptance: `cd Frontend/Chatify; npm test -- --run src/pages/chat/fixtureLeakGuard.test.ts` passes, and a direct `rg` scan over production chat runtime files reports no forbidden static/demo identifiers.

5. **Server-truth detail surfaces**: Pinned messages, shared files, shared media, and security rows must render only server-backed data, authenticated state, membership state, socket state, or explicit empty/loading/error states.
   - Current: Detail content accepts query-backed props, but the live product has shown static-looking detail rows; prior local evidence did not prove deployed truthfulness.
   - Target: The UI never synthesizes placeholder pinned messages, fake PDF/XLSX/TXT rows, fake media thumbnails, or fake security claims when the backend returns empty or unavailable data.
   - Acceptance: Component/browser tests cover non-empty API data, empty API data, loading, error, and unauthorized states; production smoke evidence shows either real rows created by the test data path or explicit empty/loading/error states, never unproven fake rows.

6. **Desktop detail rail control**: The desktop right rail must have explicit open, close, Escape, restore, and focus-return behavior.
   - Current: `ChatContextRail` is rendered as a static `xl:flex` aside with no close button or desktop open-state control, while the header More button opens only the mobile drawer state.
   - Target: On desktop widths, the detail rail defaults open for the reference three-panel layout, can be closed by a visible accessible control and Escape, can be reopened from the conversation header, and returns focus to the opener or close control consistently.
   - Acceptance: Automated browser or component tests prove desktop rail default-open, close, hidden state, Escape close, reopen, focus return, and no content overlap at a desktop viewport.

7. **Mobile detail drawer parity**: Mobile detail drawer behavior must remain closeable, bounded, and focus-safe while sharing the same server-backed content contract as desktop.
   - Current: `ConversationDetailDrawer` already supports close button, Escape, backdrop close, and focus on open, but Phase 10 must lock this as a production regression gate.
   - Target: Mobile details open from the header, close through close button, Escape, and backdrop, return focus to the header opener, stay within the viewport, and render the same real data/empty/error contract as desktop.
   - Acceptance: Browser or component tests prove all mobile drawer close paths, focus return, viewport bounds, and server-backed detail content behavior.

8. **Honest unsupported controls**: Visible controls that are not implemented in Phase 10 must be hidden or disabled with accessible labels and cannot appear as no-op clickable actions.
   - Current: Header/detail call and video controls are disabled, voice is disabled, and More/favorite controls are disabled in detail content, but production screenshots still raised dead-control concerns.
   - Target: Call, video, voice, favorite, and not-yet-implemented More actions are disabled or hidden until their owning phases implement them; message search remains functional because it already has a real query flow.
   - Acceptance: Tests assert unsupported controls are disabled or absent with clear accessible names/titles, and message search opens the real search UI instead of a decorative panel.

9. **Existing supported controls stay functional**: Phase 10 must not break existing real conversation selection, sidebar search, message search, attachment selection, attachment rendering, pinned-message jump/unpin entry points, or logout/session cleanup.
   - Current: These workflows have local component or Playwright coverage from prior phases, but Phase 10 changes around fixture removal and panel control could regress them.
   - Target: Supported workflows continue to use the existing query/API/socket/state contracts without replacing them with static placeholders or disabling them to satisfy the audit.
   - Acceptance: Focused frontend tests and browser checks pass for conversation selection, conversation search, message search open/query/jump, attachment selection/rendering, detail rows, and session cleanup after Phase 10 changes.

10. **Delivery-reliability baseline handoff**: Duplicate sends, false delivered state, and missing realtime recipient receive must be reproduced or documented as Phase 10 baseline evidence, but not repaired inside Phase 10.
   - Current: Production screenshots show one send creating duplicate sender bubbles, delivered indicators that do not match recipient receipt, and recipient pages requiring refresh.
   - Target: The production audit artifact records whether each delivery defect is reproduced, including the two-account steps, observed sender state, observed recipient state, and whether refresh changes the recipient view.
   - Acceptance: Phase 10 artifacts explicitly mark delivery-reliability repair as out of scope for Phase 10 and blocking for the following delivery-reliability phase; no Phase 10 summary may claim the messenger is fully reliable if these defects remain.

11. **Phase 10 evidence and verification record**: Phase 10 must leave a durable pass/fail record that future phases and reviewers can use without re-discovering the same production gaps.
   - Current: Prior phase summaries include local verification and screenshot evidence, but no Phase 10 production-live audit, no production-smoke command record, and no desktop rail close/reopen proof exist.
   - Target: The phase summary or audit artifact records exact commands, exact test files, production smoke result, static scan result, screenshots/traces, changed files, unresolved risks, and the next required phase boundary.
   - Acceptance: A verifier can read Phase 10 artifacts and determine which live failures were reproduced, which static/demo fallback paths were removed, which controls are intentionally disabled, which panel behaviors passed, and which delivery defects remain deferred.

## Boundaries

**In scope:**
- Production-live audit against deployed Vercel/Render with real authenticated smoke accounts.
- Safe smoke-account handling rules and redacted production evidence.
- Static/demo fixture guardrails for production chat runtime.
- Removal or prevention of production runtime placeholder rows for pinned messages, shared files, shared media, message text, media cards, and detail-panel content.
- Desktop detail rail open/close/reopen/Escape/focus-return behavior.
- Mobile detail drawer regression coverage for close paths, focus return, viewport bounds, and server-backed content.
- Honest disabled or hidden state for unimplemented call, video, voice, favorite, and not-yet-implemented More actions.
- Existing supported workflow regression checks for search, selection, attachments, detail content, and session cleanup.
- Production baseline documentation for duplicate-send, false-delivered, and no-refresh receive defects.
- Durable Phase 10 audit/summary artifacts with exact command and evidence outcomes.

**Out of scope:**
- Fixing duplicate-send, delivered/read honesty, or realtime recipient receive defects - owned by the delivery-reliability phase after Phase 10.
- Implementing block/unblock, real More menus, or user-safety actions - owned by Phase 11.
- Implementing changeable identity images/marks, voice messages, or additional media workflows - owned by Phase 12.
- Implementing audio/video call signaling, permission states, or WebRTC flows - owned by Phase 13.
- Final "Chatify is functionally ready" certification - owned by Phase 14 after all later feature and reliability phases pass.
- Replacing the React/Vite/Express/MongoDB/Socket.IO/TanStack Query architecture - not needed for this audit/remediation phase.
- Committing or rewriting unrelated screenshot/config changes that already exist in the working tree - repository hygiene requires a focused Phase 10 scope.

## Constraints

- Production smoke must target the deployed frontend and backend origins, not only localhost.
- Production smoke must use real authenticated accounts and real persisted data, with secrets supplied outside git.
- Production evidence must redact emails, passwords, cookies, tokens, reset codes, and private identifiers not needed for verification.
- Production smoke must not mock or intercept Chatify auth, chat, message, attachment, or socket traffic.
- Test fixtures may remain in `e2e`, `src/test`, or `.test.*` files, but production runtime files must not depend on them.
- Empty, loading, error, disabled, and unavailable states are allowed only when they are truthful and accessible.
- Wide desktop may default the detail rail open, but users must be able to close and reopen it.
- Phase 10 changes must preserve existing supported workflows and must not disable features simply to pass fixture/static scans.
- Local verification should include focused frontend tests, fixture guard tests, frontend lint/build where affected, and production-smoke evidence.
- Existing unrelated dirty planning screenshots/config files must stay out of the Phase 10 SPEC commit.

## Acceptance Criteria

- [ ] `10-PRODUCTION-AUDIT.md` records deployed Vercel/Render production evidence with real smoke accounts, redacted account identifiers, timestamps, URLs/origins, commands or manual steps, screenshots/traces, and pass/fail outcomes.
- [ ] Production smoke credentials are read from environment/secret storage only; no smoke passwords, raw emails, cookies, tokens, or reset codes are committed or written into artifacts.
- [ ] Production smoke does not mock or intercept Chatify auth, chat, message, attachment, or Socket.IO traffic.
- [ ] Fixture/static guardrails pass and fail on forbidden production runtime references to known demo fixture names or e2e fixture identifiers.
- [ ] Pinned messages, shared files, shared media, and security rows render only server-backed data or explicit empty/loading/error/auth/socket states.
- [ ] Desktop detail rail can default open, close through an accessible control, close with Escape, remain hidden after close, reopen from the header, and return focus predictably.
- [ ] Mobile detail drawer opens, closes through button/backdrop/Escape, returns focus to the opener, stays within the viewport, and shares the same real-data contract as desktop.
- [ ] Unsupported call, video, voice, favorite, and not-yet-implemented More controls are disabled or hidden with accessible labels/titles; message search remains functional.
- [ ] Existing supported search, selection, attachment, detail-row, and session cleanup workflows pass focused regression checks after Phase 10 changes.
- [ ] Duplicate-send, false-delivered, and no-refresh recipient receive defects are captured as baseline evidence and explicitly deferred to the delivery-reliability phase.
- [ ] Phase 10 summary or audit artifacts list exact commands, test files, screenshot/trace paths, changed files, residual risks, and the next phase boundary.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.95 | 0.75 | Met | Production-truth audit, fixture removal, and panel control are specific and measurable. |
| Boundary Clarity | 0.92 | 0.70 | Met | Feature implementation is separated from the later control, media, call, and delivery-reliability phases. |
| Constraint Clarity | 0.86 | 0.65 | Met | Production origins, real smoke accounts, no mocks, secret handling, and fixture boundaries are locked. |
| Acceptance Criteria | 0.90 | 0.70 | Met | Pass/fail evidence, guard, browser, and artifact checks are explicit. |
| **Ambiguity** | 0.09 | <=0.20 | Met | Gate passed after user approved all recommendations. |

Status: Met = dimension meets minimum; Below minimum = planner treats as assumption.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | Phase role | Phase 10 audits/removes static production fallback behavior and fixes panel control; feature implementation stays in later phases. |
| 1 | Researcher | Production evidence | Deployed Vercel/Render evidence with real authenticated smoke accounts is mandatory. |
| 1 | Researcher | Smoke credentials | Credentials are supplied through environment or secret storage and are redacted from artifacts. |
| 1 | Researcher | Static content definition | Fake pinned messages, files, media, message text, user rows, and security rows are forbidden as real production data. |
| 2 | Simplifier | Known reference names | Known fake names fail production checks unless created as real test data in the current run. |
| 2 | Simplifier | Minimum viable panel repair | Desktop rail close/reopen/Escape/focus behavior is mandatory; mobile drawer close behavior remains a regression gate. |
| 3 | Boundary Keeper | Unsupported controls | Call, video, voice, favorite, and not-yet-implemented More actions stay hidden or disabled until their owning phases. |
| 3 | Boundary Keeper | Search scope | Message search must remain real because the query/API path exists; it must not be decorative. |
| 3 | Boundary Keeper | Attachments/media scope | Existing attachments/detail data are verified for truthfulness; new media/voice workflows are out of scope. |
| 3 | Boundary Keeper | Identity scope | Changeable user images/marks are out of scope for Phase 10 and belong to the identity/media phase. |
| 4 | Failure Analyst | Duplicate-send/realtime defect | Phase 10 reproduces and records the delivery defect as baseline evidence; repair is out of scope here. |
| 4 | Failure Analyst | Production smoke mocking | Production smoke must not mock auth/chat/message/socket traffic. |
| 4 | Failure Analyst | Rejection cases | Static fixture data, non-closable panels, no-op enabled controls, leaked secrets, or mocked production smoke reject the phase. |
| 5 | Seed Closer | Required artifacts | Phase 10 must produce a production audit artifact, screenshots/traces, guard results, commands, and residual-risk record. |
| 5 | Seed Closer | Done definition | Done requires deployed evidence, fixture guardrails, panel control proof, honest unsupported controls, and delivery-defect handoff. |
| 5 | Seed Closer | Approval | User approved all recommendations and explicitly requested SPEC.md creation. |

---

*Phase: 10-production-messenger-reality-audit-and-fixture-removal*
*Spec created: 2026-06-13*
*Next step: $gsd-discuss-phase 10 - implementation decisions (how to build what's specified above)*
