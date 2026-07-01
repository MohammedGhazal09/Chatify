# Phase 51 Discussion Log

## Decision 1: Frontend-Only Hub

Recommendation: implement Phase 51 without a backend endpoint. Existing admin pages already have backend authority and aggregate hooks.

Outcome: accepted.

## Decision 2: Sidebar Shortcut Target

Recommendation: change the chat sidebar admin shortcut from `/admin/moderation` to `/admin` so admins land on the operations hub first.

Outcome: accepted.

## Decision 3: Hub Scope

Recommendation: include moderation and delivery-health cards only. Release-candidate evidence remains a planning artifact from Phase 50, not a runtime admin feature.

Outcome: accepted.

## Decision 4: Visual QA Coverage

Recommendation: cover desktop, mobile, Arabic RTL, and non-admin states with Playwright screenshots.

Outcome: accepted.
