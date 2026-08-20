---
phase: 53
created: 2026-07-01
---

# Phase 53 UI Spec

## Surface

Add a protected admin privacy-operations diagnostics view and surface it from the `/admin` operations hub.

## UX Requirements

- Non-admin users see the existing restricted admin state pattern.
- Admin hub gains a Privacy operations card with aggregate status, due deletion count, cleanup backlog, and last run date.
- `/admin/privacy-operations` shows:
  - Summary metrics for pending deletions, due deletions, completed deletions, and cleanup backlog.
  - Worker status with enabled state, interval, last run, and last run status.
  - Retention cleanup counts by artifact type.
  - A privacy boundary note that no emails, message bodies, tokens, reset codes, or push endpoints are shown.
- The page must work in English and Arabic and preserve the existing compact admin visual language.

## Design Constraints

- Use the existing chat admin theme and admin page patterns.
- Keep cards at the existing 8px-or-less radius variable.
- Do not add manual destructive action buttons.
- Use lucide icons for controls and metrics.
- Verify desktop and mobile screenshots with Hercules-compatible Playwright visual QA.
