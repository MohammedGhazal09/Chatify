# Phase 30 External Notification Design

## Notification Modes

| Mode | Status | Notes |
|---|---|---|
| In-app sound/browser alert | Existing local feature | Works while app receives socket events; no server delivery. |
| Web push | Future implementation | Requires service worker, subscription storage, VAPID/config, queue, delivery receipts, and unsubscribe flow. |
| Email notification | Future implementation | Requires server-side opt-in, templates, throttling, unsubscribe, provider observability, and privacy-safe content. |

## Server-Side Preference Model

Future backend preferences should include:

- `pushEnabled`
- `emailNotificationsEnabled`
- `messagePreviewMode`: `none` by default
- `mutedChatIds`
- `blockedUserPolicy`: always suppress for blocked peers
- `encryptedConversationPolicy`: generic copy only
- `quietHours`
- `unsubscribeTokenHash`

## Delivery Rules

- Do not notify the sender.
- Do not notify muted chats.
- Do not notify blocked direct peers.
- Do not include plaintext content for E2EE conversations.
- Default standard-conversation copy is still generic unless the user explicitly enables previews.
- Batch or throttle bursts per chat and per user.
- Persist delivery attempts in an outbox with retry count, provider status, redacted error, and final disposition.

## Privacy-Safe Templates

Default push:

- Title: `New Chatify message`
- Body: `Open Chatify to read it.`

Default email:

- Subject: `New Chatify activity`
- Body: generic CTA with no sender email, no message text, no attachment filename, no reset-code-shaped values, and no tokens.

## Observability

Future implementation must record structured redacted events:

- `notification.outbox_created`
- `notification.delivery_skipped`
- `notification.delivery_attempted`
- `notification.delivery_failed`
- `notification.delivery_succeeded`

Do not log recipient email, message text, attachment names, provider tokens, push endpoint URLs, or unsubscribe tokens.
