# Phase 3: Canonical Message State - Specification

**Created:** 2026-06-08
**Ambiguity score:** 0.09 (gate: <= 0.20)
**Requirements:** 12 locked

## Goal

Chatify message state changes from loosely merged HTTP, socket, optimistic, and refetch updates into one deterministic client/server contract for sending, receiving, editing, deleting, reacting, reading, unread counts, and cursor-paginated history.

## Background

Phase 2 completed the authenticated realtime contract: Socket.IO now derives identity from the authenticated session, rejects forged client identity, checks chat membership for room and event access, targets private user emissions, and reconciles socket readiness from server truth. Message creation remains HTTP-only by design.

The current Phase 3 baseline is still non-deterministic. `Backend/Chatify/Controller/messageController.mjs` creates messages without a client correlation id, emits `message:new` separately from the HTTP response, increments a global `Chats.unReadMessages` field, stores per-message `readBy`, uses page/skip pagination, hard-deletes messages for everyone, and does not filter `deletedFor` messages from history. `Backend/Chatify/Models/messageModel.mjs` allows 5000-character messages while the controller enforces 1000 characters. `Frontend/Chatify/src/hooks/useChatQueries.ts` creates optimistic messages with `optimistic-${Date.now()}` ids and replaces them only by temporary id, while `Frontend/Chatify/src/hooks/useChatSocket.ts` and `Frontend/Chatify/src/pages/chat/chat.tsx` merge socket events, mark reads, update unread counts, and apply edit/delete/reaction events through separate paths.

The trigger for this phase is that optimistic updates, mutation responses, socket events, read receipts, unread counters, deletes, edits, reactions, and paginated history can currently race or drift. The primary deliverable is a canonical message contract and state merge path that makes those operations idempotent, authorized, and verifiable before Phase 4 rebuilds the UI.

## Requirements

1. **Idempotent HTTP message creation**: Message creation accepts a client-generated correlation id and creates at most one persisted message for a sender/chat/client-message tuple.
   - Current: `messageApi.createMessage()` sends `{ chatId, text, sender }`; the backend derives `sender` from `req.userId` but has no `clientMessageId`, so retries or socket echoes can create or render duplicates.
   - Target: `POST /api/message/new-message` accepts `{ chatId, text, clientMessageId }`, ignores or rejects client-supplied sender identity, persists `clientMessageId` with the message, and returns the existing persisted message for duplicate submissions by the same authenticated sender in the same chat.
   - Acceptance: Two authenticated requests with the same `chatId`, `text`, and `clientMessageId` from the same user create exactly one `Messages` document and return the same `_id`; a request cannot create a message as another user by supplying `sender`.

2. **Canonical message payload**: HTTP responses, Socket.IO events, query refetches, and frontend types expose one stable message shape.
   - Current: Controller responses, socket events, and frontend types are close but not locked; some events send partial payloads and deletion/edit/reaction responses return different slices of message state.
   - Target: Every message-bearing response or event uses a stable contract containing `_id`, `clientMessageId` when present, `chatId`, `sender`, `text`, `status`, `deliveredAt`, `readAt`, `readBy`, `reactions`, `isEdited`, `editedAt`, deletion fields, `createdAt`, and `updatedAt`, with partial events documented as patches tied to `_id`.
   - Acceptance: Backend tests assert the canonical fields on create, fetch, edit, delete, reaction, read, and socket message events; frontend `Message` and event types match those fields without requiring ad hoc casts.

3. **Monotonic delivery/read lifecycle**: Message status transitions are idempotent and cannot move backward.
   - Current: Messages use `sent`, `delivered`, and `read`, while socket join, `message:delivered`, single read, and batch read paths can independently mutate status.
   - Target: Persisted status moves only `sent -> delivered -> read`; repeated delivery/read requests are no-ops; sender-owned messages are not marked delivered/read by the sender; direct-message read state updates `readBy`, `readAt`, and status consistently.
   - Acceptance: Tests prove duplicate delivery events do not change timestamps after the first transition, read implies delivered, delivered never overwrites read, and a sender cannot mark their own message delivered or read.

4. **Duplicate-free frontend merge**: The frontend merges optimistic messages, HTTP responses, socket events, and refetches by canonical identity.
   - Current: Optimistic messages use temporary ids and `upsertMessage()` matches only `_id`, so a persisted socket echo can appear alongside the optimistic message before or after mutation success.
   - Target: TanStack Query message cache merges by `_id` and `clientMessageId`, replaces optimistic messages with server payloads, treats duplicate socket/refetch payloads as no-ops, and keeps messages sorted by server `createdAt` plus `_id` tie-breaker.
   - Acceptance: Focused frontend regression coverage shows one visible message after optimistic send plus HTTP success, optimistic send plus socket echo, socket echo before HTTP success, and refetch after success.

5. **Optimistic failure recovery**: Failed sends have a deterministic rollback or failed-state path.
   - Current: `useSendMessage()` restores previous messages/chats on mutation error, which can discard unrelated concurrent updates and does not leave a stable failed-send identity.
   - Target: Failed sends tied to a `clientMessageId` become a deterministic failed state or are removed without dropping unrelated messages; retry with the same client message id cannot duplicate the final persisted message.
   - Acceptance: Frontend regression coverage proves a failed send does not remove messages received after the optimistic update and a retried send produces one final persisted message.

6. **Authoritative per-user unread state**: Unread counts are derived from per-message read state for the authenticated user, not from the global chat counter.
   - Current: `Chats.unReadMessages` increments globally on send while unread count endpoints aggregate `Message.readBy`, creating two possible sources of truth.
   - Target: Unread count endpoints, socket `unread:update`, chat list updates, and mark-read responses use the authenticated user's unread count derived from messages where `sender != user` and `readBy.user != user`; `Chats.unReadMessages` is not treated as authoritative.
   - Acceptance: Tests prove user A and user B can have different unread counts in the same chat, mark-read returns the user's updated unread count, and global `Chats.unReadMessages` is not required for correct API/socket responses.

7. **Read receipt synchronization**: Batch and single read operations return enough server truth for message and unread caches to converge.
   - Current: Batch read returns updated messages and emits `messages:read-batch`; unread reset is a separate socket update, so frontend message status and unread cache can temporarily disagree.
   - Target: Read operations return updated receipt patches plus the authoritative unread count for the authenticated user and emit corresponding socket events to authorized room members or target user sockets.
   - Acceptance: Tests prove marking visible messages read updates `readBy`, message status, sender-visible receipt events, and the reader's unread count in one idempotent operation.

8. **Delete-for-self history filtering**: Messages deleted for the current user are excluded from that user's history and unread counts without affecting other members.
   - Current: `deletedFor` is written for delete-for-self, but `getAllMessages()` and unread aggregation do not filter it out.
   - Target: History and unread queries exclude messages whose `deletedFor` contains the authenticated user; other chat members still see the message unless they also delete it for themselves or it is deleted for everyone.
   - Acceptance: After user B deletes a message for self, user B no longer receives it from history or unread counts, while user A still receives it from history.

9. **Delete-for-everyone tombstone**: Delete-for-everyone preserves a stable message id while removing user-visible content.
   - Current: Delete-for-everyone hard-deletes the `Messages` document and then recalculates `latestMessage`, which can break event ordering, pagination, dedupe, and clients holding the deleted `_id`.
   - Target: Delete-for-everyone converts the message into a tombstone with stable `_id`, redacted/empty text, deletion metadata, and canonical socket/API updates; latest-message behavior treats tombstones consistently.
   - Acceptance: After delete-for-everyone, history returns a deleted marker with the same `_id`, socket clients receive a canonical deletion update, message content is not exposed, and pagination remains stable around the tombstone.

10. **Edit and validation boundary alignment**: Message edit and creation validation is consistent across model, controller, and frontend boundaries.
   - Current: Controller creation caps text at 1000 characters, the Mongoose model caps at 5000, edit validation has its own trimming and 15-minute rule, and frontend validation is not locked to the same boundary.
   - Target: Create and edit use the same trimmed non-empty text rule, 1000-character maximum, authenticated sender ownership, 15-minute edit window, and no editing of delete-for-everyone tombstones.
   - Acceptance: Backend tests and frontend validation coverage reject empty, whitespace-only, over-1000-character, non-owner, expired-window, and tombstoned-message edits with stable error responses.

11. **Reaction idempotency and bounds**: Reactions are authorized, bounded, and emitted as canonical state.
   - Current: `toggleReaction()` checks membership and toggles a user/emoji pair, but emoji length/count limits and duplicate behavior are not locked.
   - Target: A chat member can toggle one reaction per user per emoji on a visible message; invalid, oversized, or excessive reactions are rejected; non-members and users who cannot see the message cannot react; socket/API responses include canonical reaction state.
   - Acceptance: Tests prove duplicate toggles add then remove one reaction, duplicate storage is impossible for the same user/emoji/message tuple, invalid emoji payloads are rejected, and unauthorized users cannot infer or mutate private messages.

12. **Cursor-paginated message history and verification**: Message history avoids skip-based pagination and Phase 3 produces blocking regression evidence.
   - Current: `getAllMessages()` uses `page`, `limit`, `skip`, total counts, and reversal; frontend `loadMoreMessages()` requests page numbers.
   - Target: History uses cursor pagination based on server `createdAt` plus `_id`, returns messages in display order with `nextCursor` and `hasMore`, filters user-deleted messages, and keeps max page size bounded.
   - Acceptance: Backend tests prove the first page, older-page cursor, boundary tie-breaker, deleted-message filtering, and max-limit behavior; frontend regression coverage proves `loadMoreMessages()` prepends older messages without duplicates; `npm test` from `Backend/Chatify`, frontend lint/build, and any added frontend tests pass.

## Boundaries

**In scope:**
- Canonical message creation contract with `clientMessageId` idempotency.
- Stable message response/event/type shape for create, fetch, delivery, read, edit, delete, reaction, and unread updates.
- Backend idempotent state transitions for sent, delivered, read, edit, delete, reaction, unread, and pagination behavior.
- Frontend TanStack Query message cache merge rules for optimistic send, socket events, mutation responses, refetches, rollback, unread sync, and cursor loading.
- Delete-for-self filtering and delete-for-everyone tombstones.
- Cursor-based message history replacing page/skip behavior.
- Validation alignment for message text length, edit window, ownership, visibility, and reaction bounds.
- Backend Vitest regression coverage and focused frontend state regression coverage for Phase 3 behavior.
- Minimal necessary edits to `Frontend/Chatify/src/pages/chat/chat.tsx` only where required to connect canonical state to the existing UI.

**Out of scope:**
- Chat page visual redesign, responsive layout polish, and component splitting - Phase 4 owns messenger UI reconstruction.
- Conversation search, message search, and direct-message continuation polish - Phase 5 owns baseline completion.
- Socket identity, membership authorization, presence privacy, and reconnect readiness redesign - Phase 2 already owns that contract.
- Broad auth/session, CSRF, reset, OAuth, and logging foundation work - Phase 1 owns those controls.
- Group-chat product expansion - v2 defers group conversations, although existing group-compatible fields must not be broken.
- Attachments, media previews, push notifications, moderation, admin tooling, and end-to-end encryption - v2 or later work.
- Horizontal Socket.IO scaling or Redis/shared presence state - later infrastructure work.
- Replacing React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, or the npm package layout.
- Overwriting unrelated local work in `Frontend/Chatify/src/pages/chat/chat.tsx`.

## Constraints

- Message creation remains HTTP-only; Socket.IO broadcasts persisted server-authoritative state but does not create arbitrary client-supplied messages.
- Message identity and authorization derive from authenticated session data and server-side chat/message membership checks, not from client-supplied sender or chat ownership claims.
- The canonical message state must be compatible with the existing MongoDB/Mongoose data model unless discuss-phase proves a focused schema migration is necessary.
- Cursor pagination must avoid `skip` for message history pages and must remain stable when messages are edited, tombstoned, or deleted for one user.
- Message text create/edit maximum is 1000 characters unless the SPEC is updated before planning.
- Edit window is 15 minutes from message creation unless the SPEC is updated before planning.
- Unauthorized failures must not leak private chat or message existence beyond the project's established forbidden/not-found behavior.
- Logs added or changed in this phase must not include secrets, full tokens, raw cookies, reset codes, OAuth payloads, or unnecessary user-identifying data.
- Existing production deployment assumptions remain Render backend, Vercel frontend, cookie credentials, and aligned CORS/socket origins.
- The existing dirty `Frontend/Chatify/src/pages/chat/chat.tsx` file must be preserved unless user-authorized edits are needed for this phase's locked state contract.

## Acceptance Criteria

- [ ] Repeating `POST /api/message/new-message` with the same authenticated sender, chat, and `clientMessageId` returns one persisted message and does not create duplicates.
- [ ] HTTP responses, socket events, frontend `Message` types, and cache merge code share one canonical identity and payload contract.
- [ ] Message status transitions are idempotent and monotonic: `sent -> delivered -> read`, with no backward transitions.
- [ ] Optimistic send plus HTTP response, socket echo, and refetch renders one message, not duplicates.
- [ ] Failed send handling preserves unrelated concurrent cache updates and allows retry without duplicate persisted messages.
- [ ] Unread counts are correct per user and do not depend on global `Chats.unReadMessages` as the source of truth.
- [ ] Single and batch read operations update message receipts and the authenticated user's unread count from server truth.
- [ ] Delete-for-self excludes messages from that user's history and unread counts while preserving visibility for other members.
- [ ] Delete-for-everyone returns and emits a stable tombstone without exposing deleted content.
- [ ] Create/edit validation is aligned at 1000 characters, trimmed non-empty text, sender ownership, 15-minute edit window, and tombstone rejection.
- [ ] Reactions are authorized, bounded, idempotent per user/emoji/message, and emitted as canonical state.
- [ ] Message history uses cursor pagination with `nextCursor` and `hasMore`, not page/skip behavior.
- [ ] Backend Vitest coverage exists for idempotent create, status transitions, read/unread, delete, edit, reaction, authorization, and cursor pagination.
- [ ] Focused frontend regression coverage exists for merge, optimistic success/failure, unread cache sync, and cursor prepend behavior.
- [ ] `npm test` from `Backend/Chatify`, frontend lint/build, and any added frontend test command pass.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.94  | 0.75  | met    | Goal locks deterministic message state across send, receive, status, edit, delete, reaction, unread, and pagination. |
| Boundary Clarity    | 0.92  | 0.70  | met    | Phase 4 UI, Phase 5 search/baseline, Phase 2 realtime auth, v2 expansion, and protected local work are explicit exclusions. |
| Constraint Clarity  | 0.86  | 0.65  | met    | HTTP-only creation, session identity, cursor pagination, validation limits, privacy, stack, and deployment constraints are explicit. |
| Acceptance Criteria | 0.88  | 0.70  | met    | Pass/fail criteria cover backend state, frontend cache convergence, unread sync, pagination, and verification commands. |
| **Ambiguity**       | 0.09  | <=0.20| met    | Gate passed after user approved all recommendations and requested SPEC.md creation. |

Status: met = met minimum, below = below minimum (planner treats as assumption).

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists in message state today? | Message creation is HTTP-only but lacks `clientMessageId`; optimistic, socket, refetch, and unread paths can race. |
| 1 | Researcher | What triggered this phase? | Current message state can duplicate, drift, skip deleted filtering, and paginate with page/skip. |
| 2 | Simplifier | What is the irreducible Phase 3 core? | Canonical identity, idempotent backend transitions, frontend merge/rollback, unread sync, and cursor history. |
| 2 | Simplifier | Should socket create messages? | No; message creation remains HTTP-only and sockets broadcast persisted state. |
| 3 | Boundary Keeper | What stays out of scope? | UI reconstruction, search, group expansion, media, notifications, E2EE, and broad auth/socket foundation work. |
| 3 | Boundary Keeper | How should dirty chat page work be treated? | Avoid overwriting unrelated local `chat.tsx` changes; touch it only if necessary for canonical state wiring. |
| 4 | Failure Analyst | What would make the output unreliable? | Temporary-id dedupe, global unread counters, hard deletes, skip pagination, and stale optimistic rollback. |
| 4 | Failure Analyst | What should verifier rejection cover? | Duplicate messages, status downgrades, unread drift, deleted message leakage, invalid edits/reactions, and missing regression tests. |
| 5 | Seed Closer | What identity should dedupe use? | Add and persist `clientMessageId`, with server `_id` as canonical persisted identity. |
| 5 | Seed Closer | What should be authoritative for unread counts? | Per-user unread counts derived from `Message.readBy`, not `Chats.unReadMessages`. |
| 6 | Seed Closer | What pagination contract is locked? | Cursor pagination using server `createdAt` plus `_id`, returning display-ordered messages with `nextCursor` and `hasMore`. |
| 6 | Seed Closer | How were recommendations handled? | User approved all recommendations, so every questionnaire recommendation is locked. |

---

*Phase: 03-canonical-message-state*
*Spec created: 2026-06-08*
*Next step: $gsd-discuss-phase 3 - implementation decisions (how to build what is specified above)*
