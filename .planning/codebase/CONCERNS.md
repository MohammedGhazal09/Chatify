# Codebase Concerns

**Analysis Date:** 2026-06-07

## Tech Debt

**Large monolithic chat UI:**
- Issue: The main chat page owns selection state, message rendering, reactions, editing, deleting, unread handling, presence rendering, modals, and layout in one file.
- Files: `Frontend/Chatify/src/pages/chat/chat.tsx`, `Frontend/Chatify/src/pages/chat/chat.css`
- Impact: Small chat changes have a high regression surface because UI, socket-derived state, and message actions are coupled. The file is difficult to test and review.
- Fix approach: Split by responsibility into focused components and hooks under `Frontend/Chatify/src/pages/chat/`, such as message list, composer, chat sidebar, reaction picker, and message action handlers. Keep server data access in `Frontend/Chatify/src/hooks/useChatQueries.ts` and realtime wiring in `Frontend/Chatify/src/hooks/useChatSocket.ts`.

**Auth and account pages duplicate interaction patterns:**
- Issue: Login, signup, and forgot-password pages repeat form layout, OAuth handling, password visibility controls, error display, and logging patterns.
- Files: `Frontend/Chatify/src/pages/login/login.tsx`, `Frontend/Chatify/src/pages/signup/signup.tsx`, `Frontend/Chatify/src/pages/forgotPassword/forgotPassword.tsx`
- Impact: Validation, accessibility, and error handling changes must be applied in multiple places, which makes auth UI behavior drift likely.
- Fix approach: Introduce shared auth form primitives under `Frontend/Chatify/src/components/` or `Frontend/Chatify/src/pages/auth/` and keep page files focused on page-specific mutations and routing.

**Request queue is duplicated across client and server:**
- Issue: The same queue concept exists independently in frontend and backend with separate defaults, behavior, and logging.
- Files: `Frontend/Chatify/src/utils/requestQueue.ts`, `Backend/Chatify/Utils/requestQueue.mjs`, `Backend/Chatify/Middlewares/queueMiddleware.mjs`, `Frontend/Chatify/src/api/axios.ts`
- Impact: Queue behavior is hard to reason about end to end. Client retry after `429` can hold requests while the backend also queues "heavy" routes, increasing latency during load.
- Fix approach: Define explicit queue goals per side. Use backend queues only for protected expensive operations with bounded queue length and timeout. Use frontend queues only for UX throttling or retry coordination, not as a substitute for server backpressure.

**CSRF implementation is scaffolded but inactive:**
- Issue: `csurf` is configured and `/api/csrf-token` exists, but the middleware that applies CSRF validation is commented out. The local TODO also flags CSRF as incomplete.
- Files: `Backend/Chatify/app.mjs`, `Frontend/Chatify/src/api/authApi.ts`, `Frontend/Chatify/ToDos.md`
- Impact: Cookie-authenticated cross-origin requests rely on `SameSite` and CORS but do not enforce a request-bound anti-CSRF token for state-changing routes.
- Fix approach: Apply CSRF validation to unsafe methods after confirming the frontend sends the token header from `XSRF-TOKEN`. Keep explicit exemptions small and document why each exempt route is safe.

**Debug logging is embedded in production-adjacent code paths:**
- Issue: Authentication, token generation, database, request, OAuth, and UI flows use direct `console.log` / `console.error`; some token and user metadata logs are not guarded by a central logger.
- Files: `Backend/Chatify/Middlewares/protectRoutes.mjs`, `Backend/Chatify/Utils/tokenCookieGenerator.mjs`, `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Config/DBConfig.mjs`, `Backend/Chatify/Config/passport.mjs`, `Frontend/Chatify/src/pages/login/login.tsx`, `Frontend/Chatify/src/pages/forgotPassword/forgotPassword.tsx`
- Impact: Sensitive metadata can leak into logs and browser consoles. Debug output also makes operational logs noisy and harder to alert on.
- Fix approach: Replace direct logging with a small logger that redacts tokens and PII, gates debug logs by environment, and emits structured fields for operational events.

## Known Bugs

**Expired access token can be refreshed without verifying signature freshness:**
- Symptoms: `refreshToken` verifies the token first, but on expiration it decodes the expired token and issues a new cookie if the user still exists.
- Files: `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Utils/tokenCookieGenerator.mjs`, `Backend/Chatify/Middlewares/protectRoutes.mjs`
- Trigger: A client presents an expired but otherwise decodable `accessToken` cookie to `/api/auth/refresh-token`.
- Workaround: Current code depends on possession of the old cookie and user existence. Replace with a dedicated refresh token, refresh-token rotation, and server-side revocation state.

**Socket identity is client-supplied:**
- Symptoms: The socket server accepts `user:connect` with a raw `userId` from the browser and maps that socket to the provided user without verifying the cookie/JWT.
- Files: `Backend/Chatify/Config/socket.mjs`, `Frontend/Chatify/src/hooks/useChatSocket.ts`
- Trigger: Any connected client emits `user:connect` with another user's id.
- Workaround: None in socket layer. Authenticate the socket handshake using the `accessToken` cookie or an auth payload, verify JWT server-side, and derive `userId` from the verified token only.

**Socket room joins are not membership-checked:**
- Symptoms: `chat:join`, `typing:start`, `typing:stop`, and `message:delivered` trust client-provided `chatId` after socket identification.
- Files: `Backend/Chatify/Config/socket.mjs`, `Frontend/Chatify/src/hooks/useChatSocket.ts`
- Trigger: A client emits socket events for a chat room it does not belong to.
- Workaround: HTTP message endpoints perform membership checks in `Backend/Chatify/Controller/messageController.mjs`, but socket events need the same check before joining rooms or emitting typing/status events.

**Soft-delete stores hidden messages but fetch does not filter them:**
- Symptoms: `deleteMessage` with `deleteForEveryone: false` pushes the user id into `message.deletedFor`, while `getAllMessages` fetches all messages for the chat without excluding messages deleted for the requester.
- Files: `Backend/Chatify/Controller/messageController.mjs`, `Backend/Chatify/Models/messageModel.mjs`
- Trigger: User deletes a message only for themselves and later reloads the chat.
- Workaround: Filter `getAllMessages` with `deletedFor: { $ne: userObjectId }` and ensure latest-message logic handles per-user deletion semantics.

**Unread count is stored both globally and per-user-derived:**
- Symptoms: `Chats.unReadMessages` is incremented by recipient count on send, while unread endpoints compute unread counts from `Messages.readBy`.
- Files: `Backend/Chatify/Models/chatModel.mjs`, `Backend/Chatify/Controller/messageController.mjs`, `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/hooks/useChatSocket.ts`
- Trigger: Multiple recipients, read receipts, message deletion, or missed socket events can make chat-level `unReadMessages` diverge from per-user unread counts.
- Workaround: Prefer derived per-user unread counts from `Messages.readBy` or introduce a per-user unread counter model; avoid one global unread counter on `Chats` for multi-user data.

## Security Considerations

**Cross-site cookie auth lacks active CSRF enforcement:**
- Risk: State-changing cookie-authenticated requests can be exposed to CSRF if browser cookies are sent cross-site and token validation is not applied.
- Files: `Backend/Chatify/app.mjs`, `Backend/Chatify/Routes/authRouter.mjs`, `Backend/Chatify/Routes/chatRouter.mjs`, `Backend/Chatify/Routes/messageRouter.mjs`
- Current mitigation: CORS is restricted to `FRONTEND_ORIGIN`; cookies are `httpOnly`; production cookies use `secure` and `sameSite: 'none'` in `Backend/Chatify/Utils/tokenCookieGenerator.mjs`.
- Recommendations: Enforce CSRF on unsafe methods, validate origin headers for cross-site cookie requests, and add integration tests for accepted/rejected CSRF cases.

**Token and user metadata can leak through logs:**
- Risk: Token previews, token lengths, user ids, emails, and cookie options are printed directly.
- Files: `Backend/Chatify/Middlewares/protectRoutes.mjs`, `Backend/Chatify/Utils/tokenCookieGenerator.mjs`, `Backend/Chatify/Controller/authController.mjs`, `Frontend/Chatify/src/pages/login/login.tsx`, `Frontend/Chatify/src/pages/forgotPassword/forgotPassword.tsx`
- Current mitigation: Some socket logs are gated by `NODE_ENV` in `Backend/Chatify/Config/socket.mjs`; many auth logs are not centrally redacted.
- Recommendations: Remove token previews and email logs, redact all auth identifiers by default, and gate debug logs by environment.

**Password reset code is low entropy and stored in plaintext:**
- Risk: Six-digit reset codes can be brute-forced within the reset window if rate limiting is bypassed or distributed, and database access exposes active reset codes.
- Files: `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Models/passwordResetModel.mjs`, `Backend/Chatify/Routes/authRouter.mjs`
- Current mitigation: Auth routes use `authLimiter` in `Backend/Chatify/Middlewares/rateLimiters.mjs`; reset records expire after five minutes via TTL index.
- Recommendations: Store a hash of the reset code, track attempt counts per reset record, increase entropy or use single-use opaque tokens, and bind rate limits to account plus IP.

**Committed profile artifact may contain user/OAuth data:**
- Risk: `profile.json` is committed in the backend tree and may contain development user profile data or OAuth response data.
- Files: `Backend/Chatify/profile.json`
- Current mitigation: Not detected.
- Recommendations: Remove committed profile artifacts if they contain personal data, add an ignore rule for generated OAuth/profile dumps, and rotate any exposed identifiers if needed.

**Environment files exist in app directories:**
- Risk: Secret-bearing env files are present locally and must not be read, logged, or committed.
- Files: `Backend/Chatify/.env`, `Frontend/Chatify/.env`
- Current mitigation: `.gitignore` exists at repo root.
- Recommendations: Keep env files ignored, provide sanitized `.env.example` files for required variable names, and verify no secrets are present in git history.

## Performance Bottlenecks

**Offset pagination on messages degrades for large chats:**
- Problem: `getAllMessages` uses `skip` with newest-first sorting and then reverses the page in memory.
- Files: `Backend/Chatify/Controller/messageController.mjs`, `Backend/Chatify/Models/messageModel.mjs`, `Frontend/Chatify/src/hooks/useChatQueries.ts`
- Cause: MongoDB `skip` becomes increasingly expensive as page depth grows; repeated sorting and count queries add work per request.
- Improvement path: Switch to cursor pagination using `createdAt` and `_id`, return `nextCursor`, and avoid full `countDocuments` on every message fetch unless explicitly needed.

**Batch read updates save each message sequentially:**
- Problem: `markMessagesAsRead` loops over messages and calls `await message.save()` per message.
- Files: `Backend/Chatify/Controller/messageController.mjs`
- Cause: Per-document saves serialize writes and trigger Mongoose document overhead for a batch operation.
- Improvement path: Use `bulkWrite` or `updateMany` where possible, then fetch only the fields needed for socket events.

**Socket delivery status fetches recently updated messages using a time window:**
- Problem: `markMessagesAsDelivered` updates many messages, then fetches delivered messages with `deliveredAt` in the last second to emit status events.
- Files: `Backend/Chatify/Config/socket.mjs`
- Cause: The one-second time-window query can miss slow updates or include unrelated updates under concurrency.
- Improvement path: Query by the exact update criteria before/after `updateMany`, or use `bulkWrite` with known ids to emit deterministic status events.

**Request queues are unbounded:**
- Problem: Queue implementations hold pending requests in memory without max queue length, age limit, or cancellation.
- Files: `Backend/Chatify/Utils/requestQueue.mjs`, `Frontend/Chatify/src/utils/requestQueue.ts`
- Cause: Each `add` pushes to an array and only drains by concurrency; overload increases memory usage and response latency.
- Improvement path: Add queue capacity, timeout, dropped-request metrics, and explicit `503` behavior for backend queues. On the client, clear or cancel stale queued work during route/auth changes.

## Fragile Areas

**Authentication lifecycle:**
- Files: `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Middlewares/protectRoutes.mjs`, `Backend/Chatify/Utils/tokenCookieGenerator.mjs`, `Frontend/Chatify/src/api/axios.ts`, `Frontend/Chatify/src/hooks/useAuthQuery.ts`
- Why fragile: Access-token refresh, rolling cookies, OAuth callbacks, auth-check state, and axios retry behavior are spread across backend middleware, backend controllers, and frontend interceptors.
- Safe modification: Add integration tests around login, expired token, refresh failure, logout, and OAuth callback redirects before changing token behavior.
- Test coverage: No test files detected and backend `Backend/Chatify/package.json` defines `test` as a failing placeholder.

**Realtime presence and room membership:**
- Files: `Backend/Chatify/Config/socket.mjs`, `Frontend/Chatify/src/hooks/useChatSocket.ts`, `Frontend/Chatify/src/store/presenceStore.ts`, `Frontend/Chatify/src/components/OnlineStatus.tsx`, `Frontend/Chatify/src/components/TypingIndicator.tsx`
- Why fragile: Presence depends on module-level maps, client-supplied ids, socket reconnect behavior, and database online flags. A process restart or multi-instance deployment loses in-memory state.
- Safe modification: Authenticate socket handshake first, centralize membership checks, and treat database status as eventually consistent. For multi-instance production, add a shared adapter/store for Socket.IO presence.
- Test coverage: No socket integration tests detected.

**Optimistic message state:**
- Files: `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/hooks/useChatSocket.ts`, `Frontend/Chatify/src/pages/chat/chat.tsx`
- Why fragile: Messages can arrive via mutation response, optimistic cache state, and socket events. Deduplication is partial and spread between hook state and React Query cache.
- Safe modification: Define one canonical merge path for messages and status updates. Keep optimistic ids mapped to server ids and add tests for duplicate socket/event ordering.
- Test coverage: No frontend unit tests detected.

**Input validation split between layers:**
- Files: `Frontend/Chatify/src/utils/validationSchemas.tsx`, `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Controller/messageController.mjs`, `Backend/Chatify/Middlewares/sanitization.mjs`, `Backend/Chatify/Models/userModel.mjs`, `Backend/Chatify/Models/messageModel.mjs`
- Why fragile: Frontend schemas, backend controller checks, sanitization middleware, and Mongoose schema constraints do not share a single contract. Message model allows `maxlength: 5000`, while controller limits messages to `1000`.
- Safe modification: Treat backend validation as authoritative, align model/controller limits, and add request tests for boundary values.
- Test coverage: No validation tests detected.

## Scaling Limits

**Single-process Socket.IO state:**
- Current capacity: Online users and socket mappings are stored in process memory.
- Limit: Horizontal scaling or process restart breaks presence, room membership helpers, and online user tracking.
- Scaling path: Add a Socket.IO Redis adapter or equivalent shared state, and derive authorization from verified session data per socket.

**MongoDB query load for chat history:**
- Current capacity: Message indexes exist for chat/time and unread queries in `Backend/Chatify/Models/messageModel.mjs`.
- Limit: Deep offset pagination and per-request counts increase latency as message volume grows.
- Scaling path: Use cursor pagination, avoid repeated total counts, and consider archiving or partitioning very large chat histories.

**Per-IP rate limiting behind proxies:**
- Current capacity: Production sets `app.set('trust proxy', 1)` and applies global/auth/message limiters.
- Limit: Incorrect proxy configuration can group users under a proxy IP or allow spoofed client IPs depending on hosting.
- Scaling path: Verify deployment proxy chain, use account-aware limits for auth/reset flows, and persist rate-limit state externally for multi-instance deployments.

## Dependencies at Risk

**`csurf`:**
- Risk: The app depends on `csurf` for CSRF scaffolding, but active enforcement is commented out and the package is deprecated in the wider Express ecosystem.
- Impact: Future CSRF fixes may be built on an inactive dependency and remain easy to bypass if middleware wiring stays optional.
- Migration plan: Either fully wire and test the current middleware, or migrate to a maintained double-submit/signed-token strategy implemented explicitly in `Backend/Chatify/app.mjs` and `Frontend/Chatify/src/api/axios.ts`.

**No backend test framework dependency:**
- Risk: Backend has no real test command or test framework dependency.
- Impact: Auth, CSRF, socket, and message authorization fixes have no automated regression safety.
- Migration plan: Add an API test stack such as Vitest/Jest plus Supertest and an isolated MongoDB test strategy. Replace the placeholder script in `Backend/Chatify/package.json`.

**Frontend build-only validation:**
- Risk: Frontend has lint and build scripts, but no test runner.
- Impact: Realtime and optimistic-update behavior can regress without immediate signal.
- Migration plan: Add Vitest and React Testing Library for hooks/components, then cover `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/hooks/useChatSocket.ts`, and auth pages.

## Missing Critical Features

**Automated tests:**
- Problem: No `*.test.*` or `*.spec.*` files were detected, backend `npm test` intentionally fails, and frontend has no test script.
- Blocks: Safe changes to auth, CSRF, socket authorization, message deletion, unread counts, and optimistic UI behavior.

**Socket authentication and authorization:**
- Problem: Realtime behavior does not derive identity from a verified session and does not consistently check chat membership before room actions.
- Blocks: Safe use of realtime presence, typing, room join, delivered status, and chat notification events in production.

**Operational observability:**
- Problem: Logs are plain console statements with no request correlation outside development middleware and no metrics for queues, auth failures, socket events, or database latency.
- Blocks: Diagnosing production incidents and capacity limits without leaking sensitive data.

## Test Coverage Gaps

**Auth and token lifecycle:**
- What's not tested: Signup, login, logout, expired-token refresh, invalid token rejection, rolling cookie refresh, OAuth callback behavior, and CSRF enforcement.
- Files: `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Middlewares/protectRoutes.mjs`, `Backend/Chatify/Utils/tokenCookieGenerator.mjs`, `Frontend/Chatify/src/api/axios.ts`, `Frontend/Chatify/src/hooks/useAuthQuery.ts`
- Risk: Security-sensitive regressions can ship unnoticed.
- Priority: High

**Message authorization and state transitions:**
- What's not tested: Chat membership checks, send/edit/delete permissions, read receipts, batch read updates, reactions, soft delete filtering, and unread-count consistency.
- Files: `Backend/Chatify/Controller/messageController.mjs`, `Backend/Chatify/Controller/chatController.mjs`, `Backend/Chatify/Models/messageModel.mjs`, `Backend/Chatify/Models/chatModel.mjs`
- Risk: Users may read, mutate, or receive events for chats they should not access; message state can diverge between client and server.
- Priority: High

**Socket flows:**
- What's not tested: Socket authentication, reconnect behavior, room joins/leaves, typing events, delivered/read events, chat creation/deletion events, and presence privacy.
- Files: `Backend/Chatify/Config/socket.mjs`, `Frontend/Chatify/src/hooks/useChatSocket.ts`, `Frontend/Chatify/src/store/presenceStore.ts`
- Risk: Realtime features can fail silently or expose cross-user data.
- Priority: High

**Frontend optimistic updates:**
- What's not tested: Optimistic send rollback, duplicate message merge, delete rollback, unread cache updates, reaction updates, and edit propagation.
- Files: `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/pages/chat/chat.tsx`
- Risk: UI can show duplicate, stale, or missing messages after network errors or out-of-order socket events.
- Priority: Medium

**Validation boundaries:**
- What's not tested: Password length, reset-code lifecycle, email normalization, message length mismatch, invalid ObjectId handling, and XSS sanitization.
- Files: `Frontend/Chatify/src/utils/validationSchemas.tsx`, `Backend/Chatify/Middlewares/sanitization.mjs`, `Backend/Chatify/Controller/authController.mjs`, `Backend/Chatify/Controller/messageController.mjs`, `Backend/Chatify/Models/userModel.mjs`
- Risk: Client and server validation can diverge, causing broken UX or missed security constraints.
- Priority: Medium

---

*Concerns audit: 2026-06-07*
