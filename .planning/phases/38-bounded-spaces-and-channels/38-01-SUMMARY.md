---
phase: 38-bounded-spaces-and-channels
plan: 01
subsystem: backend
tags: [express, mongoose, socket-io, spaces, channels, privacy]
requires:
  - phase: 37-rich-profiles-and-presence-privacy
    provides: public profile identity and presence privacy rules reused by space member serialization
provides:
  - Private Space persistence with owner/admin/member roles
  - Chat-backed space channel metadata with default channel creation
  - Space membership routes with username-only add/remove controls
  - Privacy-safe space and channel serialization without email exposure
  - Backend regression tests for space contracts and membership authorization
affects: [phase-38, backend-api, chat-model, message-authorization, frontend-spaces]
tech-stack:
  added: []
  patterns:
    - Chat-backed channel records distinguished by isSpaceChannel and space metadata
    - Public identity serialization shared by space member and channel responses
key-files:
  created:
    - Backend/Chatify/Models/spaceModel.mjs
    - Backend/Chatify/Utils/spaceAccess.mjs
    - Backend/Chatify/Controller/spaceController.mjs
    - Backend/Chatify/Routes/spaceRouter.mjs
    - Backend/Chatify/test/space/space.contract.test.mjs
    - Backend/Chatify/test/space/space.membership.test.mjs
  modified:
    - Backend/Chatify/Models/chatModel.mjs
    - Backend/Chatify/Controller/chatController.mjs
    - Backend/Chatify/app.mjs
    - Backend/Chatify/test/helpers/authAgent.mjs
key-decisions:
  - "Space channels are represented as chat records with isSpaceChannel metadata so message authorization can continue to use chat membership."
  - "The first bounded version uses username-based member adds only; email identifiers are rejected and never serialized."
  - "Space channels are excluded from the normal conversation list so frontend workspace work can present them separately."
patterns-established:
  - "Space roles: owner/admin/member, with owner/admin server-side checks for membership and channel mutations."
  - "Default channel: creating a space creates an all-member general channel."
requirements-completed: [V2-SPACE-01, V2-SPACE-02, V2-PROF-02, V2-PRES-02, TEST-02]
duration: 47 min
completed: 2026-06-21
---

# Phase 38 Plan 01: Backend Space And Channel Data Contract Summary

**Private spaces with owner/admin/member roles, default chat-backed channels, and username-only membership controls**

## Performance

- **Duration:** 47 min
- **Started:** 2026-06-21T01:58:00+03:00
- **Completed:** 2026-06-21T02:45:20+03:00
- **Tasks:** 5
- **Files modified:** 10

## Accomplishments

- Added a `Spaces` model with owner/admin/member roles, member limits, owner invariants, and explicit default-channel linkage.
- Extended `Chats` with `isSpaceChannel`, `space`, channel name/key/description metadata, and a per-space channel uniqueness index.
- Added protected `/api/space` routes for create, list, detail, add/remove member, create channel, and list channels.
- Reused chat membership as the channel authorization boundary and removed space channels from the regular conversation list.
- Added backend tests proving private listing, default channel creation, username-only membership, role checks, removal access revocation, channel limits, and no email serialization.

## Task Commits

Current checkout contains an active uncommitted multi-phase worktree, so this plan was closed locally without creating isolated per-task commits. The authoritative evidence is the current worktree plus the verification commands below.

## Files Created/Modified

- `Backend/Chatify/Models/spaceModel.mjs` - Space persistence, roles, limits, and membership invariants.
- `Backend/Chatify/Utils/spaceAccess.mjs` - Space/channel validation, role helpers, and privacy-safe serializers.
- `Backend/Chatify/Controller/spaceController.mjs` - Space API behavior, membership mutation, channel creation, and socket notifications.
- `Backend/Chatify/Routes/spaceRouter.mjs` - Protected space route definitions.
- `Backend/Chatify/Models/chatModel.mjs` - Chat-backed space-channel metadata and validation.
- `Backend/Chatify/Controller/chatController.mjs` - Excludes space channels from standard conversation listing.
- `Backend/Chatify/app.mjs` - Mounts `/api/space` behind auth and CSRF protection.
- `Backend/Chatify/test/helpers/authAgent.mjs` - Adds automatic CSRF coverage for space routes in tests.
- `Backend/Chatify/test/space/space.contract.test.mjs` - Contract tests for creation, privacy, metadata access, and limits.
- `Backend/Chatify/test/space/space.membership.test.mjs` - Membership and removal tests.

## Decisions Made

- Used chat-backed channels rather than a separate channel message store. This keeps Phase 38 aligned with existing message, unread, attachment, reaction, and socket room behavior.
- Kept channel membership all-space-member for this first version. Private channel overrides remain deferred because the Phase 38 spec only requires bounded text channels.
- Returned generic not-found/member-update errors for unauthorized or missing space resources to avoid leaking private space membership.

## Deviations from Plan

None - plan executed within the planned backend data-contract scope.

## Issues Encountered

- Populated `Space.owner` and `Space.members.user` documents needed id-normalization in model validation. Fixed by resolving populated refs through `_id` before comparing owner/member invariants.
- `rg` was unavailable under the managed filesystem context in one search attempt. Used targeted file reads and tests instead.

## Verification

- `npm test -- space.contract.test.mjs space.membership.test.mjs` from `Backend/Chatify` - passed, 2 files, 7 tests.
- `npm test -- chat.group.test.mjs message.mutations.test.mjs` from `Backend/Chatify` - passed, 2 files, 12 tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 38-02 can now wire space channels into message, unread, realtime, notification, and moderation contracts using the `isSpaceChannel` chat metadata and existing channel membership records.

---
*Phase: 38-bounded-spaces-and-channels*
*Completed: 2026-06-21*
