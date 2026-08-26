# Security Audit Phase 17 — PWA, Service Worker, Caching, and Push Lifecycle

Phase 17 validates Chatify's service-worker scope, cache isolation, update behavior, push-event handling, notification-click navigation, and cross-account subscription cleanup.

## Implemented controls

### Service-worker scope and update security

- The Chatify worker is registered explicitly at `/chatify-service-worker.js` with root scope `/`.
- `updateViaCache: 'none'` prevents the browser HTTP cache from indefinitely retaining an outdated worker script.
- Registration performs an immediate best-effort update check.
- The worker calls `skipWaiting()` during installation and `clients.claim()` during activation so fixed behavior reaches controlled pages without waiting for every older tab to close.

### Cache strategy and user isolation

- The worker deliberately registers no `fetch` listener and therefore does not cache authenticated API responses, private attachments, application documents, or user-specific navigation responses.
- Activation deletes legacy CacheStorage entries whose names begin with the Chatify-owned `chatify-` prefix.
- A `CHATIFY_CLEAR_PRIVATE_STATE` message performs the same cleanup on demand.
- Page-side cleanup independently deletes only Chatify-owned caches and never removes unrelated origin caches.

### Push payload and notification-click handling

- Push titles and bodies are normalized, control-character stripped, whitespace bounded, and length limited before display.
- Only the sanitized local application path is retained in notification data; arbitrary provider payload fields are discarded.
- External, protocol-relative, backslash, malformed, control-character, and overlong click destinations fall back to `/`.
- Notification clicks convert the local path to an absolute same-origin URL, reuse only same-origin window clients, and otherwise open a same-origin window.

### Account and session lifecycle

- Anonymous startup removes any browser push subscription left by a previous account and clears Chatify-owned private worker state.
- Explicit logout removes the current endpoint from the authenticated account before invalidating the session, unsubscribes the browser, and clears private worker/cache state.
- Revoke-all follows the same ordering before server-side session revocation.
- Browser unsubscription and private-state cleanup continue when server endpoint cleanup is temporarily unavailable, preventing a stale browser subscription from silently surviving an account transition.

## Permanent verification

The dedicated workflow is:

- `.github/workflows/security-phase-17-pwa-security.yml`

It runs:

- service-worker syntax validation;
- `scripts/security/__tests__/phase17-service-worker.test.mjs`, which executes the actual worker in an adversarial VM harness;
- `Frontend/Chatify/src/utils/pushNotifications.test.ts`;
- `Frontend/Chatify/src/hooks/useAuthQuery.pwa-security.test.tsx`;
- inherited authentication and notification-preference regressions;
- full frontend ESLint;
- the production TypeScript/Vite build;
- the production high-severity dependency audit;
- patch-hygiene validation.

## Phase boundary and residual risks

- Chatify intentionally has no offline private-message cache. Adding offline message availability later requires per-account encryption, cache versioning, logout deletion, and cross-account isolation tests before any authenticated response may enter CacheStorage.
- Browser and push-provider delivery can persist a previously displayed operating-system notification outside web application storage. Notification copy remains generic to minimize that residual exposure.
- Server-side push endpoint retention, privacy export, account deletion, and administrative privacy operations are validated in Phase 18.
- A compromised browser profile, service-worker implementation in another origin, operating-system notification database, or malicious browser extension remains outside this repository's control.
