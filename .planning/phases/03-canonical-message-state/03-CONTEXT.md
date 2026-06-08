# Phase 03: canonical-message-state - Context

**Gathered:** 2026-06-08T18:01:35+03:00
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers Chatify's canonical message state contract: idempotent HTTP message creation, canonical message payloads, monotonic delivery/read transitions, duplicate-free frontend cache merging, failed-send recovery, per-user unread truth, delete/edit/reaction visibility semantics, cursor-paginated history, and regression coverage. It does not redesign the chat UI, add search, expand group-chat product scope, or revisit Phase 1/2 auth and realtime identity foundations.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**12 requirements are locked.** See `03-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `03-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Canonical message creation contract with `clientMessageId` idempotency.
- Stable message response/event/type shape for create, fetch, delivery, read, edit, delete, reaction, and unread updates.
- Backend idempotent state transitions for sent, delivered, read, edit, delete, reaction, unread, and pagination behavior.
- Frontend TanStack Query message cache merge rules for optimistic send, socket events, mutation responses, refetches, rollback, unread sync, and cursor loading.
- Delete-for-self filtering and delete-for-everyone tombstones.
- Cursor-based message history replacing page/skip behavior.
- Validation alignment for message text length, edit window, ownership, visibility, and reaction bounds.
- Backend Vitest regression coverage and focused frontend state regression coverage for Phase 3 behavior.
- Minimal necessary edits to `Frontend/Chatify/src/pages/chat/chat.tsx` only where required to connect canonical state to the existing UI.

**Out of scope (from SPEC.md):**
- Chat page visual redesign, responsive layout polish, and component splitting - Phase 4 owns messenger UI reconstruction.
- Conversation search, message search, and direct-message continuation polish - Phase 5 owns baseline completion.
- Socket identity, membership authorization, presence privacy, and reconnect readiness redesign - Phase 2 already owns that contract.
- Broad auth/session, CSRF, reset, OAuth, and logging foundation work - Phase 1 owns those controls.
- Group-chat product expansion - v2 defers group conversations, although existing group-compatible fields must not be broken.
- Attachments, media previews, push notifications, moderation, admin tooling, and end-to-end encryption - v2 or later work.
- Horizontal Socket.IO scaling or Redis/shared presence state - later infrastructure work.
- Replacing React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, or the npm package layout.
- Overwriting unrelated local work in `Frontend/Chatify/src/pages/chat/chat.tsx`.

</spec_lock>

<decisions>
## Implementation Decisions

### Backend Message-State Boundary
- **D-01:** Extract focused message-state helpers instead of expanding `messageController.mjs` further. Helpers should cover canonical serialization, idempotent create, status transitions, unread counting, and visibility filters.
- **D-02:** Keep HTTP route modules thin. Route wiring remains in `Backend/Chatify/Routes/messageRouter.mjs`; request behavior remains in controllers and extracted helpers.
- **D-03:** Keep message creation HTTP-only. Socket.IO may broadcast persisted server-authoritative state but must not create arbitrary client-supplied messages.

### Persistence Shape And Idempotency
- **D-04:** Add optional fields directly to `Backend/Chatify/Models/messageModel.mjs`: `clientMessageId`, `deletedForEveryone`, `deletedBy`, and `deletedAt`.
- **D-05:** Add indexes that support idempotent creation and cursor history. The idempotency index should uniquely identify one message per authenticated sender, chat, and `clientMessageId` when `clientMessageId` exists.
- **D-06:** If the same sender/chat/clientMessageId is reused with different message content, return a stable `409 conflict` rather than returning the existing message or overwriting content.
- **D-07:** A duplicate idempotent create must not re-emit `message:new`, unread updates, or other side effects. It may return the existing persisted message over HTTP.
- **D-08:** Generate `clientMessageId` in `Frontend/Chatify/src/hooks/useChatQueries.ts` using `crypto.randomUUID()` before optimistic insertion.
- **D-09:** Backend should accept messages without `clientMessageId` as a legacy-compatible path during this phase, but new frontend sends must include it.

### Canonical Payloads And Status Transitions
- **D-10:** Use full canonical message payloads for create, fetch, edit, delete-for-everyone tombstone, and reaction responses/events.
- **D-11:** Use small typed patch payloads for delivery/read status updates where resending full message content is unnecessary.
- **D-12:** Enforce `sent -> delivered -> read` with a shared status-rank helper and guarded MongoDB updates. Ad hoc per-handler status checks are not enough.
- **D-13:** Delivery/read operations must be idempotent: repeated events or requests cannot change first-transition timestamps or move a message backward.
- **D-14:** Socket delivery handling in `Backend/Chatify/Config/socket.mjs` should continue deriving chat membership from the persisted message, following the Phase 2 decision not to trust client-supplied `chatId`.

### Unread And Visibility Semantics
- **D-15:** Treat `Message.readBy` and authenticated user context as the source of truth for unread counts. `Chats.unReadMessages` must not be required for correct unread behavior.
- **D-16:** Emit authoritative absolute unread counts after create, read, delete-for-self, and delete-for-everyone visibility changes. Avoid relative increment/decrement as the canonical contract.
- **D-17:** Any authorized chat member who can see a message may delete it for self. Only the sender may delete for everyone.
- **D-18:** `getAllChats()` should project `latestMessage` for the requesting user so messages deleted for self do not reappear in the sidebar as latest message.
- **D-19:** Delete-for-everyone should write a stable tombstone with an unchanged `_id`, deletion metadata, and empty/redacted message text. UI copy such as "Message deleted" should be rendered by the frontend later, not stored as message content.

### Cursor Pagination And Frontend Cache Ownership
- **D-20:** Keep the existing `GET /api/message/get-all-messages/:id` route but add cursor parameters such as `before` and `limit`; migrate frontend callers away from `page` and `skip`.
- **D-21:** Cursor ordering should use server `createdAt` plus `_id` tie-breaker and return display-ordered messages with `nextCursor` and `hasMore`.
- **D-22:** Make TanStack Query the canonical frontend message store. Remove the current split-brain behavior where `useMessages()` mirrors query data into separate local `useState` as the durable message list.
- **D-23:** Expose shared query helper functions from `Frontend/Chatify/src/hooks/useChatQueries.ts` for upsert, patch, remove/tombstone, unread sync, and cursor prepend behavior.
- **D-24:** Socket event callbacks and existing page handlers should call shared query helpers rather than each owning bespoke merge logic.
- **D-25:** Failed optimistic sends should remain visible as frontend-only failed items tied to the same `clientMessageId`, with retry reusing that id.

### Validation And Error Semantics
- **D-26:** Reaction validation should avoid a brittle emoji allowlist. Use a max 32-character emoji string and max 50 reactions per message.
- **D-27:** Keep status codes meaningful, but use generic private-resource messages for membership failures so unauthorized users do not learn whether private chats or messages exist.
- **D-28:** Align create/edit text validation at trimmed non-empty content and 1000 characters across frontend types/helpers, controller checks, and Mongoose schema.

### Testing And Verification
- **D-29:** Add minimal frontend Vitest coverage around extracted pure helper logic for merge, unread count sync, failed optimistic retry, and cursor prepend. Defer DOM UI tests and React Testing Library setup to Phase 4 unless planning proves they are unavoidable.
- **D-30:** Backend regression tests should be split into focused suites for message creation/idempotency, status/read/unread, delete/edit/reaction, pagination, and socket event contract.
- **D-31:** Backend tests should extend the existing Vitest, Supertest, MongoDB Memory Server, fixture, and real Socket.IO client patterns from Phase 1 and Phase 2 rather than introducing another backend test framework.
- **D-32:** Frontend verification must still run `npm run lint` and `npm run build`; if a frontend Vitest script is added, it becomes part of Phase 3 verification.

### Repository Hygiene
- **D-33:** Phase 3 may make minimal targeted wiring edits to the dirty `Frontend/Chatify/src/pages/chat/chat.tsx` only where necessary to connect canonical state to the existing UI.
- **D-34:** Do not use Phase 3 to clean up layout, styling, or component structure in `chat.tsx`; Phase 4 owns that reconstruction.
- **D-35:** Before and after any targeted `chat.tsx` edits, inspect the diff carefully because the file is already dirty from local line-ending/worktree state.

### Agent Discretion
- Planners may choose exact helper filenames and module placement under backend `Controller`, `Utils`, or a small message-domain folder, as long as controllers stay readable and tests can target the helpers.
- Planners may choose exact TypeScript helper names and whether helpers are exported from `useChatQueries.ts` or a nearby utility module, as long as TanStack Query remains the canonical message store.
- Planners may choose whether legacy page/skip parameters are rejected immediately or tolerated during migration, as long as frontend Phase 3 code uses cursor parameters and backend no longer relies on `skip` for the new path.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Requirements
- `.planning/phases/03-canonical-message-state/03-SPEC.md` - locked Phase 3 requirements, boundaries, constraints, and acceptance criteria.

### Prior Phase Decisions
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` - authenticated socket identity, membership checks, private user emits, reconnect behavior, and prohibition on socket-created messages.
- `.planning/phases/01-security-and-test-foundation/01-CONTEXT.md` - backend test harness, CSRF/session/security boundaries, redacted logging, and chat-page protection constraints.

### Project Planning
- `.planning/ROADMAP.md` - Phase 3 plan split and Phase 4/5 boundaries.
- `.planning/REQUIREMENTS.md` - MSG-01 through MSG-07 and TEST requirement traceability.
- `.planning/PROJECT.md` - core value, brownfield constraints, security posture, and dirty chat page warning.
- `.planning/STATE.md` - current GSD state and Phase 3 readiness.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - route/controller/model layering, socket singleton pattern, frontend query/socket hook layering, and anti-patterns.
- `.planning/codebase/CONVENTIONS.md` - naming, import, error handling, logging, and module design conventions.
- `.planning/codebase/TESTING.md` - historical testing map; note it is stale after Phase 1/2, so verify live package scripts and test folders.

### Live Code Surfaces
- `Backend/Chatify/Controller/messageController.mjs` - current message create, fetch, read, unread, delete, edit, reaction, and socket emission behavior.
- `Backend/Chatify/Models/messageModel.mjs` - message schema, status/read/reaction/delete fields, and indexes.
- `Backend/Chatify/Models/chatModel.mjs` - chat members, global `unReadMessages`, and `latestMessage` fields.
- `Backend/Chatify/Config/socket.mjs` - delivery socket handling, status updates, targeted emits, and Phase 2 socket authorization helpers.
- `Backend/Chatify/test/message/message.authorization.test.mjs` - existing HTTP message authorization regression pattern.
- `Backend/Chatify/test/socket/socket.authorization.test.mjs` - existing socket authorization, delivery, message-send rejection, and unread targeting tests.
- `Frontend/Chatify/src/api/messageApi.ts` - current message API request/response types and page-based message fetching.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - current optimistic send, local message state, cache updates, unread queries, and mutation hooks.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - current socket event listeners and reconnect invalidation.
- `Frontend/Chatify/src/types/chat.ts` - frontend chat/message/event contracts.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - current integration point for message callbacks, mark-read observer, delete/edit/reaction handlers, and unread badges; edit only minimally.
- `Backend/Chatify/package.json` - backend Vitest command and test dependencies.
- `Frontend/Chatify/package.json` - frontend lint/build scripts and absence of a frontend test script before Phase 3.

### External Skills Installed Or Reused
- `C:/Users/saieh/.agents/skills/mongodb/SKILL.md` - MongoDB/Mongoose persistence guidance found for this phase.
- `C:/Users/saieh/.agents/skills/tanstack-query/SKILL.md` - TanStack Query cache guidance found for this phase.
- `C:/Users/saieh/.agents/skills/vitest-testing/SKILL.md` - Vitest testing guidance reused for this phase.
- `C:/Users/saieh/.agents/skills/websocket-engineer/SKILL.md` - WebSocket/Socket.IO contract guidance reused for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Backend/Chatify/Utils/chatAccess.mjs`: Phase 2 already provides `assertChatMember`, `assertMessageChatMember`, and `normalizeObjectId`; Phase 3 should reuse or align with these helpers for message authorization.
- `Backend/Chatify/test/helpers/authAgent.mjs`: Existing signup/auth agent helpers support authenticated HTTP message tests.
- `Backend/Chatify/test/helpers/socketClient.mjs` and `socketServer.mjs`: Existing real Socket.IO client/server test harness supports message delivery and event contract tests.
- `Backend/Chatify/test/fixtures/chats.mjs` and `messages.mjs`: Existing fixture factories are the right starting point for idempotency, status, unread, and pagination tests.
- `Frontend/Chatify/src/hooks/useChatQueries.ts`: Existing query keys and mutation hooks are the correct integration point for canonical message cache helpers.
- `Frontend/Chatify/src/hooks/useChatSocket.ts`: Existing socket lifecycle and listener registration should stay centralized here.

### Established Patterns
- Backend route files stay thin and delegate to named controller exports.
- Backend controllers use Mongoose models, `asyncErrHandler`, and direct JSON responses for route behavior.
- Phase 1/2 backend tests use Vitest, Supertest, MongoDB Memory Server, fixtures, and real Socket.IO clients where contract behavior matters.
- Frontend transport belongs in `Frontend/Chatify/src/api/*.ts`; pages should not call Axios directly.
- Frontend server state belongs in TanStack Query hooks; socket logic belongs in `useChatSocket.ts`, not directly in components.
- Existing file style is mixed; preserve local style and avoid broad formatting churn.

### Integration Points
- `POST /api/message/new-message` must accept `clientMessageId`, ignore/reject client sender identity, and return canonical messages.
- `GET /api/message/get-all-messages/:id` should keep its route path but move to cursor params and response metadata.
- `PATCH /api/message/:messageId/read` and `PATCH /api/message/:chatId/mark-read` must return receipt patches plus authoritative unread count.
- Delete/edit/reaction routes must return canonical full message state or typed response data that shared frontend helpers can apply.
- `message:new`, `message:status-update`, `message:read`, `messages:read-batch`, `message:deleted`, `message:edited`, `message:reaction`, and `unread:update` must align with the canonical TypeScript event types.
- `Frontend/Chatify/src/pages/chat/chat.tsx` currently calls `upsertMessage`, `removeMessage`, `updateMessageStatus`, `updateMessagesStatus`, `markMessagesAsRead`, `handleDeleteMessage`, and `handleReaction`; Phase 3 should redirect those through shared query helpers with minimal page edits.

</code_context>

<specifics>
## Specific Ideas

- User approved all recommended implementation decisions from the one-shot Phase 3 questionnaire.
- Keep Phase 3 state-focused and avoid UI reconstruction.
- Add `mongodb` and refreshed `tanstack-query` skills for persistence/cache planning; reuse already-installed `vitest-testing` and `websocket-engineer` skills.
- The first TanStack Query skill installed in the prior spec pass was lower-install; this pass refreshed it with `tanstack-skills/tanstack-skills@tanstack-query` because it has higher install count and direct relevance.
- Both recent skill installs copied into `C:/Users/saieh/.agents/skills/...`; the Skills CLI also warned that PromptScript does not support global skill installation, which does not block Codex skill availability.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within Phase 3 scope.

</deferred>

---

*Phase: 03-canonical-message-state*
*Context gathered: 2026-06-08T18:01:35+03:00*
