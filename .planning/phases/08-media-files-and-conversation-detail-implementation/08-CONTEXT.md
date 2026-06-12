# Phase 08: Media Files And Conversation Detail Implementation - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 08 turns the previously unavailable media, file, pinned-message, and conversation-detail surfaces into real product behavior. Users can send text-only, attachment-only, and text-plus-attachment messages through the existing chat lifecycle; preview and download authorized attachments; inspect shared media/files and pinned messages from server data; and use desktop and mobile detail surfaces without static demo content or unsupported privacy claims. This phase does not add calls, voice messages, video calls, favorite conversations, broad more menus, end-to-end encryption, virus scanning, file-content indexing, external object storage, groups, notifications, admin tooling, native apps, or deployment work.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**14 requirements are locked.** See `08-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `08-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Attachment metadata contract for backend serialization and frontend TypeScript types.
- MongoDB-backed protected attachment byte storage and metadata persistence.
- Message send support for text-only, attachment-only, and text-plus-attachment messages.
- Allowlisted images and documents: `png`, `jpg`, `jpeg`, `webp`, `gif`, `pdf`, `txt`, `csv`, `xlsx`, and `docx`.
- File validation for type, size, count, auth, membership, message visibility, and recoverable failure states.
- Protected preview and download endpoints with membership and visibility checks.
- Message bubble media previews, file cards, loading/error states, and download actions.
- Shared media and shared files data endpoints and UI sections.
- Message-level pin/unpin behavior, pinned-message data, and realtime pin updates.
- Desktop right rail and mobile detail drawer with real pinned, shared-asset, member, and security data.
- Filename-based attachment search integration; file content indexing is excluded.
- Backend, frontend, socket/hook, and Playwright coverage for Phase 8 behavior and authorization.

**Out of scope (from SPEC.md):**
- Voice messages, calls, video calls, favorite conversations, and broad "more actions" menus - these are not Phase 8 media/file/detail requirements.
- End-to-end encryption implementation - v1 explicitly defers E2EE to a separate storage and key-management design.
- External object storage such as S3/R2/Cloudinary - MongoDB-backed private storage is the approved MVP boundary for this phase.
- Public or signed direct asset URLs - all attachment access must flow through protected backend routes.
- Server-generated thumbnails or image transcoding - client-constrained previews are sufficient for the MVP.
- Virus scanning service integration - Phase 8 uses strict allowlists and executable/script/archive blocking; AV can be planned later.
- File-content search or OCR - Phase 8 searches filenames/metadata only.
- Group-chat expansion, channels, bots, notifications, moderation/admin tooling, and native mobile apps - outside the current direct-message reconstruction scope.
- Production deployment/release operations - this phase produces implementation, tests, and evidence, not deployment.

</spec_lock>

<decisions>
## Implementation Decisions

### Backend Data Contracts And Storage
- **D-01:** Use a separate `Attachment` model plus attachment summary objects embedded or projected on message responses. Do not store only opaque blobs inside messages. Shared media/files, authorization, and panel pagination need queryable attachment metadata.
- **D-02:** Add focused backend modules for attachment metadata/state and GridFS-backed storage, such as `Backend/Chatify/Models/attachmentModel.mjs` and a storage service under `Backend/Chatify/Services` or `Backend/Chatify/Utils`. Keep `messageController.mjs` as orchestration, not a large storage implementation.
- **D-03:** Upgrade the existing `/api/message/new-message` send route to accept both JSON text-only sends and multipart text/file sends. Do not create a parallel attachment-message lifecycle that bypasses current message idempotency, optimistic reconciliation, status, unread, and socket behavior.
- **D-04:** Use Multer with memory storage and strict limits for multipart parsing, then write validated files into MongoDB-backed private storage. Do not use Render disk as durable file storage.
- **D-05:** Use MongoDB GridFS through a central storage service, backed by the existing Mongoose/MongoDB connection. Do not expose GridFS ids or bucket names as public asset URLs.
- **D-06:** Query shared media/files from attachment metadata by chat, kind, visibility, and sort order instead of deriving panels from only the currently loaded message pages.
- **D-07:** Store pin state on messages for Phase 08 rather than introducing a separate pin collection unless planning proves a hard blocker. The phase scope only needs message-level pins inside the selected chat.

### Validation, Authorization, And Privacy
- **D-08:** Validate attachments using extension allowlists, client MIME for quick UI feedback, and server-side MIME/signature checks where practical. Client-provided extension or MIME alone is not trusted.
- **D-09:** Keep the existing response envelope style for validation failures, but add stable attachment-specific error codes where useful so the frontend can render precise file errors.
- **D-10:** Reuse the current message rate limiter and add an upload-specific limiter by authenticated user/IP. Uploads are more expensive than text sends and need a tighter abuse boundary.
- **D-11:** Store a sanitized display filename and generated storage ids. Never log raw private storage ids, file bytes, public-looking download URLs, or raw private object ids; omit or redact filenames in logs.
- **D-12:** Implement upload/message creation with cleanup guarantees: write files in a controlled sequence, create message and attachment metadata transactionally where available, and delete orphaned GridFS files if later metadata/message creation fails.
- **D-13:** Extend `clientMessageId` idempotency to include normalized text plus attachment count, sanitized names, sizes, and hashes. The same payload returns the existing message; a different payload with the same client id conflicts.
- **D-14:** Compute attachment hashes for idempotency and audit consistency, but do not deduplicate physical storage in Phase 08.
- **D-15:** For delete-for-everyone, immediately deny attachment retrieval for all users through metadata/visibility checks. For delete-for-self, deny only that user. Physical storage cleanup can be a later maintenance concern and must not break per-user visibility.
- **D-16:** Add protected preview/download routes under the message or attachment API boundary, guarded by authentication, chat membership, message visibility, and delete state. Non-members and users without visibility must receive access errors without leaking asset existence details.

### Frontend API, Query, Cache, And Realtime
- **D-17:** Extend `messageApi.createMessage` and `useSendMessage` to support text-only JSON and multipart `FormData` sends through one typed hook-level adapter.
- **D-18:** Keep TanStack Query as the owner of durable message, shared-asset, and pinned-message server state. Add specific query keys such as shared assets and pinned messages rather than placing panel state only in component-local state.
- **D-19:** Use local object URLs for selected image previews and temporary optimistic attachment summaries while upload is in progress. Revoke object URLs on settle/unmount and replace optimistic data with server attachment summaries on success.
- **D-20:** Failed attachment sends should stay recoverable only while browser `File` objects still exist. After reload, failed attachment states must require reattachment rather than silently retrying missing local files.
- **D-21:** Reconcile incoming HTTP responses, socket `message:new` events, and refetches using existing `_id` and `clientMessageId` merge behavior extended for attachments. Attachment sends must not create duplicate messages or duplicate attachment summaries.
- **D-22:** Upsert attachment-bearing messages directly into the timeline cache, then invalidate or refetch shared-asset and pinned-message panel query keys after relevant room-scoped socket events.
- **D-23:** Add chat-scoped pin/unpin Socket.IO events and use room-scoped emits only. Users outside the chat room must not receive pin or attachment-detail updates.
- **D-24:** Extend selected-chat message search to match attachment display filenames and metadata only. Do not index file contents or OCR data.

### UI And Interaction Surfaces
- **D-25:** Replace the disabled paperclip with a native hidden file input plus an inline attachment tray in the composer. The tray should show selected files, validation errors, remove actions, sending/progress state, and recoverable failure state.
- **D-26:** Render attachments inside message bubbles from persisted message data. Text remains visible when present; image attachments use constrained protected previews; document attachments use accessible file cards with type, size, sanitized filename, and download/open action.
- **D-27:** Keep attachment layouts stable on mobile and desktop. Use bounded grids/cards and loading/error preview states so previews cannot overflow or shift the messenger shell.
- **D-28:** Add a full-screen mobile detail drawer or sheet controlled by the existing header More action. Do not restructure routing just to expose mobile conversation details.
- **D-29:** Desktop right rail and mobile detail surfaces show real pinned messages, shared files, shared media, member/security rows, empty states, and loading/error states from APIs. They must not use static demo assets or fake counts.
- **D-30:** Shared file/media cards should support open/download and jump-to-message when the message is available. Pinned messages should support jump-to-message and unpin where authorized.
- **D-31:** Security copy must stay factual: authenticated session, member checked, realtime connected/reconnecting/offline, and protected file access. Do not claim end-to-end encryption, virus scanning, or broader security guarantees that Phase 08 does not implement.
- **D-32:** Continue using abstract, non-living identity and media placeholders only. No humans, animals, mascots, realistic avatars, or life-form imagery may appear in placeholder or fixture media.

### Testing, Evidence, And Plan Shape
- **D-33:** Backend tests should cover attachment validation, upload limits, authorization, idempotency, delete visibility, shared asset listing, filename search, protected download, and pin/unpin behavior.
- **D-34:** Frontend tests should cover attachment composer selection/rejection, optimistic attachment bubbles, failed retry/reattach behavior, message bubble attachment rendering, shared/pinned rail rendering, detail drawer behavior, and cache helpers.
- **D-35:** Socket/hook tests should prove pin/unpin and attachment-bearing message events update authorized visible UI/cache state and do not leak to users outside the chat room.
- **D-36:** Playwright evidence should use behavior-first flows and after-interaction screenshots across desktop/mobile and light/dark: attachment send/preview/download, shared panels, pin/detail flow, mobile detail drawer, and failed/retry states.
- **D-37:** Runtime code must never import static attachment, shared-media, pinned-message, or detail-panel fixtures. Test fixtures are allowed only in `src/test`, `e2e/fixtures`, or equivalent test-only paths, with guardrails similar to Phase 07.
- **D-38:** Plan Phase 08 in dependency-aware vertical waves: backend storage/contracts/auth tests first, frontend send/render/cache/detail UI second, then realtime/search/pin/panel/evidence third.

### the agent's Discretion
- The planner may choose exact helper/module names as long as routing, controller, service, model, and hook boundaries stay consistent with the existing codebase.
- The planner may choose whether upload validation helpers live under `Utils` or `Services` if controllers remain thin and tests can target validation behavior.
- The planner may choose exact shared-asset and pinned-message query key names if they are typed, stable, and targeted enough for invalidation.
- The planner may choose exact mobile drawer implementation details if it preserves the Phase 06/07 visual direction and does not fork behavior by theme or viewport.
- The planner may choose exact Playwright fixture file names and screenshot names if production runtime fixture leakage is guarded.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/08-media-files-and-conversation-detail-implementation/08-SPEC.md` - locked Phase 08 requirements, boundaries, constraints, acceptance criteria, and file/storage/privacy decisions.
- `.planning/phases/08-media-files-and-conversation-detail-implementation/08-CONTEXT.md` - implementation decisions captured by this discussion.
- `.planning/ROADMAP.md` - Phase 08 goal, success criteria, dependency on Phase 07, and recommended planning waves.
- `.planning/REQUIREMENTS.md` - MEDIA-01 through MEDIA-03, MSG-03/04, PARITY-01/02, UI-01/02/04/05, and TEST-05 traceability.
- `.planning/PROJECT.md` - project core value, brownfield constraints, collaboration preference, and repository hygiene rule for `chat.tsx`.
- `.planning/STATE.md` - current reconstruction continuity and prior correction-phase notes.

### Prior Phase Contracts
- `.planning/phases/07-messenger-functional-parity-restoration/07-CONTEXT.md` - honest controls, no product fixture leakage, right-rail unavailable states, behavior-backed UI, and Phase 08 handoff decisions.
- `.planning/phases/06-messenger-visual-parity/06-CONTEXT.md` - desktop/mobile light/dark visual direction, abstract identity, theme tokens, and non-living imagery constraints.
- `.planning/phases/05-messenger-baseline-completion/05-CONTEXT.md` - message search, selected-chat continuity, conversation search, presence, and account/session behavior.
- `.planning/phases/04-messenger-ui-reconstruction/04-CONTEXT.md` - componentized chat shell, composer, message actions, failed-send recovery, and responsive UI state patterns.
- `.planning/phases/03-canonical-message-state/03-CONTEXT.md` - idempotent message creation, optimistic merge, retry, pagination, visibility, edit/delete/reaction, and unread contracts.
- `.planning/phases/02-authenticated-realtime-contract/02-CONTEXT.md` - authenticated socket identity, room membership, targeted emits, privacy-aware presence, and reconnect rules.

### Codebase Maps
- `.planning/codebase/ARCHITECTURE.md` - frontend/backend layering, API/hook boundaries, controller/model/service responsibilities, and chat authorization anti-patterns.
- `.planning/codebase/STACK.md` - current React, Express, Mongoose, Socket.IO, TanStack Query, Tailwind, npm, and test tooling versions.
- `.planning/codebase/CONVENTIONS.md` - TypeScript, ESM, import, naming, error-handling, logging, and test conventions.
- `.planning/codebase/TESTING.md` - historical test map; verify live package scripts because package files now include backend Vitest and frontend Vitest/Playwright scripts.

### Backend Runtime And Test Files
- `Backend/Chatify/app.mjs` - JSON/urlencoded limits, protected route mounting, security middleware, rate limits, and parser boundary where multipart support must be integrated safely.
- `Backend/Chatify/package.json` - backend dependencies and test scripts; currently has no multipart parser dependency.
- `Backend/Chatify/Models/messageModel.mjs` - current text-only message schema, idempotency index, delete/edit/reaction fields, and attachment field insertion point.
- `Backend/Chatify/Models/chatModel.mjs` - chat membership model used by message and attachment authorization.
- `Backend/Chatify/Controller/messageController.mjs` - current JSON `newMessage` lifecycle, `loadChatForUser` membership pattern, idempotency behavior, search, delete, edit, reaction, read, unread, and socket emits.
- `Backend/Chatify/Routes/messageRouter.mjs` - current message route boundary where multipart send, attachment download/preview, shared assets, and pin routes will be added.
- `Backend/Chatify/Utils/chatAccess.mjs` - existing chat access helpers to reuse or extend for attachment visibility checks.
- `Backend/Chatify/Utils/messageState.mjs` - current message status/visibility helpers to keep attachment lifecycle aligned with canonical message state.
- `Backend/Chatify/Config/socket.mjs` - Socket.IO room and event behavior that pin/detail updates must extend without leaking to non-members.
- `Backend/Chatify/test/message/*.test.mjs` - existing backend message authorization, idempotency, mutation, pagination, search, status, and unread coverage to extend.
- `Backend/Chatify/test/socket/socket.message-state.test.mjs` - existing socket integration patterns to extend for pin/detail events.
- `Backend/Chatify/test/fixtures/messages.mjs` and `Backend/Chatify/test/fixtures/chats.mjs` - current backend fixture patterns for new attachment/pin tests.

### Frontend Runtime And Test Files
- `Frontend/Chatify/package.json` - live frontend scripts: `test`, `test:ui`, `lint`, and `build`.
- `Frontend/Chatify/src/types/chat.ts` - current text-only message and payload types; add attachment, shared asset, pinned-message, and socket event types here or adjacent typed modules.
- `Frontend/Chatify/src/api/messageApi.ts` - current JSON message API client; extend for multipart send, shared assets, pin/unpin, preview/download, and filename search response shape.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - message/history/search/send mutation ownership, optimistic update behavior, failed-send retry/dismiss, and future shared/pinned query keys.
- `Frontend/Chatify/src/hooks/messageCache.ts` - canonical merge, optimistic insert, failure, dismiss, retry, and attachment reconciliation insertion point.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - socket event handling and cache updates; extend with attachment-bearing messages and pin/detail events.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - route orchestration, selected chat, send/retry, message actions, export, search, session, mobile state, and detail drawer integration point. Preserve as orchestrator.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - current disabled attachment control; replace with validated file input and attachment tray.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - current text-only bubble; add persisted attachment preview/card rendering.
- `Frontend/Chatify/src/pages/chat/components/MessageList.tsx` - current paginated message rendering; verify attachment layout and search highlights do not break list behavior.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - current disabled More control; wire to mobile detail drawer while keeping unsupported call/video honest.
- `Frontend/Chatify/src/pages/chat/components/ChatContextRail.tsx` - current empty/unavailable pinned/shared sections; replace with server-backed real data and factual security rows.
- `Frontend/Chatify/src/pages/chat/components/ChatShell.tsx` - desktop right rail and responsive shell where mobile detail drawer/sheet should integrate.
- `Frontend/Chatify/src/pages/chat/components/MessageSearchResults.tsx` - selected-chat search result rendering; extend for attachment filename hits and jump-to-message.
- `Frontend/Chatify/src/test/chatFixtures.ts` - current production-shaped fixture builders for component/hook tests; extend without importing fixture data into runtime.
- `Frontend/Chatify/src/hooks/*.test.tsx` and `Frontend/Chatify/src/pages/chat/components/*.test.tsx` - existing test patterns for QueryClient wrappers, socket mocks, composer, bubble, rail, search, and responsive state.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` - existing guardrail pattern to extend for Phase 08 fixture leakage.
- `Frontend/Chatify/e2e/chat-functional-parity.spec.ts` and `Frontend/Chatify/e2e/chat-ui-smoke.spec.ts` - existing behavior-first and screenshot evidence patterns to extend for media/detail workflows.

### Supporting Skills Used For This Discussion
- `C:/Users/saieh/.agents/skills/api-and-interface-design/SKILL.md` - API contract and interface boundary guidance.
- `C:/Users/saieh/.agents/skills/express-rest-api/SKILL.md` - Express route/controller/service patterns.
- `C:/Users/saieh/.agents/skills/mongodb/SKILL.md` - MongoDB/Mongoose data modeling and query guidance.
- `C:/Users/saieh/.agents/skills/react-best-practices/SKILL.md` - React component/state boundary guidance.
- `C:/Users/saieh/.agents/skills/tanstack-query/SKILL.md` - query key, optimistic update, invalidation, and test-wrapper guidance.
- `C:/Users/saieh/.agents/skills/websocket-engineer/SKILL.md` - Socket.IO room, realtime, and reconnect guidance.
- `C:/Users/saieh/.agents/skills/e2e-testing-patterns/SKILL.md` - behavior-first Playwright guidance.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Backend/Chatify/Controller/messageController.mjs`: Reuse current membership checks, message visibility behavior, idempotent send, socket emit, search, delete, edit, reaction, read, and unread patterns; extend rather than bypass.
- `Backend/Chatify/Utils/messageState.mjs`: Reuse canonical message state helpers so attachments follow existing delete/read/status behavior.
- `Backend/Chatify/Utils/chatAccess.mjs`: Reuse or extend chat access helpers for attachment preview/download/shared-list authorization.
- `Backend/Chatify/test/message/*.test.mjs`: Reuse existing backend test setup and fixtures for attachment/pin validation and auth coverage.
- `Frontend/Chatify/src/hooks/useChatQueries.ts`: Reuse query/mutation structure, optimistic context, failure handling, and search hook as the single frontend send/cache boundary.
- `Frontend/Chatify/src/hooks/messageCache.ts`: Reuse merge-by-`_id`/`clientMessageId` behavior for attachment summaries and optimistic states.
- `Frontend/Chatify/src/hooks/useChatSocket.ts`: Reuse socket connection and room event handling; add pin/detail updates in the hook, not in components.
- `MessageComposer.tsx`, `MessageBubble.tsx`, `ChatContextRail.tsx`, `ConversationHeader.tsx`, and `ChatShell.tsx`: Reuse the Phase 06/07 visual shell while replacing disabled/static media/detail surfaces with real behavior.
- `Frontend/Chatify/src/test/chatFixtures.ts`: Reuse and extend test-only fixture builders for production-shaped attachment, pinned, and shared asset data.
- `Frontend/Chatify/e2e/chat-functional-parity.spec.ts`: Reuse behavior-first browser flow patterns for attachment/detail workflows.

### Established Patterns
- Pages/components should consume typed API and hook outputs; they should not call raw Axios or own durable server state.
- Backend routers stay thin and delegate validation, authorization, database work, and response shaping to controllers/services.
- Private chat and message operations must verify authenticated user membership and message visibility server-side.
- Socket events must be chat-room scoped and must not rely on client-supplied identity for authorization.
- Durable message state is merged in TanStack Query caches by `_id` and `clientMessageId`.
- Failed sends remain visible and recoverable when the required local data still exists.
- Unsupported controls are hidden or truthfully disabled. Phase 08 should remove the "unavailable in this phase" attachment/detail states only when real behavior exists.
- Theme should remain token-driven; light/dark and desktop/mobile variants must not fork product behavior.
- Visual placeholders and test media must be abstract and non-living.

### Integration Points
- Add multipart parsing around `/api/message/new-message` without weakening the existing JSON text-only path.
- Add attachment metadata and storage models/services alongside existing message/chat models.
- Extend message serialization to return `attachments: []` for old messages and populated summaries for new ones.
- Add protected preview/download and shared media/files endpoints to the message/attachment API boundary.
- Add pin/unpin and pinned-list endpoints plus chat-scoped socket events.
- Extend frontend message types, API clients, query hooks, cache helpers, and socket event types for attachment and pin data.
- Replace the composer paperclip disabled state with file selection and validation UI.
- Add attachment rendering to message bubbles and attachment-aware filename search results.
- Convert desktop right rail and mobile details into real server-backed views.
- Extend fixture leak guardrails so production runtime cannot depend on static media/detail fixtures.

</code_context>

<specifics>
## Specific Ideas

- The implementation should preserve the current Chatify visual direction from the supplied light/dark desktop/mobile references while making the media/detail controls real.
- Attachment UI should feel quiet and secure, not flashy: clear status, clear errors, bounded previews, and factual security rows.
- Research used during discussion: MongoDB GridFS supports streaming protected file access and metadata queries; Multer is a focused Express multipart parser; TanStack Query supports optimistic updates and targeted invalidation; Socket.IO room emits support chat-scoped realtime updates.
- The user approved all recommendations from the one-shot questionnaire on 2026-06-12, so planners should treat these implementation decisions as locked unless implementation research proves a blocker.

</specifics>

<deferred>
## Deferred Ideas

- Server-generated thumbnails, image transcoding, file-content indexing, OCR, virus scanning service integration, and external object storage remain future phases.
- Calls, video calls, voice messages, favorite conversations, broad more menus, groups, notifications, moderation/admin tooling, native apps, and end-to-end encryption remain outside Phase 08.
- Physical background deletion/garbage collection of orphaned or deleted attachment bytes can be planned later if not necessary for Phase 08 correctness, as long as access is denied immediately through metadata/visibility checks.

</deferred>

---

*Phase: 08-media-files-and-conversation-detail-implementation*
*Context gathered: 2026-06-12*
