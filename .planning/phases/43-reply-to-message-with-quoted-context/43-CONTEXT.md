# Phase 43 Context - Reply To Message With Quoted Context

**Gathered:** 2026-06-30
**Status:** Ready for planning
**Source:** Auto-approved recommendations from the phase objective and codebase scout.

<domain>
## Phase Boundary

Phase 43 turns the existing local reply affordance into durable quoted context for standard conversation messages. Replies remain normal messages with a safe quote snapshot; they do not create threads, reply counters, side conversations, or new notification grouping.
</domain>

<spec_lock>
## Locked Requirements

- `.planning/phases/43-reply-to-message-with-quoted-context/43-SPEC.md` is the locked requirements source.
- Planning and execution must preserve Phase 3 canonical message state and Phase 36 encrypted limitations.
</spec_lock>

<decisions>
## Implementation Decisions

### D-01 Reply Data Shape
- Store a `replyTo` subdocument on `Messages` rather than a separate reply collection.
- Include `messageId`, `sender`, `messageType`, `textPreview`, `attachmentCount`, `isDeleted`, `isEncrypted`, and `createdAt`.
- Recommendation auto-approved because quoted context is read with each message and does not need independent lifecycle.

### D-02 Validation Boundary
- Accept `replyToMessageId` only for messages in the same chat that the sender can currently see.
- Reject malformed ids, out-of-chat ids, deleted-for-self ids, and deleted-for-everyone ids with generic message-not-found copy.

### D-03 Snapshot Stability
- Keep quote snapshots stable after source edits/deletes. Later source deletion may show the reply quote fallback from the stored snapshot rather than mutating historical replies.
- Recommendation: stable snapshots are simpler, auditable, and avoid fanout rewrites.

### D-04 Idempotency
- Include reply fingerprint in standard send idempotency so identical `clientMessageId` with a different quote source conflicts.

### D-05 Encrypted Conversations
- Do not send decrypted quote text for encrypted conversations. Disable durable encrypted replies in this phase with visible UI copy.
- Recommendation: this preserves Phase 36's privacy promise and avoids designing client-encrypted quote metadata inside a quoted-reply phase.

### D-06 Frontend Interaction
- Reuse existing `replyingTo` state and action menu entry.
- Pass `replyToMessageId` through the standard send payload, clear the composer reply state on successful send, and preserve it on failed send.
- Render a compact quote block in message bubbles and a hardened composer preview with sender/fallback copy.

### D-07 Source Navigation
- Clicking a quote should first scroll/highlight if the source is loaded. If it is not loaded, use the existing `useMessageContext` path to fetch surrounding messages, then highlight.
- If the source cannot be loaded, show a non-blocking toast and leave the reply message visible.

### D-08 Privacy
- Quote snapshots must use ids and bounded previews only. They must never include email, token, cookie, reset-code, raw encrypted plaintext, or non-public profile details.
</decisions>

<canonical_refs>
## Canonical References

### Locked Requirements
- `.planning/phases/43-reply-to-message-with-quoted-context/43-SPEC.md` - Phase 43 requirements, boundaries, and acceptance criteria.

### Backend Message Contract
- `Backend/Chatify/Models/messageModel.mjs` - Message schema, indexes, and message fields.
- `Backend/Chatify/Controller/messageController.mjs` - Message creation, idempotency, history, search context, delete/edit/reaction/pin flows.
- `Backend/Chatify/Utils/messageState.mjs` - Message normalization, serialization, visibility filters, id conversions, and cache-safe state helpers.
- `Backend/Chatify/test/chat` - Existing message lifecycle and conversation tests.

### Frontend Message Contract
- `Frontend/Chatify/src/types/chat.ts` - `Message`, `NewMessagePayload`, and related API contracts.
- `Frontend/Chatify/src/api/messageApi.ts` - Message create transport and multipart body construction.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Send mutation, optimistic updates, message search/context hooks.
- `Frontend/Chatify/src/hooks/messageCache.ts` - Canonical message merge, optimistic messages, and socket/cache helpers.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - Reply selection state, send orchestration, source jump/highlight behavior.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - Reply preview and cancel UI.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - Message bubble rendering and actions.
- `Frontend/Chatify/src/pages/chat/components/MessageActionMenu.tsx` - Reply action entry.

### Prior Phase Decisions
- `.planning/phases/03-canonical-message-state/03-SUMMARY.md` - Canonical message state and idempotency expectations.
- `.planning/phases/34-advanced-message-and-asset-search/34-SUMMARY.md` - Message context jump behavior.
- `.planning/phases/36-opt-in-encrypted-conversation-mode/36-SUMMARY.md` - Encrypted conversation limitations and privacy claims.
- `.planning/phases/42-contact-requests-and-trusted-conversation-onboarding/42-SUMMARY.md` - Current chat onboarding closure.
</canonical_refs>

<code_context>
## Code Context

- `chat.tsx` already owns `replyingTo`, `setReplyingTo`, `handleReply`, Escape cancellation, and composer props.
- `MessageComposer` renders a reply preview but only displays `replyingTo.text`.
- `handleSendMessage` currently omits reply metadata from the mutation payload.
- `MessageBubble` renders text, encrypted state, attachments, reactions, status, and actions but no quoted context.
- `messageState.serializeMessage` is the central serializer that should expose `replyTo`.
- `newMessage` already validates chat membership, block/moderation state, text, attachments, and `clientMessageId`.
- Standard idempotency compares message text and attachment fingerprint; encrypted idempotency compares encrypted payload fingerprint.
</code_context>

<specifics>
## Auto-Approved Recommendations

- Use `replyToMessageId` as the request field and `replyTo` as the serialized stored snapshot field.
- Disable encrypted durable replies for this phase with honest UI copy instead of leaking decrypted text or inventing partial crypto.
- Keep quote block compact: sender label, one-line or two-line preview, attachment/deleted/encrypted fallback, and source timestamp where useful.
- Use existing message-context loading for quote jumps instead of adding a new endpoint.
</specifics>

<deferred>
## Deferred Ideas

- Nested thread view, reply counts, thread subscriptions, and thread notifications.
- Client-encrypted quote payloads for encrypted conversations.
- Live quote snapshot updates after source edits.
- Quote search filters and analytics.
</deferred>

---

*Phase: 43-reply-to-message-with-quoted-context*
*Context gathered: 2026-06-30*
