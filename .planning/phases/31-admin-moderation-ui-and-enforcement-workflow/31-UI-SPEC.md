# Phase 31 UI Specification

## Route

- Path: `/admin/moderation`
- Access: authenticated route; UI shows forbidden state for non-admin users, while API 403 remains authoritative.

## Layout

- Full-height work surface using the existing Chatify chat theme tokens.
- Left queue column:
  - status segmented filter: Open, Reviewed, Dismissed, Action taken, All
  - report rows with priority, report type, status, age, reporter label, reported label, and reason
  - empty, loading, and recoverable error states
- Right detail column:
  - selected report summary
  - redacted reported user/chat/message context
  - reviewer form with status, enforcement action, and note
  - audit trail entries
  - no-selection state on desktop and stacked selected-detail flow on mobile

## Copy

- Page title: `Moderation`
- Forbidden state: `Admin access required`
- Empty state: `No reports match this filter`
- Review success toast/status: `Review saved.`
- Review failure fallback: `Could not save the moderation review.`

## Accessibility

- Queue rows are buttons with clear accessible names.
- Filter controls use real buttons with `aria-pressed`.
- Review form controls use labels, not placeholder-only fields.
- Status/error messages use `role="status"` or `role="alert"` as appropriate.
- Focus outlines use existing `--chat-focus` token.
- Keyboard-only flow supports selecting a report, changing controls, submitting review, and returning to chat.

## Privacy Rules

- Do not render emails, tokens, cookies, reset codes, raw bearer tokens, SDP, ICE candidates, or provider secrets.
- Reporter and reported labels use username/display-name snapshots or short report ids, not email.
- Message context uses the existing redacted text preview only.

## Responsive Behavior

- Desktop: two-column grid with sticky queue/header and independently scrollable detail panel.
- Mobile: queue and detail stack vertically; controls remain visible without horizontal overflow.
