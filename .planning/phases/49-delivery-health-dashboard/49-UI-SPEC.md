---
phase: 49
slug: delivery-health-dashboard
status: approved
shadcn_initialized: false
preset: none
created: 2026-06-30
---

# Phase 49 - UI Design Contract

> Visual and interaction contract for the admin delivery-health dashboard.

---

## Product Intent

| Item | Contract |
|---|---|
| Human | A Chatify maintainer or admin checking whether message delivery is healthy before investigating logs or database state. |
| Job | Identify stale sends, stale reads, realtime/socket problems, and notification outbox failures quickly. |
| Feel | Quiet operations console: dense, scannable, restrained, and trustworthy. |
| Focal point | The health summary row leads; the highest-risk conversation list is second. |
| Signature | Receipt-lane risk rows: sent, delivered, read, unread, realtime, and outbox signals line up as compact operational lanes. |

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | native controls, existing React/Tailwind components |
| Icon library | lucide-react |
| Font | Existing app/system font stack |

Use `chat.css` variables and the existing admin moderation shell conventions. Do not introduce shadcn, charting, data-grid, or CSS framework dependencies.

---

## Spacing Scale

Declared values must be multiples of 4:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, small status dots |
| sm | 8px | Inline labels, compact row cells |
| md | 16px | Metric card padding, mobile stack gaps |
| lg | 24px | Page gutters, section spacing |
| xl | 32px | Desktop grid gaps |
| 2xl | 48px | Top/bottom page breathing room |

Exceptions: `1px` borders only; no arbitrary negative margins or viewport-scaled type.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.5 |
| Label | 11-12px | 600 | 1.25 |
| Heading | 20-24px | 700 | 1.2 |
| Display metric | 28-32px | 700 | 1.05 |
| Table/meta | 12-13px | 500 | 1.35 |

Metric numbers must use tabular numerals. Keep headings balanced and keep long row labels wrapped, not clipped.

---

## Color

Use existing CSS variables instead of new hard-coded palettes.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--chat-bg)` | Page background |
| Secondary (30%) | `var(--chat-panel)`, `var(--chat-panel-subtle)` | Metric panels, risk rows, runtime sections |
| Accent (10%) | `var(--chat-accent)` | Active window selector, primary refresh affordance, focus state |
| Warning | existing warning/status token or amber utility with low opacity | Stale delivered/sent emphasis only |
| Destructive | `var(--chat-danger)` | Failed outbox and blocked states only |
| Success | existing success/status token or green utility with low opacity | Healthy status only |

Accent reserved for: active segmented option, refresh button, focus ring, and selected/healthy state accent line. Do not color every metric.

---

## Layout Contract

| Surface | Desktop | Mobile |
|---|---|---|
| Page shell | Full-height admin page using `chat-theme-root` and `bg-[var(--chat-bg)]`. | Same shell; content stacks with 16px gutters. |
| Header | Back link, eyebrow, title, generated time, window selector, refresh icon button. | Header wraps controls; selector remains tappable with min 40px hit area. |
| Summary | 4-6 compact metric panels in a responsive grid. | Two-column when possible, otherwise one column. |
| Risk list | Table-like rows with receipt-lane metrics; no raw message previews. | Card-like row list with same fields stacked. |
| Runtime/outbox | Two side-by-side panels below summary or beside risk list if width allows. | Stack below risk list. |

No nested cards. Each repeated metric/risk row may be card-like, but page sections should be unframed layouts or simple panels.

---

## Interaction Contract

| Interaction | Contract |
|---|---|
| Window selector | Segmented control with `1h`, `24h`, `7d`; default `24h`; active state is visually and programmatically clear. |
| Refresh | Icon button with `RefreshCw`, `aria-label`, pending state, and no layout shift. |
| Non-admin | Restricted state matches moderation admin access style and does not fire the query. |
| Loading | Skeleton or compact loading panels that preserve layout dimensions. |
| Empty | Clearly states no recent delivery risk for the selected window. |
| Error | States diagnostics are unavailable and offers refresh. |
| RTL | Header, selector, rows, and metric flow respect `dir`. Numeric metric alignment stays readable. |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Page title | Delivery health |
| Eyebrow | Admin diagnostics |
| Primary CTA | Refresh diagnostics |
| Empty state heading | No delivery risk in this window |
| Empty state body | Recent message delivery looks clear. Try another window if you need a wider check. |
| Error state | Delivery diagnostics unavailable. Refresh or check backend readiness. |
| Restricted state | Admin access required |

Keep labels operational and short. Avoid help text that explains how the app works.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party | none | not allowed |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-06-30
