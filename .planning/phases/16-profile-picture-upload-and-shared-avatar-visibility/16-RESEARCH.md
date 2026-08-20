---
phase: 16
artifact: research
status: complete
created: 2026-06-16
---

# Phase 16 Research: Profile Picture Upload And Shared Avatar Visibility

## Research Scope

Research covered the locked Phase 16 specification, the approved discussion context, current backend upload/storage/security patterns, current frontend Settings/avatar/query patterns, and the test surface needed to prove real uploaded profile images without weakening fixture guardrails.

## Skills Used

- `find-skills`: Required discovery skill. External searches were run for Express file uploads, React image uploads, and CSRF multipart uploads.
- `api-and-interface-design`: Used for route, payload, and response-boundary recommendations.
- `privacy-by-design`: Used for personal image minimization, access control, safe payloads, and logging boundaries.
- `frontend-accessibility`: Used for labelled upload controls, keyboard access, image alternative text, and fallback behavior.
- `csrf-protection`: Used for unsafe cookie-authenticated profile image route handling.
- `vitest`: Used for backend and frontend test strategy, mocking, and focused regression coverage.
- `mongodb-schema-design`: Used for User-owned metadata versus separate profile-image record tradeoffs.

External search notes:

- `npx skills find "express file upload multer gridfs"` returned generic upload candidates, but no candidate fit Chatify's existing GridFS, Express, and private identity surface better than local project patterns.
- `npx skills find "react image upload accessibility"` returned vendor or hosting-oriented skills, including Cloudinary-oriented guidance, which does not match the approved server-owned storage path.
- `npx skills find "csrf express multipart upload"` returned generic CSRF/security material, but the project-local `csrf-protection` skill and existing middleware are more directly applicable.

Recommendation: do not install an external skill for Phase 16. Use the verified local skills and existing Chatify upload/security code as the implementation source of truth.

## Current Implementation Map

### Backend Identity And Profile Data

- `Backend/Chatify/Models/userModel.mjs` has a single `profilePic` string today.
- `Backend/Chatify/Controller/authController.mjs` currently accepts `profilePic` from local signup input, which conflicts with the approved rule that local signup must not trust client-supplied profile picture sources.
- `Backend/Chatify/Config/passport.mjs` maps OAuth provider images into `profilePic`; Phase 16 needs this split into provider image metadata plus an uploaded override.
- `Backend/Chatify/Controller/userController.mjs` owns logged-user, all-users, online/contact, and privacy payloads. These are the main safe identity response surfaces for profile image references.
- `Backend/Chatify/Routes/userRouter.mjs` is protected by auth middleware and is the right home for profile-image upload/remove/fetch routes.

### Backend Upload, Storage, And Validation

- `Backend/Chatify/Services/attachmentStorageService.mjs` proves a GridFS service pattern, but its bucket and lifecycle are message-attachment specific.
- `Backend/Chatify/Utils/attachmentValidation.mjs` proves signature validation, stable errors, size checks, and safe file metadata handling.
- `Backend/Chatify/Controller/messageController.mjs` proves multer memory upload handling and cleanup on metadata failure.
- `Backend/Chatify/Middlewares/rateLimiters.mjs` already has upload limiter precedent, but profile images need a dedicated smaller-scope limiter.

Recommendation: create a dedicated profile-image storage service and validation utility, using attachment code as a pattern only. Do not reuse the message attachment bucket, 10 MB limit, broad media type list, or user-visible metadata.

### Backend Security And CSRF

- `Backend/Chatify/app.mjs` mounts `csrfProtection` on `/api/auth`.
- `/api/user` currently mounts separately without route-wide CSRF protection.
- `Backend/Chatify/Middlewares/csrfProtection.mjs` uses the existing double-submit token/header pattern for unsafe methods.
- `Frontend/Chatify/src/api/axios.ts` already attaches `X-CSRF-Token` on unsafe requests when the cookie exists.

Recommendation: protect profile-picture upload/remove unsafe methods with the existing CSRF flow. If multipart parsing blocks header-based CSRF in implementation, the executor must document the exact blocker and add a narrower verified exemption rather than silently skipping CSRF.

### Frontend Settings And Identity Surfaces

- `Frontend/Chatify/src/components/SettingsModal.tsx` currently handles sound, Enter-to-send, and theme settings only.
- `Frontend/Chatify/src/pages/chat/components/AbstractIdentityTile.tsx` is the canonical deterministic fallback.
- `ChatSidebar`, `ChatListItem`, `ConversationHeader`, `ConversationDetailContent`, and `NewChatDialog` currently render abstract identity tiles directly.
- `Frontend/Chatify/src/api/userApi.ts` has no profile-image upload/remove methods.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` exposes chat and online presence query keys that should be invalidated after upload/remove.
- `Frontend/Chatify/src/store/authstore.ts` owns immediate current-user state.

Recommendation: add a small API method set and focused mutation hook, then keep `SettingsModal` as a consumer of that hook. Add a reusable `UserAvatar` wrapper so image/fallback/error-load behavior is not duplicated across chat identity surfaces.

### Existing Tests And Guardrails

- Backend attachment tests already cover validation, cleanup, authorization, and private serving patterns.
- Frontend component tests currently assert abstract identity rendering in several places and will need to be updated to cover profile image, missing image, and failed image load paths.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` intentionally blocks static avatar/profile fixture language and storage internals.
- `Frontend/Chatify/src/test/chatFixtures.ts` currently includes profile picture fixture values and needs careful narrowing so real runtime profile pictures are allowed without reopening static demo-avatar leakage.

Recommendation: update guardrails by file/path allowlist and explicit forbidden storage terms, not by broadly removing avatar/profile image checks.

## Research Findings

1. User-owned profile image metadata should live with the User for Phase 16.
   - Profile image state is one-to-one with the user and always co-accessed with identity payloads.
   - A separate profile image collection can be added later if moderation, audit history, or multi-image lifecycle becomes necessary.
   - Recommendation: embed uploaded profile-image metadata on `User`, while storing bytes in a dedicated server-owned GridFS bucket/service.

2. `profilePic` should remain the safe display field during migration.
   - Existing backend and frontend payloads already understand `profilePic`.
   - Recommendation: keep `profilePic` as an effective safe URL/string in API responses, but separate persisted provider image and uploaded image metadata internally.

3. OAuth provider images and user uploads need explicit precedence.
   - OAuth images should not be destroyed by upload.
   - Recommendation: uploaded image override wins while present; removal clears the override and falls back to the stored provider image if available.

4. Upload validation should be narrower than message attachments.
   - The attachment stack proves the pattern but accepts broader types and larger sizes.
   - Recommendation: create `profileImageValidation` with PNG, JPEG/JPG, WebP only, non-empty buffers, signature validation, 2 MB max, stable client-facing errors, and no acceptance of GIF/PDF/executable mismatch cases.

5. Profile images need safe application URLs.
   - Raw GridFS ids, bucket names, hashes, object keys, private paths, and storage metadata are not acceptable in client payloads.
   - Recommendation: emit an authenticated app route such as `/api/user/:userId/profile-image?v=<version>`, with versioning derived from safe metadata and no raw storage id in the URL.

6. Authenticated fetch is sufficient for Phase 16 if URL emission stays controlled.
   - The app already exposes identity through authenticated chat/contact/search surfaces.
   - Recommendation: require authentication to fetch profile image bytes and emit URLs only in logged-user, chat-member, online/contact, and user-search/list responses. Do not add complex relationship-only image streaming in this phase unless those identity payloads are also narrowed.

7. `/api/user` unsafe route protection is a required implementation task.
   - Current CSRF placement does not automatically cover user routes.
   - Recommendation: add route-level CSRF protection to profile-image upload/remove routes and keep tests proving unsafe requests without CSRF fail.

8. Frontend propagation can use normal query invalidation.
   - A dedicated Socket.IO event is not required by the spec or context.
   - Recommendation: upload/remove success updates auth store immediately and invalidates auth, chats, online/contact, and user-search/list queries.

9. `chat.tsx` should not be edited unless execution proves it is unavoidable.
   - Existing child components are the right integration points.
   - Recommendation: implement `UserAvatar` in chat components and update direct child surfaces, preserving the protected chat route orchestrator file.

10. Acceptance needs a real local two-account flow.
    - Unit tests cannot prove another authenticated user sees the uploaded picture through real app data refresh.
    - Recommendation: add a generated-image Playwright flow that uploads from disk as Account A and verifies Account B sees the image after normal refetch/refresh, with a blocked artifact if local credentials/env are missing.

## Recommended Strategy

Build Phase 16 in four slices:

1. Backend profile image contract, storage, validation, lifecycle, route security, and backend tests.
2. Frontend Settings workflow, API methods, mutation hook, auth store update, and query invalidation tests.
3. Reusable `UserAvatar`, identity-surface migration, fallback/error-load tests, and fixture guard narrowing.
4. Full acceptance pass with local two-account Playwright evidence, privacy scans, lint/build, and planning evidence artifact.

This order keeps the server contract stable before UI work and prevents frontend tests from relying on speculative response shapes.

## Validation Architecture

Backend validation:

- Focused profile-image tests for successful PNG/JPEG/WebP upload.
- Negative tests for empty, oversized, PDF, GIF, executable, unsupported, and MIME/extension mismatch files.
- Replacement/removal lifecycle tests proving old uploaded image is no longer active and failed metadata persistence cleans up new uploads.
- Auth, CSRF, rate-limit, and private fetch tests.
- Response-shape tests proving storage internals and hashes are absent.

Frontend validation:

- Settings modal tests for select, preview, submit, remove, cancel/reset, loading, success, and error states.
- API/hook tests proving FormData usage, auth store update, and query invalidation.
- Identity-surface tests for image present, no image, and image load failure.
- Fixture leak guard tests that still block demo avatar fixtures and storage internals.

End-to-end validation:

- Local two-account Playwright flow with generated small image assets.
- Account A uploads/replaces/removes from Settings.
- Account B sees the changed image through existing identity surfaces after normal app-level refetch/refresh.
- Evidence artifact records commands, environment gates, and redacted outcomes.

## Risks And Mitigations

- Risk: Multipart CSRF integration may be sensitive to middleware order.
  - Mitigation: prefer header-based CSRF before or alongside multer parsing; add explicit tests for missing and valid CSRF token cases.
- Risk: Existing fixture guard blocks legitimate Phase 16 code.
  - Mitigation: narrow by allowlisted runtime components/routes and keep forbidden static fixture/storage terms active.
- Risk: Updating chat identity surfaces could drift into a broad UI rewrite.
  - Mitigation: add `UserAvatar` and replace only identity-rendering call sites; keep layout and behavior otherwise unchanged.
- Risk: Provider image migration could break OAuth users.
  - Mitigation: add tests for uploaded override, removal fallback, and existing provider URL compatibility.
- Risk: Query invalidation could miss one identity surface.
  - Mitigation: centralize invalidation in the profile image hook and include auth, chats, online/contact, and user search/list queries in tests.

## Research Complete

Phase 16 is ready for implementation planning. The recommended plan structure is four dependent slices: backend contract, Settings mutation flow, avatar surface rendering, and acceptance evidence.
