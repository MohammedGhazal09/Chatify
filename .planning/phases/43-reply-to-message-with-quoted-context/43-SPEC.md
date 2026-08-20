# Phase 43: Reply To Message With Quoted Context - Specification

**Created:** 2026-06-30
**Ambiguity score:** 0.11 (gate: <= 0.20)
**Requirements:** 6 locked

## Goal

Users can reply to a visible message in the same conversation and see durable quoted context in the composer, sent bubble, socket updates, reloads, search jumps, and mobile layouts without creating nested thread semantics.

## Background

Chatify already has a message action menu with a `Reply` action and a local `replyingTo` composer preview. The state is not persisted: `NewMessagePayload`, `messageApi.createMessage`, `Message` serialization, the Mongoose message schema, optimistic cache merging, and message bubbles do not carry durable reply metadata. A sent reply currently becomes an ordinary message after reload or socket reconciliation.

## Requirements

1. **Durable reply relationship**: A standard outgoing message can include `replyToMessageId` when the source message is visible to the sender and belongs to the same chat.
   - Current: Reply selection is local UI state only and is discarded when the message is sent.
   - Target: Backend validates the source message and stores a reply metadata snapshot on the new message.
   - Acceptance: A backend test sends with `replyToMessageId`, refetches the conversation, and sees stable `replyTo.messageId`, `replyTo.sender`, and preview metadata.

2. **Privacy-safe quote snapshot**: Reply metadata is a bounded send-time snapshot, not a live embed of the source document.
   - Current: No snapshot exists.
   - Target: Snapshot includes source message id, sender id, message type, created time, attachment count, deleted/encrypted flags, and a short plaintext preview only when the source is a visible standard message.
   - Acceptance: Tests prove deleted, encrypted, unauthorized, and out-of-chat source messages do not leak plaintext or private identity.

3. **Idempotent reply sends**: Reusing a `clientMessageId` must not silently change the quoted source.
   - Current: Idempotency compares text, attachment fingerprint, and encrypted payload fingerprint.
   - Target: Standard message idempotency also compares a reply fingerprint derived from `replyToMessageId` and safe quote state.
   - Acceptance: A backend test proves same `clientMessageId` with a different `replyToMessageId` returns 409.

4. **Frontend send contract**: The composer passes reply metadata through standard sends and optimistic messages.
   - Current: `replyingTo` is displayed but omitted from the API payload and cache.
   - Target: `NewMessagePayload`, `useSendMessage`, `createOptimisticMessage`, and cache merge preserve `replyTo`.
   - Acceptance: Frontend hook tests prove optimistic and server-confirmed messages retain quoted context.

5. **Quoted reply UI**: Users can see, cancel, and navigate quoted context without layout overlap.
   - Current: Composer preview only shows raw text and bubbles show no quote.
   - Target: Composer preview shows sender/preview/fallback, sent bubbles render a compact quote block, and clicking/tapping a quote jumps to the loaded source or loads context through the existing message-context path.
   - Acceptance: Component/browser tests cover desktop and mobile quote display, cancel, long text, attachment-only, deleted source fallback, and jump behavior.

6. **Encrypted limitation honesty**: Encrypted conversations must not leak plaintext quote previews to the server.
   - Current: Reply is selectable in encrypted conversations but has no durable contract.
   - Target: Phase 43 either stores encrypted-safe placeholder metadata only or disables encrypted quoted replies with visible copy; recommendation is to disable encrypted quoted replies until a client-encrypted quote payload exists.
   - Acceptance: Tests prove encrypted messages cannot send server-readable quote plaintext and the UI communicates the limitation.

## Boundaries

**In scope:**
- Mongoose reply metadata on messages.
- Backend validation for same-chat, visible, non-tombstoned source messages.
- Standard message idempotency that includes reply metadata.
- Message serialization, API types, optimistic cache merge, and socket payload compatibility.
- Composer preview, message bubble quote rendering, quote cancel, and source jump/fallback behavior.
- Focused backend/frontend tests, lint/build, and Hercules visual QA evidence.

**Out of scope:**
- Nested threads, threaded inboxes, reply counts, side panels, or notification grouping - this phase is quoted context only.
- Editing the quote snapshot after the source message is edited - snapshots are intentionally stable.
- Replying to messages hidden from the current user, deleted for everyone, or outside the chat.
- Server-readable encrypted quote previews - encrypted quote support needs a future client-encrypted metadata design.
- Broad search changes beyond preserving existing message-context jump behavior.

## Constraints

- Preserve Phase 3 canonical message lifecycle, unread counts, delivery/read receipts, and pagination order.
- Preserve Phase 36 encrypted-mode privacy claims; do not send decrypted quote text to the backend.
- Keep quote previews bounded to avoid large payloads, layout overflow, and notification/privacy leaks.
- Use existing React/Vite, TanStack Query, Mongoose, Socket.IO, and Tailwind patterns.
- Do not add a new component library or threading data model.

## Acceptance Criteria

- [ ] Standard messages can include `replyToMessageId` and persist safe `replyTo` metadata.
- [ ] Reply source validation rejects unauthorized, out-of-chat, deleted-for-self, deleted-for-everyone, and malformed ids.
- [ ] Idempotent standard sends reject a different reply target for the same `clientMessageId`.
- [ ] Message history, search context, socket `message:new`, optimistic send, retry, and chat latest-message cache preserve `replyTo`.
- [ ] Composer and bubble UI show quote preview/fallback states and can cancel or jump to source on keyboard and mobile.
- [ ] Encrypted conversation reply behavior is honest and does not leak plaintext.
- [ ] Backend tests, frontend tests, lint/build, and Hercules visual QA evidence are recorded.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes |
|--------------------|-------|------|--------|-------|
| Goal Clarity       | 0.94  | 0.75 | PASS   | Target is durable quoted context for same-chat replies. |
| Boundary Clarity   | 0.90  | 0.70 | PASS   | Threads, live quote updates, and encrypted plaintext quote support are excluded. |
| Constraint Clarity | 0.88  | 0.65 | PASS   | Privacy, idempotency, pagination, socket, and UI constraints are explicit. |
| Acceptance Criteria| 0.86  | 0.70 | PASS   | Backend, frontend, and visual checks are falsifiable. |
| **Ambiguity**      | 0.11  | <=0.20 | PASS | Ready for planning. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today for replies? | Local reply selection exists; no durable message contract exists. |
| 2 | Simplifier | What is the minimum useful version? | Same-chat quoted context on standard messages only. |
| 3 | Boundary Keeper | What is explicitly not this phase? | No threads, reply counts, or encrypted plaintext quote previews. |
| 4 | Failure Analyst | What would make the phase unsafe? | Quoting hidden messages, leaking encrypted plaintext, or changing idempotent payload meaning. |
| 5 | Seed Closer | What evidence proves completion? | API persistence, cache/socket propagation, UI states, and visual QA evidence. |

---

*Phase: 43-reply-to-message-with-quoted-context*
*Spec created: 2026-06-30*
