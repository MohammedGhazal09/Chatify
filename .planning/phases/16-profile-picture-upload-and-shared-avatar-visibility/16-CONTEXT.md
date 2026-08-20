# Phase 16: Profile Picture Upload And Shared Avatar Visibility - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 16 adds an authenticated profile picture workflow to Chatify. A signed-in user can select an image from their own PC in Settings, preview it, upload it, replace it, and remove it. Other authenticated users see that profile picture only through existing identity surfaces that already expose user identity, with the existing deterministic abstract identity tile retained as fallback.

The phase clarifies how to implement the locked SPEC. It does not add crop tools, signup-time upload, group images, broad media/voice scope, public profile pages, required socket broadcasts, or production-readiness claims.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**9 requirements are locked.** See `16-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `16-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Authenticated profile picture upload from the user's PC through Settings.
- Local preview before submit, replace existing user-uploaded image, and remove uploaded image.
- PNG, JPEG/JPG, and WebP profile image validation with a 2 MB limit.
- Server-owned storage/access metadata that avoids raw storage leaks.
- Current account, chat list, conversation header, conversation detail rail/drawer, and contact/search identity rendering.
- Abstract identity fallback for no image, removed image, or failed image load.
- Auth/query cache refresh so current user and direct-chat peers see updated identity imagery through normal app data flow.
- Backend, frontend, and end-to-end verification for upload, visibility, fallback, privacy, and fixture guard behavior.

**Out of scope (from SPEC.md):**
- Crop, zoom, rotate, filters, or an image editor.
- Signup-time profile picture upload.
- Group chat images or group identity editing.
- Voice messages, general attachment progress, shared media truth, or broader Phase 12 media scope.
- Immediate socket broadcast as a required realtime contract.
- Public unauthenticated profile pages or globally browsable profile pictures.
- End-to-end encryption, moderation tooling, image scanning services, or content review workflows.
- Production readiness claims for all deployed messenger behavior.

</spec_lock>

<decisions>
## Implementation Decisions

### Storage And Data Model
- **D-01:** Store uploaded profile pictures in a dedicated server-owned GridFS bucket or profile-image storage service, not in the existing message attachment bucket.
- **D-02:** Keep profile-image storage lifecycle separate from message attachment lifecycle, validation constants, and user-visible metadata.
- **D-03:** Add structured profile-image metadata for uploaded images while preserving `profilePic` as the client-safe display URL/string used by existing payloads during migration.
- **D-04:** Do not expose GridFS ids, bucket names, hashes, object keys, private paths, or raw storage metadata in user, chat, online, contact, search, or auth responses.

### OAuth And Profile Source Precedence
- **D-05:** Store OAuth/provider profile image data separately from user-uploaded image override data.
- **D-06:** Uploaded profile pictures supersede OAuth images while present.
- **D-07:** Removing a user-uploaded image restores the OAuth/provider image only if a provider image is still available; otherwise the UI falls back to `AbstractIdentityTile`.
- **D-08:** Local signup must not accept or trust client-supplied `profilePic` as an owned profile picture source.

### Image URL And Authorization Boundary
- **D-09:** Expose uploaded profile pictures through authenticated application URLs, such as a user-scoped profile-image route with a version/cache-busting query, rather than raw storage URLs.
- **D-10:** Profile-image fetch routes must require authentication and must not stream image bytes to unauthenticated requests.
- **D-11:** Use existing authorized identity surfaces to decide where profile-image URLs are emitted: logged-in user, direct-chat members, contact/online payloads, and start-chat/search results.
- **D-12:** Avoid a complex relationship-only image fetch policy unless the existing user discovery payloads are narrowed at the same time; otherwise authenticated route access plus controlled URL emission is the cleaner Phase 16 boundary.

### Upload Validation And Lifecycle
- **D-13:** Implement avatar-specific validation with PNG, JPEG/JPG, and WebP only, real file signature checks, non-empty buffers, a 2 MB maximum, and stable client-facing error messages.
- **D-14:** Use shared validation patterns from message attachments where they are safe, but do not reuse the broad 10 MB attachment type contract.
- **D-15:** Client-side validation should mirror size/type rules for quick feedback, but backend validation is authoritative.
- **D-16:** Replacement should upload the new image, persist the metadata/user reference, then delete or deactivate the old uploaded image best-effort.
- **D-17:** If user metadata persistence fails after a new image is uploaded, clean up the newly uploaded image so failed replacement does not leave orphaned active data.
- **D-18:** Remove should clear the uploaded-image override, delete or deactivate the uploaded file, and return the effective fallback image or abstract identity state.

### Security, CSRF, Rate Limits, And Logging
- **D-19:** Profile-picture upload, replace, remove, and unsafe metadata updates must be authenticated.
- **D-20:** Unsafe profile-picture methods must use the existing CSRF flow where feasible; if multipart CSRF integration is blocked, the exemption must be explicit, documented, and verified.
- **D-21:** Add a dedicated profile-image upload rate limiter instead of directly reusing message attachment limits.
- **D-22:** Logs and errors may include generic event names and redacted user identifiers, but must not include filenames where unnecessary, image bytes, storage ids, hashes, URLs, cookies, tokens, emails, or raw multipart metadata.
- **D-23:** Update `/api/user` unsafe-route security deliberately because current user routes are mounted without the auth router's CSRF middleware.

### Frontend Settings Workflow
- **D-24:** Add the profile-picture workflow inside the existing `SettingsModal`, not signup and not a new public profile page.
- **D-25:** Settings should show the current effective identity image/fallback, a labeled file picker or choose button, preview before submit, save/change, remove, cancel/reset, loading, success, and stable error states.
- **D-26:** Do not add crop, zoom, rotate, filters, or editor controls in Phase 16.
- **D-27:** Controls must be keyboard-operable, labelled for assistive technology, and stable on desktop and mobile.

### Identity Rendering
- **D-28:** Create a reusable `UserAvatar` or equivalent component that renders a profile image when present and falls back to `AbstractIdentityTile` on missing data or failed image load.
- **D-29:** Use that component across current account sidebar, chat list rows, conversation header, conversation detail rail/drawer, and contact/search rows instead of duplicating image/fallback behavior inline.
- **D-30:** Broken or denied image loads should fail closed to the abstract identity tile without retry loops or noisy UI.
- **D-31:** Preserve the existing deterministic abstract identity visual system as the fallback; do not remove or replace it.

### Cache And Propagation
- **D-32:** Add profile-image API methods under the frontend API layer, then consume them through a focused hook/mutation rather than calling Axios directly from components.
- **D-33:** On successful upload/remove, update the current auth store immediately and invalidate or refetch auth, chats, online/contact, and user-search/list query data.
- **D-34:** A dedicated Socket.IO profile-image event is not required in Phase 16; other users see changes through normal app refresh/refetch paths.

### Fixture Guard And Evidence
- **D-35:** Update fixture leak guardrails narrowly so real Phase 16 profile-picture code is allowed while static demo avatars, profile-photo fixtures, private storage internals, and fake visual identity content remain blocked.
- **D-36:** Verification must include backend validation/privacy tests, frontend Settings and identity-surface tests, fallback/error-load tests, fixture guard tests, and a local two-account Playwright flow using generated test images.
- **D-37:** Production E2E is not required for Phase 16; production readiness remains governed by production acceptance phases.

### Repository Hygiene
- **D-38:** Avoid direct edits to `Frontend/Chatify/src/pages/chat/chat.tsx` unless integration requires it; prefer reusable components and existing child component surfaces.
- **D-39:** Preserve unrelated local work and stage only Phase 16 planning or implementation files in focused commits.

### the agent's Discretion
- The planner/executor may choose exact model/service names, route names, response field names, version token format, storage metadata shape, test helper names, and UI copy if the decisions above and `16-SPEC.md` are preserved.
- The planner/executor may choose whether to implement profile-image metadata inline on `User` or through a dedicated profile-image model, as long as the user payload remains safe and storage internals are hidden.
- The planner/executor may choose exact cache invalidation query keys after reading the current hook/API structure, as long as auth, chats, online/contact, and user-search/list data refresh correctly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Phase Scope
- `.planning/phases/16-profile-picture-upload-and-shared-avatar-visibility/16-SPEC.md` - locked Phase 16 requirements, boundaries, constraints, and acceptance criteria. MUST read before planning.
- `.planning/phases/16-profile-picture-upload-and-shared-avatar-visibility/16-CONTEXT.md` - implementation decisions captured by this discussion.
- `.planning/ROADMAP.md` - Phase 16 position, dependency on Phase 15, and milestone context.
- `.planning/REQUIREMENTS.md` - ID-01, ID-02, SEC-01, SEC-02, TEST-01, TEST-04, TEST-05, and messenger baseline traceability.
- `.planning/PROJECT.md` - core value, brownfield constraints, no-subagent preference, repository hygiene, deployment references, and security posture.
- `.planning/STATE.md` - current continuity record, pending security foundation, production/live readiness blockers, and repository hygiene notes.

### Codebase Maps
- `.planning/codebase/STACK.md` - React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, npm, Vercel, and Render stack.
- `.planning/codebase/ARCHITECTURE.md` - HTTP/API/query/socket layering, controller/model responsibilities, and anti-patterns around page-owned transport logic.
- `.planning/codebase/CONVENTIONS.md` - TypeScript, ESM, naming, import, error handling, logging, and local style conventions.

### Backend Runtime And Tests
- `Backend/Chatify/Models/userModel.mjs` - existing `profilePic` field, OAuth ids, privacy fields, and JSON transform.
- `Backend/Chatify/Config/passport.mjs` - OAuth provider profile image population and current `profilePic` behavior.
- `Backend/Chatify/Controller/authController.mjs` - local signup currently reads `profilePic` from request body and must stop trusting it as a user-owned image.
- `Backend/Chatify/Controller/userController.mjs` - logged-user, all-users, online/contact, and privacy settings payloads that currently expose or should expose safe profile image references.
- `Backend/Chatify/Routes/userRouter.mjs` - protected user routes and the likely home for profile-image routes.
- `Backend/Chatify/app.mjs` - route mounting and current CSRF split between `/api/auth` and `/api/user`.
- `Backend/Chatify/Middlewares/csrfProtection.mjs` - existing CSRF token/header middleware.
- `Backend/Chatify/Middlewares/rateLimiters.mjs` - existing limiter pattern and attachment upload limiter precedent.
- `Backend/Chatify/Services/attachmentStorageService.mjs` - GridFS storage precedent; use as a pattern but keep profile storage separate.
- `Backend/Chatify/Utils/attachmentValidation.mjs` - file signature, extension, size, and stable error pattern precedent; adapt narrowly for profile images.
- `Backend/Chatify/Controller/messageController.mjs` - existing multer memory upload and cleanup flow for multipart requests.
- `Backend/Chatify/test/message/message.attachments.test.mjs` - backend upload/validation/cleanup test precedent.
- `Backend/Chatify/test/message/message.attachment-authorization.test.mjs` - authorization and private asset serving precedent.

### Frontend Runtime And Tests
- `Frontend/Chatify/src/components/SettingsModal.tsx` - existing Settings modal where profile-picture management should be added.
- `Frontend/Chatify/src/pages/chat/components/AbstractIdentityTile.tsx` - deterministic fallback identity component that must remain.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` - current account and chat list integration point.
- `Frontend/Chatify/src/pages/chat/components/ChatListItem.tsx` - chat row identity surface.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - selected conversation identity surface.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` - detail rail/drawer identity surface.
- `Frontend/Chatify/src/pages/chat/components/NewChatDialog.tsx` - start-chat/search/contact identity surface.
- `Frontend/Chatify/src/api/userApi.ts` - user API client to extend with profile-image upload/remove methods.
- `Frontend/Chatify/src/api/authApi.ts` - logged-user response and auth state refresh path.
- `Frontend/Chatify/src/hooks/useAuthQuery.ts` - auth store/query update pattern.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - `chatsQueryKey`, `onlinePresenceQueryKey`, and query invalidation patterns.
- `Frontend/Chatify/src/store/authstore.ts` - current user state that must update immediately after upload/remove.
- `Frontend/Chatify/src/types/auth.ts` - `User` type currently exposes `profilePic`.
- `Frontend/Chatify/src/types/chat.ts` - chat member/user payload contracts.
- `Frontend/Chatify/src/pages/chat/fixtureLeakGuard.test.ts` - static fixture and storage-internal guard that must be updated narrowly.
- `Frontend/Chatify/src/test/chatFixtures.ts` - test fixture profile image values that may need careful adjustment to keep production runtime clean.

### Supporting Skills Used For Discussion
- `C:/Users/saieh/.agents/skills/find-skills/SKILL.md` - required skill discovery workflow; external searches did not produce a better install candidate for this approved Chatify-specific path.
- `C:/Users/saieh/.codex/skills/gsd-discuss-phase/SKILL.md` - one-shot questionnaire and context-writing workflow.
- `C:/Users/saieh/.agents/skills/api-and-interface-design/SKILL.md` - API surface and contract decision support.
- `C:/Users/saieh/.agents/skills/privacy-by-design/SKILL.md` - profile image privacy, minimization, access, and logging decisions.
- `C:/Users/saieh/.agents/skills/frontend-accessibility/SKILL.md` - accessible upload controls and identity image/fallback rendering.
- `D:/Projects/Chatify/.agents/skills/vitest/SKILL.md` - backend/frontend test strategy support.
- `D:/Projects/Chatify/.agents/skills/csrf-protection/SKILL.md` - unsafe cookie-authenticated route protection support.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Backend/Chatify/Services/attachmentStorageService.mjs`: Provides a focused GridFS upload/open/delete pattern. Phase 16 should reuse the shape but use a profile-image bucket/service boundary.
- `Backend/Chatify/Utils/attachmentValidation.mjs`: Provides signature-based type validation, size checks, stable error payloads, and display-name sanitization. Phase 16 should adapt the pattern for PNG/JPEG/WebP and 2 MB only.
- `Backend/Chatify/Controller/messageController.mjs`: Shows multer memory upload handling and cleanup behavior for multipart requests.
- `Backend/Chatify/Middlewares/rateLimiters.mjs`: Shows the existing `express-rate-limit` pattern for adding a dedicated profile-image limiter.
- `Frontend/Chatify/src/pages/chat/components/AbstractIdentityTile.tsx`: Stable fallback identity component with variants and accessible role/label behavior.
- `Frontend/Chatify/src/components/SettingsModal.tsx`: Existing modal, theme, sound, and Enter-to-send settings surface where profile-picture management should be added.
- `Frontend/Chatify/src/hooks/useChatQueries.ts`: Exposes query keys and invalidation patterns for chats, online presence, messages, shared assets, and pinned messages.
- `Frontend/Chatify/src/store/authstore.ts`: Central current-user/auth state updated by auth hooks.

### Established Patterns
- Backend routes are thin and call controller functions; profile-image behavior should live in controller/service/utility modules, not in `Routes/*.mjs`.
- Backend async handlers should use `asyncErrHandler` and operational failures should use `CustomError`.
- API clients belong under `Frontend/Chatify/src/api`; components should not call Axios directly.
- Server state and mutation side effects belong in hooks; Settings should consume a focused hook or mutation rather than owning query invalidation details.
- Frontend identity surfaces already use `AbstractIdentityTile`; profile images should be layered on top with fallback, not a replacement visual system.
- Fixture guardrails intentionally block static identity imagery and private storage terms from chat runtime. Phase 16 must update these only for real runtime profile-picture code.
- CSRF is currently mounted on `/api/auth`, while `/api/user` is mounted separately. Unsafe profile-image routes need explicit security planning.

### Integration Points
- Add backend profile-image upload/remove/fetch endpoints under protected user routing.
- Add profile-image storage and validation modules alongside existing backend services/utils.
- Adjust `User` schema and OAuth handling to separate provider image from uploaded profile-image override.
- Update logged-user, chat member, online/contact, and user-search/list responses to emit safe effective profile image references.
- Add frontend user API methods and a profile-image mutation hook that updates auth state and invalidates relevant query keys.
- Add a reusable `UserAvatar` component and migrate identity surfaces from direct `AbstractIdentityTile` usage where profile images should render.
- Update Settings modal tests and identity-surface tests for image, no-image, and failed-load fallback states.
- Add a local two-account Playwright flow with generated image files to prove cross-user visibility after normal app refetch.
- Avoid direct edits to `Frontend/Chatify/src/pages/chat/chat.tsx` unless routing/integration requires it.

</code_context>

<specifics>
## Specific Ideas

- The user approved all recommendations from the Phase 16 one-shot discussion questionnaire on 2026-06-16.
- The user asked for the ability to edit/upload a profile picture from their own PC and for other users to see it.
- The approved interpretation of "edit" is upload, preview, replace, and remove. Image crop/zoom/filter editing remains outside Phase 16.
- External skill search was tried for file-upload/profile-image topics, but the results did not fit this server-owned Chatify storage path well enough to install. The verified local skills listed in canonical refs are the guidance set for this phase.

</specifics>

<deferred>
## Deferred Ideas

- Crop, zoom, rotate, filters, or full image editor.
- Signup-time profile picture upload.
- Group chat images or group identity editing.
- Public unauthenticated profile pages or globally browsable profile images.
- Dedicated realtime socket broadcast for profile-picture changes.
- Production readiness claims for the deployed app.
- Image scanning/moderation services and content review workflows.
- End-to-end encryption implications for profile media.

</deferred>

---

*Phase: 16-profile-picture-upload-and-shared-avatar-visibility*
*Context gathered: 2026-06-16*
