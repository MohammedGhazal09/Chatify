# Phase 47 Discussion Log

## Defaults Applied

- **Recommendation:** Implement invite links as a new hashed-token model.
  **Rationale:** Existing space join codes are permanent and manager-visible; expiring/revokable links need separate lifecycle state.

- **Recommendation:** Support groups and spaces only.
  **Rationale:** Direct chats are trust-gated by contact requests, and encrypted conversation invites would require key-sharing design outside this phase.

- **Recommendation:** Require `groupAdmin` for groups and owner/admin for spaces.
  **Rationale:** This matches existing authority models and avoids broad member-controlled membership growth.

- **Recommendation:** Return already-member success for join links.
  **Rationale:** Users often reopen invites; this should navigate them to the target rather than presenting a confusing failure.

- **Recommendation:** Keep invite join protected behind normal auth.
  **Rationale:** Unauthenticated previews can leak private group/space names and require more recovery logic than this phase needs.

## Grey Areas Resolved

- Expiry presets: 1, 7, and 30 days.
- Default expiry: 7 days.
- Usage caps: 1, 5, 10, or unlimited.
- Link display: raw URL only in create response; metadata-only list later.
- UI placement: management controls in conversation/space management surfaces; join route at `/invite/:token`.

## Non-Goals

- Public discovery.
- Email/SMS invite delivery.
- Invite QR codes.
- Custom invite slugs.
- Invite analytics dashboards.
- Encrypted group key distribution.
