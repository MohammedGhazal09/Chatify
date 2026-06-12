# Phase 7: Messenger Functional Parity Restoration - Specification

**Created:** 2026-06-12
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 12 locked

## Goal

The Phase 6 messenger reference UI must become a working production messenger surface where chat, message, presence, status, search, selection, navigation, session, and theme behavior all come from real app state and supported APIs instead of static visual fixtures.

## Background

The chat page currently has real production wiring for chats, messages, unread counts, optimistic sending, retry, edit, delete, reactions, message search, selected-chat persistence, Socket.IO presence/typing/reconnect, auth-expired handling, and light/dark chat theme state. That wiring lives mainly in `Frontend/Chatify/src/pages/chat/chat.tsx`, `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/hooks/useChatSocket.ts`, `Frontend/Chatify/src/store/presenceStore.ts`, and the chat components under `Frontend/Chatify/src/pages/chat/components`.

Phase 6 introduced reference visual parity but also left a fixture-heavy validation path. `Frontend/Chatify/src/pages/chat/components/Phase06VisualFixture.ts` contains static users, chats, messages, file chips, unread counts, presence, and typing data. `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` imports that fixture, mocks the API, aborts `socket.io`, and opens the app with `chatVisualSmoke=phase06`. The runtime route also detects `chatVisualSmoke=phase06` and disables socket behavior in that mode.

Several reference UI surfaces also look product-like while not being backed by real supported behavior. Examples include disabled call/video/more/favorite/voice/attachment controls, hardcoded right-rail shared files/media, optimistic fixture file chips, static security rows, and visual-smoke screenshots that prove layout more than product behavior. Phase 7 corrects that gap. It does not implement real attachments or media sharing; Phase 8 owns those capabilities. Phase 7 makes the current supported messenger workflows honest, live, and behavior-tested.

## Requirements

1. **Production fixture isolation**: Product runtime code must not depend on Phase 6 visual fixture data or visual-smoke query flags.
   - Current: `Phase06VisualFixture.ts` lives under chat components, `chat-ui-smoke.spec.ts` imports it, and `chat.tsx` checks `chatVisualSmoke=phase06` to change socket behavior.
   - Target: Visual fixtures are restricted to test/e2e support paths and no product page/component logic branches on `chatVisualSmoke`, `Phase06VisualFixture`, `PHASE06_*`, or `phase06*` fixture exports.
   - Acceptance: A verifier can run a source search proving no non-test chat runtime file imports or checks Phase 6 fixture identifiers, and `npm run build` still succeeds.

2. **Live chat-state rendering**: The main messenger surfaces must render from production chat state rather than hardcoded reference names, counts, or messages.
   - Current: The live route uses `useChats`, `useMessages`, `useUnreadCounts`, `usePresenceStore`, and `useChatSocket`, but Phase 6 evidence can pass with fully mocked fixture conversations and static labels such as `IN-8B21`.
   - Target: Sidebar conversations, selected header, message list, unread badges, delivery/read indicators, typing indicator, presence, offline/reconnect banners, and session-expired state are all driven by API, TanStack Query, Zustand, or Socket.IO state.
   - Acceptance: Component or Playwright tests with alternate chat/user/message fixtures prove the UI reflects the supplied data and does not require Phase 6 hardcoded identities or messages.

3. **Composer and send lifecycle**: The composer must support real text-message workflows in the reference UI.
   - Current: `MessageComposer` can send text, disable on invalid/offline/session states, show sending/error states, and support emoji/reply UI, but Phase 6 screenshots do not prove the full behavior path.
   - Target: Users can type, send with button or configured Enter behavior, see optimistic sending, receive success reconciliation, see failed-send state, retry with the same `clientMessageId`, dismiss failed messages, and retain proper disabled states for empty, offline, expired-session, and over-limit messages.
   - Acceptance: Tests cover successful send, failed send, retry, dismiss, offline disabled, session-expired disabled, empty disabled, and 1000-character boundary behavior.

4. **Message action workflows**: Supported message actions must work through real handlers and unsupported actions must not appear actionable.
   - Current: `MessageActionMenu` exposes reply, edit, copy, delete, and reactions, while Phase 6 screenshots only prove the menu can render.
   - Target: Reply, edit, copy, delete-for-self, delete-for-everyone, quick reaction, and expanded emoji reaction entry points operate through existing handlers and mutation/cache behavior, with proper rollback or user-visible error on failure.
   - Acceptance: Component or Playwright tests exercise each supported action against controlled data and verify resulting UI/cache changes or error recovery.

5. **Search, selection, and continuation workflows**: Conversation discovery and navigation must remain functional in the reference shell.
   - Current: The app includes conversation search, message search, URL selected-chat persistence, invalid-chat fallback, and new-chat continuation, but Phase 6 validation mainly uses mocked fixture routes.
   - Target: Conversation search, message search, loaded-result jump/highlight, search minimum-length handling, selected-chat URL restore, invalid-chat fallback, mobile drawer selection, and exact-email new-chat continuation all work with production-style API data.
   - Acceptance: Tests cover conversation search, no-results state, message search success, below-minimum search state, loaded-result jump/highlight, selected-chat restore, invalid fallback, mobile drawer selection, and new-chat continuation.

6. **Realtime and reconnect behavior**: Functional validation must prove the UI handles controlled realtime updates instead of aborting sockets for every smoke path.
   - Current: `useChatSocket` supports authenticated connection, room join/leave, presence, typing, message, receipt, unread, edit/delete/reaction, and reconnect invalidation, but Phase 6 Playwright smoke aborts `socket.io`.
   - Target: Phase 7 behavior tests keep visual-only tests deterministic but add at least one controlled browser-level realtime path that proves message, typing/presence, unread/status, or reconnect UI behavior can update after initial render.
   - Acceptance: A functional test or focused hook/component test emits or simulates realtime events and verifies the visible UI/cache update without relying on a static fixture-only render.

7. **Unsupported control honesty**: Visible controls without a supported v1 behavior must be hidden or presented as genuinely disabled.
   - Current: Call, video, more conversation actions, favorite, voice, and attachment controls are visible with `aria-disabled` or unavailable labels, and some still use hover/cursor styling that can make them feel clickable.
   - Target: Unsupported controls are either removed from product surfaces or rendered as clearly disabled with no enabled-looking hover, no pointer cursor, no action handler, and accessible disabled semantics.
   - Acceptance: Tests assert unsupported controls are absent or disabled, have no click side effects, and do not use enabled-looking labels or affordances.

8. **Right-rail data integrity**: The desktop conversation detail rail must not show fake shared assets or fake security claims.
   - Current: `ChatContextRail` hardcodes shared files, abstract shared media tiles, pinned-message count fallback, and static security rows such as `Authenticated session`, `Member-only room`, and `Socket connected`.
   - Target: The right rail may keep its layout, but pinned messages, shared files, shared media, and security rows must be data-backed, empty, hidden, or disabled honestly. Since real attachments/media are Phase 8 scope, Phase 7 must not show fake shared files/media as if they exist.
   - Acceptance: Tests verify the rail shows search and real supported details, hides or empties unsupported media/file/pinned sections without fake items, and maps security/session/socket labels to actual available state or an honest unavailable state.

9. **Responsive workflow parity**: Desktop and mobile variants must support the same real workflows for Phase 7 scope.
   - Current: Phase 6 screenshots prove desktop and mobile visual shells, but a mobile or theme-specific path can still miss behavior coverage.
   - Target: Supported workflows behave the same on desktop and mobile, including drawer/back navigation, selected chat, composer, send/retry, search, auth expiry, and theme switching.
   - Acceptance: Playwright tests execute the required workflow set at desktop and mobile viewports and verify no horizontal overflow or composer overlap after interactions.

10. **Theme workflow parity**: Light and dark themes must not fork the messenger into layout-only behavior.
    - Current: `useChatTheme` and Phase 6 screenshots cover light/dark visual variants, but workflow parity after interactions is not yet locked.
    - Target: Light and dark themes use the same component/state paths and preserve behavior after sending, searching, selecting chats, opening drawers, and handling disabled states.
    - Acceptance: At least one desktop and one mobile behavior smoke runs in both light and dark themes, and screenshots are captured after interactions rather than only at initial render.

11. **Test fixture guardrails**: Test fixtures must be centralized and prevented from leaking into product runtime.
    - Current: Phase 6 visual fixture code lives in a production source subtree and is imported by e2e tests.
    - Target: Test data lives in explicit test/e2e fixture locations, product code has no dependency on those fixtures, and fixture strings such as `phase06-*` or `chatVisualSmoke` cannot be required for product UI behavior.
    - Acceptance: A test or documented verification command fails if product chat runtime code imports fixture support files or contains Phase 6 smoke-mode identifiers.

12. **Behavior-first verification gate**: Phase 7 must close with frontend verification that proves behavior, not screenshots alone.
    - Current: Phase 6 visual parity evidence emphasized screenshots and fixture-backed smoke tests.
    - Target: Phase 7 verification includes lint, build, unit/component tests, and Playwright behavior smoke tests for real supported workflows, with screenshot evidence only after behavior interactions.
    - Acceptance: `npm run lint`, `npm run build`, `npm test`, and `npm run test:ui` pass from `Frontend/Chatify`, and the Phase 7 summary records the exact outcomes.

## Boundaries

**In scope:**
- Remove or isolate Phase 6 visual fixture paths from production chat runtime.
- Keep visual fixtures only in test/e2e support where needed for deterministic tests.
- Restore production-state wiring for conversation list, selected conversation, messages, unread counts, receipts, typing, presence, connection, session, and theme behavior.
- Restore supported composer, send, retry, dismiss, reply, edit, delete, copy, reaction, search, conversation selection, URL restore, new-chat continuation, auth-expired, and mobile drawer workflows.
- Make unsupported visible controls honest by hiding them or rendering them as truly disabled.
- Replace fake right-rail shared files/media/pinned/security content with real data-backed, empty, hidden, or disabled states.
- Add or update frontend unit/component and Playwright behavior coverage for Phase 7 workflows.
- Preserve the Phase 6 visual design language while making the UI behavior-backed.

**Out of scope:**
- Real attachments, uploads, media previews, downloads, shared files, and shared media implementation - Phase 8 owns media/file capability.
- Voice calls, video calls, favorite conversations, notification systems, and full "more actions" menus - these are not supported v1 behaviors in this phase.
- Group chat expansion, channels, bots, integrations, admin/moderation, and push/email notifications - these remain outside the focused messenger restoration scope.
- End-to-end encryption implementation - this needs a separate storage and key-management design.
- Major backend platform rewrites - only targeted backend/API fixes required to restore already-claimed behavior are allowed.
- Production deployment or release operations - this phase produces code, tests, and evidence, not a deployment.

## Constraints

- Keep the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO realtime layer, TanStack Query, Zustand, Tailwind, and npm package layout.
- Do not introduce new major frontend state libraries or a second realtime client.
- Preserve the Phase 6 desktop/mobile light/dark visual direction while correcting behavior and honesty.
- Do not use humans, animals, realistic avatars, profile photos, or living imagery in identity/media placeholders; keep abstract identity tiles and non-living visual marks.
- Product runtime must not require Phase 6 fixture data, `phase06-*` ids, or `chatVisualSmoke=phase06` to render a working chat.
- Tests must be deterministic. Mock APIs are allowed for browser behavior tests, but they must exercise user workflows and state transitions instead of only initial static screenshots.
- Socket behavior can be simulated or controlled in tests, but Phase 7 cannot rely on aborting `socket.io` for every functional smoke path.
- Supported workflows must be tested on desktop and mobile, and in light and dark themes where theme parity is claimed.

## Acceptance Criteria

- [ ] Product chat runtime has no dependency on `Phase06VisualFixture`, `PHASE06_*`, `phase06VisualFixture`, or `chatVisualSmoke=phase06`.
- [ ] Conversation list, selected header, message list, unread counts, receipts, typing, presence, connection, and session surfaces render from live app state or controlled production-style test data.
- [ ] Composer workflows pass for successful send, failed send, retry, dismiss, offline disabled, session-expired disabled, empty disabled, and over-limit disabled states.
- [ ] Message action workflows pass for reply, edit, copy, delete-for-self, delete-for-everyone, and reactions, including failure recovery where applicable.
- [ ] Search and navigation workflows pass for conversation search, message search, result jump/highlight, URL restore, invalid-chat fallback, new-chat continuation, and mobile drawer selection.
- [ ] At least one realtime or simulated realtime behavior path updates the visible UI/cache after initial render.
- [ ] Unsupported controls are absent or truly disabled and cannot be mistaken for working product features.
- [ ] Right-rail shared files/media/pinned/security content is data-backed, empty, hidden, or disabled honestly, with no fake static assets presented as real.
- [ ] Desktop and mobile behavior smoke tests pass without horizontal overflow or composer overlap after interactions.
- [ ] Light and dark theme behavior smoke tests pass through the same workflows and capture screenshots after interactions.
- [ ] Test fixtures are centralized in test/e2e support paths and do not leak into product runtime imports.
- [ ] `npm run lint`, `npm run build`, `npm test`, and `npm run test:ui` pass from `Frontend/Chatify`.

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes |
|--------------------|-------|-------|--------|-------|
| Goal Clarity       | 0.94  | 0.75  | PASS   | Core promise is live production behavior behind the Phase 6 UI. |
| Boundary Clarity   | 0.92  | 0.70  | PASS   | Media, calls, groups, E2EE, deployment, and broad backend rewrites are excluded. |
| Constraint Clarity | 0.82  | 0.65  | PASS   | Existing stack, fixture isolation, deterministic tests, and theme/mobile parity are locked. |
| Acceptance Criteria| 0.90  | 0.70  | PASS   | Acceptance is tied to source searches, workflow tests, screenshots after interactions, and frontend commands. |
| **Ambiguity**      | 0.10  | <=0.20| PASS   | Gate passed after the user approved all recommendations. |

Status: PASS = met minimum, WARN = below minimum.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What is Phase 7's core promise? | Restore every already-supported workflow behind the reference UI; do not add new media/call features. |
| 1 | Researcher | What happens to `chatVisualSmoke=phase06`? | Remove or restrict visual-smoke behavior to test-only support; product runtime must not branch on it. |
| 1 | Researcher | What is the rule for fixture data? | Fixtures are allowed only in tests, never in product UI paths. |
| 2 | Simplifier | How should unsupported visible controls behave? | Hide unsupported controls or render them as honestly disabled without enabled-looking affordances. |
| 2 | Simplifier | Should Phase 7 implement attachments/media? | No; remove fake/static media and leave real media/files to Phase 8. |
| 2 | Simplifier | What should happen to the right rail? | Keep the layout only if sections are real, empty, hidden, or disabled honestly. |
| 3 | Boundary Keeper | What should happen to security labels? | Bind security/session/socket labels to actual state or downgrade/remove them when unsupported. |
| 3 | Boundary Keeper | Which workflows must Phase 7 verify? | Verify current supported chat workflows: selection, send, retry/dismiss, edit, delete, reaction, reply, copy, unread/read, typing/presence, searches, new chat, URL restore, auth expiry, theme, and mobile drawer. |
| 3 | Boundary Keeper | How strict should mobile parity be? | Mobile must have behavior parity with desktop for all supported workflows. |
| 3 | Boundary Keeper | How strict should theme parity be? | Light and dark themes must preserve the same workflows and capture screenshots after interactions. |
| 4 | Failure Analyst | What is the E2E testing standard? | Use deterministic mocked APIs for UI workflows, focused socket/event verification for realtime behavior, and behavior interactions before screenshots. |
| 4 | Failure Analyst | Should Playwright abort `socket.io`? | Only visual-only tests may abort sockets; functional tests must prove a controlled realtime path. |
| 4 | Failure Analyst | What should be the acceptance rule for static-looking content? | Product paths reject static demo content unless it is an explicit loading, empty, disabled, or error state. |
| 5 | Seed Closer | What commands gate Phase 7? | `npm run lint`, `npm run build`, `npm test`, and `npm run test:ui` from `Frontend/Chatify`. |
| 5 | Seed Closer | What is out of scope? | Real attachments/media, calls, groups, E2EE, notifications, admin/moderation, large backend rewrites, and deployment are out of scope. |

---

*Phase: 07-messenger-functional-parity-restoration*
*Spec created: 2026-06-12*
*Next step: $gsd-discuss-phase 7 - implementation decisions (how to build what is specified above)*
