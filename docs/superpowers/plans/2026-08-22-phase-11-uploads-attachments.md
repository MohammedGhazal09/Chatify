# Phase 11 Uploads and Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Secure Chatify’s message-attachment and profile-image upload lifecycle from validation through private delivery and deletion.

**Architecture:** Keep MongoDB GridFS as the storage provider. Add one shared, pure upload-inspection utility used by the existing attachment and profile-image validators, plus one attachment-lifecycle service used by message/chat deletion and a bounded retry worker. Preserve current APIs while strengthening stable error codes and response headers.

**Tech Stack:** Node.js 24.19.0, Express 5, Multer 2, Mongoose 8, MongoDB GridFS, `file-type`, Vitest, Supertest, GitHub Actions.

**Spec:** `docs/security/audit/phase-11/phase-11-uploads-attachments-spec.md`

## Global Constraints

- Keep the existing React/Vite frontend, Express backend, MongoDB/Mongoose persistence, Socket.IO, TanStack Query, Zustand, Tailwind, and npm layout.
- Do not migrate upload storage to Cloudinary; the repository’s active provider is MongoDB GridFS.
- Preserve private authenticated delivery routes and current response payload shapes.
- Never log file bytes, private filenames, hashes, GridFS IDs, message content, credentials, or cookies.
- Use test-first development. Each production behavior must be preceded by a failing regression test.
- Do not add Phase 12 integration/webhook behavior or Phase 13 Socket.IO protocol changes.

---

### Task 1: Define the Phase 11 regression contract

**Files:**
- Create: `Backend/Chatify/test/security/phase11-upload-security.test.mjs`
- Modify: `Backend/Chatify/test/fixtures/attachments.mjs`
- Modify: `Backend/Chatify/test/fixtures/profileImages.mjs`

**Interfaces:**
- Consumes: `validateIncomingAttachments(files, options)`, `validateIncomingProfileImage(file)`, existing authenticated upload routes, GridFS test buckets.
- Produces: failing behavioral coverage for active content, polyglots, dimensions, aggregate limits, container signatures, response headers, and lifecycle deletion.

- [ ] Write tests that currently accept an active PDF, deceptive `.html.txt` filename, plain-text WebM, PNG with trailing HTML, and over-dimension PNG.
- [ ] Write tests that currently leave GridFS files after delete-for-everyone and chat deletion.
- [ ] Run `npm --prefix Backend/Chatify test -- --run test/security/phase11-upload-security.test.mjs` and verify failures are caused by missing Phase 11 behavior.
- [ ] Commit the red contract.

### Task 2: Add shared upload structure inspection

**Files:**
- Create: `Backend/Chatify/Utils/uploadSecurity.mjs`
- Modify: `Backend/Chatify/Utils/attachmentValidation.mjs`
- Modify: `Backend/Chatify/Utils/profileImageValidation.mjs`

**Interfaces:**
- Produces:
  - `inspectImageUpload({ buffer, mimeType }) -> { ok, buffer, width, height, metadataRemoved } | { ok: false, reason }`
  - `inspectPdfUpload(buffer) -> { ok } | { ok: false, reason }`
  - `inspectTextUpload(buffer) -> { ok, buffer } | { ok: false, reason }`
  - `inspectOpenXmlUpload({ buffer, extension }) -> { ok } | { ok: false, reason }`
  - `isDeceptiveUploadFilename(filename) -> boolean`
  - `buildPrivateFileHeaders({ disposition, filename, mimeType, size }) -> Record<string,string>`

- [ ] Implement strict filename controls, including bidi/control characters and deceptive inner active extensions.
- [ ] Parse PNG, JPEG, GIF, and WebP dimensions; reject malformed/trailing data and values above 10,000 per dimension or 40,000,000 total pixels.
- [ ] Remove JPEG EXIF/comment segments and PNG/WebP metadata chunks before hashing and storage.
- [ ] Reject PDF JavaScript, launch actions, embedded files, rich media, malformed EOF, and trailing polyglot content.
- [ ] Require recognized WebM/Ogg container signatures and valid OpenXML ZIP/container markers.
- [ ] Enforce UTF-8/NUL rules for text and CSV.
- [ ] Add the 20 MiB aggregate attachment limit.
- [ ] Run the focused tests until the validation cases pass.

### Task 3: Harden private file delivery

**Files:**
- Modify: `Backend/Chatify/Controller/messageController.mjs`
- Modify: `Backend/Chatify/Controller/userController.mjs`

**Interfaces:**
- Consumes: `buildPrivateFileHeaders`.
- Produces: `nosniff`, private cache policy, sandbox CSP, same-origin resource policy, frame denial, safe `Content-Disposition`, and exact content length for attachment/profile-image responses.

- [ ] Apply the shared header policy to preview, download, and profile-image responses.
- [ ] Keep content delivery behind current membership/message-visibility checks.
- [ ] Verify private routes do not expose storage identifiers or hashes.
- [ ] Run attachment authorization and profile-image tests.

### Task 4: Implement durable attachment cleanup

**Files:**
- Create: `Backend/Chatify/Services/attachmentLifecycleService.mjs`
- Modify: `Backend/Chatify/Models/attachmentModel.mjs`
- Modify: `Backend/Chatify/Controller/messageController.mjs`
- Modify: `Backend/Chatify/Controller/chatController.mjs`
- Modify: `Backend/Chatify/server.mjs`
- Modify: `Backend/Chatify/.env.example`

**Interfaces:**
- Produces:
  - `purgeAttachmentsForMessage({ messageId, reason, now })`
  - `purgeAttachmentsForChat({ chatId, reason, now })`
  - `cleanupAttachmentOrphans({ now, limit })`
  - `startAttachmentCleanupWorker()` / `stopAttachmentCleanupWorker()`

- [ ] Add nonsecret lifecycle fields: `storageState`, `deletedAt`, `storageDeletedAt`, `cleanupAttempts`, `nextCleanupAt`, and a bounded sanitized error code.
- [ ] Delete GridFS objects and mark metadata deleted on delete-for-everyone.
- [ ] Purge attachments and messages before deleting a chat.
- [ ] Keep failed cleanup retryable; do not swallow failures as successful deletion.
- [ ] Add a disabled-in-test bounded retry worker.
- [ ] Verify delete-for-self does not remove shared storage.
- [ ] Run lifecycle and privacy-operation tests.

### Task 5: Add Phase 11 evidence and CI

**Files:**
- Create: `scripts/security/phase11-upload-policy.mjs`
- Create: `scripts/security/phase11-reproduce.mjs`
- Create: `docs/security/audit/phase-11/README.md`
- Create: `docs/security/audit/phase-11/upload-policy.json`
- Create: `docs/security/audit/phase-11/upload-policy.md`
- Create: `.github/workflows/security-phase-11-uploads-attachments.yml`
- Modify: `package.json`

**Interfaces:**
- Produces root scripts `security:phase11:test`, `security:phase11:generate`, `security:phase11:check`, and `security:phase11:reproduce`.

- [ ] Generate deterministic evidence from source-controlled limits, allowed types, delivery headers, cleanup integration points, and storage-provider inventory.
- [ ] Record that Cloudinary and external antivirus scanning are not present; do not claim provider-side controls.
- [ ] Add a read-only workflow pinned to immutable action SHAs.
- [ ] Run focused backend tests, complete backend tests, frontend tests, lint, build, Phase 1–5 checks, and operations guard through the reproduction script.
- [ ] Verify generated evidence is drift-clean.

### Task 6: Final verification and pull request

**Files:** all Phase 11 changes.

- [ ] Run `git diff --check` through CI.
- [ ] Confirm no Phase 12+ behavior or unrelated frontend redesign is included.
- [ ] Inspect GitHub Actions logs and separate inherited failures from Phase 11 failures.
- [ ] Update the draft pull request with exact test evidence, residual risks, and the immutable head SHA.
