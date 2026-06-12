# Phase 03: canonical-message-state - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-08T18:01:35+03:00
**Phase:** 03-canonical-message-state
**Areas discussed:** Backend message-state boundary, persistence shape and idempotency, canonical events and status transitions, unread and visibility semantics, pagination and cache ownership, validation/testing/repository hygiene

---

## Backend Message-State Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Keep inside `messageController.mjs` | Continue adding canonical state behavior directly to the existing controller. | |
| Extract message-state helpers/services | Move reusable serialization, idempotency, status, unread, and visibility behavior into focused helpers. | yes |
| Split by operation | Create separate operation-specific modules for every route/action. | |

**User's choice:** Approved recommendation.
**Notes:** The controller is already large; downstream planning should keep route/controller behavior readable and testable.

---

## Persistence Shape And Idempotency

| Option | Description | Selected |
|--------|-------------|----------|
| Direct model fields | Add canonical optional fields to `Messages`. | yes |
| Subdocuments | Model canonical state as nested subdocuments. | |
| Separate message-state collection | Store lifecycle/idempotency state outside the `Messages` document. | |

**User's choice:** Approved recommendation.
**Notes:** Add `clientMessageId`, `deletedForEveryone`, `deletedBy`, and `deletedAt` directly to the message schema with supporting indexes.

| Option | Description | Selected |
|--------|-------------|----------|
| Return existing | Return the existing message even when the duplicated `clientMessageId` has different text. | |
| Overwrite | Update the prior message with the new text. | |
| Reject conflict | Return a stable `409 conflict`. | yes |

**User's choice:** Approved recommendation.
**Notes:** Prevents hidden client bugs and protects message integrity.

| Option | Description | Selected |
|--------|-------------|----------|
| Re-emit | Emit socket and unread events again for duplicate creates. | |
| Never re-emit | Return the existing HTTP result without repeating side effects. | yes |
| Re-emit only to sender | Notify only the sender for duplicate creates. | |

**User's choice:** Approved recommendation.
**Notes:** Duplicate retries must not duplicate UI messages or unread state.

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend hook | Generate the id before optimistic insertion. | yes |
| Backend fallback | Generate the id only after the request reaches the server. | |
| Both | Generate in both places. | |

**User's choice:** Approved recommendation.
**Notes:** Use `crypto.randomUUID()` in `useSendMessage()`. Backend tolerates legacy absence but new frontend sends include it.

---

## Canonical Events And Status Transitions

| Option | Description | Selected |
|--------|-------------|----------|
| Always full message | Send full canonical message payloads for every event. | |
| Mostly patches | Send minimal patches for most events. | |
| Mixed | Full messages for state replacement, typed patches for delivery/read status. | yes |

**User's choice:** Approved recommendation.
**Notes:** Full payloads simplify create/fetch/edit/tombstone/reaction cache replacement; typed status patches avoid needless message body resend.

| Option | Description | Selected |
|--------|-------------|----------|
| Ad hoc checks | Each route/event handler enforces its own transition checks. | |
| Status rank helper | Central helper encodes monotonic status ordering. | yes |
| Database-only filters | Rely entirely on MongoDB update predicates. | |

**User's choice:** Approved recommendation.
**Notes:** Use a shared status-rank helper plus guarded MongoDB updates.

---

## Unread And Visibility Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Keep increment/count mix | Continue mixing relative increments and absolute resets. | |
| Emit absolute counts only | Send authoritative unread counts after state changes. | yes |
| Invalidate/refetch only | Avoid socket count updates and rely on query invalidation. | |

**User's choice:** Approved recommendation.
**Notes:** Absolute counts recover from missed events and reduce unread drift.

| Option | Description | Selected |
|--------|-------------|----------|
| Sender only | Only the sender can delete a message for self. | |
| Any chat member who can see it | Any authorized visible-message member can hide it locally. | yes |
| Only recipient | Only non-senders can delete for self. | |

**User's choice:** Approved recommendation.
**Notes:** Only sender can delete for everyone.

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is | Keep global `latestMessage` behavior. | |
| Hide only in history | Filter self-deleted messages only from message history. | |
| Project latest message per user | Return sidebar latest message according to requester visibility. | yes |

**User's choice:** Approved recommendation.
**Notes:** Prevents self-deleted messages from reappearing in the sidebar.

| Option | Description | Selected |
|--------|-------------|----------|
| Empty text | Return an empty/redacted text field for tombstones. | |
| Fixed placeholder | Store visible copy such as "Message deleted" in the message text. | |
| Deleted metadata only | Let metadata drive frontend rendering. | yes |

**User's choice:** Approved recommendation.
**Notes:** Use stable metadata plus empty/redacted text; frontend renders user-facing copy later.

---

## Pagination And Cache Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| New endpoint | Add a new cursor-specific message history endpoint. | |
| Same endpoint with `before` cursor | Keep route path and add cursor params. | yes |
| Support both temporarily | Keep page and cursor behaviors in parallel. | |

**User's choice:** Approved recommendation.
**Notes:** Lowest routing churn while moving new frontend code off page/skip behavior.

| Option | Description | Selected |
|--------|-------------|----------|
| Local `useState` inside `useMessages` | Keep current local durable message list. | |
| TanStack Query only | Make query data the canonical frontend store. | yes |
| Both | Keep query and local state in sync. | |

**User's choice:** Approved recommendation.
**Notes:** Current split state causes duplicate merge paths.

| Option | Description | Selected |
|--------|-------------|----------|
| `chat.tsx` callbacks | Page-level handlers own socket event cache updates. | |
| `useChatSocket` | Socket hook owns direct message cache mutation. | |
| Shared query helpers | Socket/page code call reusable cache helpers. | yes |

**User's choice:** Approved recommendation.
**Notes:** Keeps event behavior testable and minimizes page edits.

| Option | Description | Selected |
|--------|-------------|----------|
| Remove | Delete failed optimistic message on error. | |
| Keep failed item | Preserve failed item and allow retry. | yes |
| Toast only | Show an error but do not preserve message state. | |

**User's choice:** Approved recommendation.
**Notes:** Retry uses the same `clientMessageId` to prove no duplicate persisted messages.

---

## Validation, Testing, And Repository Hygiene

| Option | Description | Selected |
|--------|-------------|----------|
| No cap | Accept arbitrary reaction strings/counts. | |
| Small per-message cap | Bound reaction string length and total reactions. | yes |
| Emoji allowlist | Accept only explicitly allowed emoji. | |

**User's choice:** Approved recommendation.
**Notes:** Max 32-character emoji string and max 50 reactions per message.

| Option | Description | Selected |
|--------|-------------|----------|
| Current specific messages | Keep detailed auth/membership error messages. | |
| Generic forbidden/not-found | Preserve status codes but avoid existence leaks. | yes |
| Fully structured codes | Add a broader structured HTTP error-code contract. | |

**User's choice:** Approved recommendation.
**Notes:** Aligns with Phase 2 private-resource handling.

| Option | Description | Selected |
|--------|-------------|----------|
| No frontend tests | Rely on lint/build and backend tests. | |
| Full React Testing Library setup | Add DOM/hook integration testing now. | |
| Pure Vitest utility tests first | Test extracted merge/unread/cursor helpers without UI reconstruction. | yes |

**User's choice:** Approved recommendation.
**Notes:** Phase 4 owns DOM UI tests unless Phase 3 planning proves them unavoidable.

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing authorization test | Add all backend message-state coverage into the current authorization file. | |
| One large state test | Create one broad backend file for all message-state behavior. | |
| Focused files | Split by idempotency, status/read/unread, delete/edit/reaction, pagination, and socket contract. | yes |

**User's choice:** Approved recommendation.
**Notes:** Focused suites map better to the locked requirements.

| Option | Description | Selected |
|--------|-------------|----------|
| No edits | Avoid `chat.tsx` entirely. | |
| Minimal wiring edits | Touch only integration points needed for canonical state. | yes |
| Full cleanup | Use Phase 3 to clean up page layout and component structure. | |

**User's choice:** Approved recommendation.
**Notes:** Inspect diffs before/after because `chat.tsx` is already dirty from local line-ending/worktree state.

---

## Agent Discretion

- Exact backend helper filenames and placement are left to planning.
- Exact frontend helper names and whether they live in `useChatQueries.ts` or a nearby utility module are left to planning.
- Legacy page/skip tolerance during migration is left to planning, as long as new Phase 3 frontend code uses cursor behavior and backend no longer relies on skip for the new path.

## Deferred Ideas

None - discussion stayed within Phase 3 scope.
