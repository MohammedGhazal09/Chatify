# Phase 43 Research - Reply To Message With Quoted Context

**Created:** 2026-06-30
**Status:** Complete
**Method:** Inline codebase scout; subagents disabled by project instruction.

## Current Implementation

- `Frontend/Chatify/src/pages/chat/chat.tsx` already has `replyingTo`, `setReplyingTo`, `handleReply`, Escape cancellation, and `MessageComposer` props.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` displays a reply preview, but it only uses the local source message and does not alter the send payload.
- `Frontend/Chatify/src/pages/chat/components/MessageActionMenu.tsx` exposes `Reply` for active conversations.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` has no quoted context rendering.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` and `Frontend/Chatify/src/hooks/messageCache.ts` create optimistic messages and merge socket/API messages, but no reply fields exist in the message type.
- `Backend/Chatify/Models/messageModel.mjs` has no reply metadata fields.
- `Backend/Chatify/Controller/messageController.mjs` validates chat membership and source message visibility for history/search/delete flows; those patterns can validate reply sources.
- `Backend/Chatify/Utils/messageState.mjs` owns serialization and visibility helpers. It is the right home for quote serialization and preview normalization.

## Recommended Backend Shape

Add a `replyTo` subdocument to `Messages`:

- `messageId`: ObjectId ref `Messages`
- `sender`: ObjectId ref `Users`
- `messageType`: `text | call | encrypted`
- `textPreview`: string, max 160
- `attachmentCount`: number
- `isDeleted`: boolean
- `isEncrypted`: boolean
- `createdAt`: Date

Recommendation: use `replyToMessageId` only in the request payload, then persist the normalized `replyTo` snapshot on the created message. This keeps payloads simple and response objects stable.

## Validation Rules

- Validate `replyToMessageId` only for standard non-encrypted sends.
- Require the source message to be in the same chat.
- Use `canUserSeeMessage` and `buildVisibleMessageFilter` semantics so deleted-for-self sources cannot be quoted.
- Reject deleted-for-everyone sources with the same generic source-unavailable error.
- Do not expose whether a message exists outside the chat or was deleted by someone else.

## Idempotency

Standard send idempotency currently compares text plus attachment fingerprint. Phase 43 should add a reply fingerprint:

- no reply: empty string
- reply: source message id plus safe snapshot fields

Same `clientMessageId` with different `replyToMessageId` must return 409. Same `clientMessageId` with the same reply target returns the existing message.

## Frontend Integration

- Extend `Message`, `NewMessagePayload`, `ComposerSendPayload`, and send mutation variables.
- Add `replyTo` to `createOptimisticMessage` input/output and `mergeCanonicalMessage`.
- In `handleSendMessage`, pass `replyToMessageId` and an optimistic reply snapshot when `replyingTo` exists.
- Clear `replyingTo` only after mutation success.
- Render quote block in `MessageBubble` before primary text/attachments.
- Add quote click callback through `MessageList` to `chat.tsx`.

## Encrypted Conversation Decision

Recommendation: disable durable replies in encrypted conversations in this phase. The server cannot receive decrypted quote text without weakening Phase 36's product claim. A future encrypted quote design can include client-encrypted quote metadata inside the encrypted payload.

## Test Plan Inputs

Backend focused tests:

- create reply to visible standard message
- reject out-of-chat source
- reject source hidden by `deletedFor`
- reject source deleted for everyone
- idempotent same reply reuses message
- idempotent different reply conflicts
- encrypted conversation reply plaintext is not accepted

Frontend focused tests:

- `MessageComposer` preview hardening/fallback/cancel
- `MessageBubble` quote rendering and jump action
- `useSendMessage` carries `replyToMessageId` and optimistic `replyTo`
- cache merge preserves reply metadata
- `chat.tsx` quote jump uses loaded source or context fetch fallback

## Risks

- Quote snapshots can accidentally leak hidden source text if visibility checks are missed.
- Optimistic messages can lose `replyTo` if cache merge does not preserve the field.
- Encrypted replies can create a privacy regression if decrypted text is sent as server-readable metadata.
- Quote block can overflow on mobile with long CJK/emoji/RTL text unless it clamps/wraps.

## Recommendation

Implement in three waves:

1. Backend schema, validation, serialization, idempotency, and tests.
2. Frontend payload/cache/UI/jump behavior and tests.
3. Review, lint/build, Hercules visual QA, and traceability.
