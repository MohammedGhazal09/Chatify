# Phase 05: Messenger Baseline Completion - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 05 completes Chatify's v1 direct-message baseline by implementing the search, continuation, presence, navigation, session, and verification behavior locked in `05-SPEC.md`. It clarifies how to build those capabilities on top of the Phase 02 socket privacy contract, Phase 03 canonical message-state contract, and Phase 04 componentized messenger UI. It does not expand v1 into a contact directory, all-chat search, group-chat product scope, broad account settings, or v2 platform work.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `05-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `05-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Local sidebar filtering for conversations the user already has.
- Exact-email New chat submit as the v1 contact start/continue flow.
- Backend direct-chat uniqueness/idempotency for non-group one-to-one chats.
- Server-backed message search inside the selected conversation only.
- Message search UI states, snippets, highlighting, empty/error/loading behavior, and clear return to the normal conversation.
- Search input constraints: trimming, minimum length, debouncing, escaping, case-insensitive matching, and bounded result limits.
- Presence and typing display polish for authorized chat members.
- Selected chat restoration through URL query parameter plus per-user local storage fallback.
- Session-expired, logout, and auth-loss cleanup for chat-specific transient state.
- Backend, frontend, and Playwright smoke verification for Phase 05 behavior.

**Out of scope (from SPEC.md):**
- Fuzzy global user search or contact directory - excluded to avoid user-enumeration risk in v1.
- Passive account lookup while typing an email - excluded because it can reveal whether an account exists.
- Global message search across all chats - excluded because selected-conversation search satisfies v1 and has a smaller privacy surface.
- Group chat creation, group search, group administration, and group presence expansion - deferred to v2 platform scope.
- Attachments, media previews, push notifications, moderation, admin tooling, and end-to-end encryption - deferred v2 items outside the direct-message baseline.
- Search ranking beyond simple case-insensitive matching - not required for v1 reliability.
- Message virtualization or a full route restructure - only allowed if implementation discovers a blocker that cannot be solved within the existing React/Vite route shell.
- Profile editing, password management, and broader account settings redesign - account/session work is limited to chat safety and recovery states.

</spec_lock>

<decisions>
## Implementation Decisions

### Direct-Chat Continuation And Privacy
- **D-01:** Add a deterministic sorted member-pair `directKey` for non-group direct chats and enforce it with a partial unique index.
- **D-02:** On duplicate-key errors during direct-chat creation, re-query the existing direct chat and return it with the existing-chat `200` response semantics.
- **D-03:** Keep invalid email format errors specific, but use a generic user-facing failure for account existence, self-target, and private lookup failures.
- **D-04:** Emit `chat:new` only when a new chat is created. Returning an existing chat must update the requester through the HTTP response/cache path without broadcasting a new-chat event.
- **D-05:** Preserve the exact-email New chat submit as the only v1 contact start/continue path. Do not add passive lookup while typing.

### Message Search API And Query Semantics
- **D-06:** Add `GET /api/message/search/:chatId?q=&limit=25` before parameterized message routes in `Backend/Chatify/Routes/messageRouter.mjs`.
- **D-07:** Return canonical `Message[]` search results from the backend; build snippets and highlight ranges in the frontend.
- **D-08:** Implement matching with escaped case-insensitive regex scoped by `chatId`, requester visibility filters, and result limit. Do not add a Mongo text index or external search service for v1.
- **D-09:** Search only current visible message text. Respect delete-for-self, exclude delete-for-everyone tombstones, and do not attempt to expose edit history.
- **D-10:** Use generic private-resource errors for non-member message search requests so unauthorized users do not learn whether a private chat exists.

### Message Search Frontend
- **D-11:** Add a dedicated `useMessageSearch(chatId, query)` hook with query key `['messageSearch', chatId, normalizedQuery]`.
- **D-12:** Keep search result state separate from the durable `['messages', chatId]` cache. Search must never replace, filter, or mutate canonical conversation messages in TanStack Query.
- **D-13:** Use a dedicated in-conversation result mode for loading, result, empty, error, clear-search, and return-to-conversation states.
- **D-14:** Clicking a result may scroll to and highlight the message only when the message is already loaded in the normal conversation cache. Results for older unloaded messages remain snippet rows in v1.
- **D-15:** Debounce remote message search by about 300 ms and suppress remote calls for trimmed queries shorter than 2 characters.

### Sidebar Conversation Search
- **D-16:** Sidebar search stays local and matches only conversations already returned for the authenticated user.
- **D-17:** Sidebar search should match conversation title plus latest requester-visible message snippet. Do not match member email in the sidebar field.
- **D-18:** Update no-results copy to say "No matching conversations" and point users to New chat for exact-email start/continue.
- **D-19:** The sidebar search field must not call a user-search endpoint or expose presence/profile data for users outside the current chat list.

### Navigation Continuity
- **D-20:** Selected chat restoration priority is URL `?chatId=` first, then per-user localStorage fallback, then most recent available chat.
- **D-21:** If a URL `chatId` is invalid or inaccessible, replace the URL without that parameter and select a safe fallback without showing a private-resource error.
- **D-22:** Store last selected chat in a per-user key, `chatify_selected_chat_${user._id}`, and remove or update that key on logout and auth loss.
- **D-23:** Keep the existing root chat route and query-parameter approach. Do not restructure routing unless implementation discovers a blocker.

### Session, Auth Loss, Presence, And Typing
- **D-24:** Dispatch a small `chatify:auth-expired` browser event from the Axios refresh-failure path, then handle privacy cleanup through an auth/session hook or page effect.
- **D-25:** On logout or unrecoverable auth loss, clear Query cache, selected chat, sidebar search, message search text/results, local per-user selection state, presence maps, and typing maps.
- **D-26:** Do not add a REST presence endpoint in Phase 05. Continue using authorized Socket.IO presence and `socket:ready` reconciliation from Phase 02.
- **D-27:** Keep the existing typing timeout behavior and also clear typing state on selected-chat change and auth loss.
- **D-28:** Session-expired UI must block private conversation rendering and provide a sign-in path without showing previous private messages.

### Testing And Verification
- **D-29:** Add focused backend Vitest integration tests under the existing backend test structure, with likely files such as `Backend/Chatify/test/chat/chat.direct.test.mjs` and `Backend/Chatify/test/message/message.search.test.mjs`.
- **D-30:** Backend tests should use existing Supertest, MongoDB Memory Server, and fixture patterns. Do not introduce a new backend test framework.
- **D-31:** Add frontend RTL/Vitest tests for search hooks/components, sidebar filtering, URL/localStorage restoration, session cleanup, and presence/typing cleanup states.
- **D-32:** Extend fixture-driven Playwright smoke to cover sidebar search, message search result state, New chat selecting an existing chat, URL restore, and session-expired state.
- **D-33:** Keep E2E focused on critical happy paths and user-visible states. Edge cases belong in backend/frontend component or integration tests.
- **D-34:** Search inputs, dialogs, and result rows must keep accessible labels, keyboard operation, focus return, Escape close where applicable, and `aria-live` announcements for counts/errors.

### Agent Discretion
- The planner may choose exact helper filenames, controller helper names, and whether the `directKey` is computed in controller code, model hooks, or a small chat-domain utility, as long as the database uniqueness contract is enforced and tests prove concurrency safety.
- The planner may choose exact UI copy for generic privacy-safe failures, search counts, and empty states, as long as it avoids account enumeration and remains accessible.
- The planner may choose exact component boundaries for search result rows, snippet helpers, and URL/localStorage helpers, as long as durable message state remains in TanStack Query and transient UI state stays isolated.
- The planner may choose whether to add static utility tests for regex escaping and search normalization separately from integration tests.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/05-messenger-baseline-completion/05-SPEC.md` - locked Phase 05 requirements, boundaries, constraints, and acceptance criteria.
- `.planning/PROJECT.md` - project core value, brownfield constraints, security posture, and collaboration preference.
- `.planning/REQUIREMENTS.md` - BASE-01 through BASE-05 and relevant TEST requirements.
- `.planning/ROADMAP.md` - Phase 05 goal, success criteria, dependencies, and two planned work slices.
- `.planning/STATE.md` - current project state and prior phase readiness.

### Prior Phase Contracts
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` - authenticated socket identity, membership checks, targeted emits, presence privacy, and reconnect behavior.
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` - canonical message payloads, visibility rules, idempotency, unread truth, cursor history, and TanStack Query ownership.
- `.planning/phases/04-messenger-ui-reconstruction/04-CONTEXT.md` - componentized messenger UI, state/recovery decisions, and UI testing direction.
- `.planning/phases/04-messenger-ui-reconstruction/04-UI-REVIEW-FIX.md` - current Phase 04 UI smoke remediation and Playwright smoke setup.
- `.planning/phases/04-messenger-ui-reconstruction/04-SMOKE.md` - current desktop/mobile smoke evidence pattern to extend.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - route/controller/model layering, frontend API/query layering, socket singleton pattern, and privacy anti-patterns.
- `.planning/codebase/STACK.md` - live stack and package layout constraints; verify package scripts because this map predates later test additions.
- `.planning/codebase/TESTING.md` - historical testing map; stale after Phase 01-04, so use live package scripts and test files as source of truth.

### Backend Code To Scout
- `Backend/Chatify/app.mjs` - protected `/api/chat` and `/api/message` router mounting and message rate limiter.
- `Backend/Chatify/Routes/chatRouter.mjs` - current create/get/delete chat routes.
- `Backend/Chatify/Routes/messageRouter.mjs` - route ordering where the new static search route must be inserted before parameterized routes.
- `Backend/Chatify/Controller/chatController.mjs` - exact-email create/continue behavior, latest visible message projection, and socket new-chat side effects.
- `Backend/Chatify/Controller/messageController.mjs` - current membership checks, cursor history, visibility filtering, and message response shape.
- `Backend/Chatify/Models/chatModel.mjs` - chat schema and indexes target for direct-chat uniqueness.
- `Backend/Chatify/Models/messageModel.mjs` - message text, delete, visibility, and existing indexes for search/history behavior.
- `Backend/Chatify/Utils/messageState.mjs` - reusable visible-message filters, cursor helpers, serialization, and validation boundaries.
- `Backend/Chatify/Config/socket.mjs` - presence, typing, targeted emits, and `socket:ready` reconciliation.
- `Backend/Chatify/test` - existing Vitest/Supertest/MongoDB-memory test patterns and fixtures.

### Frontend Code To Scout
- `Frontend/Chatify/src/pages/chat/chat.tsx` - orchestration point for selected chat, search state, message callbacks, logout, and URL/localStorage integration.
- `Frontend/Chatify/src/pages/chat/hooks/useChatViewState.ts` - transient chat UI state to extend or reset.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - local sidebar search and New chat integration.
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx` - message search surface and session-expired UI.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - search trigger and presence header display.
- `Frontend/Chatify/src/api/chatApi.ts` - direct-chat create API client.
- `Frontend/Chatify/src/api/messageApi.ts` - message API client and new search endpoint type.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - chat/message query keys, mutations, and likely home for `useMessageSearch`.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - socket ready, presence, typing, and realtime cache reconciliation.
- `Frontend/Chatify/src/hooks/useAuthQuery.ts` - logout cache clearing and auth state integration.
- `Frontend/Chatify/src/hooks/useLocalStorage.ts` - existing localStorage hook to adapt carefully for per-user selected chat state.
- `Frontend/Chatify/src/api/axios.ts` - refresh-failure path for `chatify:auth-expired` dispatch.
- `Frontend/Chatify/src/store/authstore.ts` - auth state and logout behavior.
- `Frontend/Chatify/src/store/presenceStore.ts` - online/typing maps and cleanup helpers target.
- `Frontend/Chatify/src/components/TypingIndicator.tsx` - typing UI that should clear on selection/auth changes.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` - deterministic Playwright request interception pattern to extend for Phase 05.
- `Frontend/Chatify/src/test/chatFixtures.ts` - frontend component test fixtures.
- `Frontend/Chatify/src/pages/chat/components/*.test.tsx` - current RTL component coverage patterns.

### Supporting Skills
- `C:/Users/saieh/.agents/skills/api-and-interface-design/SKILL.md` - stable API and contract design guidance used for route and response decisions.
- `C:/Users/saieh/.agents/skills/react-best-practices/SKILL.md` - React state and data-fetching boundary guidance.
- `C:/Users/saieh/.agents/skills/vitest/SKILL.md` - Vitest testing guidance.
- `C:/Users/saieh/.agents/skills/e2e-testing-patterns/SKILL.md` - focused Playwright smoke guidance.
- `C:/Users/saieh/.agents/skills/accessibility/SKILL.md` - keyboard, label, focus, and live-region guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildVisibleMessageFilter()` and `serializeMessage()` in `Backend/Chatify/Utils/messageState.mjs`: reuse for message search so visibility and response shape match history.
- `projectLatestVisibleMessage()` in `Backend/Chatify/Controller/chatController.mjs`: existing pattern for requester-visible latest snippets in sidebar data.
- `useCreateChat()` in `Frontend/Chatify/src/hooks/useChatQueries.ts`: already merges returned chats by id and can support existing-chat continuation selection.
- `useMessages()` and `messagesQueryKey()` in `Frontend/Chatify/src/hooks/useChatQueries.ts`: keep durable message history separate from search result query keys.
- `useLocalStorage()` in `Frontend/Chatify/src/hooks/useLocalStorage.ts`: reusable but may need careful handling because keys must be per user and removable on auth loss.
- `usePresenceStore()` in `Frontend/Chatify/src/store/presenceStore.ts`: existing online/typing maps need explicit clear helpers for auth/session cleanup.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts`: existing intercepted API smoke can be extended without seeded database credentials.

### Established Patterns
- Backend route modules are thin and static routes must be declared before parameterized routes.
- Backend protected chat/message routes already rely on `protect` middleware, then controllers must still enforce resource membership.
- Message privacy is enforced through requester visibility filters, not through frontend filtering.
- Frontend transport stays in typed API modules; pages should not call Axios directly.
- TanStack Query owns durable chat/message server state; local UI state belongs in components or focused hooks.
- Socket.IO presence and typing are centralized in `useChatSocket.ts` and `presenceStore`, not component-local socket listeners.
- Frontend tests use Vitest/jsdom/RTL with semantic queries, and smoke tests use Playwright route interception.

### Integration Points
- `Backend/Chatify/Models/chatModel.mjs`: add `directKey` and partial unique index for non-group direct chats.
- `Backend/Chatify/Controller/chatController.mjs`: compute direct key, catch duplicate-key races, re-query existing direct chats, and keep new-chat socket side effects only for new records.
- `Backend/Chatify/Routes/messageRouter.mjs` and `Backend/Chatify/Controller/messageController.mjs`: add selected-chat message search route/controller.
- `Frontend/Chatify/src/api/messageApi.ts`: add typed message search client method.
- `Frontend/Chatify/src/hooks/useChatQueries.ts`: add `useMessageSearch()` and a search query key independent from history.
- `Frontend/Chatify/src/pages/chat/chat.tsx`: integrate URL search params, per-user selected-chat persistence, auth-expired handling, and cleanup without broad UI rewrites.
- `Frontend/Chatify/src/pages/chat/components/ConversationPane.tsx`: replace loaded-page filtering with search result mode props and accessible states.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx`: filter by local title/latest snippet and correct no-results copy.
- `Frontend/Chatify/src/api/axios.ts` and `Frontend/Chatify/src/hooks/useAuthQuery.ts`: coordinate refresh failure, logout, query cache clearing, and chat/presence cleanup.

</code_context>

<specifics>
## Specific Ideas

- The user approved all recommended implementation decisions from the Phase 05 one-shot questionnaire.
- Keep Phase 05 conservative: exact-email contact continuation, selected-chat message search, and no passive account discovery.
- Prefer database-enforced uniqueness for direct chats because controller-only find-then-create can race.
- Prefer canonical backend messages with frontend snippet/highlight helpers to avoid another message payload shape.
- Keep URL `?chatId=` as the navigation surface instead of adding a new route or route restructure.
- Extend the existing deterministic Playwright smoke rather than requiring live backend/database fixtures.

</specifics>

<deferred>
## Deferred Ideas

- Fuzzy global user/contact search remains deferred because it is outside v1 and can reveal account existence.
- Global all-chat message search remains deferred because selected-conversation search satisfies Phase 05.
- Jump-to-context for unloaded older search results remains deferred unless planning proves it can be done without a new pagination contract.
- REST presence endpoints remain deferred; Phase 05 continues the Socket.IO presence contract from Phase 02.
- Broad account/profile/password settings remain deferred; account work here is limited to session safety and recovery.

</deferred>

---

*Phase: 05-messenger-baseline-completion*
*Context gathered: 2026-06-09*
