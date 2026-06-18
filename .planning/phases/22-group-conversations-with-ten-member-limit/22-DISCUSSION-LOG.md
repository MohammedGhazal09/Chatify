---
phase: 22
status: drafted
created_at: 2026-06-18
---

# Phase 22 Discussion Log

## Decisions

1. Dedicated endpoint vs overloaded direct endpoint
   - Recommendation: use `POST /api/chat/create-group-chat`.
   - Rationale: avoids ambiguous payloads and protects direct-chat continuation behavior.

2. Minimum member count
   - Recommendation: require at least 3 total members including creator.
   - Rationale: two-person conversations should remain direct chats.

3. Maximum member count
   - Recommendation: hard cap at 10 total members including creator on both backend and UI.
   - Rationale: this is the explicit product requirement and keeps group UX simple.

4. Username resolution UX
   - Recommendation: username chips with exact submit-time validation, no autocomplete.
   - Rationale: aligns with Phase 21 privacy posture and avoids public directory enumeration.

5. Group calls
   - Recommendation: keep calls/video unavailable for groups with honest disabled copy.
   - Rationale: group call signaling is separate scope.

6. Blocked users
   - Recommendation: reject group creation when the creator is blocked by or has blocked a selected member.
   - Rationale: preserves conversation safety semantics without introducing group moderation complexity.

## Open Questions

No blocking questions. Recommended defaults above are sufficient for implementation.
