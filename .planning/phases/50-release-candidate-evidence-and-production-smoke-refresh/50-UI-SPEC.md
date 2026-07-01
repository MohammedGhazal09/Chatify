# Phase 50 UI-SPEC: Release Evidence Visual QA Contract

## UI Surface Scope

Phase 50 does not add a new product page. Its UI contract is a visual QA refresh for existing release-critical surfaces:

- Chat messenger shell at `/` with deterministic Phase 06/08 fixtures.
- Admin delivery-health dashboard at `/admin/delivery-health` with deterministic Phase 49 fixtures.
- Production smoke config remains command-only and has no rendered UI.

## Visual Requirements

- Desktop chat and admin screenshots must show readable hierarchy, no horizontal overflow, and no overlapping composer/header/rail content.
- Mobile chat and admin screenshots must show touch-sized controls, no composer overlap, and no clipped text.
- Tablet RTL admin screenshot must keep Arabic direction, labels, and empty state readable.
- Error and permission states must remain clear and must not expose private diagnostics.

## Interaction Requirements

- Chat search, drawer/detail close paths, retry/dismiss, and route restore remain covered by existing Playwright flows.
- Admin delivery-health window switch, refresh, non-admin, empty, and backend-error states remain covered by existing Playwright flows.
- Console errors and failed network requests must be collected or explicitly reported when unavailable.

## Accessibility Basics

- Pages must retain visible headings.
- Important controls must have accessible names.
- Keyboard close paths for search, menus, and dialogs remain part of the checked flows.
- No color-only status indicators may be introduced by Phase 50.

## Screenshot Matrix

| Surface | Viewport | State | Required evidence |
|---|---|---|---|
| Chat | 1440x900 | light desktop | Screenshot and workflow assertions |
| Chat | 390x844 | mobile | Screenshot and workflow assertions |
| Admin delivery health | 1366x768 | populated desktop | Screenshot and workflow assertions |
| Admin delivery health | 390x844 | populated mobile | Screenshot |
| Admin delivery health | 768x1024 | Arabic RTL empty | Screenshot |
| Admin delivery health | 1366x768 | non-admin and backend error | Screenshots |

## Out Of Scope

- Pixel-diff baselines.
- New UI components.
- Live production screenshots with real user data.

## Approval

Approved for Phase 50 when the report records every tested, blocked, or untested item in a Hercules-compatible coverage ledger.
