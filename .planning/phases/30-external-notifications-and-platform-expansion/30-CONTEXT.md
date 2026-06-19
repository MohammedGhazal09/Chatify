# Phase 30 Context

## Current Notification State

- Phase 19 added local browser alert preferences, muted chat ids, sound preferences, and generic notification copy.
- `useChatSocket` can create browser notifications while the app is open and receives socket events.
- Notification copy intentionally does not include message text or attachment names.
- Backend email infrastructure exists only for password reset through Brevo.
- There is no push subscription model, service worker delivery, server notification outbox, email message notification job, or cross-device notification preference model.

## Current Platform State

- Chatify supports private direct and group conversations.
- Moderation foundation exists through Phase 28 report/review APIs.
- E2EE is design-complete but not implemented; Phase 29 requires generic encrypted notifications and reporter-submitted evidence.
- Phase 25 live evidence is closed by maintainer confirmation.

## Recommendation

Recommendation: implement the admin moderation UI/enforcement workflow before external notifications, channels, or bots. Channels and integrations should stay design-only until the private messenger and safety foundations are demonstrably stable.
