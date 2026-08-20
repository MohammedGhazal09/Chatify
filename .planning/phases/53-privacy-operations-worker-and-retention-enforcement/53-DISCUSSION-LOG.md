---
phase: 53
created: 2026-07-01
---

# Phase 53 Discussion Log

## Decisions

- Use a backend worker rather than a user-triggered destructive endpoint.
- Preserve chats, messages, spaces, and moderation records by anonymizing the user profile and login identifiers instead of hard-deleting referenced records.
- Store operation evidence as aggregate run counts and request-level event metadata only.
- Add admin visibility as diagnostics, not a manual deletion console.
- Treat old notification outbox payloads as privacy-sensitive retention data and clean terminal rows after a bounded retention window.

## Recommendations

- Before production launch, configure `PRIVACY_WORKER_INTERVAL_MS` explicitly and run a one-time staging dry run against copied data.
- Add provider-backup deletion timing to the public privacy policy because app code cannot purge Render/MongoDB backups directly.
- Keep deletion processing observable through aggregate counts rather than individual-user identifiers in admin UI.
