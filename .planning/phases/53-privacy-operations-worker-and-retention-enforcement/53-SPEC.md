---
phase: 53
name: Privacy Operations Worker And Retention Enforcement
status: planned
depends_on: [52]
created: 2026-07-01
---

# Phase 53: Privacy Operations Worker And Retention Enforcement

## Goal

Turn the Phase 39 privacy request contract into an operational runtime: due account deletion requests are processed by a backend worker, expired privacy artifacts are cleaned up on schedule, and admins can see aggregate privacy-operation health without exposing private account data.

## Requirements

- Process pending account deletion requests whose `scheduledFor` timestamp has passed.
- Revoke the deleted account's active sessions, disconnect live sockets where possible, and remove password-reset and notification artifacts tied to that account.
- Anonymize account profile and login identifiers while preserving conversation referential integrity.
- Keep retained conversation, moderation, and audit records metadata-only and free of raw email, message text, reset codes, tokens, and push endpoints.
- Enforce retention cleanup for expired account-export audit rows, expired password resets, expired sessions, and old terminal notification outbox rows.
- Record aggregate operation-run evidence for worker activity and completed deletion requests.
- Expose an admin-only aggregate privacy-operations diagnostic endpoint and UI surface.
- Do not add immediate destructive user-facing deletion controls beyond the existing reversible request/cancel flow.

## Non-Goals

- Large asynchronous export artifact storage remains deferred.
- Backup-provider purge automation remains outside app runtime and stays disclosed as provider-lifecycle-bound.
- Hard-deleting conversation messages, chats, or moderation reports is out of scope; this phase preserves product integrity by anonymizing the user record and cleaning auxiliary artifacts.

## Acceptance Criteria

- A due deletion request completes only after the waiting period and marks its privacy request completed with aggregate counts.
- The deleted account can no longer authenticate through active sessions or provider identifiers.
- Privacy operation runs create aggregate evidence that does not contain raw private fields.
- Admin privacy diagnostics are restricted to admins and return only counts, dates, and health states.
- Frontend admin views fit desktop and mobile in English and Arabic without overflow.
- Focused backend, frontend, lint/build, and Hercules-compatible visual QA evidence are recorded.
