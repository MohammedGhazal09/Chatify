# Phase 29 Discussion Log

## Decisions

| Topic | Decision | Rationale |
|---|---|---|
| Immediate code changes | None | The phase is a design spike and runtime encryption would be high-risk without key lifecycle work. |
| E2EE scope | New opt-in conversation mode | Avoids silently breaking existing search, reports, attachments, and recovery. |
| Existing history | Do not server-migrate to E2EE | Server-side migration is not true E2EE. |
| Key recovery | User-controlled optional recovery | Password reset must not unlock encrypted history by itself. |
| Moderation | Reporter-submitted decrypted evidence | Server cannot inspect encrypted content. |
| Notifications | Generic encrypted-message copy | Prevents plaintext leakage through push/email. |

## Recommendation

Recommendation: ship Phase 30 notifications for standard conversations only unless the notification work explicitly gates encrypted conversations to generic copy.
