# Phase 08 Review Fix

## Scope

Resolved the Phase 08 code review findings in `08-REVIEW.md`.

## Fixes

- `WR-001`: `storeMessageAttachments` now tracks the GridFS file id immediately after upload and performs helper-local cleanup if attachment metadata creation fails before returning to the caller.
- `WR-002`: private attachment preview/download authorization now returns the same `404 Attachment not found` response for non-members as it does for invalid, missing, deleted, or hidden attachments.

## Regression Coverage

- Added a metadata-failure regression that mocks `Attachment.create()` after upload and verifies no GridFS file, attachment metadata, or message document remains.
- Updated outsider preview/download authorization expectations to `404` while keeping shared-assets chat access at `403`.

## Verification

- `Backend/Chatify`: `npm test -- test/message/message.attachments.test.mjs test/message/message.attachment-authorization.test.mjs`
- `Backend/Chatify`: `npm test -- test/message/message.shared-assets.test.mjs test/socket/socket.attachments-pins.test.mjs`
- `Backend/Chatify`: `npm test` (`17` files, `83` tests)
