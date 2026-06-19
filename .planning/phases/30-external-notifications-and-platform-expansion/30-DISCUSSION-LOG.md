# Phase 30 Discussion Log

## Decisions

| Topic | Decision | Rationale |
|---|---|---|
| Runtime implementation | Deferred | No server subscription/outbox/provider model exists, and release evidence is still blocked. |
| Notification copy | Generic by default | Avoids leaking private message content through push/email. |
| E2EE notifications | Generic only | Server cannot see encrypted content. |
| Email provider | Reuse provider only after outbox/preferences exist | Current Brevo usage is password reset only. |
| Channels | Private spaces first | Bounded expansion fits the current private messenger model. |
| Bots | Require scopes and audit before runtime | Prevents integrations from bypassing privacy and abuse controls. |

## Recommendation

Recommendation: implement server notification preferences and outbox before choosing push/email provider details. Provider integration without a durable outbox creates hard-to-debug delivery gaps.
