---
phase: 21
review_type: code
status: passed
reviewed_at: 2026-06-18
---

# Phase 21 Code Review

## Findings

No blocking code findings.

## Checked

- Backend direct-chat creation no longer imports or uses email validation for contact discovery.
- `targetUsername` is normalized by the shared backend validator before lookup.
- Existing `directKey` idempotency and duplicate-key recovery remain intact.
- Public lookup uses the same public identity serializer used by contact and chat member surfaces.
- Frontend `CreateChatPayload`, React Query mutation variables, dialog props, sidebar props, and chat submit path all use username naming.
- Leak guard blocks old direct-chat email payload/state/copy from production chat runtime files.

## Residual Risk

The exact lookup endpoint can confirm whether a username exists to authenticated users. That is consistent with username-based discovery, but broader discovery should remain deferred until rate-limited and explicitly designed.
