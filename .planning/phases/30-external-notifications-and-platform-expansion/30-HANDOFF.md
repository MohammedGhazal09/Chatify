# Phase 30 Implementation Handoff

## Recommended Later Phases

1. **Phase 35: Server Notification Preferences And Outbox**
   - Add backend preference model, unsubscribe model, notification outbox, skip reasons, rate limits, and redacted observability.
   - Acceptance: no delivery provider required; outbox decisions are testable and privacy-safe.

2. **Phase 36: Web Push Delivery**
   - Add service worker, push subscription storage, VAPID/config validation, delivery worker, and opt-in UI.
   - Acceptance: push sends generic notifications, respects mute/block/encryption, and records delivery outcomes.

3. **Phase 37: Email Message Notifications**
   - Add email templates, unsubscribe, digest/throttle rules, provider retry handling, and privacy-safe tests.
   - Acceptance: emails never include private content by default and can be disabled from every message.

4. **Phase 38: Private Spaces Prototype**
   - Add bounded invite-only spaces with limited channels after notification/safety gates pass.
   - Acceptance: private membership and message authorization are covered by backend/socket/browser tests.

5. **Phase 39: Bot And Integration Permission Prototype**
   - Add app registration, scoped tokens, signed webhooks, audit logs, revocation, and abuse reporting.
   - Acceptance: integrations cannot read/write outside granted scopes and all actions are auditable.

## Blocking Gates

- Phase 25 release evidence.
- Phase 28 moderation foundation.
- Phase 29 encryption tradeoff acceptance.
- Provider secret management and rotation runbook.
- Abuse and rate-limit tests for all delivery and integration paths.
