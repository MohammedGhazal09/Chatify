# Phase 28: Trust And Abuse Safety Foundation - Specification

**Created:** 2026-06-19
**Ambiguity score:** 0.14 (gate: <= 0.20)
**Requirements:** V2-MOD-01, V2-ADMIN-01, BLOCK-01, BLOCK-02, SEC-02, TEST-01

## Goal

Add the first abuse-safety layer beyond direct-user blocking: users can report users, messages, and conversations; maintainers can review reports through an admin-only API; report context is membership-checked, rate-limited, redacted, and auditable.

## Background

Phase 11 already shipped direct-chat blocking and conversation controls. Phases 20-22 moved public discovery and group participant surfaces to usernames so private email addresses should not appear in chat identity surfaces. Phase 28 promotes the next safety primitive: abuse reporting and maintainer review. This is not a full admin suite, account suspension system, content takedown system, or trust-and-safety dashboard.

## Requirements

1. **Report intake**: Authenticated users can report a direct peer, a visible message, or a conversation from supported chat surfaces.
2. **Membership and privacy checks**: Message and conversation reports are accepted only for conversations the reporter belongs to, and self-reporting is rejected.
3. **Redacted context storage**: Reports persist enough review context while redacting emails, tokens, secrets, cookies, and overlong message text.
4. **Admin review boundary**: Report listing and review updates require an admin role loaded from server-side user state, not client-supplied role data.
5. **Audit trail**: Review decisions update report status and append an audit entry with reviewer, decision, action, note, and timestamp.
6. **User-facing report states**: Chat menus expose report actions and return honest success/failure toasts without promising instant enforcement.

## Boundaries

**In scope:**
- Abuse report model, controller, route, route-specific rate limiters, and admin middleware.
- Backend tests for report creation, redaction, membership checks, CSRF, admin denial, admin review, direct user reports, and self-report rejection.
- Frontend API hook and report actions in existing conversation/message menus.
- Phase 28 GSD artifacts and requirement traceability.

**Out of scope:**
- A full admin UI/dashboard.
- Account suspension, message removal, automatic enforcement, appeal flows, or trust queue assignment.
- End-to-end encryption implementation or notification expansion.
- Release-readiness claims; Phase 25 production evidence blockers remain separate.

## Acceptance Criteria

- [x] Report routes are protected by auth, CSRF, membership checks, and rate limiters.
- [x] Report responses and stored context do not expose private emails or raw secrets.
- [x] Non-admin users cannot list or review reports.
- [x] Admin review changes status/action and writes an audit trail entry.
- [x] Conversation and received-message menus expose accessible report actions.
- [x] Focused backend and frontend tests pass.
- [x] Frontend lint and production build pass.

## Recommendation

Treat Phase 28 as a foundation phase. My recommendation is to add the full admin dashboard and actual enforcement actions only after Phase 29 resolves moderation/encryption tradeoffs, because encryption can change what reviewers are able to inspect.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---:|---:|---|---|
| Goal Clarity | 0.90 | 0.75 | PASS | Abuse report intake and admin review are explicit. |
| Boundary Clarity | 0.88 | 0.70 | PASS | Full admin suite and enforcement are out of scope. |
| Constraint Clarity | 0.90 | 0.65 | PASS | Membership, redaction, CSRF, rate limits, and no release claim are concrete. |
| Acceptance Criteria | 0.92 | 0.70 | PASS | Tests and verification are command-backed. |
| **Ambiguity** | 0.14 | <=0.20 | PASS | Remaining ambiguity is product policy, deferred to later phases. |

---

*Phase: 28-trust-and-abuse-safety-foundation*
*Spec created: 2026-06-19*
