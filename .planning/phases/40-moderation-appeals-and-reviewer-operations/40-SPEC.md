# Phase 40 Specification - Moderation Appeals And Reviewer Operations

## Objective

Users can appeal supported moderation enforcement decisions, while admins can assign moderation work, review appeal outcomes, inspect enforcement history, and monitor operations counts without exposing private messages, emails, tokens, or report internals.

## Recommended Scope

- Add appeal records to moderation reports for warning, restriction, and content-removal outcomes.
- Add user-facing endpoints for own enforcement history and appeal submission.
- Add admin assignment, appeal review, enforcement-history, and operations-summary endpoints.
- Extend the protected moderation workspace with assignment, appeal, workload, and metrics surfaces.
- Add a compact user-facing Settings surface for appealable moderation outcomes.

## Out Of Scope

- Automated enforcement decisions.
- Public moderation transparency pages.
- Organization-wide administrator governance.
- Legal/compliance case-management exports.
- Permanent account deletion or suspension workflows beyond existing moderation actions.

## Success Criteria

1. Users can see their own appealable enforcement outcomes and submit one open appeal per outcome.
2. Admins can assign reports to themselves or another admin without trusting client role claims.
3. Admins can resolve appeals with accepted/rejected outcomes and redacted reviewer notes.
4. Admins can inspect enforcement history and reviewer operations counts without private data leakage.
5. Backend and frontend tests cover authorization, redaction, appeal state transitions, assignment, metrics, and UI loading/error/empty states.

## Recommendation

Keep the appeal model embedded in `AbuseReport` for this phase. It preserves existing moderation audit locality, avoids a new cross-collection consistency problem, and still supports a later extraction if appeals become a larger workflow.
