# Phase 34 Discussion Log

## 2026-06-20

- Decision: Reuse the existing conversation-scoped search route and add structured filters to it.
  - Recommendation: keep Phase 34 scoped to selected-conversation search, because global search would need different pagination, result grouping, and privacy review.
- Decision: Add a message-context endpoint for jump-to-result.
  - Recommendation: use a bounded server-provided window around the selected message instead of asking the frontend to page older messages repeatedly.
- Decision: Link search will inspect visible message text only.
  - Recommendation: do not crawl links or parse attachment contents in this phase; those features have separate privacy and abuse implications.
- Decision: Empty `q` is valid only when at least one narrowing filter is supplied.
  - Recommendation: users can browse sender/date/type-filtered results without typing filler text, while unbounded empty searches remain rejected.
