# Phase 49: Delivery Health Dashboard - Research

**Date:** 2026-06-30
**Status:** Complete

## Current Delivery And Operations Surfaces

- `Messages` already persist the lifecycle fields needed for health metrics: `status`, `deliveredAt`, `readAt`, `readBy`, `chatId`, `sender`, `messageType`, and `createdAt`.
- `messageState.mjs` owns status constants, unread filters, and receipt serialization helpers. Delivery health should reuse the same status vocabulary rather than inventing new state.
- `socket.mjs` already exports `getSocketOperationalStatus()` with initialized, connected user, and connected socket counts. This is the correct runtime source for dashboard socket signals.
- `NotificationOutbox` already stores message notification status, channel, attempts, and timestamps. The dashboard can aggregate status/channel counts without exposing payload bodies.
- Phase 18 already established secret-safe readiness and observability expectations; Phase 49 should stay inside that boundary and must not imply fresh production acceptance.

## Backend Implementation Findings

- A new `Backend/Chatify/Routes/adminRouter.mjs` plus `Backend/Chatify/Controller/adminController.mjs` keeps the route semantic clear and avoids overloading moderation review.
- `app.mjs` can mount `/api/admin` after queue/CSRF/protect setup, mirroring `/api/moderation`.
- Existing `requireAdmin.mjs` is sufficient for server-side admin authority. The frontend role is advisory only.
- `moderationReviewLimiter` is the nearest existing limiter for read-only admin operations and avoids creating another rate limiter.
- Aggregation should be bounded by `createdAt >= windowStart`, exclude `messageType: "call"`, and avoid populating message sender/member documents.
- Risk rows can be built by grouping messages by `chatId`, then enriching with `Chats` metadata using `_id`, `isGroupChat`, `isSpaceChannel`, `members`, and `latestMessage` without populating `latestMessage`.

## Frontend Implementation Findings

- `AdminModeration.tsx` already provides the admin page shell, non-admin restricted state, theme wrapper, RTL direction, localized labels, summary cards, refresh action, and test harness patterns.
- A separate `AdminDeliveryHealth.tsx` route avoids crowding moderation operations and lets browser tests target diagnostics directly.
- A new `deliveryHealthApi.ts` and `useDeliveryHealth.ts` keeps with existing API/hook boundaries.
- `locales.ts` must receive English and Arabic labels because Phase 41 made representative admin/settings labels translatable.
- Use compact rows and panels over chart dependencies. The UI contract calls for a dense operational console, and simple counts/rates are enough for Phase 49 acceptance.

## Validation Architecture

- Backend request tests should seed admin/non-admin users, chats, messages across sent/delivered/read/stale states, notification outbox rows, and sensitive strings. Assertions must verify exact counts and absence of private content.
- Frontend tests should mock the delivery-health API and verify non-admin disabled query behavior, loading, empty, populated, error, refresh, and RTL labels.
- Playwright visual QA can use API mocking from the browser route and capture desktop and mobile states without requiring a live backend.
- Verification should include focused backend tests, focused frontend tests, `npm run lint`, `npm run build`, and Hercules-compatible screenshot artifacts.

## Risks And Mitigations

- **Unbounded scans:** Restrict queries to the selected window and a fixed row limit.
- **Privacy leakage:** Never populate users/messages/attachments; add sensitive seeded strings to tests.
- **Lifecycle regression:** Read-only dashboard only; no writes to messages, chats, unread, sockets, or outbox.
- **Misleading operations claims:** Keep docs clear that this is in-app diagnostics, not production release recertification.
