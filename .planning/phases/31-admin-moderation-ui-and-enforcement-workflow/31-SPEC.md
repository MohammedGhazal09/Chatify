# Phase 31: Admin Moderation UI And Enforcement Workflow - Specification

**Created:** 2026-06-20
**Mode:** Auto-approved inline execution
**Requirements:** V2-ADMIN-02, V2-ADMIN-01, V2-MOD-01, BLOCK-01, BLOCK-02, SEC-02, TEST-01, TEST-03

## Goal

Build a protected admin moderation workspace on top of the Phase 28 abuse-report API so admins can triage reports, inspect redacted context, record review notes, and apply scoped enforcement without exposing private data.

## Current State

- Phase 28 created abuse report intake, redacted report snapshots, admin-only report listing/review, CSRF protection, rate limits, and audit trail writes.
- The frontend exposes report actions from chat menus but has no admin moderation route.
- Review actions can store `restricted` or `content_removed` labels, but no persisted enforcement effect is applied yet.
- Logged-in user payloads do not expose the server-owned `role`, so the client cannot safely show admin-only navigation.

## Target State

- Admins can open `/admin/moderation` and triage a privacy-safe report queue with status filters, priority, report type, age, reporter/reported labels, and selectable reports.
- Report detail shows redacted message/conversation/user context, reviewer note history, current status, and enforcement action controls.
- Admin review calls persist status, notes, audit entries, and scoped enforcement effects from server-side admin identity.
- Normal users receive a clear forbidden/no-permission state and cannot list, read, or review reports.
- Tests cover backend admin boundaries/enforcement and frontend queue/detail states.

## Auto-Approved Recommendations

1. Use a focused `/admin/moderation` route rather than adding moderation panels inside the main chat view.
   - Rationale: keeps regular chat flows stable and makes admin authorization/a11y states easier to test.
2. Extend the Phase 28 moderation API instead of creating a parallel admin API.
   - Rationale: reuses existing CSRF, rate limit, redaction, membership, and audit contracts.
3. Apply minimal scoped enforcement first: warn user, restrict user messaging, lift restriction, or remove reported message content.
   - Rationale: covers reversible account enforcement and scoped content action without expanding into a full tenant/admin suite.
4. Expose only the current user's `role` from `getLoggedUser`.
   - Rationale: admins need navigation affordances, but all real authorization remains server-side.

## Acceptance Criteria

- [ ] Admin-only UI lists reports with status, priority, type, age, reporter/reported labels, and filters.
- [ ] Report detail displays redacted context, audit trail entries, reviewer notes, and status transitions.
- [ ] Review updates are CSRF-protected, rate-limited, and authorized from persisted admin role data.
- [ ] Enforcement actions apply durable effects where applicable:
  - `warned`: records a warning marker on the reported user.
  - `restricted`: blocks the reported user's new message sends until the restriction expires.
  - `restriction_lifted`: clears the reported user's active messaging restriction.
  - `content_removed`: tombstones the reported message without exposing raw content.
- [ ] Normal users cannot access report list/detail/review and see a usable forbidden state in the UI.
- [ ] Reports, audit entries, UI text, tests, and logs do not expose emails, tokens, cookies, reset codes, or provider secrets.
- [ ] Focused backend and frontend tests pass, plus frontend lint/build verification.

## Out Of Scope

- Appeals, reviewer assignment queues, multi-admin permissions, tenant administration, and analytics.
- Full content moderation policy authoring.
- Automated detection or machine review.
- Production deployment or Phase 25 release closeout.
