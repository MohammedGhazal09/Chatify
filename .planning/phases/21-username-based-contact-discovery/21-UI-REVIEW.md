---
phase: 21
review_type: ui
status: passed
reviewed_at: 2026-06-18
---

# Phase 21 UI Review

## Findings

No blocking UI findings.

## Checked

- New-chat dialog labels the field as `Username`, uses `targetUsername`, disables email autocomplete, and keeps the existing focus trap and Escape return-focus behavior.
- Sidebar empty state now tells users to start direct chats by username.
- Invalid username feedback is short and recoverable.
- Missing/self-target server failures stay generic and do not expose email/account existence details.

## Recommendation

Keep Phase 21 as exact username entry only. Do not add autocomplete or a public directory until a later phase defines enumeration controls, dedicated rate limits, and privacy copy.
