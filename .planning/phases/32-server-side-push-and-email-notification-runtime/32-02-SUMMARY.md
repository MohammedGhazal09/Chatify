---
phase: 32-server-side-push-and-email-notification-runtime
plan: 02
subsystem: backend
tags: [notifications, worker, brevo, web-push, observability]
requires:
  - phase: 32-server-side-push-and-email-notification-runtime
    provides: notification outbox jobs
provides:
  - Dry-run notification delivery
  - Email and web-push provider boundaries
  - Bounded outbox processor and worker startup
affects: [notifications, operations, provider-config]
tech-stack:
  added: [web-push]
  patterns: [dry-run providers, sanitized provider failures, bounded retries]
key-files:
  created:
    - Backend/Chatify/Services/notificationService.mjs
    - Backend/Chatify/test/notification/notification.delivery.test.mjs
  modified:
    - Backend/Chatify/Services/emailService.mjs
    - Backend/Chatify/server.mjs
    - Backend/Chatify/.env.example
    - Backend/Chatify/package.json
    - Backend/Chatify/package-lock.json
key-decisions:
  - "Local/test notification processing uses dry-run delivery instead of provider network calls."
  - "Production missing provider config fails closed with sanitized retry/failure state."
patterns-established:
  - "Provider delivery returns normalized provider/status values for outbox persistence."
  - "Worker startup is disabled in tests and configurable by env."
requirements-completed: [V2-NOTF-01, V2-NOTF-03, V2-PLAT-03, SEC-02, PROD-04]
duration: 50m
completed: 2026-06-20
---

# Phase 32 Plan 02: Provider Worker And Sanitized Delivery Outcomes Summary

**Notification outbox jobs now process through dry-run, Brevo email, or web-push provider boundaries with sanitized outcomes**

## Performance

- **Duration:** 50m
- **Started:** 2026-06-20T21:55:00Z
- **Completed:** 2026-06-20T22:45:00Z
- **Tasks:** 5
- **Files modified:** 7

## Accomplishments

- Added `processNotificationOutbox` with bounded batch size, attempts, retry backoff, sent/failed state, and sanitized provider errors.
- Added dry-run delivery for test/local environments.
- Extended Brevo email transport behind a generic notification email method.
- Added web-push provider configuration and VAPID env documentation.
- Started the worker from backend server startup while disabling it in tests.

## Task Commits

Inline execution in this Codex session; no per-task commits were created before this summary.

## Files Created/Modified

- `Backend/Chatify/Services/notificationService.mjs` - enqueue, provider delivery, processor, and worker.
- `Backend/Chatify/Services/emailService.mjs` - shared Brevo transport and generic notification email.
- `Backend/Chatify/server.mjs` - worker startup.
- `Backend/Chatify/.env.example` - dry-run, worker, and VAPID env documentation.
- `Backend/Chatify/package.json` / `package-lock.json` - `web-push` dependency.
- `Backend/Chatify/test/notification/notification.delivery.test.mjs` - delivery dry-run and missing-config failure tests.

## Decisions Made

- Use `CHATIFY_NOTIFICATION_DRY_RUN=1`/non-production/test to avoid provider calls in local evidence.
- Record push subscriptions in the user record and reference them from outbox jobs by endpoint hash.
- Keep provider error persistence intentionally compact and sanitized.

## Deviations from Plan

None - plan executed as specified after the Plan 01 resubscribe fix.

## Issues Encountered

None.

## User Setup Required

For production push delivery, configure `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and frontend `VITE_VAPID_PUBLIC_KEY`. For production email delivery, existing `EMAIL_USER_SENDER` and `BREVO_API_KEY` remain required.

## Next Phase Readiness

Plan 03 can expose the server preferences and push subscription contract in the existing Settings modal.

---
*Phase: 32-server-side-push-and-email-notification-runtime*
*Completed: 2026-06-20*
