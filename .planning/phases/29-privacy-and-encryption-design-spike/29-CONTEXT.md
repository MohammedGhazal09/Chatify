# Phase 29 Context

## Current Privacy Model

- HTTP uses authenticated cookie requests with CSRF protection on unsafe routes.
- Socket identity is derived from verified session data.
- MongoDB stores message `text` in plaintext in `Messages`.
- Attachment bytes are stored in MongoDB GridFS and protected by membership-checked download/preview routes.
- Message search is server-side and depends on readable plaintext.
- Moderation reports can store redacted message context because the server can currently read plaintext.

## Why This Matters

True E2EE changes product behavior. The server can still route encrypted payloads, enforce membership metadata, and synchronize receipts, but it cannot read message text or attachment bytes. That breaks or changes server-side search, moderation content review, notification previews, export behavior, and recovery after lost devices.

## Recommendation

Recommendation: add E2EE only as a new opt-in conversation mode. Existing conversations should remain `standard` unless users intentionally create or migrate to an encrypted conversation with clear loss/recovery tradeoffs.
