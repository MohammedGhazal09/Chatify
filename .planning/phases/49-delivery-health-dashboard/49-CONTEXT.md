# Phase 49: delivery-health-dashboard - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 49 adds a protected admin delivery-health dashboard and diagnostics API that summarize existing message lifecycle, realtime, unread, and notification-outbox health without changing delivery semantics or exposing private content.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**6 requirements are locked.** See `49-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `49-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**

- Admin-only backend diagnostics endpoint for recent delivery health.
- Server-computed aggregate delivery/read/stale receipt metrics.
- Bounded high-risk conversation summaries without private content.
- Socket readiness and notification outbox summary signals.
- Frontend admin dashboard route with responsive states and refresh/window controls.
- Focused backend, frontend, lint, build, visual QA, and traceability evidence.

**Out of scope (from SPEC.md):**

- Changing message send, delivery, read, unread, retry, or socket semantics - this phase observes existing behavior and must not rewrite the lifecycle.
- External observability vendors, metrics collectors, background jobs, Prometheus, Grafana, or alert routing - Phase 49 is an in-app operational surface.
- Production smoke reruns or release-readiness claims - Phase 25/17 release evidence remains a separate gate.
- Per-user private investigation tooling or raw participant identity inspection - the dashboard is aggregate and metadata-only.
- Message content search, attachment inspection, encrypted plaintext recovery, or notification provider payload replay - these would violate the privacy boundary.
- Broad admin suite redesign - reuse existing admin UI and route patterns.

</spec_lock>

<decisions>
## Implementation Decisions

### API Shape And Access
- **D-01:** Add a dedicated admin API surface at `GET /api/admin/delivery-health`, mounted behind `protect`, `csrfProtection`, `moderationReviewLimiter`, and `requireAdmin`.
- **D-02:** Keep the endpoint read-only and metadata-only; it must not accept chat ids, user ids, message ids, free-text filters, or drill-down parameters in Phase 49.
- **D-03:** Support `window` query values of `1h`, `24h`, and `7d`; default to `24h`; reject unsupported windows with a 400 response.
- **D-04:** Return a single payload with `summary`, `riskConversations`, `runtime`, `outbox`, and `generatedAt` sections so the frontend can render one dashboard query without stitching multiple endpoints.

### Metric Semantics
- **D-05:** Compute delivery lifecycle counts from `Messages.createdAt` inside the selected window: total recent messages, `sent`, `delivered`, and `read` counts.
- **D-06:** Compute rates as bounded percentages over total recent messages: delivery rate counts delivered plus read messages; read rate counts read messages.
- **D-07:** Treat a message as stale-sent when it is still `sent` and older than 5 minutes; treat a message as stale-delivered when it is `delivered` and older than 24 hours without a read transition.
- **D-08:** Exclude call activity messages from delivery-health counts because they use call-session semantics rather than ordinary message receipt semantics.
- **D-09:** Risk rows should be derived from recent chat-level aggregation and sorted by a deterministic score: stale sent first, then stale delivered, then unread estimate, then latest activity.

### Privacy And Serialization
- **D-10:** Conversation risk rows may include only chat id, conversation kind, member count, recent message count, stale counts, unread estimate, last activity time, and high-level flags.
- **D-11:** Do not populate users, serialize member identity, include latest-message text, attachment names, encrypted payload fields, notification payload body, provider raw responses, emails, tokens, cookies, reset codes, or freeform log metadata.
- **D-12:** Add explicit tests with seeded sensitive strings to prove the backend response and rendered dashboard stay metadata-only.

### Runtime And Outbox Signals
- **D-13:** Reuse `getSocketOperationalStatus()` for socket initialized/connected-user/connected-socket counts and make the diagnostics utility tolerate an uninitialized Socket.IO server.
- **D-14:** Summarize `NotificationOutbox` by status and channel for message notifications inside the selected window; count only statuses and attempts, not payload text or provider details.
- **D-15:** Include a simple health classification per section (`ok`, `degraded`, `blocked`) based on stale counts, socket initialization, and failed outbox counts; keep thresholds conservative and documented in tests.

### Frontend Surface
- **D-16:** Add a lazily loaded `AdminDeliveryHealth` page at `/admin/delivery-health`, separate from moderation review but visually consistent with `AdminModeration`.
- **D-17:** Add typed `deliveryHealthApi` and `useDeliveryHealth` query hook rather than calling Axios directly from the page.
- **D-18:** The page should render summary metric cards, a risk-conversation table/list, runtime status, notification outbox status, a segmented window selector, and an icon refresh button.
- **D-19:** Non-admin users see the same style of restricted admin state used by moderation pages and the query remains disabled.
- **D-20:** Reuse existing Chatify theme CSS variables and lucide icons; avoid nested cards, marketing layouts, charts that need extra dependencies, or text-heavy instructions.
- **D-21:** Localize user-facing labels in English and Arabic, preserve RTL layout, and keep mobile parity by stacking the risk list and metric panels.

### the agent's Discretion
- Choose whether backend aggregation lives in a new `adminController.mjs` or a focused diagnostics utility imported by that controller, as long as routers stay thin and tests can call the utility.
- Choose exact warning copy and icon choices from lucide, with a preference for operational labels such as "Stale sent" and "Outbox failed".
- Use focused component/API/hook tests plus one Playwright/Hercules visual path rather than building a broad end-to-end fixture suite.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/phases/49-delivery-health-dashboard/49-SPEC.md` - Locked requirements, boundaries, constraints, and acceptance criteria.
- `.planning/REQUIREMENTS.md` - Existing delivery, realtime, notification, privacy, admin, and test traceability.
- `.planning/ROADMAP.md` - Phase 49 roadmap position and prior delivery-health history.
- `.planning/STATE.md` - Current completed phase chain and outstanding production evidence boundaries.
- `.planning/phases/18-operational-observability-and-runbook-hardening/18-SPEC.md` - Existing observability scope and secret-safe runtime constraints.
- `.planning/phases/18-operational-observability-and-runbook-hardening/18-OPERATIONS-READINESS.md` - Existing operations readiness evidence and release-blocker boundary.

### Backend
- `Backend/Chatify/app.mjs` - API route mounting, CSRF, protect, readiness, and queue middleware order.
- `Backend/Chatify/Routes/moderationRouter.mjs` - Existing admin-only route and limiter pattern.
- `Backend/Chatify/Middlewares/requireAdmin.mjs` - Admin authorization boundary.
- `Backend/Chatify/Models/messageModel.mjs` - Message status, read, delivered, readBy, chat, sender, and indexes.
- `Backend/Chatify/Models/chatModel.mjs` - Conversation type, member count, group, space-channel, and latest-message metadata.
- `Backend/Chatify/Models/notificationOutboxModel.mjs` - Notification delivery status/channel data.
- `Backend/Chatify/Utils/messageState.mjs` - Message status constants and unread filter semantics.
- `Backend/Chatify/Utils/operationalReadiness.mjs` - Existing health/readiness payload style.
- `Backend/Chatify/Config/socket.mjs` - `getSocketOperationalStatus()` and socket lifecycle counters.
- `Backend/Chatify/test/observability/health-readiness.test.mjs` - Secret-safe operations response tests.
- `Backend/Chatify/test/notification/notification.delivery.test.mjs` - Notification outbox test patterns.

### Frontend
- `Frontend/Chatify/src/App.tsx` - Lazy route registration and protected admin routes.
- `Frontend/Chatify/src/pages/admin/AdminModeration.tsx` - Admin shell, non-admin restricted state, operations summary cards, theme usage, RTL handling.
- `Frontend/Chatify/src/pages/admin/AdminModeration.test.tsx` - Admin page test setup and API mocking.
- `Frontend/Chatify/src/api/moderationApi.ts` - Admin API typing pattern.
- `Frontend/Chatify/src/hooks/useModerationReports.ts` - Admin query enablement pattern.
- `Frontend/Chatify/src/i18n/locales.ts` - English/Arabic localized labels and translation key typing.
- `Frontend/Chatify/src/pages/chat/chat.css` - Chatify theme tokens used by admin pages.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireAdmin` can protect the diagnostics endpoint without adding a second role-checking pattern.
- `moderationReviewLimiter` is the closest existing limiter for read-only admin operations.
- `getSocketOperationalStatus()` already exposes initialized and connection counts.
- `NotificationOutbox` already stores status, channel, attempts, timestamps, and message linkage needed for aggregate outbox diagnostics.
- `AdminModeration` provides a working admin page structure, restricted state, operations cards, theme wrapper, RTL support, and refresh action pattern.

### Established Patterns
- Backend routers remain thin; controller functions own validation, aggregation, and response shaping.
- Admin APIs use cookie auth plus `requireAdmin`, not client-side role trust.
- Frontend pages use typed API modules and TanStack Query hooks; pages do not call Axios directly.
- UI surfaces should use existing `--chat-*` theme variables and lucide icons.
- Privacy-sensitive diagnostics must be test-guarded with seeded sensitive values, following Phase 18 operations response patterns.

### Integration Points
- Add an admin route import/mount in `Backend/Chatify/app.mjs`.
- Add `Backend/Chatify/Routes/adminRouter.mjs` and a focused controller/utility for delivery health aggregation.
- Add frontend API/hook/types for delivery health diagnostics.
- Add a lazy `/admin/delivery-health` route in `Frontend/Chatify/src/App.tsx`.
- Add `Frontend/Chatify/src/pages/admin/AdminDeliveryHealth.tsx` and focused tests.

</code_context>

<specifics>
## Specific Ideas

- Use compact labels like "Delivery rate", "Read rate", "Stale sent", "Stale delivered", "Realtime", and "Outbox".
- Show a generated timestamp so admins know whether they are looking at fresh diagnostics.
- Prefer rows and small panels over charts for the first version; counts and risk ordering are more useful than decoration.
- Keep the default `24h` window selected on first load and expose `1h` and `7d` as segmented controls.

</specifics>

<deferred>
## Deferred Ideas

- External metrics exporters, alerting, Grafana/Prometheus integration, and webhook incident routing.
- Per-message or per-user forensic drill-down.
- CSV/PDF export.
- Production smoke execution and release-readiness recertification.
- Automated remediation actions for delivery failures.

</deferred>

---

*Phase: 49-delivery-health-dashboard*
*Context gathered: 2026-06-30*
