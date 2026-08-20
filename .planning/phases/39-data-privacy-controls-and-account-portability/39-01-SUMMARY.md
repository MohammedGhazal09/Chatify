# Phase 39 Plan 01 Summary - Backend Account Export And Privacy Audit

## Completed

- Added `PrivacyRequest` audit persistence for account export and deletion workflows.
- Added `POST /api/user/privacy/export` with cookie auth, CSRF protection, rate limiting, and allowlist serialization.
- Export includes the requester's account/profile/settings, safe session summaries, authorized chats/spaces, visible messages, attachment metadata/download references, filed reports, and encrypted-message limitation metadata.
- Export excludes unauthorized chats/messages, deleted-for-user messages, peer emails, raw tokens, reset codes, push endpoint internals, and admin-only moderation notes.
- Audit records store counts and metadata only; raw export payloads are not persisted.

## Verification

- Passed: `npm test -- test/user/user.privacy-export.test.mjs test/user/user.privacy-deletion.test.mjs`

## Notes

- Attachment file bytes remain behind protected download routes and are not embedded in JSON exports.
- Server export does not decrypt encrypted conversation payloads.
