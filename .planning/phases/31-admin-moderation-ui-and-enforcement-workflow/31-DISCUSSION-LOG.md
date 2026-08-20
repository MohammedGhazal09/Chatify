# Phase 31 Discussion Log

## Auto Mode Summary

The user approved executing all previously recommended Phase 31 work inline. No subagents are allowed by repo instruction, so the GSD spec, discussion, UI, plan, execute, review, and verification steps are being handled in the current thread.

## Decisions

| Decision | Recommendation | Rationale |
|---|---|---|
| Admin surface | Build `/admin/moderation` | Keeps admin tooling separate from user chat flows while reusing app auth/session bootstrapping. |
| API strategy | Extend Phase 28 moderation routes | The existing routes already have auth, CSRF, rate limits, redaction, and admin role checks. |
| Enforcement scope | Add warn, restrict, lift restriction, and content removal | Covers account and content outcomes without broad admin-suite expansion. |
| Role exposure | Include current user's role from `getLoggedUser` only | Enables admin navigation while preserving server-side authorization as the source of truth. |
| Testing scope | Focused backend API tests and frontend component/page tests | Matches the risk surface and avoids a brittle full e2e admin dependency on local secrets. |

## Questions Treated As Approved

1. Should restriction duration be configurable in this phase?
   - Recommendation: default to a server-owned seven-day messaging restriction for Phase 31.
   - Reason: safer than trusting arbitrary client duration input and enough to prove reversible enforcement.
2. Should content removal emit realtime socket updates immediately?
   - Recommendation: persist the tombstone now and leave realtime moderation broadcasts for a later phase unless tests show a regression.
   - Reason: the phase asks for enforcement and auditability; adding socket fanout would widen scope and risk.
3. Should non-admins be blocked client-side before API calls?
   - Recommendation: show a forbidden state when the known user role is not admin, while still letting API 403 be authoritative.
   - Reason: improves UX without relying on client claims.
