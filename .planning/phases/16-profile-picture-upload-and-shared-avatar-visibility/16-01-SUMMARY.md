---
phase: 16-profile-picture-upload-and-shared-avatar-visibility
plan: 16-01
subsystem: backend
tags: [express, mongoose, gridfs, csrf, multer, vitest, profile-images]
requires:
  - phase: 15-investigate-and-fix-audio-and-video-call-reliability
    provides: messenger reliability context and protected chat hygiene constraints
provides:
  - Dedicated backend profile image upload, remove, and authenticated fetch contract
  - User-owned uploaded profile image metadata with provider image fallback
  - Avatar-specific PNG/JPEG/WebP validation and 2 MB limit
  - Backend regression tests for validation, lifecycle, auth, CSRF, safe payloads, and attachment regressions
affects: [profile-image, user-identity, settings, chat-identity-surfaces, csrf]
tech-stack:
  added: []
  patterns:
    - Dedicated GridFS service per private asset domain
    - Select-hidden Mongoose metadata with safe display field in API payloads
    - Header-based CSRF before multipart parsing
key-files:
  created:
    - Backend/Chatify/Services/profileImageStorageService.mjs
    - Backend/Chatify/Utils/profileImageValidation.mjs
    - Backend/Chatify/test/fixtures/profileImages.mjs
    - Backend/Chatify/test/user/user.profile-image.test.mjs
  modified:
    - Backend/Chatify/Models/userModel.mjs
    - Backend/Chatify/Config/passport.mjs
    - Backend/Chatify/Controller/authController.mjs
    - Backend/Chatify/Controller/userController.mjs
    - Backend/Chatify/Routes/userRouter.mjs
    - Backend/Chatify/Middlewares/rateLimiters.mjs
key-decisions:
  - "Store uploaded profile image metadata inline on User because it is one-to-one and always co-read with identity payloads."
  - "Store image bytes in a dedicated profile-image GridFS bucket instead of reusing message attachment storage."
  - "Keep profilePic as the safe effective display reference while hiding provider and uploaded storage metadata from JSON."
  - "Protect profile image upload/remove with existing CSRF middleware before multer parsing."
patterns-established:
  - "Profile-image routes use /api/user/profile-image for owner mutation and /api/user/:userId/profile-image?v=version for authenticated image fetch."
  - "Old profile image versions return not found after replacement or removal."
  - "Local signup ignores client-supplied profilePic; OAuth provider images are stored separately as fallback."
requirements-addressed:
  - ID-02
  - SEC-01
  - SEC-02
  - TEST-01
  - TEST-04
  - SPEC-16-02
  - SPEC-16-03
  - SPEC-16-04
  - SPEC-16-05
  - SPEC-16-08
duration: 14 min
completed: 2026-06-16
---

# Phase 16 Plan 16-01: Backend Profile Image Contract, Storage, And Security Summary

**Authenticated profile image upload, replacement, removal, and private fetch backed by dedicated GridFS storage and safe user payloads**

## Performance

- **Duration:** 14 min
- **Started:** 2026-06-16T04:46:00Z
- **Completed:** 2026-06-16T05:00:22Z
- **Tasks:** 6
- **Files modified:** 10

## Accomplishments

- Added server-owned profile image storage and validation separate from message attachments.
- Split OAuth provider profile images from user-uploaded overrides while preserving `profilePic` as the client-safe effective reference.
- Added authenticated upload, remove, and fetch routes with CSRF, upload limiting, versioned app URLs, and cleanup lifecycle.
- Added backend tests covering valid PNG/JPEG/WebP, invalid payloads, replacement/removal, OAuth fallback, unauthenticated access, CSRF, safe response payloads, and existing attachment regressions.

## Task Commits

1. **Tasks 16-01-T1 through 16-01-T6: Backend profile image contract, storage, lifecycle, routes, and tests** - `824fe03` (feat)

**Plan metadata:** this summary commit.

## Files Created/Modified

- `Backend/Chatify/Services/profileImageStorageService.mjs` - Dedicated profile image GridFS bucket wrapper.
- `Backend/Chatify/Utils/profileImageValidation.mjs` - Avatar-only file validation with stable error codes.
- `Backend/Chatify/test/fixtures/profileImages.mjs` - Minimal generated binary profile image fixtures.
- `Backend/Chatify/test/user/user.profile-image.test.mjs` - Backend profile image regression coverage.
- `Backend/Chatify/Models/userModel.mjs` - Hidden provider/uploaded metadata and safe effective `profilePic` behavior.
- `Backend/Chatify/Config/passport.mjs` - OAuth provider image fallback handling without overwriting uploaded overrides.
- `Backend/Chatify/Controller/authController.mjs` - Local signup no longer trusts client-supplied `profilePic`.
- `Backend/Chatify/Controller/userController.mjs` - Profile image upload/remove/fetch lifecycle.
- `Backend/Chatify/Routes/userRouter.mjs` - Protected profile image routes and CSRF on unsafe user routes.
- `Backend/Chatify/Middlewares/rateLimiters.mjs` - Dedicated profile image upload limiter.

## Decisions Made

- Inline metadata on `User` is sufficient for Phase 16 because a user has one active uploaded profile image and the metadata is always co-read with identity payloads.
- The profile-image bucket is intentionally separate from message attachments to keep validation, lifecycle, and privacy boundaries narrow.
- Versioned app URLs are safe to expose because they contain user id plus a cache token, not storage ids or hashes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first backend test run failed because the profile-image Supertest helper was accidentally declared `async`, causing `.expect()` to run against a Promise and leaving stray requests. The helper was corrected and the full backend slice passed.
- The planned broad storage/privacy scan finds expected internal server-side storage variable names in backend controllers/models and the test regex that blocks those fields from responses. Response-shape tests prove those internals are not exposed to clients.

## Verification

```powershell
cd Backend/Chatify
npm test -- --run test/user/user.profile-image.test.mjs test/message/message.attachments.test.mjs test/message/message.attachment-authorization.test.mjs
```

Result: passed, 3 test files, 19 tests.

```powershell
rg -n "gridfs|bucket|storageFileId|objectKey|sha256|hash|private path|cookie|token|email" Backend/Chatify/Controller Backend/Chatify/Routes Backend/Chatify/Models Backend/Chatify/test/user
```

Result: expected server-internal storage references and test guard terms only; profile image response tests assert client payloads do not expose them.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The backend contract is ready for 16-02. Frontend work should use `PATCH /api/user/profile-image` with `profileImage` FormData, `DELETE /api/user/profile-image` for removal, and treat `/api/user/:userId/profile-image?v=...` profile references as authenticated app image URLs.

---
*Phase: 16-profile-picture-upload-and-shared-avatar-visibility*
*Completed: 2026-06-16*
