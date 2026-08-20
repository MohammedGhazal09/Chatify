# Phase 51 Spec: Admin Navigation And Operations Hub

## Goal

Add a protected admin operations hub that makes existing moderation and delivery-health tools discoverable from one route without expanding admin authority or exposing private data.

## Requirements

- `V2-ADMIN-02`: Admin operations surfaces are discoverable from a single protected hub.
- `V2-ADMIN-03`: Non-admin users see an access-required state and do not trigger admin data requests.
- `V2-ADMIN-04`: Existing admin surfaces remain reachable with direct links and back-navigation to chat.
- `V2-I18N-02`: The hub supports English/Arabic labels and RTL layout.
- `TEST-04`: Add focused component coverage.
- `TEST-05`: Capture behavior-backed visual QA.

## Acceptance Criteria

1. `/admin` renders only for authenticated users with `role === "admin"` and otherwise shows the same style of restricted state as existing admin pages.
2. The chat sidebar admin shortcut points to `/admin` instead of a single admin subtool.
3. The hub includes clear links to `/admin/moderation` and `/admin/delivery-health`.
4. The hub surfaces aggregate-only status from existing moderation and delivery-health hooks; it must not display message text, user emails, notification payloads, tokens, cookies, or raw IDs beyond existing aggregate labels.
5. English and Arabic labels fit desktop and mobile layouts.
6. Tests cover admin, non-admin, and localized hub rendering.
7. Visual QA covers desktop, mobile, RTL, and non-admin states.

## Non-Goals

- No new backend endpoint.
- No new moderation or delivery-health authority.
- No new admin role-management UI.
- No production launch-readiness claim; Phase 50 blockers still stand.

## Recommendation

Build the hub as a frontend-only route that composes existing hooks. This keeps Phase 51 low-risk and avoids duplicating backend access-control logic already covered by `requireAdmin`.
