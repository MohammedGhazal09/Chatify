# Phase 42 Discussion Log - Contact Requests And Trusted Conversation Onboarding

**Date:** 2026-06-30
**Mode:** Auto-approved recommendations

## Questions And Decisions

| Area | Question | Recommendation | Decision |
|------|----------|----------------|----------|
| Gate placement | Should request approval be UI-only or backend-enforced? | Backend-enforced in `createChat`. | Approved. |
| Data model | Should accepted contacts become a separate contact graph? | No; use accepted request records first. | Approved. |
| Existing conversations | Should legacy direct chats require retroactive approval? | No; existing direct chats are trusted. | Approved. |
| Encrypted chats | Should encrypted request/key-sharing be included? | No; defer encrypted request onboarding. | Approved. |
| UI location | Where should users manage requests? | Existing messenger dialog/sidebar surfaces. | Approved. |
| Realtime | Should sockets be authoritative? | No; HTTP refetch is source of truth. | Approved. |

## Deferred

- Expiration and invite links.
- Broad contact graph and recommendations.
- Request push/email notifications.
- Encrypted request key exchange.
