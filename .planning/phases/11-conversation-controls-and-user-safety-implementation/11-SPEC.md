# Phase 11: Conversation Controls And User Safety Implementation - Specification

**Created:** 2026-06-13
**Ambiguity score:** 0.11 (gate: <= 0.20)
**Requirements:** 12 locked

## Goal

Conversation header, detail, More, search, and block/unblock controls change from partly static or unavailable UI into server-backed, authorized, test-proven direct-message workflows.

## Background

Phase 11 exists because the reference-quality messenger UI still exposes conversation controls that are not fully reliable product behavior. The current frontend has real message search hooks, pinned-message queries, shared-asset queries, detail rail/drawer close behavior, and attachment/pin APIs from earlier phases. It also still has gaps: header More opens conversation details rather than an action menu, detail "More conversation actions" is disabled, call and video controls are disabled, unloaded search results cannot be jumped to, empty detail sections render placeholder copy, and the backend has no block model or block-aware capability state.

On the backend, `Chats` stores members, direct chat keys, group metadata, unread counts, and latest message references. `Users` stores profile and presence privacy fields. There is no blocklist, no directed block relationship, and no conversation controls/capabilities contract. Message endpoints check membership through `loadChatForUser`, and Socket.IO uses `assertChatMember` / `assertMessageChatMember`, but those checks currently verify chat membership only. They do not prevent blocked participants from sending messages, typing, exposing presence, or emitting inappropriate realtime events.

Phase 10.1 remains the reliability dependency for production claims. Phase 11 may be specified, discussed, planned, and implemented locally, but it cannot be called production-ready until Phase 10.1 production delivery smoke has passed or is explicitly marked blocked with evidence.

## Requirements

1. **Unified message-search entry points**: Header, desktop detail rail, and mobile detail drawer search controls must open the same real message-search workflow for the selected conversation.
   - Current: Header search toggles the search panel, detail search calls the same handler, and backend search exists at `/api/message/search/:chatId`, but behavior is not fully verified across every entry point and viewport.
   - Target: Every visible "Search messages" control opens the same search UI, focuses the input, uses the server-backed search query, and can be closed with explicit close controls and Escape.
   - Acceptance: A browser test opens search from the header, desktop detail rail, and mobile drawer; each path returns server-backed results for the selected chat and closes without trapping focus.

2. **Search result jump and fetch**: Selecting a search result must jump to the target message even when that message is not currently loaded, as long as it is available through authorized history pagination.
   - Current: Loaded results can jump, but unloaded results display "Load older history to jump to this message" and `handleJumpToMessage` only shows a toast when the message id is absent from loaded messages.
   - Target: Selecting an unloaded result loads the needed older message range with a bounded fetch strategy, then scrolls to and highlights the message, or shows a recoverable error if the range cannot be loaded.
   - Acceptance: A test searches for an older message outside the initial message window, selects it, observes additional history loading, and verifies the target message is visible and highlighted without a full page refresh.

3. **Conversation More menu**: The conversation More menu must open on desktop and mobile and expose only implemented conversation actions.
   - Current: Header More opens conversation details; detail "More conversation actions" is disabled; there is no real conversation action menu.
   - Target: More opens an accessible action menu containing only supported Phase 11 actions: Search messages, Block user or Unblock user for direct chats, and Conversation details. Unsupported actions are hidden instead of pretending to work.
   - Acceptance: Component and browser tests prove the More menu opens/closes by click, Escape, and outside click, has accessible labels and keyboard navigation, and contains no enabled dead actions.

4. **Conversation control capability state**: The selected chat state must expose enough server-backed capability data for the frontend to decide whether the user can send, block, unblock, view controls, and see conversation security rows.
   - Current: `Chat` has no block or capability fields, and the frontend infers security rows from client auth/member/socket state.
   - Target: The selected conversation data available to the frontend includes direct-chat block state and capability fields such as whether the current user can send, whether they blocked the other member, and whether messaging is unavailable because of a block.
   - Acceptance: A test fetches or refreshes a direct chat after block and unblock and verifies the frontend receives updated capability state without relying on static fixtures.

5. **Directed direct-message block/unblock**: A user must be able to block and unblock the other participant in a direct-message conversation.
   - Current: No block model, API, UI action, or frontend type exists.
   - Target: Blocking is a directed user-level relationship for direct chats only: user A can block user B without deleting history, and user A can unblock user B later.
   - Acceptance: Backend tests prove block and unblock are idempotent, require authentication and chat membership, reject self-block and group-chat block attempts, and persist state across reloads.

6. **HTTP message send block enforcement**: Blocked direct-message pairs must not be able to create new messages through the HTTP message creation path.
   - Current: `newMessage` checks authentication, message validation, attachments, idempotency, and membership, but it does not check block state.
   - Target: If either direct-message participant has an active block relationship against the other, `POST /api/message/new-message` rejects new messages with a clear forbidden response and does not create or emit a message.
   - Acceptance: Backend tests prove blocked sends return 403, create zero new messages, do not update latest message, and leave prior authorized history visible.

7. **Realtime block enforcement**: Blocked direct-message pairs must not receive new activity signals that reveal current user behavior.
   - Current: Socket events such as `typing:start`, `typing:stop`, `message:delivered`, room join delivery reconciliation, and presence broadcasts are membership-checked but not block-aware.
   - Target: Active block state suppresses new message emits, typing events, presence/last-seen exposure, new read/delivery activity after the block, and future call attempts between the pair. Existing history remains authorized unless existing message-visibility rules exclude it.
   - Acceptance: Socket tests prove blocked pairs do not receive typing, presence, delivered/read, new-message, or call-attempt events after block, while unblocked direct chats continue to receive normal events.

8. **Blocked-state frontend behavior**: The chat UI must make blocked state visible, recoverable for the blocker, and non-leaky for the blocked counterpart.
   - Current: The composer remains driven by auth/session/offline state only, and there is no block copy or unblock action.
   - Target: When the current user blocked the other participant, the composer is disabled with copy equivalent to "You blocked this user. Unblock to send" and an unblock action is available. When messaging is unavailable because the other user blocked the current user, copy is neutral, such as "Messaging is unavailable."
   - Acceptance: Frontend tests verify composer disabled states, block/unblock menu labels, neutral counterpart copy, no send request while blocked, and restored composer behavior after unblock.

9. **Server-backed pinned and shared detail sections**: Pinned messages, shared files, and shared media must render only from authorized server data and must not display static placeholders as if they were real data.
   - Current: Hooks call real pinned/shared APIs, but empty sections still render "No pinned messages", "No shared files", and "No shared media" inside the detail rail/drawer.
   - Target: Non-empty sections render server data; loading and error states are explicit; empty individual sections disappear after loading. If all optional detail content is empty, the UI shows one honest empty state instead of multiple fake-looking rows.
   - Acceptance: Tests prove non-empty data renders from API responses, empty individual sections are hidden after loading, errors show recoverable copy, and no fixture/static shared content appears in production runtime.

10. **Shared asset paging**: Shared files and shared media detail lists must expose a load-more path when the server reports additional shared assets.
    - Current: `useSharedAssets` requests a limited first page and discards cursor metadata in the frontend.
    - Target: Shared file/media lists preserve cursor metadata and provide a user-visible load-more action when more server-backed assets exist.
    - Acceptance: Frontend and API tests prove the first page renders, a next cursor enables "Load more", the second page appends without duplicates, and exhausted lists hide the load-more action.

11. **Honest conversation security rows**: Security rows in the detail surfaces must state only verifiable runtime facts.
    - Current: Security rows are client-derived from authentication, membership, socket connection, and file-access assumptions, and can read as stronger security claims than the app proves.
    - Target: Security rows are limited to verifiable states such as authenticated session, member-only access, realtime connection, and protected file/message access. They must degrade to unavailable/error states when backing checks fail.
    - Acceptance: Tests cover authenticated, unauthenticated/session-expired, non-member/forbidden, offline/reconnecting, and attachment-access-failure states and verify the UI does not claim "secure" or "verified" when the evidence is unavailable.

12. **Phase 11 verification gate**: Phase 11 must include backend, frontend, accessibility, and browser coverage for the conversation controls and block behavior.
    - Current: Backend Vitest, frontend Vitest, ESLint/build, and Playwright exist, with prior quality gates for search, detail panels, media, and delivery reliability.
    - Target: Verification includes backend tests for block/capability/message/socket enforcement, frontend tests for menu/search/detail/composer states, and Playwright coverage for desktop/mobile, light/dark, More menu, search jump, block/unblock, empty detail, and drawer/rail close behavior.
    - Acceptance: Phase 11 summary records exact outcomes for `cd Backend/Chatify; npm test`, `cd Frontend/Chatify; npm test`, `cd Frontend/Chatify; npm run lint`, `cd Frontend/Chatify; npm run build`, and focused `cd Frontend/Chatify; npm run test:ui` coverage for Phase 11.

## Boundaries

**In scope:**
- Real message-search entry points from header, desktop rail, and mobile drawer.
- Search result jump/fetch behavior for unloaded but authorized messages.
- Accessible conversation More menu containing only implemented Phase 11 actions.
- Directed direct-message block/unblock state, API contract, and frontend controls.
- HTTP and Socket.IO enforcement of blocked direct-message state.
- Composer/menu/header/detail UI states driven by server-backed conversation capabilities.
- Pinned messages, shared files, shared media, and conversation security rows backed by real data or honestly hidden/unavailable.
- Shared asset load-more behavior for server-paginated file/media results.
- Backend, frontend, accessibility, and Playwright verification for Phase 11 behavior.

**Out of scope:**
- Full audio/video call implementation - Phase 13 owns call signaling, media permissions, and call state machines.
- Voice message recording/playback - Phase 12 owns voice message workflows.
- Identity image or identity mark customization - Phase 12 owns user identity imagery persistence and validation.
- Group-chat blocking or moderation - Phase 11 covers direct-message safety only.
- Delete/archive conversation actions - current delete semantics are shared/destructive and need a separate per-user archive/delete contract before exposure.
- Full conversation export - exporting loaded messages is not part of the approved Phase 11 minimum and could imply incomplete or unsafe history export.
- Production live acceptance claim - Phase 14 owns the final deployed Vercel/Render acceptance gate.
- End-to-end encryption, abuse reports, admin moderation, native apps, and push notifications - these remain outside v1 reconstruction scope or later roadmap work.

## Constraints

- Preserve the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO realtime layer, TanStack Query, Zustand, Tailwind, and npm package layout.
- Do not use fixture/static/demo conversation content in production runtime paths.
- Preserve Phase 10.1 message idempotency and delivery reliability contracts; block enforcement must not reintroduce duplicate sends, false delivery state, or refresh-only receive behavior.
- Blocking must preserve existing authorized message history and must not delete chats or messages.
- Blocking is direct-message only in this phase.
- Call and video buttons may remain honestly disabled in Phase 11, but blocked state must prevent future call attempts and any currently exposed call attempt path.
- Production readiness remains blocked until Phase 10.1 production delivery smoke has passed or is explicitly documented as blocked.
- Execution must stay inline in the current Codex thread; do not use subagents.
- Preserve unrelated local work and stage only Phase 11 planning/code/test artifacts during Phase 11 work.

## Acceptance Criteria

- [ ] Header, desktop rail, and mobile drawer search controls open the same server-backed message-search workflow and close with focus recovery.
- [ ] Selecting an unloaded search result loads the needed authorized history range, scrolls to the message, and highlights it without a refresh.
- [ ] Conversation More opens on desktop and mobile with accessible keyboard behavior and no enabled dead actions.
- [ ] Direct-message block and unblock are authenticated, membership-checked, persisted, idempotent, and rejected for self-block/group-chat cases.
- [ ] The selected conversation state exposes block/capability data that drives composer, menu, header, detail, and send availability.
- [ ] HTTP message creation returns 403 and creates no message when either direct-message participant has an active block relationship.
- [ ] Socket typing, presence/last-seen, new-message, delivered/read, and future call-attempt signals are suppressed for blocked pairs after the block.
- [ ] Blocked-state UI disables sending, shows correct blocker copy, shows neutral counterpart copy, and restores sending after unblock.
- [ ] Pinned messages, shared files, and shared media render only from authorized server data; empty sections disappear after loading.
- [ ] Shared file/media lists support load-more behavior when the server reports more assets.
- [ ] Conversation security rows show only verifiable runtime facts and degrade honestly on auth, membership, socket, or asset-access failures.
- [ ] Backend, frontend, lint, build, and focused Playwright Phase 11 verification commands are recorded in the phase summary.
- [ ] Phase 11 artifacts do not claim production readiness unless Phase 10.1 production delivery smoke is complete or the remaining blocker is explicitly documented.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.93  | 0.75  | met    | User approved concrete target surfaces and reliability/safety outcomes. |
| Boundary Clarity    | 0.90  | 0.70  | met    | Calls, voice, identity changes, delete/archive, group blocking, export, and production live acceptance are excluded. |
| Constraint Clarity  | 0.82  | 0.65  | met    | Direct-chat-only block semantics, Phase 10.1 dependency, no fixture data, and stack constraints are explicit. |
| Acceptance Criteria | 0.88  | 0.70  | met    | Pass/fail checks cover HTTP, Socket.IO, frontend state, accessibility, and browser evidence. |
| **Ambiguity**       | 0.11  | <=0.20| met    | Gate passed after the user approved all recommendations. |

Status: met = dimension meets the workflow minimum.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | Should Phase 11 proceed while Phase 10.1 production smoke is blocked? | Spec/discuss/plan can proceed, but production-ready claims remain blocked by Phase 10.1 production evidence. |
| 1 | Researcher | What current code is real versus missing? | Existing search, pins, shared assets, and detail queries are real; block/capability state and More actions are missing. |
| 2 | Simplifier | What is the minimum useful More menu? | Include Search messages, Block/Unblock for direct chats, and Conversation details only. |
| 2 | Simplifier | Should call/video, voice, identity image changes, export, or delete be included? | Exclude them from Phase 11; keep call/video honestly disabled and block-safe. |
| 3 | Boundary Keeper | What blocking semantics apply? | Directed user-level direct-message block, no group blocking, history preserved, unblock restores new messaging. |
| 4 | Failure Analyst | What must block state prevent? | New HTTP messages, typing, presence/last-seen exposure, new receipt/read activity, new-message emits, and future call attempts after block. |
| 4 | Failure Analyst | What makes detail surfaces unacceptable? | Static or fixture-backed pinned/shared/security content, fake empty rows, or unverifiable "secure" claims. |
| 5 | Seed Closer | What verification proves this phase? | Backend Vitest, frontend Vitest, lint/build, and focused Playwright coverage for desktop/mobile light/dark controls and block behavior. |

---

*Phase: 11-conversation-controls-and-user-safety-implementation*
*Spec created: 2026-06-13*
*Next step: $gsd-discuss-phase 11 - implementation decisions for how to build the locked requirements above*
