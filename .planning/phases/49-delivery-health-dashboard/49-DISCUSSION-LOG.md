# Phase 49: delivery-health-dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 49-delivery-health-dashboard
**Areas discussed:** API shape and access, metric semantics, privacy and serialization, runtime and outbox signals, frontend surface

---

## API Shape And Access

| Option | Description | Selected |
|---|---|---|
| Dedicated admin route | Add `GET /api/admin/delivery-health` behind existing auth/admin controls. | yes |
| Reuse moderation route | Add diagnostics under `/api/moderation`. | |
| Public readiness extension | Extend `/api/ready` with delivery health. | |

**User's choice:** Auto-approved recommended default.
**Notes:** Dedicated admin route keeps diagnostics separate from moderation review while preserving admin-only semantics.

---

## Metric Semantics

| Option | Description | Selected |
|---|---|---|
| Bounded recent aggregate metrics | Use 1h/24h/7d windows, message status counts, stale sent/delivered thresholds, and high-risk chat summaries. | yes |
| Full historical analytics | Scan all message history for long-term trends. | |
| Raw delivery event stream | Persist and display every delivery/read event. | |

**User's choice:** Auto-approved recommended default.
**Notes:** The bounded aggregate version matches the existing data model and avoids new event storage or unbounded scans.

---

## Privacy And Serialization

| Option | Description | Selected |
|---|---|---|
| Metadata-only diagnostics | Return counts, statuses, ids, timestamps, and conversation type only. | yes |
| Public identity enrichment | Include usernames/display names for admins. | |
| Raw context drill-down | Include latest message previews, payload snippets, or provider details. | |

**User's choice:** Auto-approved recommended default.
**Notes:** Metadata-only payloads satisfy the Phase 49 privacy boundary and reduce accidental leakage in screenshots/tests.

---

## Runtime And Outbox Signals

| Option | Description | Selected |
|---|---|---|
| Reuse existing runtime/outbox data | Use `getSocketOperationalStatus()` and `NotificationOutbox` aggregate status counts. | yes |
| Add new monitoring daemon | Create background metrics collection. | |
| Vendor integration | Push metrics to an external observability tool. | |

**User's choice:** Auto-approved recommended default.
**Notes:** Reuse keeps the phase focused and avoids new infrastructure.

---

## Frontend Surface

| Option | Description | Selected |
|---|---|---|
| Separate admin delivery dashboard | Add `/admin/delivery-health` with summary cards, risk rows, runtime/outbox panels, window selector, and refresh. | yes |
| Embed in moderation dashboard | Add delivery panels to `AdminModeration`. | |
| Chat sidebar operator panel | Put diagnostics inside the normal chat shell. | |

**User's choice:** Auto-approved recommended default.
**Notes:** A separate admin page avoids overloading moderation workflows and keeps ordinary chat users away from operational data.

---

## the agent's Discretion

- Exact backend file split between controller and utility.
- Exact conservative health thresholds as long as tests document them.
- Exact lucide icons and compact warning copy.

## Deferred Ideas

- External metrics exporters and alerting.
- Per-message or per-user forensic drill-down.
- CSV/PDF export.
- Production smoke recertification.
- Automated remediation actions.
