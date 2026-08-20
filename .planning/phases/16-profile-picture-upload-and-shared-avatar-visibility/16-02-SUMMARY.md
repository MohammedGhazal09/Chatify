---
phase: 16-profile-picture-upload-and-shared-avatar-visibility
plan: 16-02
subsystem: frontend-settings
tags: [react, settings, profile-images, csrf, tanstack-query, vitest, accessibility]
requires:
  - plan: 16-01
    provides: backend profile image upload/remove/fetch contract
provides:
  - Settings profile picture picker, preview, save, remove, and reset workflow
  - Frontend user API methods for profile image upload and remove
  - Focused mutation hook for auth-store update and identity cache invalidation
  - Client-side PNG/JPEG/WebP and 2 MB advisory validation
  - Settings, mutation, and CSRF regression tests
affects: [settings, profile-image, auth-store, chat-cache, contact-cache, csrf]
tech-stack:
  added: []
  patterns:
    - Shared Axios API layer for multipart profile-image mutation
    - Focused TanStack Query mutation hook for identity propagation
    - Accessible labelled file input with preview object URL cleanup
key-files:
  created:
    - Frontend/Chatify/src/hooks/useProfileImageMutation.ts
    - Frontend/Chatify/src/hooks/useProfileImageMutation.test.tsx
    - Frontend/Chatify/src/components/SettingsModal.test.tsx
  modified:
    - Frontend/Chatify/src/api/userApi.ts
    - Frontend/Chatify/src/api/axios.test.ts
    - Frontend/Chatify/src/components/SettingsModal.tsx
    - Frontend/Chatify/src/hooks/useChatQueries.ts
key-decisions:
  - "Settings consumes profile image changes through userApi and a focused hook, not direct Axios calls."
  - "Client validation mirrors backend type/size rules for quick feedback while backend validation remains authoritative."
  - "Upload/remove success updates the auth store immediately and invalidates auth, chats, online presence, users, and user-search query keys."
  - "The Settings preview resolves app-relative profile image URLs against the configured backend origin."
patterns-established:
  - "Frontend upload sends FormData field profileImage to PATCH /api/user/profile-image."
  - "Frontend removal uses DELETE /api/user/profile-image."
  - "Object URLs are revoked when the selected file changes, resets, saves, or the modal closes."
requirements-addressed:
  - ID-01
  - ID-02
  - SEC-01
  - SEC-02
  - TEST-04
  - TEST-05
  - UI-04
  - UI-05
  - SPEC-16-01
  - SPEC-16-06
  - SPEC-16-07
  - SPEC-16-08
duration: 10 min
completed: 2026-06-16
---

# Phase 16 Plan 16-02: Settings Profile Picture Workflow And Cache Propagation Summary

**Settings now supports selecting, previewing, saving, replacing, removing, and resetting a user-uploaded profile picture through the backend contract from 16-01.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-16T05:01:00Z
- **Completed:** 2026-06-16T05:11:05Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments

- Added typed `userApi.uploadProfileImage(file)` and `userApi.removeProfileImage()` methods on the shared Axios instance.
- Added `useProfileImageMutation` to update the current auth user immediately and invalidate identity-dependent query keys after upload/remove.
- Added a compact Settings profile picture section with labelled file input, preview, save, remove, reset, loading, success, and stable error states.
- Mirrored backend profile-image type and size rules client-side without adding crop, zoom, rotate, filters, or editor controls.
- Added tests for preview/upload, invalid type/size blocking, backend error display, remove, object URL cleanup, mutation cache propagation, and CSRF headers for multipart profile-image updates.

## Task Commits

1. **Tasks 16-02-T1 through 16-02-T4: Settings profile image workflow, mutation hook, cache propagation, and tests** - `72b6f01` (feat)

**Plan metadata:** this summary commit.

## Files Created/Modified

- `Frontend/Chatify/src/hooks/useProfileImageMutation.ts` - Focused upload/remove mutation hook and query invalidation.
- `Frontend/Chatify/src/hooks/useProfileImageMutation.test.tsx` - Hook tests for auth-store updates, invalidation, remove fallback, and failure preservation.
- `Frontend/Chatify/src/components/SettingsModal.test.tsx` - Settings workflow tests.
- `Frontend/Chatify/src/api/userApi.ts` - Profile-image upload/remove API methods.
- `Frontend/Chatify/src/api/axios.test.ts` - CSRF coverage for multipart profile-image requests.
- `Frontend/Chatify/src/components/SettingsModal.tsx` - Profile picture controls in Settings.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Shared users/user-search query keys for invalidation.

## Decisions Made

- The Settings workflow keeps its own local preview and error state, while persistent identity state comes only from the successful backend response.
- The remove action is enabled for app-uploaded profile images and clears an unsaved local selection before calling the backend.
- A reusable cross-surface `UserAvatar` remains deferred to 16-03, so this plan does not modify the protected chat route orchestrator.

## Deviations from Plan

None - plan executed within the intended Settings/API/hook/test scope.

## Issues Encountered

- No implementation blockers. The existing app had no all-users query hook, so 16-02 introduced stable `usersQueryKey` and `userSearchQueryKey` constants for focused invalidation without wiring new list behavior.

## Verification

```powershell
cd Frontend/Chatify
npm test -- --run src/components/SettingsModal.test.tsx src/hooks/useProfileImageMutation.test.tsx src/api/axios.test.ts src/hooks/useChatQueries.test.tsx
```

Result: passed, 4 test files, 17 tests.

```powershell
cd Frontend/Chatify
npm run lint
npm run build
```

Result: both passed.

## User Setup Required

None - no new environment variables or external services were added.

## Next Phase Readiness

16-03 can now introduce the reusable fallback-safe `UserAvatar` component and migrate chat identity surfaces to render the safe `profilePic` value returned by the backend and updated by Settings.

---
*Phase: 16-profile-picture-upload-and-shared-avatar-visibility*
*Completed: 2026-06-16*
