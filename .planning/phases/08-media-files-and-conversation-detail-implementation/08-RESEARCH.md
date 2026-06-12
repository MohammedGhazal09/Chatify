---
phase: 08-media-files-and-conversation-detail-implementation
researched: 2026-06-12T17:55:32+03:00
status: complete
sources:
  - https://www.mongodb.com/docs/drivers/node/current/crud/gridfs/
  - https://expressjs.com/en/resources/middleware/multer/
  - https://github.com/sindresorhus/file-type
  - https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates
  - https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation
  - https://socket.io/docs/v4/server-api/
  - https://socket.io/docs/v4/rooms/
skills_used:
  - api-and-interface-design
  - express-rest-api
  - mongodb
  - tanstack-query
  - websocket-engineer
  - e2e-testing-patterns
---

# Phase 08 Research

## Research Summary

Phase 08 should be planned as a secure extension of the existing canonical message lifecycle, not as a separate attachment subsystem. The existing backend already has the right privacy shape for text messages: protected message routes, membership checks through `loadChatForUser`, per-user visibility in message state helpers, idempotent `clientMessageId` handling, and chat-room Socket.IO emits. The key implementation risk is preserving those behaviors while adding multipart input, protected file storage, attachment metadata, shared asset panels, and pinned-message data.

MongoDB GridFS is the best storage fit for the approved MVP boundary because the phase explicitly rejects external object storage and public URLs. MongoDB's Node.js driver documents GridFS buckets with `files` metadata and `chunks` collections, upload streams with metadata, and download streams for retrieving protected bytes. Even though the approved max file size is 10 MB, which is below MongoDB's 16 MB BSON document limit, GridFS is still the better long-term internal abstraction because it streams retrieval, separates file chunks from message documents, and avoids inflating message rows with binary data.

The frontend should keep TanStack Query as the source of durable server state. Current `useSendMessage`, `messageCache`, `useChatSocket`, and `messageApi` already own optimistic send, cache merge, retry, search, and socket reconciliation. Phase 08 should extend these contracts for attachment summaries, local object URL previews, shared asset query keys, pinned message query keys, and room-scoped invalidations instead of moving upload state directly into presentational components.

## External Research Findings

### MongoDB GridFS

- The official MongoDB Node.js driver docs describe GridFS as splitting files into chunks and reassembling them during retrieval.
- A GridFS bucket stores file chunks in a `chunks` collection and descriptive metadata in a `files` collection.
- `openUploadStream()` accepts options including `metadata`, which lets Chatify store private product metadata near the storage object.
- GridFS download operations can be wrapped behind authenticated Express routes, allowing protected streaming without public asset URLs.

Recommendation: create a Chatify storage service around `GridFSBucket`, using the existing Mongoose connection's database handle. Store product authorization fields in an `Attachment` model, not only in GridFS metadata, because shared files/media queries and message visibility rules are product-domain concerns.

Source: https://www.mongodb.com/docs/drivers/node/current/crud/gridfs/

### Express Multipart Uploads

- Express does not parse multipart file uploads through the existing JSON parser.
- Multer is the focused Express middleware for `multipart/form-data`.
- The Express Multer docs expose `storage`, `fileFilter`, and `limits`, and Multer supports `MemoryStorage` and `DiskStorage`.
- `.array(fieldname, maxCount)` is a direct fit for the approved max 5 attachments per message.

Recommendation: use Multer memory storage with `limits.fileSize` set to 10 MB and `.array('attachments', 5)`. Validate each file before writing to GridFS. Do not use disk storage because local disk is not durable for Render-style deployments.

Source: https://expressjs.com/en/resources/middleware/multer/

### File Signature Validation

- The `file-type` package detects binary file types by checking magic numbers from buffers, streams, files, and blobs.
- Its README warns that detection is a best-effort hint and not a complete guarantee that an untrusted file is valid or safe.
- It does not cover text-based formats in the same way as binary formats, so `txt` and `csv` need separate textual validation.

Recommendation: use server-side signature validation for binary formats and explicit handling for text-like formats. Treat `docx` and `xlsx` as ZIP container formats with allowlisted Office extensions and MIME expectations, but still block generic archives and executable/script content. Keep size limits and allowlists as the main defense, and avoid making virus-scan claims.

Source: https://github.com/sindresorhus/file-type

### TanStack Query

- TanStack Query v5 supports optimistic UI either through mutation variables or `onMutate` cache updates.
- Query invalidation marks matched queries stale and refetches active rendered queries in the background.
- Partial query matching supports targeted invalidation by query key prefix.

Recommendation: extend the current `onMutate` message send flow to create temporary attachment summaries and local preview object URLs. On success, upsert the persisted message into `messagesQueryKey(chatId)`, invalidate `chatsQueryKey`, and invalidate dedicated `sharedAssetsQueryKey(chatId, kind)` and `pinnedMessagesQueryKey(chatId)` when attachment or pin mutations change panel data.

Sources:
- https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates
- https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

### Socket.IO Rooms

- Socket.IO rooms are server-side channels that can broadcast to subsets of clients.
- The v4 server API documents `server.to(room).emit(...)` and namespace/socket variants for room-scoped emissions.
- Namespace middleware can reject unauthorized socket connections before room events run.

Recommendation: keep pin/detail realtime events scoped to the existing chat room id and keep authorization on the HTTP mutation path. Add events such as `message:pinned` and `message:unpinned` only after server-side membership and visibility checks pass.

Sources:
- https://socket.io/docs/v4/server-api/
- https://socket.io/docs/v4/rooms/

## Technology Recommendations

1. Add `multer` to `Backend/Chatify/package.json` for multipart parsing.
2. Add `file-type` only if implementation confirms it integrates cleanly with the current ESM backend and supports the selected binary formats. If not, implement a small allowlisted signature validator for image/PDF formats and explicit text/Office checks.
3. Do not add external object storage, thumbnail generators, transcoding tools, OCR, antivirus SDKs, or image-processing dependencies in Phase 08.
4. Use native MongoDB `GridFSBucket` via the existing Mongoose connection rather than a separate GridFS wrapper package.
5. Keep the frontend on existing `axios`, TanStack Query, Socket.IO client, Tailwind, and component/test stack.

## Architecture Recommendations

### Backend

- Add `Backend/Chatify/Models/attachmentModel.mjs` with fields for `chatId`, `messageId`, `uploader`, `storageFileId`, `clientFileId` or hash fields, sanitized display name, original extension, MIME, byte size, kind, status, visibility/delete flags, and timestamps.
- Extend `Backend/Chatify/Models/messageModel.mjs` with attachment summaries or attachment references and pin metadata. Existing messages must serialize `attachments: []`.
- Add `Backend/Chatify/Services/attachmentStorageService.mjs` for GridFS upload/download/delete cleanup.
- Add `Backend/Chatify/Utils/attachmentValidation.mjs` for allowlist, count, size, filename, signature, and hash logic.
- Add `Backend/Chatify/Utils/attachmentVisibility.mjs` only if visibility checks become too large for `messageState.mjs`; otherwise extend `messageState.mjs` with attachment-aware helpers.
- Extend `Backend/Chatify/Controller/messageController.mjs` for multipart branch routing, protected download/preview, shared asset listing, pin/unpin, and filename search. Split helper functions locally or move attachment-specific behavior to focused services to avoid a controller balloon.
- Extend `Backend/Chatify/Routes/messageRouter.mjs` with protected attachment and pin routes. Static routes must stay before parameterized `/:messageId` routes.
- Add upload-specific rate limiting in `Backend/Chatify/Middlewares/rateLimiters.mjs` and mount it on multipart send/download-heavy endpoints if appropriate.

Recommended API shape:

- `POST /api/message/new-message` - accepts JSON or multipart; canonical message creation path.
- `GET /api/message/attachments/:attachmentId/preview` - protected inline preview stream when allowed.
- `GET /api/message/attachments/:attachmentId/download` - protected attachment download stream.
- `GET /api/message/:chatId/shared-assets?kind=media|file&cursor=...&limit=...` - protected shared assets list.
- `GET /api/message/:chatId/pinned` - protected pinned messages list.
- `POST /api/message/:messageId/pin` - protected pin mutation.
- `DELETE /api/message/:messageId/pin` - protected unpin mutation.

### Frontend

- Extend `Frontend/Chatify/src/types/chat.ts` with `AttachmentSummary`, `SharedAsset`, `PinnedMessage`, attachment error codes, and socket pin event types.
- Extend `Frontend/Chatify/src/api/messageApi.ts` with JSON/multipart overloads, shared assets, pinned messages, and protected preview/download URL helpers.
- Extend `Frontend/Chatify/src/hooks/useChatQueries.ts` with `sharedAssetsQueryKey`, `pinnedMessagesQueryKey`, `useSharedAssets`, `usePinnedMessages`, `usePinMessage`, `useUnpinMessage`, and attachment-aware `useSendMessage`.
- Extend `Frontend/Chatify/src/hooks/messageCache.ts` so `mergeCanonicalMessage` preserves and reconciles attachment summaries, failed attachment optimistic state, and tombstone behavior.
- Extend `Frontend/Chatify/src/hooks/useChatSocket.ts` with room-scoped pin/unpin handling and attachment-bearing message cache updates.
- Replace the disabled paperclip in `MessageComposer.tsx` with an accessible file input plus inline attachment tray.
- Extend `MessageBubble.tsx` with constrained image previews and document file cards.
- Replace unavailable sections in `ChatContextRail.tsx` with server-backed data, loading/error/empty states, factual security rows, and no static media fixtures.
- Add a mobile conversation detail drawer through `ChatShell.tsx`, `ConversationHeader.tsx`, and the chat page orchestration layer.

## Codebase Patterns

- Backend controllers use `asyncErrHandler` and explicit response helpers for auth/access errors.
- `loadChatForUser` in `messageController.mjs` is the closest existing membership gate. Attachment endpoints should reuse the same private-resource response style.
- `messageState.mjs` is the existing canonical location for text validation, cursor behavior, visibility filters, serialization, and receipt patches. Attachment serialization should be aligned there or in a similarly focused helper.
- `messageModel.mjs` already has indexes for chat/timeline/idempotency/visibility. Attachment metadata needs equivalent indexes for shared asset queries and authorization.
- `messageApi.ts` is the frontend transport boundary. Components should not make raw Axios calls.
- `useChatQueries.ts` owns message query keys, optimistic send, search, retry, and mutations.
- `messageCache.ts` owns canonical message merge semantics. Attachment merge logic belongs here, not inside `MessageBubble`.
- `useChatSocket.ts` owns socket event subscriptions and cache mutation. Pin/detail socket listeners should be added there.
- Existing component tests use React Testing Library and semantic roles. Continue testing user-observable behavior.
- Existing Playwright tests include behavior-first and visual smoke patterns. Phase 08 should capture screenshots only after upload/detail interactions.

## Implementation Considerations

### Idempotency

Current backend idempotency compares only `text` for a repeated `clientMessageId`. Phase 08 must compare normalized text plus attachment payload fingerprint. Store a hash for each attachment and a message-level attachment fingerprint so retries can return the existing message and conflicting payloads return 409.

### Transactions And Cleanup

MongoDB transactions should wrap message and metadata creation when the active connection supports it. GridFS file writes are separate stream operations, so the storage service needs cleanup on metadata/message failure. If a transaction is unavailable in the test environment, tests should still prove deterministic cleanup or non-public orphan denial.

### Preview And Download Security

Never expose public or signed direct URLs. Frontend preview/download actions should point at protected backend routes and send cookies through the existing Axios/fetch credential path. Response headers should use sanitized filenames and conservative content types.

### Delete Semantics

Delete-for-everyone should make attachments unretrievable for everyone immediately. Delete-for-self should hide attachments only for the deleting user. Physical deletion can be deferred if access denial is immediate and tested.

### UI State

Attachment selection state is browser-local until send. Optimistic messages can carry temporary object URLs, but those URLs must be revoked and cannot be recreated after reload. Failed upload retry after reload must require reattachment.

### Search

Backend search currently applies a regex to message text. Phase 08 should include attachment display filenames in selected-chat search without indexing file contents. Consider a metadata query over attachments and then message ids, or an aggregation joining visible messages to visible attachment metadata.

### Pinning

Phase 08 only needs chat-level message pins. Store pin metadata on message documents unless implementation research finds a hard blocker. Cap at 50 pinned messages per chat and emit chat-scoped pin/unpin events after successful protected mutations.

## Potential Pitfalls

- Letting multipart upload bypass existing `clientMessageId`, unread, latestMessage, status, or socket behavior.
- Trusting extension or `file.mimetype` as proof of file content.
- Adding public blob/object URLs or leaking GridFS ids in API responses.
- Rendering shared files/media from loaded message pages instead of protected server-backed paginated APIs.
- Keeping Phase 07 "unavailable in this phase" text after adding partial file behavior.
- Placing upload and preview state directly in message bubbles instead of typed hooks/cache helpers.
- Forgetting to return `attachments: []` for historical text-only messages.
- Allowing file cards/previews to overflow mobile bubbles or the desktop rail.
- Claiming E2EE, virus scanning, or generic "secure files" beyond the actual protections.
- Allowing fixture media/pinned data to leak into production runtime.

## Validation Architecture

### Backend Verification

- Add backend tests for attachment validation, storage metadata, protected preview/download, idempotency, delete visibility, shared asset filtering, filename search, and pin/unpin.
- Use `mongodb-memory-server` plus Supertest patterns already present under `Backend/Chatify/test`.
- Commands:
  - `cd Backend/Chatify; npm test`

### Frontend Verification

- Add component and hook tests for file selection, validation errors, attachment optimistic states, failed retry/reattach, bubble rendering, rail/drawer data, query key invalidation, and socket pin updates.
- Commands:
  - `cd Frontend/Chatify; npm run test`
  - `cd Frontend/Chatify; npm run lint`
  - `cd Frontend/Chatify; npm run build`

### Browser Verification

- Add Playwright behavior coverage for desktop/mobile and light/dark:
  - desktop light attachment send, preview/download, shared files panel
  - desktop dark pin/unpin and right-rail update
  - mobile light detail drawer with shared media/files
  - mobile dark failed attachment validation/retry/reattach state
- Command:
  - `cd Frontend/Chatify; npm run test:ui`

### Security Verification

- Unauthorized users, non-members, users who deleted a message for self, and all users after delete-for-everyone must fail preview/download.
- Source search must prove production UI does not claim end-to-end encryption or virus scanning.
- Fixture leak guard must fail if production runtime imports static attachment/shared/pinned fixtures.

## Planning Gate Notes

- Phase 08 has frontend UI indicators and the project has `workflow.ui_safety_gate=true`.
- No `08-UI-SPEC.md` exists at research time.
- Per the GSD plan-phase workflow, planning should stop after research/validation and ask for `$gsd-ui-phase 8` before writing Phase 08 PLAN files, unless the user explicitly reruns planning with `--skip-ui`.

## Open Questions

All user-facing implementation decisions were approved in `08-CONTEXT.md`. The remaining open item is procedural, not product ambiguity: generate the Phase 08 UI design contract before PLAN files are created, or explicitly skip the UI gate.

---

_Phase 08 Research_
