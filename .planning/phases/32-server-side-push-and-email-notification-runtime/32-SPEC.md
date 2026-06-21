# Phase 32: Server-Side Push And Email Notification Runtime - Specification

**Created:** 2026-06-20
**Mode:** Auto-approved inline execution
**Requirements:** V2-NOTF-01, V2-NOTF-02, V2-NOTF-03, V2-PLAT-03, SEC-02, BLOCK-02, TEST-05, PROD-04

## Goal

Add an opt-in, privacy-safe server notification runtime for new message activity, with durable preferences, an idempotent delivery outbox, email/push provider boundaries, mute/block/unsubscribe suppression, and sanitized operational evidence.

## Current State

- Phase 19 and Phase 30 provide local browser notification UX and notification architecture, but no server-owned push/email runtime.
- `useNotificationPreferences` stores sound, browser alerts, and muted chat IDs in localStorage only.
- The backend has Brevo email delivery for password reset only; it has no notification outbox or push provider contract.
- Message creation is already idempotent by `chatId`, sender, and `clientMessageId`; notification enqueue must not duplicate work on retry repairs.
- Direct-chat block controls already prevent new conversation activity and must also suppress notification delivery.

## Target State

- Authenticated users can fetch and update server-owned notification preferences for push, email, message preview mode, and muted chat IDs.
- New message creation enqueues external notifications only for eligible recipients and only for newly persisted messages.
- Eligibility excludes the sender, muted chats, blocked direct peers, unsubscribed email users, and unavailable channel configuration.
- Outbox records are deduplicated, retryable, rate-limited, and contain generic notification copy by default.
- Delivery attempts record sanitized provider status without recipient email, message text, attachment names, push endpoints, cookies, tokens, or provider secrets.
- Frontend settings expose server-backed email/push choices without breaking the existing local sound and in-app browser alert behavior.

## Auto-Approved Recommendations

1. Use server-owned notification preferences while keeping local sound/browser-alert settings local.
   - Rationale: external delivery must be authoritative on the backend, while local sound and foreground browser alerts remain device preferences.
2. Keep notification copy generic by default and treat preview mode as `none` for this phase.
   - Rationale: privacy is the blocking requirement and future E2EE must not inherit plaintext notification leakage.
3. Implement a notification outbox before provider calls.
   - Rationale: idempotency, retries, sanitized failure recording, and provider rate limiting are easier to verify with durable jobs.
4. Add provider-safe dry-run execution for local/test environments.
   - Rationale: Phase 32 can be verified without committing or requiring Brevo/VAPID secrets.
5. Enqueue from the successful non-idempotent message creation path only.
   - Rationale: retry repairs should refresh sockets/latest message state but must not duplicate external notification jobs.

## Acceptance Criteria

- [ ] Users can opt in/out of email and push notifications through authenticated, CSRF-protected APIs.
- [ ] Muted chats are persisted server-side and suppress external delivery without changing unread count or receipt behavior.
- [ ] New message notifications skip sender, muted recipients, blocked direct peers, unsubscribed email users, and unavailable channel configuration.
- [ ] Outbox jobs dedupe by recipient, message, and channel; idempotent message retries do not create duplicate jobs.
- [ ] Provider execution retries failed jobs with bounded backoff and records sanitized outcomes.
- [ ] Notification templates are generic by default and do not include private message text, attachment names, email addresses, push endpoints, tokens, or secrets.
- [ ] Frontend settings show email/push controls, pending/error states, and existing browser permission guidance without layout regressions.
- [ ] Backend and frontend focused tests pass, with local verification not depending on real provider secrets.

## Out Of Scope

- Rich content previews, per-device preference UI, notification analytics dashboards, and provider dashboard setup.
- E2EE implementation or encrypted push payload transport beyond generic notification copy.
- Native mobile push providers.
- Production secret provisioning; this phase documents required environment variables and verifies dry-run behavior locally.
