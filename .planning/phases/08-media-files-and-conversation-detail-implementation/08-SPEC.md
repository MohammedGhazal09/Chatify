# Phase 8: Media Files And Conversation Detail Implementation - Specification

**Created:** 2026-06-12
**Ambiguity score:** 0.08 (gate: <= 0.20)
**Requirements:** 14 locked

## Goal

Users can send, reload, preview, download, search, pin, and inspect supported conversation attachments and detail-panel data through protected backend-backed media, file, pinned-message, and security surfaces.

## Background

Phase 7 restored the Phase 6 reference messenger as a behavior-backed product UI and intentionally left media, file, pinned-message, and detail-panel content unavailable until Phase 8. The current backend message model in `Backend/Chatify/Models/messageModel.mjs` stores text, receipt, reaction, edit, and delete state, but it has no attachment metadata. `Backend/Chatify/Controller/messageController.mjs` creates messages from JSON `chatId`, `text`, and `clientMessageId`, and `Backend/Chatify/Routes/messageRouter.mjs` has no upload, preview, download, shared-asset, or pin routes. Backend dependencies do not include a multipart parser or external file-storage client.

The frontend contract mirrors that text-only baseline. `Frontend/Chatify/src/types/chat.ts` has no attachment types, `NewMessagePayload` requires text, `Frontend/Chatify/src/api/messageApi.ts` posts JSON to `/api/message/new-message`, `Frontend/Chatify/src/hooks/messageCache.ts` merges messages without attachment fields, and `MessageComposer` renders the paperclip as "Attach file unavailable in this phase." `MessageBubble` treats file-like text as ordinary text, and `ChatContextRail` shows honest placeholder sections for pinned messages, shared files, and shared media while deriving only basic auth/member/socket security rows from live state.

Phase 8 changes those unavailable surfaces into real product behavior. The work must preserve the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO realtime layer, TanStack Query cache, Zustand stores, Tailwind theme tokens, and the Phase 7 rule that visible controls either perform real behavior or are honestly disabled/hidden.

## Requirements

1. **Attachment data contract**: Messages must support persisted attachment summaries without breaking existing text-only message history.
   - Current: `Message` documents and frontend `Message` types have no attachment field, and existing message serialization returns text-only content.
   - Target: Messages serialize `attachments: []` for old text messages and attachment summary objects for new attachment messages, including attachment id, safe display name, mime type, byte size, kind (`media` or `file`), preview/download capability flags, uploader id, and timestamps.
   - Acceptance: Backend and frontend tests prove old messages return `attachments: []`, new attachment messages return populated summaries, and existing send/read/edit/delete/reaction flows still accept text-only messages.

2. **Protected attachment persistence**: Supported file bytes and metadata must persist in backend-owned private storage with no public asset URLs.
   - Current: No upload pipeline, attachment metadata model, file storage, or private file retrieval endpoints exist.
   - Target: Phase 8 stores attachment bytes in MongoDB-backed protected storage and stores metadata in an attachment collection linked to chat, message, uploader, and storage object id.
   - Acceptance: Uploading a supported file creates a durable attachment record and protected storage object; API responses never expose raw storage ids as public URLs; a reload after send still renders the attachment from server data.

3. **Upload validation**: The backend and frontend must reject unsupported or excessive attachments before private message content is persisted.
   - Current: `newMessage` validates only trimmed text and a 1000-character text limit.
   - Target: Attachment send accepts either text or at least one valid file, enforces max 5 attachments per message, max 10 MB per file, and allows only `png`, `jpg`, `jpeg`, `webp`, `gif`, `pdf`, `txt`, `csv`, `xlsx`, and `docx`.
   - Acceptance: Tests cover valid image, valid document, attachment-only message, text-plus-attachment message, empty text/no attachment rejection, too many files, over-size file, unsupported extension, unsupported mime/signature, and executable/script/archive rejection.

4. **Unified message send lifecycle**: Attachment sends must use the existing canonical message lifecycle and idempotency rules.
   - Current: Frontend `useSendMessage` posts JSON text messages, creates optimistic text-only messages, and retries failed sends by preserving `clientMessageId`.
   - Target: Text, attachment-only, and text-plus-attachment sends create one canonical message through the message send path, keep `clientMessageId` idempotency, show sending/sent/failed states, and reconcile mutation/socket/refetch updates without duplicates.
   - Acceptance: Frontend cache tests and backend idempotency tests prove retrying the same `clientMessageId` does not create duplicate messages or duplicate attachment summaries.

5. **Recoverable upload failures**: Users must get clear, recoverable file-send errors without losing the current conversation context.
   - Current: Failed text sends can be retried or dismissed, but attachment controls are disabled and no upload progress/error UI exists.
   - Target: Composer and message bubbles show attachment validation errors, upload/send progress, failed-send state, retry while selected `File` objects remain available in the browser session, and a reattach-required state after reload.
   - Acceptance: Component tests prove rejected files are listed inline, send is blocked for invalid selections, failed attachment sends expose retry/dismiss controls, retry reuses the same `clientMessageId` while file objects exist, and stale failed upload state after reload cannot silently retry without reattachment.

6. **Message attachment rendering**: Message bubbles must render real media previews and file cards from persisted message data.
   - Current: `MessageBubble` renders only text and explicitly tests that file-like text is ordinary text until attachments exist.
   - Target: Image attachments render constrained protected previews, document attachments render accessible file cards with type, size, filename, and download action, and text remains visible when a message has both text and attachments.
   - Acceptance: Frontend tests cover own/received image previews, document file cards, multiple attachments, attachment-only messages, text-plus-attachment messages, deleted-message tombstones, loading/error preview states, and no layout overflow on mobile.

7. **Authorized preview and download**: Users must only preview or download files they are authorized to view.
   - Current: Message authorization exists for text messages, but no file preview/download endpoints exist.
   - Target: Every preview and download request requires an authenticated user, chat membership, and message visibility for the attachment's message; deleted-for-everyone attachments are not retrievable.
   - Acceptance: Backend tests prove unauthenticated users, non-members, users who deleted the message for self, and all users after delete-for-everyone cannot retrieve private attachments, while current members can retrieve visible attachments.

8. **Shared media and shared files**: Conversation detail surfaces must list shared assets from server data, not from currently loaded message pages or static fixtures.
   - Current: `ChatContextRail` shows count `0` and unavailable copy for shared files and shared media.
   - Target: Protected paginated shared-asset data returns media and file lists for the selected chat, sorted newest first, excluding hidden/deleted attachments and including enough metadata for the right rail/mobile detail UI.
   - Acceptance: Backend tests cover shared media/file list filtering, pagination, authorization, deleted-message exclusion, and filename search participation; frontend tests prove the rail renders non-empty lists and empty states from API data.

9. **Pinned messages**: Users must be able to pin and unpin visible messages, including messages with attachments.
   - Current: No pin data model, pin route, pin socket event, or working pinned-message panel exists.
   - Target: Any current chat member can pin or unpin a visible message, each chat is capped at 50 pinned messages, pinned lists are protected and sorted predictably, and pinned messages can point to text, attachment-only, or text-plus-attachment messages.
   - Acceptance: Backend tests cover pin, unpin, duplicate pin idempotency, non-member rejection, hidden/deleted message rejection, cap enforcement, and pinned list ordering.

10. **Pinned realtime updates**: Pin changes must update open conversation detail surfaces without a page reload.
   - Current: Socket events cover message create/status/edit/delete/reaction/unread/typing/presence, but no pin events exist.
   - Target: Pin and unpin mutations emit chat-scoped realtime events that update TanStack Query caches for pinned messages and detail panels.
   - Acceptance: Socket or hook tests prove authorized pin/unpin events update the visible pinned list and do not broadcast to users outside the chat room.

11. **Conversation detail surfaces**: Desktop and mobile detail views must expose real Phase 8 data without decorative dead controls.
   - Current: Desktop has a right rail with unavailable pinned/files/media sections; mobile has no equivalent real detail surface, and the header More button is disabled.
   - Target: Desktop right rail and mobile full-screen detail drawer show real pinned messages, shared files, shared media, member/security rows, and search entry points; call/video/voice/favorite remain hidden or honestly disabled.
   - Acceptance: Playwright or component tests cover opening mobile details from the header More button, closing the drawer, rendering real detail data on desktop and mobile, and preserving layout in light and dark themes.

12. **Truthful security status**: Conversation security labels must describe actual Phase 8 protections and avoid unsupported privacy claims.
   - Current: The right rail derives basic authenticated session, member-only room, and realtime connection rows, with no file-access row and no attachment-specific security state.
   - Target: Security rows truthfully show authenticated session, member-only room, realtime connection, and protected file access state; the UI does not claim end-to-end encryption, file scanning, or broader security guarantees that Phase 8 does not implement.
   - Acceptance: Tests prove rows downgrade when auth/member/socket/file access is unavailable and source search proves no production UI copy claims end-to-end encryption or virus scanning.

13. **Search, pagination, reload, and realtime integration**: Attachments must survive existing message workflows.
   - Current: Message search searches text only, message history is cursor-paginated, and socket `message:new` carries text-only serialized messages.
   - Target: Attachment metadata survives reload, cursor pagination, search result rendering, realtime message delivery, optimistic reconciliation, and filename-based search; file contents are not indexed in Phase 8.
   - Acceptance: Tests prove an attachment message appears after reload, after loading older pages, from a realtime message event, in filename search results, and without duplicate cache entries.

14. **Verification gate**: Phase 8 must close with backend, frontend, and browser verification that proves behavior and authorization.
   - Current: Phase 7 verification proves supported text/chat workflows and intentionally unavailable media/detail surfaces.
   - Target: Phase 8 verification includes backend attachment authorization tests, frontend component/cache tests, and Playwright workflows for desktop/mobile light/dark attachment send, preview, download, pin, shared panel, and detail drawer behavior.
   - Acceptance: The Phase 8 summary records exact outcomes for backend tests, frontend tests, lint, build, Playwright behavior tests, and after-interaction screenshots.

## Boundaries

**In scope:**
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

**Out of scope:**
- Voice messages, calls, video calls, favorite conversations, and broad "more actions" menus - these are not Phase 8 media/file/detail requirements.
- End-to-end encryption implementation - v1 explicitly defers E2EE to a separate storage and key-management design.
- External object storage such as S3/R2/Cloudinary - MongoDB-backed private storage is the approved MVP boundary for this phase.
- Public or signed direct asset URLs - all attachment access must flow through protected backend routes.
- Server-generated thumbnails or image transcoding - client-constrained previews are sufficient for the MVP.
- Virus scanning service integration - Phase 8 uses strict allowlists and executable/script/archive blocking; AV can be planned later.
- File-content search or OCR - Phase 8 searches filenames/metadata only.
- Group-chat expansion, channels, bots, notifications, moderation/admin tooling, and native mobile apps - outside the current direct-message reconstruction scope.
- Production deployment/release operations - this phase produces implementation, tests, and evidence, not deployment.

## Constraints

- Keep the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO realtime layer, TanStack Query, Zustand, Tailwind, and npm package layout.
- Preserve existing text-message behavior and serialize existing messages with `attachments: []`; do not require a migration for historical text-only messages.
- Store attachment bytes privately in MongoDB-backed protected storage for this phase; do not add external storage provider environment requirements.
- Enforce max 10 MB per file and max 5 attachments per message.
- Allow only `png`, `jpg`, `jpeg`, `webp`, `gif`, `pdf`, `txt`, `csv`, `xlsx`, and `docx`; reject executables, scripts, archives, and mismatched mime/signature inputs.
- Require text or at least one valid attachment for message creation.
- Treat attachments as immutable after send; edit updates text only.
- Delete-for-everyone blocks attachment retrieval for all users; delete-for-self hides attachments only for the deleting user.
- Do not log file bytes, tokens, public-looking download URLs, storage keys, or raw private object ids; filename logging must be omitted or redacted.
- UI must use abstract/non-living imagery only; no humans, animals, realistic avatars, mascots, or life-form media placeholders.
- Tests may use production-shaped fixtures, but product runtime must not depend on static demo attachments, pinned messages, media tiles, or shared file fixtures.

## Acceptance Criteria

- [ ] Existing text-only messages serialize with `attachments: []` and all current text-message tests still pass.
- [ ] A user can send text-only, attachment-only, and text-plus-attachment messages through one canonical message lifecycle.
- [ ] Supported image/document files persist, survive reload, appear in pagination, and reconcile from realtime `message:new` events without duplicate messages.
- [ ] Invalid attachment selections are rejected for unsupported type, mime/signature mismatch, over-size file, too many files, executable/script/archive content, and missing text/no valid attachment.
- [ ] Image attachments render protected previews and document attachments render accessible file cards with safe filename, type, size, and download action.
- [ ] Preview/download endpoints reject unauthenticated users, non-members, users without message visibility, and all users after delete-for-everyone.
- [ ] Shared media and shared files panels render real paginated server data, empty states, and authorization failures without static fixture assets.
- [ ] Message-level pin/unpin works for text and attachment messages, enforces membership/visibility/cap rules, and updates open UIs through realtime events.
- [ ] Desktop right rail and mobile detail drawer show real pinned, shared-asset, member, and security data in light and dark themes without overflow.
- [ ] Security rows make only factual claims: authenticated session, member-only room, realtime connection, and protected file access.
- [ ] Message search can find attachment filenames, and Phase 8 does not index file contents.
- [ ] Failed attachment sends expose retry/dismiss behavior when retry is possible and require reattachment after reload.
- [ ] Backend tests, frontend tests, lint, build, Playwright behavior tests, and after-interaction screenshot evidence are recorded in the Phase 8 summary.

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes |
|--------------------|-------|-------|--------|-------|
| Goal Clarity       | 0.94  | 0.75  | PASS   | Approved goal ties attachments, previews, downloads, pins, shared panels, and details to concrete user workflows. |
| Boundary Clarity   | 0.93  | 0.70  | PASS   | File types, limits, pins, storage boundary, mobile details, and out-of-scope calling/E2EE/AV/content-search are explicit. |
| Constraint Clarity | 0.88  | 0.65  | PASS   | Storage, auth, visibility, deletion, privacy, validation, and existing-stack constraints are locked. |
| Acceptance Criteria| 0.91  | 0.70  | PASS   | Criteria are pass/fail across backend, frontend, realtime/cache, mobile/desktop, light/dark, and security behavior. |
| **Ambiguity**      | 0.08  | <=0.20| PASS   | Gate passed after the user approved all recommendations. |

Status: PASS = met minimum, WARN = below minimum.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today? | Chatify currently has text-only messages, disabled attachment controls, and placeholder shared media/files/pinned sections. |
| 1 | Researcher | What is Phase 8's trigger? | Phase 7 made unsupported media/detail controls honest; Phase 8 turns the approved media/detail surfaces into real behavior. |
| 2 | Simplifier | Which file types and limits are enough for MVP? | Allow images plus common documents, max 10 MB per file, max 5 attachments per message. |
| 2 | Simplifier | Should attachment-only messages work? | Yes; require text or at least one valid attachment. |
| 2 | Simplifier | Should storage use a new external provider? | No; use MongoDB-backed protected storage for this phase to avoid new provider/env scope. |
| 3 | Boundary Keeper | What detail surfaces are in scope? | Desktop right rail and mobile detail drawer show real pinned messages, shared files, shared media, members, and factual security rows. |
| 3 | Boundary Keeper | What remains out of scope? | Calls, video, voice, favorite conversations, E2EE, external storage, AV scanning, content indexing, groups, notifications, admin, and deployment. |
| 4 | Failure Analyst | How is private file access protected? | All preview/download/list routes require auth, membership, and message visibility; no public URLs or raw storage ids are exposed. |
| 4 | Failure Analyst | What happens to deleted messages? | Delete-for-everyone blocks attachment retrieval for everyone; delete-for-self hides that user's access only. |
| 4 | Failure Analyst | How are failed uploads handled? | Show recoverable failure states; retry only while browser file objects remain available, otherwise require reattachment. |
| 5 | Seed Closer | How should pins work? | Message-level pins only, any member can pin/unpin visible messages, capped at 50 per chat, with realtime updates. |
| 5 | Seed Closer | How should search work? | Search attachment filenames/metadata only, not file contents. |
| 5 | Seed Closer | What proves done? | Backend auth tests, frontend component/cache tests, Playwright desktop/mobile light/dark workflows, lint, build, and recorded evidence. |

---

*Phase: 08-media-files-and-conversation-detail-implementation*
*Spec created: 2026-06-12*
*Next step: $gsd-discuss-phase 8 - implementation decisions (how to build what is specified above)*
