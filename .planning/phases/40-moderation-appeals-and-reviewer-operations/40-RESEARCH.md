# Phase 40 Research - Moderation Appeals And Reviewer Operations

## Current Code Findings

- Abuse reports already store redacted reporter details, redacted message context, enforcement snapshots, and audit trail entries.
- Admin authorization is server-side through `requireAdmin`; frontend role checks are only UI gates.
- Current admin UI supports filtering, detail review, enforcement selection, reviewer notes, and audit trail display.
- There is no user-facing appeal endpoint, assignment field, operations summary, or enforcement-history endpoint.

## Implementation Recommendation

- Extend existing report serialization instead of creating parallel DTOs.
- Add indexes for `assignedTo`, `appeals.status`, and `reportedUser`.
- Keep appeal reasons/reviewer notes redacted with the existing text redaction pipeline.
- Reuse TanStack Query hooks for admin and user moderation state.
