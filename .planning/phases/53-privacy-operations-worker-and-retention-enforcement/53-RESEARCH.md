---
phase: 53
created: 2026-07-01
---

# Phase 53 Research

## Existing Behavior

- Privacy export rows already store `expiresAt` but no worker removes expired audit metadata.
- Account deletion requests are reversible and remain pending until a future worker processes them.
- Sessions are session-bound and revocation blocks HTTP and future socket authentication.
- Existing connected sockets need explicit disconnection to avoid stale realtime access after worker deletion.
- Notification outbox payloads can contain notification previews and should not be retained indefinitely.

## Recommended Worker Behavior

- Process due deletion requests in small batches.
- Mark requests completed after account anonymization succeeds.
- Revoke all sessions for the deleted user and delete password-reset/outbox artifacts tied to that user.
- Delete expired sessions/password resets/export audits and old terminal outbox rows as global retention cleanup.
- Record only counts and timestamps in operation runs.

## Risks

- Hard-deleting users would break message/chat references, so anonymization is the safer brownfield path.
- Access tokens are stateless; session revocation remains the enforcement point.
- Provider backup purge cannot be guaranteed from application code and must stay documented.
