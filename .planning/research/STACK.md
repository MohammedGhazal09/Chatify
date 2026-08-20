# Research: Stack

**Date:** 2026-06-07
**Scope:** Chatify messenger reconstruction

## Existing Stack

Chatify should keep its current stack for the reconstruction milestone:

- Frontend: React 19, Vite, TypeScript, Tailwind CSS, TanStack Query, Zustand, Socket.IO client.
- Backend: Node.js, Express 5, Socket.IO, MongoDB/Mongoose, JWT cookies, Passport OAuth strategies.
- Deployment targets: Vercel frontend and Render backend, with cross-origin cookies and Socket.IO credentials.

This stack can support the approved goal. The priority is not a replacement stack; it is making the current architecture trustworthy, testable, and polished.

## Recommended Additions

- Backend API tests with a Node test runner plus Supertest or equivalent.
- Socket integration tests that can connect authenticated clients, assert room authorization, and verify delivery/read flows.
- Frontend component/hook tests with Vitest and React Testing Library.
- A small structured logger with redaction for auth tokens, emails, user identifiers, socket metadata, and request correlation.
- Sanitized `.env.example` files for frontend and backend.

## Stack Risks

- Socket.IO default event delivery is not enough for a reliable messenger by itself. Socket.IO preserves event order, but default arrival is at-most-once, so missed server-to-client events after disconnect need application-level replay or refetch.
- Cross-origin cookies require aligned CORS settings for Express and Socket.IO. Socket.IO client credentials cannot be paired with wildcard origins.
- TanStack Query optimistic updates must be centralized for messages because the same message appears in the conversation list, message list, unread state, and socket event path.
- Express security middleware exists, but inactive CSRF enforcement and direct logging remain product risks.

## Source Notes

- Socket.IO middleware supports authentication, authorization, and rate-limiting at connection time: https://socket.io/docs/v4/middlewares/
- Socket.IO rooms are server-side channels and need server-side authorization before joining: https://socket.io/docs/v4/rooms/
- Socket.IO delivery requires application-level guarantees for missed server events: https://socket.io/docs/v4/delivery-guarantees/
- Socket.IO credentialed cross-origin clients require matching server CORS credentials: https://socket.io/docs/v4/client-options/
- OWASP CSRF guidance recommends request-bound tokens for unsafe methods, commonly sent in custom headers for AJAX clients: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- TanStack Query optimistic updates should snapshot, rollback, and invalidate server state when cache is manipulated: https://tanstack.com/query/v5/docs/framework/react/guides/optimistic-updates
- Express production guidance emphasizes TLS, untrusted input handling, Helmet, secure cookies, brute-force controls, and dependency hygiene: https://expressjs.com/en/advanced/best-practice-security/

