# Phase 49: Delivery Health Dashboard - Specification

**Created:** 2026-06-30
**Ambiguity score:** 0.12 (gate: <= 0.20)
**Requirements:** 6 locked

## Goal

Admins can inspect privacy-safe delivery health for recent message traffic from a protected dashboard, including aggregate send, delivery, read, unread, realtime, and notification-outbox signals without exposing message content or private identity data.

## Background

Chatify already has canonical message receipt state on `Messages`, unread count helpers, Socket.IO delivery/read events, structured redacted logging, `/api/health`, `/api/ready`, moderation operations summaries, and notification outbox diagnostics. What does not exist is one admin-visible product surface that summarizes delivery health, stale receipts, unread drift risk, realtime socket reachability, and notification outbox failures in a way that a maintainer can use without querying MongoDB manually or reading logs. Phase 49 adds that bounded visibility layer after Phase 48 saved messages, without changing the message lifecycle itself.

## Requirements

1. **Admin-only dashboard access**: Delivery health diagnostics must be available only to authenticated admins.
   - Current: Admin-only moderation operations exist, but there is no delivery-health route or API.
   - Target: A protected admin route and API expose delivery health only when `req.userId` resolves to an admin user.
   - Acceptance: Backend tests prove a non-admin receives `403`, an unauthenticated request receives auth failure, and an admin receives the diagnostics payload; frontend tests prove non-admin users see a restricted state without calling the diagnostics API.

2. **Aggregate delivery summary**: The dashboard must show recent aggregate message lifecycle counts and rates for a bounded time window.
   - Current: Message documents store `status`, `deliveredAt`, `readAt`, `readBy`, sender, chat id, and creation time, but no endpoint aggregates them.
   - Target: The diagnostics payload includes total recent messages, sent/delivered/read counts, delivery rate, read rate, and counts of stale sent/stale delivered messages for the selected window.
   - Acceptance: A focused backend test seeds sent, delivered, read, stale sent, and stale delivered messages and verifies exact aggregate counts and rates.

3. **Conversation risk list**: Admins must see a bounded list of conversations with the highest delivery-health risk without message text.
   - Current: Maintainers must inspect chats/messages directly to spot stale receipts or unread drift candidates.
   - Target: The diagnostics payload includes at most 10 conversation summaries ordered by risk, with chat id, type, member count, recent message count, stale sent count, stale delivered count, unread estimate, and last activity time.
   - Acceptance: Backend tests prove the list is sorted by risk, limited to 10 entries, includes group/direct/space-safe metadata only, and excludes message text, attachments, emails, tokens, or raw participant identity.

4. **Realtime and outbox signals**: The dashboard must correlate message delivery health with existing runtime readiness and notification outbox outcomes.
   - Current: Socket readiness and notification outbox data exist separately through readiness utilities and notification models/tests.
   - Target: The diagnostics payload includes socket readiness status, online user/socket counts where available, and notification outbox pending/failed/sent counts for recent message notifications.
   - Acceptance: Backend tests verify the payload reports socket and outbox status from existing runtime/model data and remains usable when Socket.IO is not initialized.

5. **Operational UI states**: The frontend dashboard must render loading, empty, degraded, blocked/error, refreshed, desktop, mobile, light theme, and dark theme states without layout overlap.
   - Current: Admin moderation UI has operations cards and protected states, but no delivery-health UI.
   - Target: A dashboard page presents summary cards, risk rows, outbox/runtime panels, a window selector, and a refresh action using existing Chatify theme conventions.
   - Acceptance: Frontend tests cover loading, error, empty, populated, non-admin, refresh, and RTL/localized labels; Playwright or Hercules-compatible visual QA captures desktop and mobile dashboard states.

6. **Privacy-safe diagnostics boundary**: Delivery health data must never expose message content, private emails, auth/session secrets, tokens, cookie metadata, reset codes, encrypted plaintext, attachment filenames, or provider payload bodies.
   - Current: Phase 18 established redacted logging and readiness hygiene, but a new diagnostics endpoint could accidentally aggregate sensitive fields.
   - Target: Serialization is intentionally metadata-only and test-guarded against sensitive strings.
   - Acceptance: Backend and frontend tests assert no diagnostic response or rendered dashboard contains seeded emails, message text, token-like values, encrypted plaintext, attachment filenames, or provider payload bodies.

## Boundaries

**In scope:**
- Admin-only backend diagnostics endpoint for recent delivery health.
- Server-computed aggregate delivery/read/stale receipt metrics.
- Bounded high-risk conversation summaries without private content.
- Socket readiness and notification outbox summary signals.
- Frontend admin dashboard route with responsive states and refresh/window controls.
- Focused backend, frontend, lint, build, visual QA, and traceability evidence.

**Out of scope:**
- Changing message send, delivery, read, unread, retry, or socket semantics - this phase observes existing behavior and must not rewrite the lifecycle.
- External observability vendors, metrics collectors, background jobs, Prometheus, Grafana, or alert routing - Phase 49 is an in-app operational surface.
- Production smoke reruns or release-readiness claims - Phase 25/17 release evidence remains a separate gate.
- Per-user private investigation tooling or raw participant identity inspection - the dashboard is aggregate and metadata-only.
- Message content search, attachment inspection, encrypted plaintext recovery, or notification provider payload replay - these would violate the privacy boundary.
- Broad admin suite redesign - reuse existing admin UI and route patterns.

## Constraints

- Diagnostics must use existing MongoDB/Mongoose data, readiness helpers, notification outbox models, auth middleware, admin middleware, TanStack Query, React Router, Tailwind, and Chatify theme tokens.
- Default query window should be recent and bounded; recommended defaults are 24 hours with selectable 1 hour, 24 hours, and 7 days.
- Dashboard queries must avoid unbounded scans by using indexed date/status/chat fields or documented limits.
- All payloads, logs, tests, screenshots, and visual QA artifacts must stay secret-safe and email-free.
- Existing chat UI behavior and `Frontend/Chatify/src/pages/chat/chat.tsx` local work must not be overwritten.

## Acceptance Criteria

- [ ] Admin-only delivery-health API rejects unauthenticated and non-admin callers and returns diagnostics to admins.
- [ ] API returns exact recent sent, delivered, read, stale sent, stale delivered, delivery-rate, and read-rate metrics from seeded message data.
- [ ] API returns a sorted, limited high-risk conversation list with no message text, emails, tokens, attachment filenames, encrypted plaintext, or provider payload bodies.
- [ ] API includes socket readiness and notification outbox summary status and handles missing Socket.IO initialization safely.
- [ ] Frontend route renders protected, loading, empty, populated, refresh, error, desktop/mobile, light/dark, and RTL/localized states.
- [ ] Focused backend/frontend tests, frontend lint, frontend build, and visual QA evidence pass and are recorded in Phase 49 artifacts.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---:|---:|---|---|
| Goal Clarity | 0.92 | 0.75 | met | Admin operational dashboard with defined metrics and privacy boundary. |
| Boundary Clarity | 0.90 | 0.70 | met | Explicitly excludes lifecycle rewrites, vendors, release smoke, and content inspection. |
| Constraint Clarity | 0.78 | 0.65 | met | Bounded windows, existing stack, indexed queries, and secret-safe payloads are specified. |
| Acceptance Criteria | 0.86 | 0.70 | met | Backend, frontend, visual, lint, build, and privacy checks are pass/fail. |
| **Ambiguity** | 0.12 | <=0.20 | met | Ready for discuss-phase. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|---|---|---|---|
| 1 | Researcher | What exists today related to delivery health? | Message receipt fields, unread helpers, socket lifecycle logging, readiness endpoints, and notification outbox data exist; no dashboard aggregates them. |
| 2 | Simplifier | What is the smallest useful dashboard? | Admin-only recent aggregate metrics, high-risk conversations, socket readiness, and outbox summary. |
| 3 | Boundary Keeper | What is not part of this phase? | No delivery lifecycle rewrite, external observability vendor, production smoke claim, or raw content inspection. |
| 4 | Failure Analyst | What would make the phase unsafe or rejected? | Exposing message text, emails, tokens, encrypted plaintext, attachment filenames, or provider payloads; unbounded scans; non-admin access. |
| 5 | Seed Closer | Which default decisions should be locked? | Auto-selected 24-hour default window with 1h/24h/7d options, 10-risk-row limit, existing admin UI patterns, and metadata-only serialization. |

---

*Phase: 49-delivery-health-dashboard*
*Spec created: 2026-06-30*
*Next step: $gsd-discuss-phase 49 - implementation decisions (how to build what's specified above)*
