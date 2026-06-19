# Phase 31 Context

## Purpose

Build the protected admin moderation workspace that Phase 28 deliberately left out. Phase 28 created abuse-report intake, admin-only review APIs, redacted report snapshots, and audit trail persistence; Phase 31 should make those capabilities operable from a UI and add scoped enforcement workflows.

## Recommended Scope

- Admin-only report queue with status, priority, type, age, reporter/reported labels, and privacy-safe filters.
- Report detail view with redacted context, audit trail, reviewer notes, and status transitions.
- Scoped enforcement actions for account/content/conversation outcomes, backed by server-side admin authorization and durable audit records.
- Empty, loading, error, forbidden, and no-permission states for the admin workspace.
- Backend and frontend tests for admin auth, non-admin denial, redaction, notes, enforcement actions, audit history, keyboard use, and accessibility.

## Constraints

- Reuse Phase 28 moderation APIs unless a specific gap requires extending them.
- Do not expose private email addresses, cookies, tokens, reset codes, SDP, ICE candidates, or raw provider secrets in UI, logs, screenshots, or test fixtures.
- Do not broaden into a large tenant/admin suite; keep this phase focused on abuse report triage and enforcement.
- Keep execution inline in the current Codex thread; do not use subagents.
