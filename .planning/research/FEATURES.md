# Research: Features

**Date:** 2026-06-07
**Scope:** Chatify messenger reconstruction

## Table Stakes For V1

### Account And Session

- User can sign up, log in, log out, and stay logged in across refresh.
- User can reset a password safely.
- User can use supported OAuth providers without leaking profile artifacts or debug metadata.
- Session refresh failure is clear and recoverable.

### Conversation List

- User can see direct-message conversations ordered by recent activity.
- User can search contacts or conversations.
- User can distinguish unread, selected, online, offline, typing, and loading states.
- Empty and error states are explicit and recoverable.

### Conversation View

- User can load paginated message history.
- User can send a text message and see one canonical transition from sending to sent/delivered/read.
- User can receive messages in real time without duplicate rows.
- User can see typing, presence, delivery, and read status when authorized.
- User can edit, delete for self, delete for everyone, and react to messages with clear permission rules.

### Realtime Reliability

- Socket identity is derived from verified session data.
- Room joins and event emissions are membership-checked.
- Reconnect behavior refetches or replays missed state.
- Message status events are idempotent and deterministic.

### Security Baseline

- CSRF protection covers unsafe cookie-authenticated HTTP methods.
- Socket events are authorized, rate-limited where appropriate, and do not trust client-supplied user ids.
- Reset codes are not stored in plaintext and have attempt limits.
- Logs redact secrets and user-identifying data by default.
- Environment files stay local; sanitized examples document required variables.

### Tests And Verification

- Backend request tests cover auth, CSRF, message access control, validation, and reset flows.
- Socket integration tests cover handshake auth, room membership, typing, delivery, read, edit, delete, and reconnect behavior.
- Frontend tests cover optimistic send, rollback, duplicate merge, unread updates, and core chat UI states.

## Deferred Features

- Group chats and channels.
- Attachments and media previews.
- Push/email notifications.
- User blocking/reporting/moderation.
- Admin tools.
- End-to-end encryption.
- Mobile-native apps.

## Recommendation

Do not add deferred features before the V1 messenger baseline is reliable. The highest-return sequence is:

1. Security and test foundation.
2. Authenticated, membership-checked realtime contract.
3. Canonical message state and optimistic update path.
4. Polished chat UI.
5. Search and account/session refinements.

