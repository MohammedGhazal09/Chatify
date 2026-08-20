# Phase 30 Research

## Repository Findings

- `Frontend/Chatify/src/utils/notificationPrivacy.ts` already returns generic browser notification copy and ignores message text, sender, and attachment names.
- `Frontend/Chatify/src/hooks/useNotificationPreferences.ts` stores local preferences by user id and supports muted chat ids.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` creates opportunistic browser notifications only while socket events are received in the app runtime.
- `Backend/Chatify/Services/emailService.mjs` is password-reset-specific and should not be reused for message notifications until templates, unsubscribe, throttling, and outbox are designed.
- No service worker, push subscription storage, server outbox, or notification worker exists.

## Skills Applied

- `find-skills`: required project skill selection.
- `privacy-by-design`: opt-in, minimization, unsubscribe, and no content leakage by default.
- `api-and-interface-design`: stable preference/outbox contracts before provider integration.
- `observability`: durable outbox and redacted delivery events for background delivery.

## Recommendation

Recommendation: Phase 30 should be considered design-complete, not implementation-complete. Cross-device notifications are a background delivery system and need server-side state, not just frontend browser APIs.
