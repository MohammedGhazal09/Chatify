# Phase 07: Messenger Functional Parity Restoration - Research

**Date:** 2026-06-12
**Status:** Research complete
**Mode:** Inline research, no subagents

## Research Question

How should Chatify convert the Phase 06 reference-matched messenger UI into a working production messenger surface without expanding Phase 07 into media, files, calls, pins, or backend platform work?

## Skills Used

- `gsd-plan-phase`: Phase planning workflow, coverage gates, state/roadmap update rules, and plan artifact structure.
- `find-skills`: Skill discovery discipline. Existing local skills were used directly; no external install was needed.
- `react-best-practices`: Component boundary and render-performance guidance for repairing the chat shell without a broad rewrite.
- `tanstack-query`: Query key, optimistic update, invalidation, and test-wrapper guidance for preserving server-state ownership.
- `websocket-engineer`: Socket.IO room, presence, reconnect, and auth-aware realtime validation patterns.
- `e2e-testing-patterns`: Behavior-first Playwright structure, deterministic route fixtures, and stable selector guidance.
- `design-taste-frontend`: UI honesty, disabled states, responsive stability, and avoiding static decorative product surfaces.

## Current State Findings

### Fixture leakage

- `Frontend/Chatify/src/pages/chat/chat.tsx` defines `isPhase06VisualSmoke()` and checks `chatVisualSmoke=phase06`.
- That branch disables the socket path through `useChatSocket({ enabled: !isVisualSmokeMode && ... })`.
- `Frontend/Chatify/src/pages/chat/components/Phase06VisualFixture.ts` lives in the production chat component tree, not a test-only fixture path.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` imports `Phase06VisualFixture`, opens `/?chatId=...&chatTheme=...&chatVisualSmoke=phase06`, and aborts `**/socket.io/**`.
- The current Playwright evidence can pass through static Phase 06 data even if production chat state, socket updates, and unsupported controls are broken.

### Existing live behavior worth preserving

- `chat.tsx` already orchestrates real `useChats`, `useMessages`, `useUnreadCounts`, `useMessageSearch`, `useChatSocket`, `presenceStore`, selected-chat persistence, auth-expired cleanup, send/retry/dismiss, edit/delete/reaction, and mobile drawer state.
- `useChatQueries.ts` already owns TanStack Query message/search/mutation behavior, including `clientMessageId`, optimistic inserts, failure marking, retry, and cache isolation.
- `messageCache.ts` already has focused helper coverage for optimistic merge, failure, dismissal, duplicate convergence, status, unread, edit, delete, and reaction behavior.
- `useChatSocket.ts` already listens for `message:new`, status updates, batch reads, unread updates, typing, presence, edit/delete/reaction, reconnect, and room join/leave.
- `useChatSocket.test.tsx` already mocks `socket.io-client` and can be extended to trigger registered event callbacks.
- `ConversationPane.test.tsx`, `MessageBubble.test.tsx`, `MessageComposer.test.tsx`, `MessageActionMenu.test.tsx`, `ChatSidebar.test.tsx`, and hook tests provide the existing Vitest/RTL pattern.

### Static or misleading UI surfaces

- `ChatContextRail.tsx` hardcodes `sharedFiles` and `mediaTiles` arrays.
- The rail derives "pinned messages" from latest messages or fallback reference copy, so it presents unpinned conversation text as pinned content.
- The rail shows security rows with fixed `Verified`, `Active`, and `Secure` values that are not derived from auth, membership, or socket state.
- `ConversationHeader.tsx` renders Call, Video call, and More as buttons with `aria-disabled="true"` but enabled-looking classes such as `cursor-pointer` and hover accent styling.
- `ChatContextRail.tsx` and `MessageComposer.tsx` have similar disabled-only-by-ARIA controls for favorite, call/video/more, attachment, and voice.
- `MessageComposer.tsx` displays "Secure session active" as a fixed label even though Phase 07 should avoid unsupported security claims and bind session/socket wording to real state.

### E2E test gaps

- Current Playwright uses stable route interception and useful viewport assertions, but it is centered on Phase 06 fixture data and screenshots.
- It checks some interactions, such as header search, drawer search, new chat continuation, URL restore, invalid fallback, and auth-expired cleanup, but the data source is still the Phase 06 visual fixture.
- It does not prove a controlled visible update after initial render for realtime state unless `seedPhase06Presence()` is counted, and that seed happens during setup before assertions.
- Functional Phase 07 tests should use alternate production-style fixture names and message text, perform interactions before screenshots, and avoid relying on the global socket abort used by visual-only smoke.

## Recommended Implementation Shape

### Plan split

1. **Fixture isolation and static guardrails**
   - Move Phase 06 visual data to e2e/test fixture locations.
   - Remove `chatVisualSmoke=phase06` runtime behavior from `chat.tsx`.
   - Add a Vitest static guard that fails on fixture leakage in non-test chat runtime files.
   - Keep any historical Phase 06 screenshot smoke deterministic, but test-only.

2. **Runtime behavior and honesty repairs**
   - Keep `chat.tsx` as the orchestrator.
   - Repair misleading right-rail, header, composer, and action surfaces.
   - Preserve real query/socket/store ownership.
   - Add focused component/hook coverage for composer, action, disabled-control, rail, search, and realtime cache/UI behavior.

3. **Behavior-first browser verification**
   - Add Phase 07 production-style Playwright fixtures with non-Phase-06 names.
   - Add browser workflows for search, selection, message search, new-chat continuation, mobile drawer, theme switching, auth-expired cleanup, send/retry, and a controlled visible realtime update after initial render.
   - Capture screenshots only after interactions and store evidence under the Phase 07 directory.

### Why this split is safer than one large plan

- Fixture isolation is a prerequisite. If product code still branches on `chatVisualSmoke`, later behavior tests can give false confidence.
- Runtime honesty changes touch several shared UI components and should be proven mostly with fast component/hook tests.
- Browser verification should happen after components are no longer using fake runtime shortcuts; otherwise Playwright can only prove the old static path.

## Validation Architecture

### Static guard

Add a test or script that scans production chat runtime files and fails if any non-test source file under `Frontend/Chatify/src/pages/chat` contains:

- `Phase06VisualFixture`
- `PHASE06_`
- `phase06`
- `chatVisualSmoke`

Recommended implementation: a Vitest file such as `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` using Node `fs` and `path`, excluding `.test.*`, `src/test`, and e2e fixture paths.

### Component and hook coverage

Use existing React Testing Library and QueryClient wrapper patterns. Prioritize:

- `MessageComposer.test.tsx`: send button, Enter send, Shift+Enter newline, empty/offline/session-expired/over-limit disabled, failed-send error text, disabled attachment/voice native semantics.
- `MessageBubble.test.tsx`: failed retry/dismiss carrying `clientMessageId`, status labels, highlight, edit/tombstone/reaction display.
- `MessageActionMenu.test.tsx`: reply, edit, copy, delete-for-self, delete-for-everyone, quick reaction, expanded reaction entry, Escape/focus.
- `ChatContextRail.test.tsx`: no fake files/media/pins, real/empty/unavailable states, honest security rows, disabled unsupported actions.
- `ConversationHeader.test.tsx`: unsupported call/video/more are native disabled or absent; search remains functional.
- `useChatSocket.test.tsx`: trigger registered event callbacks and assert cache/store updates for at least message, typing/presence, unread/status, and reconnect invalidation.
- `useChatQueries.test.tsx` and `messageCache.test.ts`: retain search isolation and optimistic lifecycle guarantees.

### Browser behavior coverage

Use Playwright route interception for HTTP APIs with production-style fixture data, not Phase 06 fixture constants. Recommended flows:

- Desktop light: sidebar search, no-results, selected chat, message search, jump/highlight, send success, retry/dismiss failure, screenshot after interactions.
- Mobile dark: drawer open/close, conversation selection, composer, message search or send, no horizontal overflow, no composer overlap, screenshot after interactions.
- Cross-theme smoke: desktop dark and mobile light should exercise at least selection/search/disabled-control assertions.
- URL restore and invalid fallback.
- Exact-email new-chat continuation.
- Auth-expired cleanup hides private content and routes to login.
- Controlled visible realtime update after first render, such as setting typing/presence through the store after the page is already loaded, plus hook tests for real Socket.IO event handling.

## Risks And Mitigations

| Risk | Recommendation |
|------|----------------|
| Removing the smoke branch breaks Phase 06 visual screenshots | Keep visual fixture data in e2e fixtures and route-mocked tests; do not keep product runtime query flags. |
| Static guard catches test-only Phase 06 fixture files | Scope the guard to production runtime paths and exclude `.test.*`, `src/test`, and `e2e/fixtures`. |
| Right rail becomes empty and loses visual parity | Keep the layout and sections, but render honest empty/unavailable states instead of fake assets. |
| Browser realtime proof becomes flaky without a real backend socket | Use hook tests for Socket.IO event callbacks and a controlled browser-visible store/state update after initial render. Do not rely on global socket abort for functional proof. |
| Phase 07 drifts into Phase 08 media/detail APIs | Do not add upload, file, media, pin, call, voice, or detail-panel APIs in this phase. |
| Broad chat rewrite creates regressions | Repair targeted seams only. Keep `chat.tsx`, TanStack Query hooks, Zustand presence store, and `useChatSocket` ownership boundaries. |

## Research Conclusion

Phase 07 should be planned as a three-wave correction phase: isolate fixtures first, repair live/honest runtime surfaces second, and close with behavior-first Playwright and realtime proof third. The existing code already has most of the real messaging behaviors; the main implementation risk is allowing Phase 06 visual fixtures and fake rail/control content to continue masking product behavior.

## RESEARCH COMPLETE
