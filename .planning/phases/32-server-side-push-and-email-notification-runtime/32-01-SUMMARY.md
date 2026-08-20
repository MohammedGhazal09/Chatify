---
phase: 32-server-side-push-and-email-notification-runtime
plan: 01
subsystem: backend
tags: [notifications, preferences, outbox, privacy, csrf]
requires:
  - phase: 30-external-notifications-and-platform-expansion
    provides: notification runtime design and privacy defaults
  - phase: 31-admin-moderation-ui-and-enforcement-workflow
    provides: current safety and block-state baseline
provides:
  - Server-owned notification preference API
  - Push subscription storage contract
  - Notification outbox model and message enqueue hook
affects: [notifications, messages, user-settings, privacy]
tech-stack:
  added: [web-push]
  patterns: [durable outbox, generic notification templates, CSRF-protected preferences]
key-files:
  created:
    - Backend/Chatify/Models/notificationOutboxModel.mjs
    - Backend/Chatify/Utils/notificationPreferences.mjs
    - Backend/Chatify/Utils/notificationTemplates.mjs
    - Backend/Chatify/test/notification/notification.preferences.test.mjs
    - Backend/Chatify/test/notification/notification.outbox.test.mjs
  modified:
    - Backend/Chatify/Models/userModel.mjs
    - Backend/Chatify/Controller/userController.mjs
    - Backend/Chatify/Routes/userRouter.mjs
    - Backend/Chatify/Controller/messageController.mjs
key-decisions:
  - "Backend owns external notification preferences; local sound/browser alerts remain device preferences."
  - "Message retries repair existing side effects but do not enqueue external notification jobs."
patterns-established:
  - "External notification eligibility is checked before outbox insertion."
  - "Outbox dedupe key uses recipient, message, channel, and push endpoint hash."
requirements-completed: [V2-NOTF-01, V2-NOTF-02, BLOCK-02, SEC-02, TEST-05]
duration: 1h 05m
completed: 2026-06-20
---

# Phase 32 Plan 01: Backend Preferences And Outbox Contract Summary

**Server-owned notification preferences and a privacy-safe outbox now gate external delivery before provider execution**

## Performance

- **Duration:** 1h 05m
- **Started:** 2026-06-20T20:50:00Z
- **Completed:** 2026-06-20T21:55:00Z
- **Tasks:** 6
- **Files modified:** 11

## Accomplishments

- Added authenticated, CSRF-protected notification preference, email unsubscribe, and push subscription APIs.
- Added notification preference persistence on `User` with push subscription internals stripped from serialized user payloads.
- Added `NotificationOutbox` with dedupe, status, attempts, provider result, and sanitized payload fields.
- Hooked new-message creation into outbox enqueue only for newly created messages, not idempotent retry repairs.
- Covered preference defaults/updates, push endpoint secrecy, mute/block suppression, generic payloads, and retry dedupe.

## Task Commits

Inline execution in this Codex session; no per-task commits were created before this summary.

## Files Created/Modified

- `Backend/Chatify/Models/notificationOutboxModel.mjs` - durable outbox schema and indexes.
- `Backend/Chatify/Utils/notificationPreferences.mjs` - preference serialization, patch validation, push endpoint hashing.
- `Backend/Chatify/Utils/notificationTemplates.mjs` - generic notification copy.
- `Backend/Chatify/Models/userModel.mjs` - server notification preferences and safe serialization.
- `Backend/Chatify/Controller/userController.mjs` - preference and push subscription handlers.
- `Backend/Chatify/Routes/userRouter.mjs` - protected notification routes.
- `Backend/Chatify/Controller/messageController.mjs` - outbox enqueue on new message creation.
- `Backend/Chatify/test/notification/*.test.mjs` - focused backend regression coverage.

## Decisions Made

- Keep preview mode stored as `none` only for Phase 32.
- Treat email resubscribe as clearing authenticated unsubscribe state.
- Store push endpoints only in the user subscription subdocument and reference outbox jobs by endpoint hash.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Email resubscribe initially left unsubscribe state active**
- **Found during:** Code review
- **Issue:** Re-enabling email notifications could leave `emailUnsubscribedAt` set, causing the user to appear opted in while delivery stayed suppressed.
- **Fix:** Preference PATCH now unsets `emailUnsubscribedAt` when `emailNotificationsEnabled` is set true; backend test covers unsubscribe then resubscribe.
- **Files modified:** Backend/Chatify/Controller/userController.mjs, Backend/Chatify/test/notification/notification.preferences.test.mjs
- **Verification:** `npm test -- notification.preferences.test.mjs notification.outbox.test.mjs notification.delivery.test.mjs`

**Total deviations:** 1 auto-fixed (missing critical). **Impact:** Strengthened opt-in correctness without widening scope.

## Issues Encountered

- One focused backend rerun hit a transient local MongoDB `ENOBUFS` connection error. Immediate retry passed, and full `npm run quality` passed afterward.

## User Setup Required

None for local dry-run verification. Real push delivery requires VAPID values in backend/frontend env files.

## Next Phase Readiness

Plan 02 can process the outbox through dry-run or configured providers without changing message creation again.

---
*Phase: 32-server-side-push-and-email-notification-runtime*
*Completed: 2026-06-20*
