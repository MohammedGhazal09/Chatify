---
phase: 19-messenger-product-polish-and-notifications
artifact: spec
status: planned
created_at: 2026-06-17T11:15:00+03:00
source: roadmap and current frontend evidence
---

# Phase 19 Spec: Messenger Product Polish And Notifications

## Goal

Make Chatify feel complete in daily use by adding privacy-safe notification controls, account/session edge-state polish, and consistent empty, offline, blocked, unavailable, failed-upload, and failed-send states across desktop and mobile.

## Scope

- Add a notification preference model for sound, browser notifications, permission state, and per-conversation mute behavior.
- Wire notification controls into existing Settings and chat conversation surfaces.
- Keep notification copy privacy-safe by default and never expose message text or private content outside the authenticated chat surface.
- Polish account, profile, logout, expired-session, refresh-failure, and multi-tab session behavior.
- Improve first-run, no-chat, no-results, offline, reconnecting, blocked, unavailable-call, failed-upload, and failed-send states using existing chat UI patterns.
- Add focused frontend tests and behavior-first Playwright checks for notification, account/session, and state-polish workflows.

## Out Of Scope

- Push notifications that work after the page is closed.
- Email notifications.
- Service worker notification delivery.
- Group chat notification rules.
- Moderation/admin tooling.
- End-to-end encryption.
- Broad platform expansion beyond the current React/Vite web app.

## Requirements

- AUTH-02
- BASE-01
- BASE-02
- BASE-03
- BASE-04
- BASE-05
- UI-01
- UI-02
- UI-03
- UI-04
- UI-05
- TEST-03
- TEST-05

## Acceptance Criteria

1. Users can opt into sound and browser-level notifications from Settings with clear granted, denied, default, and unsupported states.
2. Users can mute and unmute conversation alerts without losing unread counts, delivery receipts, or message state.
3. Background message alerts never include raw message text, attachment names, reset codes, emails, tokens, or other private content.
4. Session expiry, logout, refresh failure, and multi-tab auth changes clear private surfaces and present a recoverable route.
5. Empty, offline, blocked, unavailable-call, failed-upload, and failed-send states are consistent, keyboard-accessible, and usable on desktop and mobile.
6. Frontend unit tests, focused hook tests, and Playwright checks cover the new behavior.

## Recommendation

Implement browser notifications as an in-app web baseline only: a visible preference and permission layer around the browser `Notification` API while the app is open. Keep true push/email delivery deferred to v2 so this phase improves daily-use polish without expanding platform scope.
