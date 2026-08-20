# Phase 05: Messenger Baseline Completion - Specification

**Status:** Approved
**Created:** 2026-06-09
**Phase:** 05-messenger-baseline-completion
**Ambiguity score:** 0.09 (gate: <= 0.20)
**Requirements:** 10 locked

## Goal

Complete the v1 direct-message baseline by adding privacy-preserving conversation/contact search, selected-conversation message search, direct-message continuation, presence clarity, navigation continuity, session recovery, and blocking verification evidence.

## Background

Phase 04 rebuilt the chat UI into a tested responsive messenger surface with sidebar, conversation pane, message list, composer, state views, and Playwright smoke coverage. The current chat implementation already supports local sidebar title filtering, an exact-email New chat dialog, in-memory selected chat state, presence/typing display from Socket.IO, and a loaded-page message filter inside the selected conversation.

The remaining Phase 05 gap is that these affordances are not yet a reliable v1 baseline. Sidebar search does not cover contact continuation beyond the separate New chat flow. Message search only filters messages already loaded in TanStack Query and cannot search older paginated history. Direct-message creation returns existing chats in the ordinary path but still needs a durable duplicate-prevention contract under concurrent requests. Selected conversation state is lost on refresh or route return. Presence, contact lookup, message search, and session recovery must preserve Chatify's private-message security boundary.

## Requirements

1. **Sidebar conversation search**: The sidebar search control MUST filter the user's loaded conversations without requesting or revealing unrelated users.
   - Current: `ChatSidebar` filters loaded chats by display title only and shows a misleading empty-state hint that mentions message terms.
   - Target: Sidebar search filters existing conversation rows by conversation display title and latest requester-visible message snippet, while keeping all data local to chats the user already has.
   - Acceptance: A frontend test or Playwright smoke fixture proves matching and non-matching existing conversations are filtered correctly, and no global user search request is made while typing in the sidebar search box.

2. **Exact-email contact continuation**: The user MUST be able to start or continue a direct-message conversation by submitting an exact email address through the New chat flow.
   - Current: `NewChatDialog` accepts an email and `createChat` can create or return a chat, but the behavior is not documented as the v1 contact-search contract.
   - Target: Submitting a valid exact email selects the existing direct chat or creates and selects a new direct chat. The UI does not reveal names, profile data, or presence before submit.
   - Acceptance: Frontend and backend tests prove exact-email submit selects the returned chat, closes the dialog, clears stale errors, and does not expose account details before the submit response.

3. **Direct-chat duplicate prevention**: Direct-message creation MUST be idempotent and prevent duplicate one-to-one chats for the same two users, including concurrent requests.
   - Current: `createChat` checks for an existing non-group chat before creating one, but the find-then-create path can race.
   - Target: The backend enforces a stable uniqueness contract for non-group direct chats between the same two member ids and preserves response semantics: `201` for a new chat and `200` for an existing chat.
   - Acceptance: Backend tests prove repeated and concurrent create requests for the same pair produce one direct chat record and all callers receive the same chat id.

4. **Selected-conversation message search**: Message search MUST query the selected conversation's full visible history, not only the currently loaded page.
   - Current: `ConversationPane` filters `allMessages`, so older paginated messages are invisible to search until manually loaded.
   - Target: Authenticated message search returns matches from the selected chat only, applies existing membership checks, uses the same requester visibility rules as history, and limits results to 25 per request.
   - Acceptance: Backend tests prove search finds older visible messages, excludes messages hidden from the requester, rejects non-member access, and enforces the result limit.

5. **Message search UI states**: The selected-conversation search UI MUST show clear loading, result, empty, and error states without replacing durable message cache state.
   - Current: Search filters the rendered message list and displays a count based on the already-loaded page.
   - Target: Search results render as a dedicated in-conversation result mode with matched text snippets, newest matches first, highlighted query text, and a clear return-to-conversation path.
   - Acceptance: Frontend tests prove the search UI handles loading, results, empty results, request failure, clearing the query, and returning to the normal message list without mutating cached conversation messages.

6. **Search input constraints**: Conversation and message search MUST have bounded, predictable query behavior.
   - Current: Sidebar and message search use immediate local filtering with no shared query constraints.
   - Target: Search trims whitespace, requires at least 2 non-space characters for server-backed message search, debounces remote search by about 300 ms, escapes user input before database matching, and treats matching as case-insensitive.
   - Acceptance: Tests prove empty or one-character message queries do not call the backend, special regex characters are treated as literal text, and repeated typing triggers one debounced search for the final query.

7. **Presence and typing privacy**: Presence and typing indicators MUST remain scoped to conversations the current user can access.
   - Current: Presence is shown from socket-provided online maps for chat members, and typing appears in the selected chat.
   - Target: The UI distinguishes online, offline, and typing states for authorized chat members only; contact search and failed email lookup do not reveal presence.
   - Acceptance: Socket/frontend tests prove presence is displayed for selected chat members, typing is scoped to the selected chat, and no presence state appears for an email or user outside the current user's chats.

8. **Navigation continuity**: The selected conversation MUST survive ordinary navigation away, browser refresh, and return when the user still has access to that chat.
   - Current: `selectedChatId` lives only in `useChatViewState`; refresh or route return falls back to the first chat.
   - Target: Chat selection is reflected in a URL query parameter and mirrored in per-user local storage as a fallback. On load, the app validates the requested chat against loaded chats before selecting it; invalid or inaccessible ids fall back safely.
   - Acceptance: Frontend tests or Playwright smoke prove selecting a chat updates the URL, refreshing restores the same accessible chat, an invalid chat id is ignored, and logout does not restore a previous user's selected chat.

9. **Session and account edge states**: Session expiration, logout, and auth refresh failure MUST leave the chat UI in a recoverable and privacy-safe state.
   - Current: Phase 04 added a session-expired state with a Sign in action, while query/socket cleanup behavior is not locked for Phase 05.
   - Target: On logout or unrecoverable 401/refresh failure, selected chat state, search text, message search results, and presence-sensitive transient state are cleared for the current user; the UI presents a sign-in path without showing private content.
   - Acceptance: Frontend tests prove session expiry blocks the conversation pane, offers Sign in, clears transient search/selection state on logout or auth loss, and does not render previous private messages after auth is lost.

10. **Blocking verification evidence**: Phase 05 completion MUST be backed by automated tests and smoke evidence for the new baseline behavior.
   - Current: Phase 04 has Vitest component tests, lint/build passing evidence, and authenticated Playwright desktop/mobile smoke.
   - Target: Phase 05 adds or updates backend tests for search authorization and direct-chat idempotency, frontend tests for search/navigation/session states, and Playwright smoke for the v1 baseline interactions.
   - Acceptance: Completion evidence records passing `npm test` from `Backend/Chatify`, `npm test` from `Frontend/Chatify`, `npm run test:ui` from `Frontend/Chatify`, `npm run lint` from `Frontend/Chatify`, and `npm run build` from `Frontend/Chatify`, or explicitly documents any skipped command with a blocker.

## Boundaries

### In Scope

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

### Out of Scope

- Fuzzy global user search or contact directory - excluded to avoid user-enumeration risk in v1.
- Passive account lookup while typing an email - excluded because it can reveal whether an account exists.
- Global message search across all chats - excluded because selected-conversation search satisfies v1 and has a smaller privacy surface.
- Group chat creation, group search, group administration, and group presence expansion - deferred to v2 platform scope.
- Attachments, media previews, push notifications, moderation, admin tooling, and end-to-end encryption - deferred v2 items outside the direct-message baseline.
- Search ranking beyond simple case-insensitive matching - not required for v1 reliability.
- Message virtualization or a full route restructure - only allowed if implementation discovers a blocker that cannot be solved within the existing React/Vite route shell.
- Profile editing, password management, and broader account settings redesign - account/session work is limited to chat safety and recovery states.

## Constraints

- Keep the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO realtime layer, TanStack Query, Zustand, Tailwind, and npm package layout.
- Preserve Phase 03 message-state contracts: TanStack Query owns durable message state, message history uses cursor pagination, and visibility rules determine which messages each requester can see.
- Preserve Phase 04 UI component structure and Playwright smoke approach unless a Phase 05 requirement proves a focused change is necessary.
- All search and direct-chat APIs must be cookie-authenticated and must enforce membership or exact-email submit boundaries before returning private data.
- Server-backed message search must apply delete-for-self visibility and must not match delete-for-everyone tombstone text.
- Message search queries must be trimmed, minimum 2 non-space characters, case-insensitive, escaped before database matching, and limited to 25 results.
- Remote search should be debounced by about 300 ms to reduce redundant calls while preserving responsive typing.
- Selected chat persistence must be per user; one user's restored state must never select or expose another user's previous chat.
- Deployment-sensitive CORS, cookies, and Socket.IO credentials must stay aligned with the existing Render/Vercel setup.

## Acceptance Criteria

- [ ] Sidebar search filters only conversations already returned for the authenticated user and does not call a global user-search endpoint while typing.
- [ ] Exact-email New chat submit selects either the existing direct chat or the newly created direct chat without passive account or presence disclosure.
- [ ] Repeated and concurrent direct-chat creation attempts for the same two users produce one non-group direct chat record.
- [ ] Selected-conversation message search returns matches from older paginated history and excludes messages hidden from the requester.
- [ ] Non-members cannot search a chat's messages and receive an authorization-safe error.
- [ ] Message search results show loading, result, empty, error, highlighted snippet, and clear-search states without mutating durable message cache.
- [ ] Search constraints are enforced: trimmed query, 2-character minimum for remote message search, escaped literal matching, debounce, case-insensitive matching, and max 25 results.
- [ ] Online, offline, and typing indicators are shown only for authorized chat members and are not exposed through contact lookup.
- [ ] Selecting a chat updates URL state, refresh restores an accessible selected chat, invalid ids fall back safely, and logout clears per-user restoration state.
- [ ] Session expiration or unrecoverable auth loss blocks private conversation rendering and offers a sign-in path.
- [ ] `cd Backend/Chatify; npm test` passes with Phase 05 backend coverage.
- [ ] `cd Frontend/Chatify; npm test`, `npm run test:ui`, `npm run lint`, and `npm run build` pass with Phase 05 frontend and smoke coverage.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.92  | 0.75  | Met    | Phase goal is narrowed to v1 search, continuation, presence, navigation, session, and verification. |
| Boundary Clarity    | 0.96  | 0.70  | Met    | Explicitly excludes global user search, all-chat search, groups, media, notifications, broad account settings, and v2 platform work. |
| Constraint Clarity  | 0.84  | 0.65  | Met    | Locks privacy, query, persistence, stack, deployment, and test constraints. |
| Acceptance Criteria | 0.90  | 0.70  | Met    | Pass/fail checks cover backend, frontend, security, navigation, and smoke evidence. |
| **Ambiguity**       | 0.09  | <=0.20 | Met   | Gate passed after user approved all recommendations. |

Status: Met = meets minimum, Below = below minimum and planner treats as assumption.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What search exists today? | Sidebar search is local; message search currently filters loaded messages only. |
| 1 | Researcher | What direct-message continuation exists today? | Existing chat return is useful but must become an enforced idempotent contract. |
| 2 | Simplifier | What is the minimum v1 contact search? | Exact-email New chat submit, not fuzzy global user search. |
| 2 | Simplifier | What is the minimum v1 message search? | Server-backed search for the selected conversation only. |
| 3 | Boundary Keeper | What search scopes are out of phase? | No global user directory, passive account reveal, or all-chat message search. |
| 3 | Boundary Keeper | What account work is out of phase? | Only session/chat safety is in scope; broader account settings are deferred. |
| 4 | Failure Analyst | What would make direct messages fail verification? | Duplicate direct chats under repeated or concurrent create attempts. |
| 4 | Failure Analyst | What would make search fail security review? | Returning unauthorized messages, hidden/deleted content, or presence/account existence outside existing chats. |
| 5 | Seed Closer | How should selected chat survive navigation? | URL query parameter plus per-user local storage fallback, validated against accessible chats. |
| 5 | Seed Closer | What verification blocks completion? | Backend tests, frontend tests, Playwright smoke, lint, and build must be recorded. |

---

*Phase: 05-messenger-baseline-completion*
*Spec approved: 2026-06-09*
*Next step: $gsd-discuss-phase 5 - implementation decisions for how to build the locked requirements above*
