# Chatify Security Phase 11 — Uploads and Attachments

## Goal

Harden every repository-owned upload path so attacker-controlled files cannot become same-origin active content, bypass type and resource limits, leak private metadata, outlive their owning records unintentionally, or remain reachable after authorization changes.

## Scope

Phase 11 covers:

- Message attachments stored in MongoDB GridFS.
- User-uploaded profile images stored in MongoDB GridFS.
- Attachment preview and download responses.
- Upload filename and metadata handling.
- Message, chat, profile-image, and failed-write cleanup.
- Upload-specific operational evidence and regression tests.

The audited repository does not use Cloudinary for these upload paths. Phase 11 therefore verifies the actual GridFS implementation and records Cloudinary as not present rather than introducing a new storage provider.

## Security invariants

1. Extension, declared MIME type, detected format, and parsed container structure must agree for every accepted binary upload.
2. HTML, SVG, XML, JavaScript, executable, macro-enabled Office, active PDF, malformed image, and image-polyglot content must be rejected before persistence.
3. Image width, height, and total pixels must be bounded before storage; metadata that can disclose location or author information must be removed or rejected.
4. A request may not exceed five attachments, 10 MiB per attachment, or 20 MiB aggregate attachment bytes.
5. Plain-text and CSV uploads must be valid UTF-8 without NUL bytes and must be served with `nosniff` and a sandboxed content policy.
6. Voice attachments must have a recognized Ogg/Opus or WebM container signature; a declared audio MIME type alone is insufficient.
7. Attachment and profile-image responses must use private cache policy, `X-Content-Type-Options: nosniff`, same-origin resource policy, frame denial, and a restrictive CSP.
8. Attachment identifiers never provide access by themselves. Current chat membership and message visibility remain mandatory at delivery time.
9. Failed message creation, failed metadata persistence, message deletion for everyone, chat deletion, profile-image replacement/removal, and account deletion must not leave untracked GridFS objects.
10. Cleanup failures must be retryable and observable without logging file contents, hashes, private filenames, or storage identifiers.
11. No control may claim malware scanning occurred. The repository uses deterministic allowlisting, structure inspection, active-content rejection, and lifecycle cleanup; external antivirus scanning remains an explicitly documented residual control decision.

## Architecture

### Shared upload inspection

`Backend/Chatify/Utils/uploadSecurity.mjs` will own reusable filename checks, image parsing and metadata stripping, trailing-data rejection, PDF active-content checks, UTF-8 validation, OpenXML container checks, secure response-header construction, and bounded numeric parsing.

The existing attachment and profile-image validators remain their domain-facing interfaces. They call the shared inspector and translate failures into stable API error codes.

### Attachment lifecycle

`Backend/Chatify/Services/attachmentLifecycleService.mjs` will own GridFS deletion, metadata state transitions, orphan discovery, retry state, and bounded cleanup batches. Controllers call it for message and chat deletion. A disabled-in-test interval worker retries failed cleanup without weakening synchronous deletion attempts.

### Delivery

Existing authenticated routes remain the only delivery surface. Preview and download responses apply a centralized header policy. File responses never expose storage identifiers or raw GridFS metadata.

## Error contract

New stable upload error codes:

- `ATTACHMENT_BATCH_SIZE_EXCEEDED`
- `ATTACHMENT_FILENAME_DECEPTIVE`
- `ATTACHMENT_CONTENT_MALFORMED`
- `ATTACHMENT_ACTIVE_CONTENT`
- `ATTACHMENT_POLYGLOT_REJECTED`
- `ATTACHMENT_IMAGE_DIMENSIONS_EXCEEDED`
- `ATTACHMENT_TEXT_INVALID`
- `ATTACHMENT_CONTAINER_INVALID`
- `PROFILE_IMAGE_CONTENT_MALFORMED`
- `PROFILE_IMAGE_POLYGLOT_REJECTED`
- `PROFILE_IMAGE_DIMENSIONS_EXCEEDED`

All failures return HTTP 400 and contain no file content or internal storage information.

## Resource limits

- Attachments per message: 5.
- Per-attachment bytes: 10 MiB.
- Aggregate attachment bytes: 20 MiB.
- Profile image bytes: 2 MiB.
- Image maximum dimension: 10,000 pixels.
- Image maximum total pixels: 40,000,000.
- Attachment cleanup batch: 50 records.
- Cleanup retry interval: minimum 60 seconds; default 5 minutes.

## Retention decisions

- Delete-for-self hides an attachment only for that user and does not delete shared storage.
- Delete-for-everyone tombstones the message and purges its attachment GridFS objects.
- Chat deletion removes messages, attachment metadata, and GridFS objects for that chat.
- Account deletion retains message attachments when conversation messages are intentionally retained for other participants; uploaded profile images are removed.
- Profile-image replacement and removal delete the superseded GridFS object.

## Testing

The Phase 11 regression suite must prove:

- Active PDFs and deceptive filenames are rejected.
- Plain declared WebM data is rejected without a real container signature.
- Image polyglots and oversized dimensions are rejected.
- accepted images have sensitive metadata removed.
- Aggregate attachment limits are enforced.
- Private delivery headers are present.
- Nonmembers and users who deleted a message for themselves cannot retrieve attachments.
- Delete-for-everyone and chat deletion remove GridFS content and metadata.
- Cleanup failures remain retryable without exposing private data.
- Existing attachment, voice, profile-image, message, authorization, frontend, lint, and build suites remain green.

## Phase boundary

Phase 11 does not add a third-party malware scanner, migrate storage to Cloudinary, add end-to-end encrypted attachment payloads, or implement provider-side CDN signed URLs. Those would require separate product and infrastructure decisions. The phase secures the repository’s present private GridFS architecture.