# Phase 16: Profile Picture Upload And Shared Avatar Visibility - Specification

**Created:** 2026-06-16
**Ambiguity score:** 0.06 (gate: <= 0.20)
**Requirements:** 9 locked

## Goal

Authenticated Chatify users can upload, preview, replace, and remove one profile picture from Settings, and authorized other users see that picture across chat identity surfaces with a deterministic abstract fallback.

## Background

Chatify already has a `profilePic` string field on `Backend/Chatify/Models/userModel.mjs`, and OAuth providers can populate it through `Backend/Chatify/Config/passport.mjs`. Existing user and chat payloads can expose `profilePic`, including `Backend/Chatify/Controller/userController.mjs`, `Backend/Chatify/Controller/chatController.mjs`, and frontend user/chat types. The app does not currently provide an owned upload, replace, remove, or validation flow for profile pictures.

The frontend Settings modal at `Frontend/Chatify/src/components/SettingsModal.tsx` currently handles sound, enter-to-send, and theme settings only. Chat identity UI currently renders `AbstractIdentityTile` in the sidebar, chat list, conversation header, and detail rail/drawer surfaces, even when `profilePic` exists. Existing message attachment code already proves protected upload/storage/validation patterns for user-provided files, but profile pictures need a narrower identity-focused contract instead of being treated as shared message attachments.

## Requirements

1. **Authenticated profile photo management**: A signed-in user can upload, preview, replace, and remove their own profile picture from the Settings flow.
   - Current: Settings has no profile picture controls, and users cannot upload or remove their own `profilePic` from the UI.
   - Target: Settings exposes an authenticated profile picture workflow with local file selection, preview before submit, successful replacement, and an explicit remove action.
   - Acceptance: A frontend test renders Settings for a signed-in user, selects a valid image file, shows a preview, submits it, shows the updated current-account image, then removes it and returns to the fallback identity tile.

2. **Owned image validation**: Profile picture uploads accept only non-empty PNG, JPEG/JPG, and WebP image files that pass server-side content validation and stay within a 2 MB maximum.
   - Current: Message attachments allow broader file/media types up to 10 MB, while profile pictures have no dedicated upload validation.
   - Target: Profile picture upload validation is avatar-specific: PNG, JPEG/JPG, and WebP only; real image signature required; empty, oversized, mislabeled, unsupported, or non-image payloads rejected with stable client-facing errors.
   - Acceptance: Backend tests prove valid PNG/JPEG/WebP uploads succeed and empty, oversized, executable, PDF, GIF, and extension/MIME mismatch uploads fail without changing the user's current profile picture.

3. **Server-owned storage and safe URLs**: Uploaded profile pictures are stored as server-owned user image assets and exposed only through safe application URLs or descriptors, never raw storage identifiers.
   - Current: `profilePic` can contain arbitrary external OAuth image URLs, and message attachments hide GridFS/storage internals from clients.
   - Target: User-uploaded profile pictures persist with metadata owned by the user record or a dedicated user-image asset record, and API responses do not expose GridFS bucket names, storage file ids, hashes, object keys, or private filesystem paths.
   - Acceptance: Backend response tests for logged-user, chat-list, online/contact, and search/user payloads show a usable profile image reference and assert that raw storage fields and hashes are absent.

4. **Replacement and removal lifecycle**: Replacing or removing a user-uploaded profile picture does not leave the old uploaded image active for future use.
   - Current: There is no owned upload lifecycle; OAuth `profilePic` strings can be overwritten but not managed as local files.
   - Target: Replacing a user-uploaded image deactivates or deletes the previous uploaded image after the new image is safely persisted; removing a user-uploaded image clears the override. External OAuth image URLs are superseded by uploads and restored only as fallback if the upload override is removed and the provider URL is still available.
   - Acceptance: Backend tests upload image A, replace it with image B, confirm current payloads reference B, confirm A is no longer served as the active profile picture, then remove B and confirm the user falls back to OAuth image or abstract identity data.

5. **Authorized visibility**: Uploaded profile pictures are visible only through authenticated user, direct-chat contact, chat member, online/contact, and start-chat/search responses that already expose user identity.
   - Current: `getAllUsers`, online users, and populated chat members can expose `profilePic`, but there is no explicit visibility boundary for uploaded user images.
   - Target: Other authenticated users can see a user's profile picture when that user appears in direct-chat contacts, chat members, online/contact payloads, or start-chat/search results; unauthenticated requests cannot fetch profile images or profile metadata.
   - Acceptance: Backend tests prove authenticated chat/contact/search surfaces include the profile image reference for authorized user discovery, while unauthenticated requests to profile-image routes fail and do not stream image bytes.

6. **Chat identity rendering**: The uploaded profile picture renders across all existing direct-chat identity surfaces, with `AbstractIdentityTile` retained as the fallback.
   - Current: `ChatSidebar`, `ChatListItem`, `ConversationHeader`, and `ConversationDetailContent` use abstract identity tiles and do not render existing `profilePic` images.
   - Target: The current account sidebar, chat list rows, conversation header, conversation detail rail/drawer, and new-chat/contact results render the profile image when a valid image reference is available; they render the existing abstract tile when no image exists or image loading fails.
   - Acceptance: Frontend component tests cover each listed surface with a user-uploaded image, no image, and failed image load, and assert that layout remains stable and fallback identity is present when needed.

7. **Cache and propagation behavior**: After a user changes their profile picture, the current user sees the change immediately and other users see it after normal chat/contact/query refresh without requiring a full page reload.
   - Current: Auth state, chat data, and online presence are cached through Zustand and TanStack Query, but there is no profile-picture mutation or invalidation contract.
   - Target: Profile picture changes update the current auth user state and invalidate or refresh chat, online/contact, and relevant user-search data so direct-chat peers can see the updated image through normal app data flow. A dedicated socket event is not required for Phase 16.
   - Acceptance: Frontend integration tests prove the upload success path updates the current user's sidebar image and invalidates/refetches chat/contact queries; an end-to-end flow proves Account B sees Account A's changed image after app-level refresh/refetch without browser restart.

8. **Privacy and logging controls**: Profile picture upload, replace, remove, and fetch behavior follows the project's private-messenger security posture.
   - Current: Unsafe user routes and upload handling are security-sensitive, and Phase 1 CSRF/security foundation remains pending; message uploads have rate limiting and private metadata tests.
   - Target: Profile picture unsafe methods are authenticated and protected by active CSRF handling or a documented safe exemption, rate limited, and logged without emails, raw filenames where unnecessary, storage ids, hashes, file contents, tokens, or cookie metadata.
   - Acceptance: Backend/security tests or verification evidence prove unauthenticated requests are rejected, unsafe methods include CSRF coverage or explicit exemption evidence, upload rate limiting exists, and logs/errors do not expose profile image internals or user-identifying secrets.

9. **Real evidence, no fixture regression**: Phase 16 acceptance proves real user-uploaded profile images without reintroducing static avatar/demo fixtures into production chat runtime.
   - Current: Existing fixture leak guards intentionally reject static visual fixture terms such as profile photo/avatar to prevent fake production identity content.
   - Target: The guardrails are updated only enough to allow real Phase 16 profile-picture runtime behavior and tests, while still failing if static demo avatars, fixture names, or private storage internals ship in production chat runtime.
   - Acceptance: Fixture leak guard tests continue to fail on static demo avatar/profile fixture content, but pass for the real profile picture components/routes introduced by Phase 16.

## Boundaries

**In scope:**
- Authenticated profile picture upload from the user's PC through Settings.
- Local preview before submit, replace existing user-uploaded image, and remove uploaded image.
- PNG, JPEG/JPG, and WebP profile image validation with a 2 MB limit.
- Server-owned storage/access metadata that avoids raw storage leaks.
- Current account, chat list, conversation header, conversation detail rail/drawer, and contact/search identity rendering.
- Abstract identity fallback for no image, removed image, or failed image load.
- Auth/query cache refresh so current user and direct-chat peers see updated identity imagery through normal app data flow.
- Backend, frontend, and end-to-end verification for upload, visibility, fallback, privacy, and fixture guard behavior.

**Out of scope:**
- Crop, zoom, rotate, filters, or an image editor - this phase locks upload/replace/remove behavior only.
- Signup-time profile picture upload - unauthenticated pre-account file lifecycle is separate risk.
- Group chat images or group identity editing - the requested feature is user profile pictures.
- Voice messages, general attachment progress, shared media truth, or broader Phase 12 media scope - those are adjacent roadmap areas.
- Immediate socket broadcast as a required realtime contract - normal refetch/query propagation is sufficient for this phase.
- Public unauthenticated profile pages or globally browsable profile pictures - private messenger identity remains scoped to authenticated app surfaces.
- End-to-end encryption, moderation tooling, image scanning services, or content review workflows - important later but outside this phase's minimum deliverable.
- Production readiness claims for all deployed messenger behavior - live production acceptance remains governed by the production gate phases.

## Constraints

- Keep the existing MERN stack: React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, and npm package layout.
- Preserve existing chat behavior and do not overwrite unrelated local work in `Frontend/Chatify/src/pages/chat/chat.tsx` during planning/spec work.
- Profile pictures are personal data: collect only the image needed for identity display, allow removal, avoid leaking storage internals, and avoid logging PII or image metadata unnecessarily.
- Profile picture upload must be authenticated, bounded, and rate limited; unsafe cookie-authenticated methods require active CSRF handling or explicit documented exemption evidence.
- Uploaded profile pictures must not use the broad 10 MB message attachment contract; avatar-specific validation is PNG/JPEG/WebP only and max 2 MB.
- UI controls must be accessible: labeled file input/control, keyboard-operable upload/remove actions, meaningful alt/aria labels, and non-overlapping fallback states across desktop and mobile.
- Existing abstract identity tiles remain the fallback and must not be removed as part of this phase.

## Acceptance Criteria

- [ ] A signed-in user can select a PNG/JPEG/WebP image from their PC in Settings, preview it, submit it, and see their current account identity image update without signing out.
- [ ] A signed-in user can replace the image; payloads and UI show the new image, and the old uploaded image is no longer active or served as the current profile picture.
- [ ] A signed-in user can remove the uploaded image and return to OAuth image fallback if available or the abstract identity tile otherwise.
- [ ] Backend validation rejects empty, oversized, unsupported, mislabeled, GIF, PDF, and executable uploads without changing the current profile picture.
- [ ] Profile image responses never expose raw storage ids, bucket names, object keys, hashes, private filesystem paths, tokens, cookies, or user emails in client payloads or logs.
- [ ] Unauthenticated profile-picture upload, remove, and fetch attempts fail without streaming image bytes or leaking whether a private uploaded image exists.
- [ ] Other authenticated users see the uploaded profile picture through direct-chat/contact/search identity surfaces after normal app refetch/query propagation, with no full browser restart required.
- [ ] Chat list, conversation header, conversation detail rail/drawer, current account sidebar, and contact/search UI render the uploaded image when available and `AbstractIdentityTile` when unavailable or failed.
- [ ] Frontend tests cover image, no-image, and failed-image fallback states without layout overlap or inaccessible controls.
- [ ] A two-account Playwright flow proves Account A uploads a profile picture from disk and Account B sees it on chat identity surfaces.
- [ ] Fixture leak guard coverage still blocks static demo avatars/profile-photo fixtures and private storage internals from production chat runtime while allowing real Phase 16 profile-picture code.

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes |
|--------------------|-------|-------|--------|-------|
| Goal Clarity       | 0.95  | 0.75  | met    | Upload, replace, remove, visibility, and fallback are locked. |
| Boundary Clarity   | 0.96  | 0.70  | met    | Crop editor, signup upload, group images, broader media/voice, and socket broadcast are explicitly out of scope. |
| Constraint Clarity | 0.90  | 0.65  | met    | File types, size, privacy, storage exposure, auth, CSRF/rate-limit, and accessibility constraints are explicit. |
| Acceptance Criteria| 0.92  | 0.70  | met    | Backend, frontend, fixture guard, and two-account E2E checks are pass/fail. |
| **Ambiguity**      | 0.06  | <=0.20| met    | Gate passed after user approved all recommendations. |

Status: met = meets minimum; below minimum = planner treats as assumption.

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today for profile pictures and uploads? | `profilePic` exists as a string and OAuth can fill it; no owned upload/remove flow exists; message attachments provide bounded upload/storage precedent. |
| 1 | Researcher | Which existing surfaces should show uploaded identity imagery? | Current account sidebar, chat list rows, conversation header, conversation detail rail/drawer, and contact/search results are required. |
| 2 | Simplifier | What is the smallest successful version? | Upload, preview, replace, remove, authorized visibility, and fallback only; no crop/zoom editor. |
| 2 | Simplifier | Where should the workflow live? | Settings modal, not signup or a new profile page. |
| 3 | Boundary Keeper | Who can see profile pictures? | Authenticated app surfaces that already expose identity: direct-chat contacts, chat members, online/contact payloads, and start-chat/search results. |
| 3 | Boundary Keeper | What is explicitly excluded? | Signup upload, group images, image editing, generic media/voice scope, public profile pages, and required socket broadcast. |
| 4 | Failure Analyst | What invalidates the feature? | Unsafe uploads, raw storage leaks, unauthenticated image access, stale UI after update, broken fallback, or static demo avatar fixture leakage. |
| 5 | Seed Closer | What constraints must be locked before planning? | PNG/JPEG/WebP only, max 2 MB, signature validation, authenticated/CSRF-aware/rate-limited unsafe methods, privacy-safe logging, and accessible controls. |
| 6 | Seed Closer | What evidence proves done? | Backend validation/privacy tests, frontend rendering/fallback tests, fixture guard tests, and a two-account Playwright upload/visibility flow. |

---

*Phase: 16-profile-picture-upload-and-shared-avatar-visibility*
*Spec created: 2026-06-16*
*Next step: $gsd-discuss-phase 16 - implementation decisions (how to build what's specified above)*
