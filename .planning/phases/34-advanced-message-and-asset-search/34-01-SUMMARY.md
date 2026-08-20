# Phase 34 Plan 01 Summary - Backend Search Contract And Jump Context

## Completed

- Extended selected-conversation search to normalize and validate sender, date range, and type filters.
- Added `all`, `text`, `link`, `media`, `file`, and `voice` type behavior.
- Kept every search path layered on top of membership checks and `buildVisibleMessageFilter`.
- Added active attachment metadata matching for media/file/voice filters without searching attachment contents.
- Added `GET /api/message/context/:chatId/:messageId` for authorized jump-to-message windows.
- Added a sender/date index for bounded filtered message queries.
- Expanded backend search tests for invalid filters, sender/date/type filters, link search, media/file/voice asset filters, and context windows.

## Verification

- Passed: `npm test -- message.search.test.mjs`
- Passed: `npm test -- message.search.test.mjs message.shared-assets.test.mjs message.pagination.test.mjs`

## Notes

- Empty `q` remains rejected unless at least one narrowing filter is supplied.
- Link search is limited to visible message text URLs.
- Attachment filters use active persisted attachment metadata only.
