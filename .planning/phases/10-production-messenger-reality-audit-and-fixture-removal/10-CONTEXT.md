# Phase 10: Production Messenger Reality Audit And Fixture Removal - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 10 converts the messenger acceptance gate from local, fixture-friendly confidence into production-truth evidence. It audits the deployed Vercel/Render product with real smoke accounts, blocks static/demo data from production chat runtime paths, makes the desktop right rail and mobile detail drawer closeable and recoverable, and records the duplicate-send/realtime delivery defects as a baseline handoff for Phase 10.1. It does not implement new conversation safety controls, identity editing, voice, calls, or delivery repair.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**11 requirements are locked.** See `10-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `10-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
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

**Out of scope (from SPEC.md):**
- Fixing duplicate-send, delivered/read honesty, or realtime recipient receive defects - owned by the delivery-reliability phase after Phase 10.
- Implementing block/unblock, real More menus, or user-safety actions - owned by Phase 11.
- Implementing changeable identity images/marks, voice messages, or additional media workflows - owned by Phase 12.
- Implementing audio/video call signaling, permission states, or WebRTC flows - owned by Phase 13.
- Final "Chatify is functionally ready" certification - owned by Phase 14 after all later feature and reliability phases pass.
- Replacing the React/Vite/Express/MongoDB/Socket.IO/TanStack Query architecture - not needed for this audit/remediation phase.
- Committing or rewriting unrelated screenshot/config changes that already exist in the working tree - repository hygiene requires a focused Phase 10 scope.

</spec_lock>

<decisions>
## Implementation Decisions

### Production Smoke And Evidence Model
- **D-01:** Use a hybrid production audit: opt-in automated live Playwright for repeatable checks plus manual notes where live auth, deployment metadata, or visual review cannot be automated reliably.
- **D-02:** Production smoke credentials must come from environment variables or an equivalent local secret store. Use clear names such as `CHATIFY_SMOKE_USER_A_EMAIL`, `CHATIFY_SMOKE_USER_A_PASSWORD`, `CHATIFY_SMOKE_USER_B_EMAIL`, and `CHATIFY_SMOKE_USER_B_PASSWORD`; artifacts may reference only redacted labels such as Smoke user A/B.
- **D-03:** Production URLs should be configurable through variables such as `CHATIFY_PROD_FRONTEND_URL` and `CHATIFY_PROD_BACKEND_URL`, with the current Vercel and Render origins documented as defaults. The audit artifact records resolved origins, timestamps, and deployment identifiers when available.
- **D-04:** Live production smoke must not install `page.route` interception or any equivalent mock for Chatify auth, chat, message, attachment, or Socket.IO traffic. If production smoke cannot run live, it fails closed or records a blocked evidence gate.
- **D-05:** Use fixed smoke accounts and non-destructive production data. When a test must create data, use unique timestamped markers and avoid destructive cleanup of user conversations unless the test owns that data path.
- **D-06:** Write one primary production evidence artifact, `10-PRODUCTION-AUDIT.md`, with baseline observations, fixes, commands, screenshots/traces, redacted account labels, pass/fail outcomes, residual risks, and Phase 10.1 handoff notes.
- **D-07:** Keep production smoke opt-in. Normal local `npm test`, lint, build, and local Playwright runs should not hit production accidentally.

### Fixture And Static Runtime Guardrails
- **D-08:** Extend the existing `fixtureLeakGuard.test.ts` or an adjacent focused guard so production chat runtime and CSS fail on known fixture identifiers, old phase fixture names, reference fake file names, test-only imports, and demo-only static data.
- **D-09:** Add live UI assertions in the production smoke for forbidden fake production content, including `message-states-spec`, `delivery-metrics`, `retry-logic-notes`, older phase identity/message names, and other reference-only rows unless they were created as real smoke data in the current run.
- **D-10:** Keep guard patterns exact and reviewable. Block known fixture names, test fixture identifiers, and production demo paths; avoid broad words that could block legitimate runtime code or planning docs.
- **D-11:** Production runtime must never synthesize pinned messages, shared files, shared media, media cards, security rows, or message text as if they were real server data.

### Desktop And Mobile Detail Panel Control
- **D-12:** The desktop right rail defaults open at `xl` widths when a chat is selected, matching the three-column reference layout, but it must be closeable.
- **D-13:** Closing the desktop rail should be local UI state, not a URL contract in Phase 10. Respect the user closing it for the current selected chat; reopening happens from the conversation header details control.
- **D-14:** Add a visible accessible close control inside the desktop rail and make the conversation header details/More control reopen or toggle the rail on desktop.
- **D-15:** Desktop rail is not modal and should not trap focus. It must support accessible labels, Escape close when focus is inside the rail, and predictable focus return to the opener or close control.
- **D-16:** Keep the current mobile detail drawer model. Verify close button, backdrop close, Escape, focus return to the opener, viewport bounds, no content overlap, and the same server-backed data contract as desktop.
- **D-17:** Mobile drawer improvements may add lightweight focus containment or body scroll lock only if tests expose leakage; do not rewrite the drawer unless required by verification.

### Server-Truth Detail Surfaces And Honest Controls
- **D-18:** Pinned messages, shared files, shared media, and security rows must render only from server-backed props, authenticated state, membership state, socket state, or explicit empty/loading/error states.
- **D-19:** Component tests can use fixtures, but production smoke evidence must prove the deployed UI is not showing hardcoded fake pinned/file/media rows.
- **D-20:** Keep unsupported controls visible-but-disabled where the reference layout expects them, with native disabled semantics, clear accessible labels, and titles. Hide only when a disabled control would be confusing or cramped.
- **D-21:** Header details/More opens conversation details. In-panel More actions remain disabled until Phase 11. Call, video, favorite, and voice remain disabled until their owning phases.
- **D-22:** Existing supported controls must stay functional: conversation selection, sidebar search, message search, attachment selection, attachment rendering, pinned jump/unpin entry points, logout/session cleanup, and theme behavior.
- **D-23:** User identity imagery should be verified as server-derived or deterministic abstract identity only. Making avatars editable is not Phase 10 work.

### Delivery Reliability Baseline Handoff
- **D-24:** Reproduce or document duplicate sender bubbles, false delivered state, and recipient needing refresh with two authenticated smoke accounts. Record sender and recipient observations before and after refresh.
- **D-25:** Do not repair duplicate-send, socket receive, or delivered/read honesty inside Phase 10. That repair belongs to Phase 10.1 and remains blocking before later feature phases.
- **D-26:** Phase 10 may assert socket connection indicators and no mocked sockets, but it must not claim delivery reliability until Phase 10.1 passes real two-account send/receive evidence.

### Verification And Repository Hygiene
- **D-27:** Expected local verification includes focused frontend component tests for rail/drawer/detail content, fixture guard tests, frontend lint, frontend build, local Playwright quality checks, and opt-in production smoke.
- **D-28:** Backend tests are required only if Phase 10 changes backend code. If the phase only changes frontend runtime/tests/evidence, use existing backend behavior as read-only context.
- **D-29:** Create a separate production reality Playwright spec rather than mixing live production checks with local mocked quality-gate specs. This keeps mocked local gates and real production smoke visibly separate.
- **D-30:** If production credentials are absent, production is unreachable, or deployed auth blocks the smoke, mark the Phase 10 evidence gate blocked with exact missing env/command details. Do not substitute mocked evidence.
- **D-31:** Preserve unrelated local work. Stage and commit only Phase 10 context/log/audit/evidence files, intentionally changed source/tests, and normal GSD state updates.

### the agent's Discretion
- The planner may choose exact production smoke spec names, helper names, and artifact screenshot names if the live/no-mock boundary is obvious.
- The planner may choose whether desktop rail state is implemented inside `chat.tsx` or a focused route-level hook as long as durable server/query/socket state remains in existing hooks.
- The planner may choose exact guard implementation details if forbidden production runtime references fail deterministically.
- The planner may choose exact wording for empty/loading/error and disabled-control titles if the UI remains truthful, accessible, and not static-looking.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-SPEC.md` - locked Phase 10 requirements, boundaries, constraints, acceptance criteria, and production-live evidence rules.
- `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-CONTEXT.md` - implementation decisions captured by this discussion.
- `.planning/ROADMAP.md` - Phase 10 goal, success criteria, dependency on Phase 9, and Phase 10.1 handoff.
- `.planning/REQUIREMENTS.md` - PROD-01 through PROD-04, MEDIA-04, DELIV-01 through DELIV-05, CTRL, ID, VOICE, CALL, and TEST-05 traceability.
- `.planning/PROJECT.md` - project core value, brownfield constraints, collaboration preference, repository hygiene, deployment origins, and no-subagent preference.
- `.planning/STATE.md` - current continuity record that Phase 10 is current focus and Phase 10.1 is the urgent next reliability phase.

### Prior Phase Contracts
- `.planning/phases/09-messenger-interaction-quality-gate/09-CONTEXT.md` - behavior-first evidence, accessibility/keyboard guardrails, fixture isolation, unsupported-control rules, and local quality-gate limitations.
- `.planning/phases/09-messenger-interaction-quality-gate/09-BEHAVIOR-GATE.md` - Phase 9 local gate outcomes, screenshot/evidence paths, and residual risk that production-live evidence remained outside scope.
- `.planning/phases/09-messenger-interaction-quality-gate/09-SPEC.md` - locked Phase 9 gate criteria that Phase 10 must strengthen with production truth.
- `.planning/phases/08-media-files-and-conversation-detail-implementation/08-CONTEXT.md` - server-backed attachments, shared media/files, pinned messages, protected preview/download, and detail drawer/rail contracts.
- `.planning/phases/08-media-files-and-conversation-detail-implementation/08-BEHAVIOR-SMOKE.md` - media/detail evidence and residual risks to verify live.
- `.planning/phases/07-messenger-functional-parity-restoration/07-CONTEXT.md` - fixture isolation, honest controls, no fake rail content, and route-state boundaries.
- `.planning/phases/06-messenger-visual-parity/06-CONTEXT.md` - desktop/mobile light/dark reference direction, abstract non-living identity, and visual parity constraints.
- `.planning/phases/05-messenger-baseline-completion/05-CONTEXT.md` - conversation search, message search, selected-chat continuity, presence, and session cleanup contracts.
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` - canonical send/retry/status/unread/idempotency contracts that Phase 10.1 will repair if production drift exists.
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` - authenticated socket identity, room membership, reconnect, targeted emits, and presence rules.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - frontend/backend layering, query/socket/API ownership, controller/model/service responsibilities, and socket/auth boundaries.
- `.planning/codebase/CONVENTIONS.md` - TypeScript, ESM, naming, lint, import, logging, and module boundaries.
- `.planning/codebase/TESTING.md` - historical testing map; verify live package scripts because current repo has Vitest and Playwright scripts.

### Frontend Runtime And Test Files
- `Frontend/Chatify/package.json` - live frontend scripts: `test`, `test:ui`, `lint`, and `build`; production smoke should remain opt-in.
- `Frontend/Chatify/playwright.config.ts` - current local Playwright config for `127.0.0.1:4177`; production smoke likely needs separate config, project, or env-gated spec behavior.
- `Frontend/Chatify/e2e/chat-quality-gate.spec.ts` - Phase 9 mocked local quality gate to preserve and not confuse with live production smoke.
- `Frontend/Chatify/e2e/pages/chatPage.ts` - existing Playwright helper patterns for route mocks and local evidence; production smoke helpers must avoid live traffic interception.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - route orchestrator for selected chat, rail/drawer state, search, send/retry, session, socket, and theme behavior; preserve existing local user work.
- `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx` - layout integration point for desktop rail and responsive chat shell.
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx` - current desktop rail is static `xl:flex` with no close/reopen state; Phase 10 must make it controllable.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailDrawer.tsx` - existing mobile drawer with close button, backdrop, Escape, and focus-on-open behavior; preserve and strengthen tests.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` - shared detail content renders pinned messages, shared files, shared media, security rows, search, and disabled unsupported actions from props.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - header call/video/search/details controls and desktop/mobile detail opener integration point.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - active attachment selector, disabled voice control, send behavior, and composer state.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` - existing runtime fixture/private/living-term guard to extend for Phase 10 production acceptance.
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.test.tsx` - current detail rail section and disabled-control coverage; add close/reopen/Escape/focus tests or adjacent coverage.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailDrawer.test.tsx` - mobile drawer behavior coverage to preserve and extend for focus return/viewport bounds.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - query ownership for message search, shared assets, pinned messages, and send behavior.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - Socket.IO connection and cache update boundary to observe, not mock, in production smoke.
- `Frontend/Chatify/src/api/messageApi.ts` - message search, attachment preview/download, shared assets, and pinned-message API client.

### Backend Runtime And Test Files
- `Backend/Chatify/package.json` - backend `npm test` command if backend code changes become necessary.
- `Backend/Chatify/Controller/messageController.mjs` - server-backed message, attachment, shared-asset, pinned-message, preview/download, and socket emit behavior.
- `Backend/Chatify/Config/socket.mjs` - Socket.IO room and realtime behavior that production smoke should observe and Phase 10.1 will repair if delivery remains broken.
- `Backend/Chatify/test/message/*.test.mjs` - backend media/detail contract proof from earlier phases.
- `Backend/Chatify/test/socket/*.test.mjs` - socket integration proof patterns if Phase 10 touches backend/socket contracts.

### Supporting Skills Used For This Discussion
- `C:/Users/saieh/.agents/skills/webapp-testing/SKILL.md` - Playwright/web behavior verification guidance.
- `C:/Users/saieh/.agents/skills/accessibility/SKILL.md` - keyboard, focus, ARIA, disabled state, and axe guidance.
- `C:/Users/saieh/.agents/skills/tanstack-query/SKILL.md` - query key, cache, server-state, and invalidation guidance.
- `C:/Users/saieh/.agents/skills/websocket-engineer/SKILL.md` - Socket.IO rooms, auth, reconnect, live behavior, and no-mock guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConversationDetailContent.tsx`: Already accepts server-backed pinned/shared/security props, renders loading/error/empty states, and keeps call/video/favorite/More disabled when no action is wired. Reuse it for both desktop rail and mobile drawer.
- `ConversationDetailDrawer.tsx`: Already has close button, backdrop close, Escape close, and focus-on-open. Preserve this behavior and add missing focus return/viewport regression coverage as needed.
- `MessageComposer.tsx`: Already provides real attachment file selection, validation, tray state, and disabled voice semantics. Phase 10 should verify it is not static/inert rather than reimplement attachment behavior.
- `fixtureLeakGuard.test.ts`: Already blocks old fixture identifiers, fake reference file names, private storage terms, and living visual terms from chat runtime source/CSS. Extend this instead of inventing a parallel source scan if practical.
- `useChatQueries.ts`: Already owns `useMessageSearch`, shared assets, pinned messages, and send mutation flows. Detail surfaces should keep consuming these query-backed contracts.
- `playwright.config.ts` and `e2e/pages/chatPage.ts`: Useful for local mocked quality gates, but production smoke must create a no-route-interception path so live evidence is not mixed with deterministic fixture testing.

### Established Patterns
- TanStack Query owns durable chat/message/detail server state; components render props and local UI state only.
- Socket.IO handling lives in `useChatSocket.ts`; UI components should not create direct socket connections or register independent socket listeners.
- Unsupported controls are disabled or hidden with accessible labels; enabled no-op buttons are blocking failures.
- Test fixtures can live in test/e2e paths, but production runtime source must not import or synthesize fixture data.
- Visual identity remains abstract and non-living. Humans, animals, plants, mascots, realistic avatars, photos, silhouettes, and similar imagery are not allowed in chat visuals or fixtures.
- The current `.planning/codebase/TESTING.md` is stale; use live package scripts and current test files for verification planning.

### Integration Points
- Add local UI state for desktop rail visibility near the chat route orchestrator or a focused hook, then pass close/reopen handlers through the shell/header/rail.
- Add a desktop rail close button and Escape handling without turning the rail into a modal dialog.
- Keep mobile detail drawer content shared with desktop rail through `ConversationDetailContent`.
- Add or extend tests around `ChatContextRail`, `ConversationDetailDrawer`, `ChatShell`, and header detail controls.
- Add a separate opt-in production smoke spec/config path that targets deployed URLs and refuses auth/chat/message/socket mocks.
- Create `10-PRODUCTION-AUDIT.md` during execution with live evidence, screenshots/traces, command outcomes, and delivery defect baseline.

</code_context>

<specifics>
## Specific Ideas

- The phase should make the live website behave like a website, not like a reference image.
- Use fixed smoke accounts with redacted labels and optional timestamp markers for any created smoke messages.
- Suggested artifact paths include `.planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-PRODUCTION-AUDIT.md`, `10-prod-desktop-baseline.png`, `10-prod-desktop-fixed.png`, `10-prod-mobile-baseline.png`, and `10-prod-mobile-fixed.png`.
- Suggested production smoke command should be explicit and opt-in, for example with `CHATIFY_PRODUCTION_SMOKE=1` plus required smoke credential variables.
- The delivery bug must be described with exact sender and recipient observations, including whether refresh changes the recipient view.

</specifics>

<deferred>
## Deferred Ideas

- Duplicate-send, false delivered state, and missing realtime recipient receive repair belong to Phase 10.1.
- Block/unblock, real More menus, and conversation safety actions belong to Phase 11.
- Editable identity imagery, expanded media workflows, and voice messages belong to Phase 12.
- Audio/video call signaling and permission flows belong to Phase 13.
- Final deployed product readiness certification belongs to Phase 14.

</deferred>

---

*Phase: 10-production-messenger-reality-audit-and-fixture-removal*
*Context gathered: 2026-06-13*
