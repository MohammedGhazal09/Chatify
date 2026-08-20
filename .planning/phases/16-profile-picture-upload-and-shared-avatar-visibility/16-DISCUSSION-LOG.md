# Phase 16: Profile Picture Upload And Shared Avatar Visibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 16-profile-picture-upload-and-shared-avatar-visibility
**Areas discussed:** storage and data model, OAuth fallback, URL and authorization boundary, validation, lifecycle, CSRF/rate limits/logging, Settings workflow, identity rendering, cache propagation, fixture guard, evidence, repository hygiene

---

## User Answer

The user approved all recommendations from the one-shot Phase 16 questionnaire. All omitted choices were therefore locked to the recommended option.

---

## Storage And Data Model

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated profile-image storage | Use a separate GridFS bucket/service and profile-image metadata boundary. | yes |
| Reuse message attachment bucket directly | Store profile pictures alongside message attachments. | |

**User's choice:** Approved recommendation.
**Notes:** Keeps identity media lifecycle, limits, privacy, and cleanup separate from broad message attachments.

---

## User Record Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Structured metadata plus `profilePic` compatibility | Add uploaded/provider image metadata while keeping a client-safe display field. | yes |
| `profilePic` string only | Continue using one string for all image source types. | |

**User's choice:** Approved recommendation.
**Notes:** Preserves current frontend/backend payload compatibility while allowing safe storage ownership.

---

## OAuth Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Separate provider image source | Keep OAuth image data separate and restore it after uploaded image removal. | yes |
| Overwrite `profilePic` permanently | Treat OAuth and uploads as the same source. | |

**User's choice:** Approved recommendation.
**Notes:** Allows remove to return to OAuth image without losing provider data.

---

## Signup Input

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore or remove signup `profilePic` body input | Do not trust unauthenticated or pre-account client image strings. | yes |
| Keep accepting signup `profilePic` | Continue accepting arbitrary strings in signup. | |

**User's choice:** Approved recommendation.
**Notes:** Aligns with server-owned storage and private messenger security.

---

## Image URL And Fetch Authorization

| Option | Description | Selected |
|--------|-------------|----------|
| Authenticated app URL | Serve images through authenticated application routes with no raw storage leak. | yes |
| Raw storage URL/id | Expose backend storage internals or direct object references. | |

**User's choice:** Approved recommendation.
**Notes:** Unauthenticated requests must not stream image bytes. URL emission belongs to existing authorized identity payloads.

---

## Upload Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Avatar-specific validation | PNG/JPEG/WebP, signature check, non-empty, 2 MB max, stable errors. | yes |
| Reuse message attachment validation directly | Use broad attachment types and 10 MB size limit. | |

**User's choice:** Approved recommendation.
**Notes:** Message attachment validation is a pattern source, not the profile-image contract.

---

## Replacement And Removal Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Safe swap with cleanup | Upload new, update user metadata, clean old best-effort, clean new on DB failure. | yes |
| Simple overwrite | Replace current reference without cleanup guarantees. | |

**User's choice:** Approved recommendation.
**Notes:** Prevents old uploaded images from remaining active as the current profile picture.

---

## CSRF, Rate Limiting, And Logs

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit protected upload boundary | Authenticated routes, CSRF or documented exemption, dedicated limiter, redacted logs. | yes |
| Treat like ordinary user route | Add endpoints under `/api/user` without a new security decision. | |

**User's choice:** Approved recommendation.
**Notes:** `/api/user` is currently mounted separately from auth CSRF middleware, so unsafe routes need deliberate handling.

---

## Settings Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Add profile section inside Settings | Current image/fallback, choose, preview, save/change, remove, cancel, loading/error states. | yes |
| New profile page or signup upload | Move the workflow outside Settings. | |

**User's choice:** Approved recommendation.
**Notes:** Matches the locked SPEC and keeps signup upload out of scope.

---

## Image Editing Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Upload/replace/remove only | Interpret edit as profile-picture management, not image manipulation. | yes |
| Crop/zoom/filter editor | Add image editing tools. | |

**User's choice:** Approved recommendation.
**Notes:** Crop/editor tools are explicitly out of scope.

---

## Identity Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Reusable `UserAvatar` wrapper | Render image when present and fallback to `AbstractIdentityTile` on missing/failed load. | yes |
| Inline image logic per surface | Duplicate image/fallback behavior in each chat component. | |

**User's choice:** Approved recommendation.
**Notes:** Keeps behavior consistent across sidebar, list, header, details, and contact/search surfaces.

---

## Cache Propagation

| Option | Description | Selected |
|--------|-------------|----------|
| Mutation hook plus auth/query invalidation | Update auth store, invalidate auth/chats/online/contact/search data. | yes |
| Dedicated socket broadcast | Add realtime profile-image update events. | |

**User's choice:** Approved recommendation.
**Notes:** SPEC says no dedicated socket event is required for Phase 16.

---

## Fixture Guard

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow allowlist for real feature code | Permit real profile-picture implementation while still blocking static demo identity fixtures and storage internals. | yes |
| Disable guard broadly | Remove or loosen fixture leak checks. | |

**User's choice:** Approved recommendation.
**Notes:** Protects production runtime from fake identity imagery regressions.

---

## Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Backend, frontend, fixture guard, local two-account E2E | Use generated test images and local evidence. | yes |
| Production E2E required | Require deployed proof in Phase 16. | |

**User's choice:** Approved recommendation.
**Notes:** Production readiness remains governed by the production gate phases.

---

## Repository Hygiene

| Option | Description | Selected |
|--------|-------------|----------|
| Avoid `chat.tsx` unless required | Prefer reusable components and existing child surfaces. | yes |
| Patch route page directly by default | Put profile-image rendering logic in the large chat route file. | |

**User's choice:** Approved recommendation.
**Notes:** Preserves protected local work and keeps the implementation focused.

---

## the agent's Discretion

- Exact model/service names.
- Exact route names and response field names.
- Exact version/cache-busting strategy.
- Exact test helper names and Playwright selector strategy.
- Exact UI copy, provided it is accessible, stable, and matches the locked scope.

## Deferred Ideas

- Crop, zoom, rotate, filters, or full image editor.
- Signup-time profile picture upload.
- Group chat images.
- Public unauthenticated profile pages.
- Dedicated realtime socket broadcast for profile-picture changes.
- Production readiness claims for the deployed app.
- Image scanning/moderation and content review workflows.
