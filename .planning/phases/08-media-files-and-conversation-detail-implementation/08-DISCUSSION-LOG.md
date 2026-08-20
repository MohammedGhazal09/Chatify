# Phase 08: Media Files And Conversation Detail Implementation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 08-media-files-and-conversation-detail-implementation
**Areas discussed:** backend data contracts and storage, validation authorization and privacy, frontend API query cache and realtime, UI and interaction surfaces, testing evidence and plan shape

---

## Backend Data Contracts And Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Message-only attachments | Store attachment data only inside message documents. | |
| Separate attachment model plus message summaries | Store queryable attachment metadata separately and serialize summaries on messages. | x |
| GridFS metadata only | Rely on storage metadata without a product-domain attachment model. | |

**User's choice:** Approved recommendation: separate `Attachment` model plus message attachment summaries.
**Notes:** This supports shared files/media panels, authorization checks, pagination, and existing message serialization without scanning every loaded message page.

| Option | Description | Selected |
|--------|-------------|----------|
| Add attachment logic directly to `messageController.mjs` | Keep all storage, validation, and metadata behavior inside the existing controller. | |
| Add focused model/service/helper modules | Keep controllers thin and place storage/validation behavior in focused backend modules. | x |
| Add a fully separate attachment subsystem | Build a separate controller and lifecycle detached from message send. | |

**User's choice:** Approved recommendation: use focused backend modules and keep the message controller as orchestration.
**Notes:** The existing controller already owns many message behaviors. Attachment storage needs testable boundaries.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `/api/message/new-message` JSON only | Add a separate route for attachment messages. | |
| Upgrade `/api/message/new-message` | Accept JSON text-only and multipart text/file sends through the same canonical lifecycle. | x |
| Pre-upload attachments through `/api/attachments` | Upload files first, then reference them in message creation. | |

**User's choice:** Approved recommendation: upgrade the existing message send route.
**Notes:** This preserves `clientMessageId`, optimistic merge, retries, status, unread, and socket behavior.

| Option | Description | Selected |
|--------|-------------|----------|
| Multer memory storage | Parse multipart with strict limits and pass files to protected storage. | x |
| Multer disk storage | Write uploads to local disk before persistence. | |
| Raw Busboy stream handling | Hand-roll lower-level multipart parsing. | |

**User's choice:** Approved recommendation: Multer memory storage with strict limits.
**Notes:** The approved file limit is max 10 MB/file and max 5 files/message; local disk is not durable on Render.

| Option | Description | Selected |
|--------|-------------|----------|
| Direct GridFS calls in controllers | Controllers own bucket creation, streams, and cleanup. | |
| Central storage service over GridFS | One backend service wraps upload/download/delete/cleanup behavior. | x |
| External object storage | Add S3/R2/Cloudinary style provider. | |

**User's choice:** Approved recommendation: central MongoDB GridFS storage service.
**Notes:** External object storage is explicitly out of scope for Phase 08.

---

## Validation Authorization And Privacy

| Option | Description | Selected |
|--------|-------------|----------|
| Trust extension/client MIME | Use browser-provided metadata as the main validation source. | |
| Server signature only | Rely only on byte-level checks. | |
| Combined validation | Use extension allowlist, client MIME for UX, and server-side MIME/signature checks where practical. | x |

**User's choice:** Approved recommendation: combined validation.
**Notes:** Client MIME and filename extensions can be spoofed; server validation is required for private-message uploads.

| Option | Description | Selected |
|--------|-------------|----------|
| Generic errors only | Return only existing generic message strings. | |
| Structured codes only | Replace current response shapes with a new error contract. | |
| Existing envelope plus stable codes | Keep response shape and add precise attachment error codes. | x |

**User's choice:** Approved recommendation: existing response envelope with stable attachment codes.
**Notes:** This avoids breaking current patterns while enabling specific composer errors.

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse message limiter only | Treat uploads like text sends. | |
| Add upload-specific limiter | Keep message limiter and add a tighter upload limiter. | x |
| Add account storage quotas now | Introduce quota policy and enforcement in Phase 08. | |

**User's choice:** Approved recommendation: add upload-specific rate limits, defer quotas.
**Notes:** Uploads are higher cost than text. Storage quotas are a separate product policy.

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve raw filenames everywhere | Store and display exactly what the browser sends. | |
| Sanitize for display and use generated storage ids | Keep safe display names and generated storage identifiers. | x |
| Hide filenames entirely | Avoid filename display in UI. | |

**User's choice:** Approved recommendation: sanitize display filenames and avoid logging raw sensitive metadata.
**Notes:** Prevents unsafe headers, UI issues, and privacy leakage.

| Option | Description | Selected |
|--------|-------------|----------|
| Message first, files later | Create message before file persistence is known. | |
| Files first with cleanup | Store files in a controlled sequence, then create metadata/message with cleanup on later failure. | x |
| Ignore orphan cleanup | Accept orphaned files after errors. | |

**User's choice:** Approved recommendation: files first with transactional metadata/message where available and cleanup on failure.
**Notes:** Avoids messages without files and orphaned private file bytes.

| Option | Description | Selected |
|--------|-------------|----------|
| Text-only idempotency comparison | Keep current `clientMessageId` comparison tied to message text. | |
| Payload-aware idempotency | Compare text plus attachment count/name/size/hash. | x |
| Always create new file rows on retry | Allow duplicates as long as message ids converge. | |

**User's choice:** Approved recommendation: payload-aware idempotency.
**Notes:** Same retry returns existing message; changed payload with same client id conflicts.

| Option | Description | Selected |
|--------|-------------|----------|
| No attachment hashes | Avoid hash computation. | |
| Hashes for idempotency and audit | Compute hashes but do not deduplicate storage. | x |
| Hashes plus storage deduplication | Add physical deduplication now. | |

**User's choice:** Approved recommendation: hash for idempotency/audit only.
**Notes:** Deduplication adds complexity outside the MVP.

| Option | Description | Selected |
|--------|-------------|----------|
| Physically delete immediately on delete-for-everyone | Remove file bytes as soon as a message is deleted for everyone. | |
| Metadata/visibility denial first | Deny retrieval immediately and optionally clean physical bytes later. | x |
| Keep deleted files retrievable by original participants | Preserve retrieval even after delete-for-everyone. | |

**User's choice:** Approved recommendation: metadata/visibility denial first.
**Notes:** This preserves delete-for-self behavior and avoids races while meeting access requirements.

---

## Frontend API Query Cache And Realtime

| Option | Description | Selected |
|--------|-------------|----------|
| Separate attachment send hook | Add a different send path for files. | |
| Extend `useSendMessage` | One send hook handles text-only and multipart sends. | x |
| Raw FormData calls from components | Components call Axios directly for upload. | |

**User's choice:** Approved recommendation: extend `messageApi.createMessage` and `useSendMessage`.
**Notes:** Keeps transport in API/hooks and preserves the existing composer lifecycle.

| Option | Description | Selected |
|--------|-------------|----------|
| No optimistic file previews | Wait for server response before showing any selected files in the conversation. | |
| Local object URL previews | Show temporary local previews and reconcile with server data. | x |
| Upload progress only | Show progress rows but no preview. | |

**User's choice:** Approved recommendation: local object URL previews with temporary attachment summaries.
**Notes:** Revoke URLs on settle/unmount and require reattachment after reload.

| Option | Description | Selected |
|--------|-------------|----------|
| Put all detail data in message cache | Derive rails and drawers from the timeline only. | |
| Dedicated shared/pinned query keys | Add targeted query keys for shared assets and pinned messages. | x |
| Component-local detail state | Keep rail/drawer data only inside UI components. | |

**User's choice:** Approved recommendation: dedicated TanStack Query keys.
**Notes:** Enables precise invalidation and real server-backed panels independent of loaded timeline pages.

| Option | Description | Selected |
|--------|-------------|----------|
| Manual update everywhere | Update every cache copy after each event. | |
| Invalidate everything | Broadly refetch all chat/message/detail data after each event. | |
| Hybrid update and targeted invalidation | Upsert timeline messages and invalidate/refetch detail panel keys. | x |

**User's choice:** Approved recommendation: hybrid cache strategy.
**Notes:** Reduces duplicate cache logic while keeping panels fresh.

| Option | Description | Selected |
|--------|-------------|----------|
| Filename search only in panel APIs | Message search stays text-only. | |
| Selected-chat message search includes filenames | Extend current message search to attachment display names/metadata only. | x |
| Index file contents | Search PDFs, documents, OCR, and file text. | |

**User's choice:** Approved recommendation: filename/metadata search only.
**Notes:** File-content indexing is explicitly out of scope.

---

## UI And Interaction Surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden input only | Basic file picker with little selection UI. | |
| Inline attachment tray | Composer shows selected files, errors, remove actions, and progress/failure states. | x |
| Modal picker | Use a modal as the primary attachment interaction. | |

**User's choice:** Approved recommendation: hidden native input plus inline attachment tray.
**Notes:** This is direct, accessible, and mobile-friendly.

| Option | Description | Selected |
|--------|-------------|----------|
| File cards only | Render every attachment as a generic file card. | |
| Media grid plus document cards | Images get constrained previews; documents get accessible cards. | x |
| External preview page | Open files outside the message surface. | |

**User's choice:** Approved recommendation: image previews plus document cards inside message bubbles.
**Notes:** Text remains visible when present and layouts must stay bounded.

| Option | Description | Selected |
|--------|-------------|----------|
| Mobile route | Add a separate route for conversation details. | |
| Full-screen drawer/sheet | Open details from the current chat header More control. | x |
| Small modal | Overlay a compact modal for all detail content. | |

**User's choice:** Approved recommendation: full-screen mobile drawer/sheet.
**Notes:** Avoids route churn and mirrors the desktop right rail.

| Option | Description | Selected |
|--------|-------------|----------|
| View-only right rail | Show lists without direct actions. | |
| Open/download/jump actions | Let files/media open or download and jump back to message. | x |
| Broad more-actions menu | Add many future actions now. | |

**User's choice:** Approved recommendation: open/download/jump actions, plus pin jump/unpin where authorized.
**Notes:** Useful within Phase 08 scope without adding broad unsupported menus.

| Option | Description | Selected |
|--------|-------------|----------|
| Strong security marketing copy | Use labels such as encrypted, verified, scanned, or secure. | |
| Factual security rows only | Show authenticated, member checked, realtime state, and protected file access. | x |
| Hide security rows | Avoid security-status UI entirely. | |

**User's choice:** Approved recommendation: factual security rows only.
**Notes:** No E2EE or virus-scan claims are allowed.

---

## Testing Evidence And Plan Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Backend-heavy tests only | Validate storage/auth mostly on the backend. | |
| Layered backend/frontend/socket/e2e coverage | Cover behavior at the right level across all affected boundaries. | x |
| Screenshot-only proof | Rely mainly on visual evidence. | |

**User's choice:** Approved recommendation: layered tests and behavior-first evidence.
**Notes:** Phase 08 must prove actual product behavior, not another static picture.

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime fixtures allowed | Use static media/detail fixtures in production code for visual parity. | |
| Test-only fixtures with guardrails | Allow production-shaped fixtures only in test paths and add leak guards. | x |
| No fixtures anywhere | Avoid fixtures even in tests. | |

**User's choice:** Approved recommendation: test-only fixtures with guardrails.
**Notes:** Carries forward Phase 07's core correction.

| Option | Description | Selected |
|--------|-------------|----------|
| Backend-first only | Build all backend before UI starts. | |
| UI-first mock implementation | Build all surfaces against mocks before backend exists. | |
| Dependency-aware vertical waves | Backend contracts first, then frontend flows, then realtime/search/pin/evidence. | x |

**User's choice:** Approved recommendation: dependency-aware vertical waves.
**Notes:** Recommended waves are backend storage/contracts/auth tests, frontend send/render/cache/detail UI, then realtime/search/pin/panel/evidence.

---

## the agent's Discretion

- Exact backend helper/module names.
- Whether validation helpers live under `Backend/Chatify/Utils` or `Backend/Chatify/Services`.
- Exact query key names for shared assets and pinned messages.
- Exact drawer implementation details for mobile conversation detail.
- Exact Playwright fixture and screenshot naming.

## Deferred Ideas

- Server-generated thumbnails and image transcoding.
- File-content search, OCR, and document parsing.
- Virus scanning service integration.
- External object storage providers.
- Physical background cleanup/garbage-collection policy beyond immediate visibility denial.
- Calls, video calls, voice messages, favorite conversations, broad more menus, groups, notifications, admin tooling, native apps, and end-to-end encryption.
