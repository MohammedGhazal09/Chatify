# Phase 37 Plan 01 Summary - Backend Profile And Presence Privacy Contract

## Completed

- Added bounded `profileBio`, `profileStatus`, and `showProfileStatus` user fields.
- Added profile text normalization and validation for length, unsafe markup, URL-like content, and control characters.
- Added `PATCH /api/user/profile` for current-user bio/status updates.
- Extended privacy settings with `showProfileStatus`.
- Updated public identity and contact serialization so email stays private and hidden status text is omitted.
- Made online user snapshots block-aware and changed hidden-online broadcasts to emit offline/unreachable state so clients clear stale presence.

## Verification

- Passed: `npm test -- user.profile.test.mjs socket.presence-reconnect.test.mjs socket.blocking.test.mjs`

## Notes

- Profile fields remain text-only; external links, rich profile metadata, and per-chat visibility rules stay out of scope.
