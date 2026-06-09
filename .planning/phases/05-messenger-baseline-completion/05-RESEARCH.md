# Phase 05: Messenger Baseline Completion - Research

**Researched:** 2026-06-09
**Domain:** MERN direct-message baseline, selected-chat search, direct-chat idempotency, navigation/session recovery
**Confidence:** HIGH

<user_constraints>
## User Constraints

### Locked Decisions

- D-01 through D-05 require exact-email direct-chat continuation with a deterministic non-group direct-chat uniqueness key, duplicate-key race recovery, generic privacy-safe failure copy, and no passive account lookup.
- D-06 through D-10 require `GET /api/message/search/:chatId?q=&limit=25`, canonical `Message[]` results, escaped case-insensitive matching, requester visibility filters, and generic private-resource errors for unauthorized search.
- D-11 through D-15 require a dedicated `useMessageSearch(chatId, query)` hook, a search query key separate from `messagesQueryKey(chatId)`, dedicated result mode, loaded-result scroll only when already in cache, and about 300 ms debounce with a 2-character remote-search minimum.
- D-16 through D-19 require sidebar search to stay local, match title plus latest visible snippet, avoid member email matching, and point no-results copy to New chat.
- D-20 through D-23 require selected chat restore from URL first, then per-user localStorage key `chatify_selected_chat_${user._id}`, then most recent chat, with invalid ids removed from the URL without exposing private-resource errors.
- D-24 through D-28 require Axios `chatify:auth-expired` dispatch, logout/auth-loss cleanup of query/search/selection/presence/typing state, no REST presence endpoint, typing cleanup on selected-chat change and auth loss, and session-expired UI that hides private content.
- D-29 through D-34 require backend Vitest integration tests, frontend RTL/Vitest tests, focused Playwright smoke, and accessible labels, keyboard operation, focus return, Escape close, and `aria-live` announcements.

### Scope Fences

- Do not add fuzzy global user search, passive account lookup, all-chat message search, group chat expansion, REST presence, or a route restructure.
- Keep React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, and the npm package layout.
- Preserve Phase 03 durable message-state ownership in TanStack Query and Phase 04 componentized messenger UI.
- Keep E2E focused on critical fixture-driven flows; edge cases belong in backend/frontend integration and component tests.

</user_constraints>

<skill_research>
## Supporting Skill Findings

| Skill | Applied Research Guidance | Phase 05 Planning Impact |
|-------|---------------------------|--------------------------|
| `decompose-into-slices` | Prefer vertical slices with observable verification, not horizontal backend/frontend/test layers. | Keep the roadmap's two plans, but make each plan cut through API, UI, and tests where that behavior is visible. |
| `api-and-interface-design` | Define contract-first endpoints, stable response shapes, boundary validation, and consistent errors. | Use canonical `Message[]` search results, explicit route ordering, boundary normalization, and no new frontend-only private-data assumptions. |
| `react-best-practices` | Keep client server-state boundaries clear, avoid cache mutation by transient UI modes, use stable localStorage keys carefully. | Add `messageSearchQueryKey` separate from history cache and isolate selected-chat persistence in a hook. |
| `tdd` | Pin behavior through public interfaces one slice at a time, starting with failing tests for observable contracts. | Each task starts with backend/API or component/hook tests before implementation where practical. |
| `accessibility` | Icon buttons need accessible names, dynamic result/error state should use live regions, dialogs need focus handling. | Search bands, result rows, New chat, session-expired, and drawer/search controls need explicit a11y acceptance criteria. |
| `e2e-testing-patterns` | E2E should cover critical user journeys with stable selectors and deterministic fixtures. | Extend existing Playwright route interception instead of depending on live database state. |

</skill_research>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Direct-chat uniqueness | MongoDB/Mongoose model | Chat controller retry path | Application-only find-then-create can race; the database must enforce one direct chat per sorted member pair. |
| Exact-email continuation | Chat controller/API client | Sidebar/New chat UI | The user submits one exact email; the UI should not expose account details before or after failed lookup. |
| Selected-chat message search | Message controller/API client | TanStack Query hook/result component | Search must use server visibility rules and older history, while UI keeps results separate from durable message cache. |
| Sidebar conversation search | Browser local filter | Chat list data from `/api/chat/get-all-chats` | It only filters conversations already returned to the requester; no user search endpoint is needed. |
| Selected chat persistence | Chat page hook | React Router query params/localStorage | Selection is view state validated against accessible chats, not a backend resource fetch. |
| Auth-loss cleanup | Axios interceptor/auth hook | Query cache, view state, presence store | Refresh failure is detected in transport, but cleanup should be handled through app state boundaries. |
| Presence and typing | Socket.IO hook/Zustand store | Header/list/typing components | Phase 05 should continue authorized socket presence and add explicit stale-state cleanup. |
| Smoke verification | Playwright fixture routes | Frontend component tests | Component tests cover edge cases; smoke proves the critical v1 baseline flows render and remain usable. |

</architectural_responsibility_map>

<code_findings>
## Live Code Findings

### Backend

- `Backend/Chatify/Models/chatModel.mjs` has no `directKey` field or unique index. Current `createChat` checks for an existing non-group chat before create, so concurrent requests can still create duplicates.
- `Backend/Chatify/Controller/chatController.mjs` already normalizes exact email, returns an existing chat with status `200`, creates a new chat with status `201`, and emits `chat:new` only after creation. It currently exposes account existence and self-target details through response messages.
- `projectLatestVisibleMessage()` in `chatController.mjs` already uses `buildVisibleMessageFilter()` and `serializeMessage()`. That same visibility contract should inform sidebar snippets and existing-chat response data.
- `Backend/Chatify/Routes/messageRouter.mjs` has a static-route section before parameterized routes. The new static search route should be declared there before `/:messageId` routes.
- `Backend/Chatify/Controller/messageController.mjs` already has `loadChatForUser()`, `respondWithChatAccessError()`, and cursor history implementation. Search can reuse `loadChatForUser()` and `buildVisibleMessageFilter({ includeTombstones: false })`.
- `Backend/Chatify/Utils/messageState.mjs` already centralizes `serializeMessage()`, `buildVisibleMessageFilter()`, `normalizeMessageHistoryLimit()`, and object id helpers. Search normalization and regex escaping should live here or in a small adjacent utility to keep tests focused.
- Existing backend tests use Supertest agents, MongoDB Memory Server, and fixture helpers under `Backend/Chatify/test`. There are already message authorization, idempotency, mutation, pagination, status/unread, socket auth, and presence tests.

### Frontend

- `Frontend/Chatify/src/pages/chat/chat.tsx` currently derives `conversationMessages` by filtering loaded `allMessages` when `messageSearch.trim()` is present. This violates the Phase 05 requirement to search older visible history and keep search results separate from durable message cache.
- `useChatViewState.ts` stores `selectedChatId`, sidebar search, message search, and modal state in memory only. Refresh/route return falls back to `chats[0]._id`.
- `ChatSidebar.tsx` filters only by conversation title, uses placeholder `Search chats...`, and no-results copy says `No matches found` plus `Try a different name or message term.`
- `NewChatDialog.tsx` already has dialog semantics, focus trap, Escape close, outside close, and email label/error linkage. Submit copy still says `Start chat`, and the page error path forwards backend messages that can reveal account existence.
- `messageApi.ts` has history, read, unread, delete, edit, and reaction methods but no selected-chat search method.
- `useChatQueries.ts` exports `messagesQueryKey(chatId)` and keeps durable history in TanStack Query. It should add a separate `messageSearchQueryKey(chatId, query)` and `useMessageSearch()`.
- `axios.ts` retries 401 with refresh but does not dispatch `chatify:auth-expired` when refresh fails.
- `presenceStore.ts` has online and typing maps plus per-chat typing cleanup, but no single cleanup action for auth loss/logout.
- `useChatSocket.ts` owns socket presence, typing timeout cleanup, `socket:ready` reconciliation, and query invalidation. It should clear typing for the previous selected chat on selection changes and all transient presence on auth loss.
- `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` already uses deterministic route interception and screenshots. It can be extended to Phase 05 flows without live backend credentials.

</code_findings>

<standard_stack>
## Standard Stack

| Layer | Tooling | Status | Recommendation |
|-------|---------|--------|----------------|
| Backend tests | Vitest 4, Supertest, MongoDB Memory Server | Already installed | Add focused `chat.direct` and `message.search` tests under existing folders. |
| Frontend tests | Vitest 4, React Testing Library, user-event, jsdom | Already installed | Add component/hook tests near existing chat tests. |
| E2E smoke | Playwright | Already installed | Extend existing fixture-driven smoke with Phase 05 route interception. |
| API transport | Axios with credentials | Existing | Add message search API method and auth-expired event dispatch. |
| Server state | TanStack Query 5 | Existing | Keep message search results under a separate query key from message history. |
| Local state | React hooks/Zustand/localStorage | Existing | Add a focused selected-chat persistence hook and presence cleanup actions. |

</standard_stack>

<recommended_plan_shape>
## Recommended Plan Shape

1. **Plan 05-01: Search and direct-chat continuation.**
   - Build database-enforced direct-chat idempotency and privacy-safe exact-email continuation.
   - Add server-backed selected-chat message search with visibility and normalization tests.
   - Replace loaded-message filtering with a dedicated message search hook/result mode, update sidebar local filtering, and pin the UI states with component tests.

2. **Plan 05-02: Navigation, presence/session cleanup, and v1 verification.**
   - Add URL/localStorage selected-chat restoration and invalid-id fallback.
   - Dispatch/handle `chatify:auth-expired`, clear chat/search/presence state, and preserve session-expired blocking UI.
   - Clear stale typing/presence on chat selection and auth loss, extend Playwright smoke, and run the full Phase 05 verification suite.

This keeps the highest-risk persistence/API work first, then layers continuity and final smoke evidence after search/continuation contracts exist.
</recommended_plan_shape>

<verification_recommendations>
## Verification Recommendations

- Start backend changes test-first with `Backend/Chatify/test/chat/chat.direct.test.mjs` and `Backend/Chatify/test/message/message.search.test.mjs`.
- Start frontend search work with component/hook tests that prove fewer than 2 trimmed characters do not call the backend and search result state does not mutate `messagesQueryKey(chatId)`.
- Keep Playwright smoke focused on desktop sidebar search, mobile drawer search, message search result state, New chat existing-chat selection, `?chatId=` restore, and session-expired privacy.
- Final Phase 05 evidence must include:
  - `cd Backend/Chatify; npm test`
  - `cd Frontend/Chatify; npm test`
  - `cd Frontend/Chatify; npm run test:ui`
  - `cd Frontend/Chatify; npm run lint`
  - `cd Frontend/Chatify; npm run build`

</verification_recommendations>

<risks>
## Risks And Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Direct-chat duplicate index conflicts with existing duplicate data | Migration/index build can fail | Add tests and, if duplicates exist locally, document cleanup before index creation. |
| Regex search becomes expensive | Search could degrade large chats | Limit to selected chat, trim/min length, escape regex, cap at 25, sort newest first, and keep out of global search. |
| Message search mutates normal message history | Search could hide messages or corrupt cache | Use separate query key and result component; test durable cache remains unchanged. |
| Invalid URL `chatId` flashes stale private content | Privacy leak during restore | Render no-selected/skeleton until chat id is validated against loaded chats. |
| Auth refresh failure leaves private UI visible | Privacy leak after session loss | Dispatch `chatify:auth-expired` and clear query/view/presence state before rendering sign-in recovery. |
| Smoke tests become flaky | Slows execution and undermines evidence | Keep route interception deterministic and avoid fixed waits except narrow animation settle windows already used. |

</risks>

---

*Phase: 05-messenger-baseline-completion*
*Research complete: 2026-06-09*
