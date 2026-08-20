# Research Summary

**Date:** 2026-06-07
**Project:** Chatify

## Key Findings

Chatify should keep its existing MERN/Socket.IO stack for the reconstruction milestone. The app has enough foundation to support a professional messenger baseline, but it lacks the boundaries needed for reliable private messaging: verified socket identity, membership-checked realtime events, canonical message merge behavior, active CSRF protection, redacted logs, and automated tests.

## Stack

- Keep React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, and Tailwind.
- Add backend request tests, socket integration tests, frontend hook/component tests, structured redacted logging, and sanitized environment examples.
- Avoid stack migration until the current stack has been made testable and secure.

## Table Stakes

- Reliable direct messages.
- Authenticated sockets.
- Membership-checked rooms and events.
- Deterministic message send/receive/edit/delete/reaction/read/delivered state.
- Conversation and message search.
- Polished responsive chat UI.
- Active CSRF protection and secure token/reset/logging behavior.
- Blocking tests and security acceptance criteria.

## Watch Out For

- Socket.IO delivery is ordered but default arrival is at-most-once; missed server events require application-level reconciliation.
- Socket rooms must not be treated as authorization.
- Cross-origin Socket.IO credentials require explicit origin and credentials settings.
- Optimistic updates need one canonical merge path because messages appear in several UI/cache surfaces.
- CSRF scaffolding without route enforcement is not enough for cookie-authenticated unsafe requests.

## Recommended Roadmap Shape

1. Security and test foundation.
2. Authenticated realtime contract.
3. Canonical message state and delivery semantics.
4. Chat UI reconstruction.
5. Messenger baseline features and account/session polish.

## Sources

- Socket.IO middlewares: https://socket.io/docs/v4/middlewares/
- Socket.IO rooms: https://socket.io/docs/v4/rooms/
- Socket.IO delivery guarantees: https://socket.io/docs/v4/delivery-guarantees/
- Socket.IO client credential options: https://socket.io/docs/v4/client-options/
- OWASP CSRF Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- TanStack Query optimistic updates: https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates
- Express production security best practices: https://expressjs.com/en/advanced/best-practice-security/

