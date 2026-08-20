# Phase 07: Messenger Functional Parity Restoration - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 07 converts the Phase 06 reference-matched `/chat` UI from a static-looking visual shell into a behavior-backed production messenger. It restores real conversation, message, composer, search, presence, typing, receipt, retry, action, navigation, session, mobile, and theme workflows behind the existing visual direction. It does not add real attachments, shared media/files, pinned-message storage, calls, voice messages, groups, end-to-end encryption, notifications, admin tooling, or deployment work.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**12 requirements are locked.** See `07-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `07-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Remove or isolate Phase 6 visual fixture paths from production chat runtime.
- Keep visual fixtures only in test/e2e support where needed for deterministic tests.
- Restore production-state wiring for conversation list, selected conversation, messages, unread counts, receipts, typing, presence, connection, session, and theme behavior.
- Restore supported composer, send, retry, dismiss, reply, edit, delete, copy, reaction, search, conversation selection, URL restore, new-chat continuation, auth-expired, and mobile drawer workflows.
- Make unsupported visible controls honest by hiding them or rendering them as truly disabled.
- Replace fake right-rail shared files/media/pinned/security content with real data-backed, empty, hidden, or disabled states.
- Add or update frontend unit/component and Playwright behavior coverage for Phase 7 workflows.
- Preserve the Phase 6 visual design language while making the UI behavior-backed.

**Out of scope (from SPEC.md):**
- Real attachments, uploads, media previews, downloads, shared files, and shared media implementation - Phase 8 owns media/file capability.
- Voice calls, video calls, favorite conversations, notification systems, and full "more actions" menus - these are not supported v1 behaviors in this phase.
- Group chat expansion, channels, bots, integrations, admin/moderation, and push/email notifications - these remain outside the focused messenger restoration scope.
- End-to-end encryption implementation - this needs a separate storage and key-management design.
- Major backend platform rewrites - only targeted backend/API fixes required to restore already-claimed behavior are allowed.
- Production deployment or release operations - this phase produces code, tests, and evidence, not a deployment.

</spec_lock>

<decisions>
## Implementation Decisions

### Fixture Isolation And Test Data
- **D-01:** Remove `chatVisualSmoke=phase06` from product runtime entirely. Deterministic visual setup belongs in Playwright/test support, not in `chat.tsx` or production components.
- **D-02:** Move Playwright-only visual fixture data to `Frontend/Chatify/e2e/fixtures/`.
- **D-03:** Keep reusable component and hook fixture builders in `Frontend/Chatify/src/test/` when they are needed by Vitest/component tests.
- **D-04:** Phase 6 screenshot fixtures may remain as historical visual evidence, but current behavior tests must use non-Phase-6 fixture names and alternate data so the UI cannot pass only for the original reference identities.
- **D-05:** Add a static guard test or verification step that fails when production chat runtime files contain `Phase06VisualFixture`, `PHASE06_`, `phase06`, or `chatVisualSmoke`.

### Targeted Runtime Restoration
- **D-06:** Do not rewrite the chat page from scratch. Repair targeted seams: `chat.tsx` smoke branch, test fixture imports, `ChatContextRail`, unsupported controls, composer/action behavior tests, realtime coverage, and Playwright behavior flows.
- **D-07:** Keep `Frontend/Chatify/src/pages/chat/chat.tsx` as the orchestration layer. Do not move durable query/socket behavior into presentational components.
- **D-08:** Preserve existing TanStack Query, Zustand, and Socket.IO ownership boundaries. Durable server state remains in query hooks/cache; presence/typing remains in `presenceStore` and `useChatSocket`; transient UI state remains in `chat.tsx`, focused route hooks, or component props.

### Unsupported Controls And Composer Honesty
- **D-09:** Unsupported header, rail, composer, favorite, call, video, voice, attachment, and more-action controls may remain visible only when they are truly disabled with native `disabled` where possible, muted styling, no enabled hover/pointer affordance, no action handler, and accessible disabled semantics.
- **D-10:** Hide unsupported controls that cannot be made visually and semantically honest without confusing users.
- **D-11:** Keep attachment and voice composer controls disabled in Phase 7, but remove fake file-chip behavior from production messages. Real attachments and file chips are Phase 8.
- **D-12:** Keep the text composer as the only supported send path in Phase 7.

### Right Rail Data Integrity
- **D-13:** Do not reuse latest messages as fake pinned messages. Pinned content must be real, empty, hidden, or clearly unavailable until a pin data contract exists.
- **D-14:** Shared files and shared media sections must show zero/empty/unavailable states or be hidden. Do not render static fake files, abstract media tiles, or fixture downloads as real conversation assets.
- **D-15:** Conversation security rows must map to actual available state: authenticated session from auth state, member-only room from selected chat membership, and socket connected from socket/reconnect state. When state is unknown or unsupported, show neutral or unavailable wording instead of `Secure`, `Verified`, or equivalent claims.

### Composer And Message Actions
- **D-16:** Composer coverage must include successful send, failed send, retry with the same `clientMessageId`, dismiss failed, empty disabled, offline disabled, session-expired disabled, and the 1000-character boundary.
- **D-17:** Message action coverage must include reply, edit, copy, delete-for-self, delete-for-everyone, quick reaction, expanded emoji reaction entry point, and failure rollback or user-visible recovery where applicable.
- **D-18:** Put most message-action and composer edge cases in Vitest/component tests. Playwright should cover one representative user-facing action flow rather than every permutation.

### Realtime, Search, And Navigation Verification
- **D-19:** Expand `useChatSocket` and related component tests to prove message, status, typing, presence, unread, edit/delete/reaction, or reconnect updates mutate visible UI/cache after initial render.
- **D-20:** Add one controlled browser-level realtime path in Playwright or equivalent UI smoke. It may simulate controlled app state, but it must prove a visible update after initial render.
- **D-21:** Playwright visual-only tests may still abort `socket.io`; functional behavior tests must not rely on a global socket abort as their proof path.
- **D-22:** Playwright must cover sidebar search, no-results state, message search, result jump/highlight, selected-chat URL restore, invalid-chat fallback, mobile drawer selection, and new-chat continuation with production-style mocked API data.

### Theme, Mobile, Evidence, And Backend Scope
- **D-23:** Run the deepest Phase 7 behavior path on desktop light and mobile dark. Add lighter smoke assertions across desktop/mobile and light/dark so all four variants are exercised without making Phase 7 exhaustive.
- **D-24:** Capture Phase 7 screenshots only after interactions such as search, send/retry, mobile drawer, or theme switching. Do not use first-paint screenshots as the main proof.
- **D-25:** Store Phase 7 evidence under `.planning/phases/07-messenger-functional-parity-restoration/`.
- **D-26:** Avoid backend API changes unless a current supported workflow has a proven contract bug. Do not add media, file, pin, call, voice, or detail-panel data APIs in Phase 7.

### Agent Discretion
- The planner may choose exact test file names, fixture helper names, and static guard implementation as long as product runtime fixture leakage fails deterministically.
- The planner may choose whether a disabled unsupported control is removed or kept when both outcomes satisfy honest state semantics and visual parity.
- The planner may choose exact right-rail empty-state copy as long as it does not imply unsupported media, pin, file, encryption, or security capabilities.
- The planner may choose the exact Playwright split between visual-only smoke and behavior smoke as long as Phase 7 proves interactions before screenshots.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/07-messenger-functional-parity-restoration/07-SPEC.md` - locked Phase 07 requirements, boundaries, constraints, and acceptance criteria.
- `.planning/phases/07-messenger-functional-parity-restoration/07-CONTEXT.md` - implementation decisions captured by this discussion.
- `.planning/PROJECT.md` - project core value, collaboration preference, brownfield constraints, and repository hygiene constraints.
- `.planning/REQUIREMENTS.md` - PARITY-01 through PARITY-03, TEST-05, and related UI/BASE/MSG/RT requirements.
- `.planning/ROADMAP.md` - Phase 07 goal, success criteria, dependency on Phase 06, and recommended planning waves.
- `.planning/STATE.md` - current project position and correction-phase continuity notes.

### Prior Phase Contracts
- `.planning/phases/06-messenger-visual-parity/06-CONTEXT.md` - Phase 06 theme, visual parity, abstract identity, right rail, and reference-control decisions that Phase 07 must make functional or honest.
- `.planning/phases/05-messenger-baseline-completion/05-CONTEXT.md` - conversation search, message search, selected-chat restoration, new-chat continuation, presence, typing, and auth-loss cleanup decisions.
- `.planning/phases/04-messenger-ui-reconstruction/04-CONTEXT.md` - componentized messenger UI, composer recovery, message actions, accessibility, and frontend regression decisions.
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` - canonical message state, idempotent send, optimistic merge, retry, status, unread, edit, delete, reaction, and visibility contracts.
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` - authenticated socket identity, membership checks, targeted emits, privacy-aware presence, and reconnect behavior.

### Codebase Maps
- `.planning/codebase/STRUCTURE.md` - current frontend/backend directory layout and where test fixtures/components belong.
- `.planning/codebase/TESTING.md` - historical test map; verify live package scripts because the map predates current Vitest/Playwright setup.
- `.planning/codebase/CONVENTIONS.md` - frontend TypeScript, Tailwind, import, naming, lint, and testing conventions.

### Frontend Runtime And Test Files
- `Frontend/Chatify/src/pages/chat/chat.tsx` - route orchestration, current `chatVisualSmoke=phase06` runtime branch, selected chat, search, send, retry, message actions, auth-expired cleanup, and socket state.
- `Frontend/Chatify/src/pages/chat/components/Phase06VisualFixture.ts` - current production-source fixture that must be removed from product runtime paths or moved to test-only support.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` - current Playwright smoke imports Phase 6 fixtures and aborts sockets; Phase 7 must split visual smoke from behavior smoke.
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx` - current fake right-rail files, media, pinned fallback, favorite, and security rows.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - unsupported call/video/more controls and message search trigger.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - text send path, disabled attachment/voice controls, send disabled state, reply, emoji, and secure-session copy.
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx` - search mode, message list, composer, session/offline/reconnect states.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - message status, retry/dismiss, edit/delete/reaction action surfaces.
- `Frontend/Chatify/src/pages/chat/components/MessageActionMenu.tsx` - reply, edit, copy, delete, and reaction menu behavior.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - local conversation search, mobile drawer selection, new-chat entry points, and unread/presence display.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - TanStack Query chat/message/search/mutation ownership and optimistic state.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - Socket.IO connection, room, presence, typing, message, receipt, edit/delete/reaction, unread, and reconnect cache updates.
- `Frontend/Chatify/src/store/presenceStore.ts` - online and typing state used by visible UI.
- `Frontend/Chatify/src/test/chatFixtures.ts` - existing reusable frontend fixture builders for component/hook tests.
- `Frontend/Chatify/src/hooks/useChatSocket.test.tsx` - existing mocked Socket.IO test pattern to extend.
- `Frontend/Chatify/src/hooks/useChatQueries.test.tsx` - existing Query/test-wrapper pattern for message search and cache isolation.
- `Frontend/Chatify/src/pages/chat/components/*.test.tsx` - existing component test coverage to update for honest controls and behavior-backed surfaces.
- `Frontend/Chatify/package.json` - live scripts: `test`, `test:ui`, `lint`, and `build`.

### Supporting Skills Used For This Discussion
- `C:/Users/saieh/.agents/skills/react-best-practices/SKILL.md` - React component/state boundary and performance guidance.
- `C:/Users/saieh/.agents/skills/tanstack-query/SKILL.md` - query key, optimistic update, invalidation, and test-wrapper guidance.
- `C:/Users/saieh/.agents/skills/websocket-engineer/SKILL.md` - Socket.IO realtime, room, reconnect, presence, and validation guidance.
- `C:/Users/saieh/.agents/skills/e2e-testing-patterns/SKILL.md` - deterministic behavior-first Playwright guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Frontend/Chatify/src/pages/chat/chat.tsx`: Keep as the route orchestrator for query/socket state, selected chat, search, send/retry, actions, session cleanup, and theme plumbing; remove the visual-smoke branch.
- `useChatQueries.ts`: Reuse current query keys, send/edit/delete/reaction mutations, message search hook, failed-send retry/dismiss helpers, and cache ownership.
- `useChatSocket.ts`: Reuse current room, presence, typing, message, unread, receipt, edit/delete/reaction, and reconnect handlers; extend tests around visible/cache updates.
- `presenceStore.ts`: Reuse online/typing state for visible header/sidebar/typing rows; avoid component-local realtime state.
- `ChatContextRail.tsx`: Reuse layout shell and search wiring, but remove fake static files/media/pinned/security claims.
- `ConversationHeader.tsx` and `MessageComposer.tsx`: Reuse visual shell and supported search/send behavior, but make unsupported controls genuinely disabled or hidden.
- `MessageBubble.tsx` and `MessageActionMenu.tsx`: Reuse action surfaces and mutation callbacks; strengthen tests around failure and rollback behavior.
- `Frontend/Chatify/src/test/chatFixtures.ts`: Reuse for production-style test data instead of Phase 6 visual fixture constants.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts`: Reuse routing/interception patterns, but split fixtures and behavior paths away from Phase 6 runtime shortcuts.

### Established Patterns
- Product pages should not import deterministic visual fixture modules.
- Frontend transport stays in API modules and React Query hooks; pages/components should not make raw Axios calls.
- TanStack Query owns durable chat/message/search server state; transient UI state stays local or in focused chat hooks.
- Socket.IO behavior is centralized in `useChatSocket.ts` and `presenceStore`; presentational components receive state through props.
- Tests already use Vitest, React Testing Library, semantic role/name queries, QueryClient wrappers, and Playwright route interception.
- Theme is token-driven through the chat root and `useChatTheme`; Phase 7 must not fork component trees by theme.
- Chat identity imagery must remain abstract and non-living; user profile photo URLs stay ignored in chat surfaces.

### Integration Points
- Remove `isPhase06VisualSmoke()` and downstream runtime branches from `chat.tsx`.
- Move `Phase06VisualFixture` exports or their replacements into test/e2e fixture paths and update imports.
- Update `ChatContextRail` props or derived state so pinned/files/media/security sections are real, empty, hidden, disabled, or mapped to available auth/socket/membership state.
- Update disabled control markup/classes in `ConversationHeader`, `ChatContextRail`, and `MessageComposer`.
- Extend existing component tests for honest disabled controls, empty right-rail sections, composer lifecycle, message actions, search, and session/offline states.
- Extend socket/query tests for realtime cache/UI updates after initial render.
- Split Playwright smoke into visual-only evidence and behavior-first flows that use alternate production-style fixture data.
- Add a static fixture-leak guard to Vitest or a documented verification script.

</code_context>

<specifics>
## Specific Ideas

- Preserve the Phase 6 desktop/mobile light/dark visual direction, but make every surface behavior-backed or honestly unavailable.
- Keep the four supplied images as visual direction only, not as product data.
- Use abstract encrypted-pattern identity tiles and non-living placeholders only.
- Use alternate fixture names and message copy in Phase 7 tests so screenshots cannot pass by matching only `IN-8B21`/Phase 6 reference content.
- Screenshots should be captured after user interactions such as search, send/retry, mobile drawer selection, and theme switching.

</specifics>

<deferred>
## Deferred Ideas

- Real attachments, uploads, media previews, downloads, shared files, shared media, pinned message persistence, and data-backed detail panels remain Phase 8.
- Exhaustive end-to-end interaction quality, accessibility, keyboard, screenshot-after-every-workflow matrix, and final v1 acceptance gate remain Phase 9.
- Calls, video calls, voice messages, favorite conversations, full more-actions menus, groups, notifications, admin/moderation, and end-to-end encryption remain outside Phase 7.

</deferred>

---

*Phase: 07-messenger-functional-parity-restoration*
*Context gathered: 2026-06-12*
