# Phase 47 Spec: Expiring And Revokable Invite Links

## Objective

Users who manage a private group or space can create a shareable invite link that expires, can be revoked, and can be usage-limited. Authenticated recipients can open the link and join the target without exposing private member emails, creating public discovery, or bypassing existing membership, block, group-cap, and space-role boundaries.

## Recommended Scope

- Build a new invite-link model and API beside the existing permanent space `joinCode`.
- Support standard group conversations and spaces.
- Do not support direct chats or encrypted conversations in this phase.
- Do not add public directories, unauthenticated previews, email/SMS sending, QR codes, vanity URLs, deep post-login redirect persistence, or broad role customization.
- Default invite expiry: 7 days.
- Allowed expiries: 1 day, 7 days, 30 days.
- Allowed usage caps: 1, 5, 10, or unlimited within the target member cap.

## Functional Requirements

1. Group admins can create, list, copy, and revoke active invite links for their standard group conversations.
2. Space owners/admins can create, list, copy, and revoke active invite links for their spaces.
3. Invite tokens are generated with high entropy, shown only at creation time as a link, and stored only as hashes.
4. Invite list responses expose metadata only: target type/id/name, creator public identity, expiry, revoked state, usage count, max uses, and created time.
5. Join accepts an invite token for an authenticated user and returns the joined target or an already-member success state.
6. Expired, revoked, exhausted, malformed, direct-chat, encrypted-chat, non-member-manager, full-target, blocked, and deleted-target paths fail safely with generic copy.
7. Group joins add the user to the group chat only when the group remains below the 10-member cap and block checks pass.
8. Space joins add the user to the space and all current channels only when the space remains below the 25-member cap and block checks pass.
9. Successful joins update relevant query caches and emit existing `chat:new`, `space:new`, and update events where appropriate.
10. Invite link UI is available from group/space management surfaces without exposing emails or raw token hashes.

## Acceptance Criteria

- Backend tests prove token hashing, one-time token exposure, manager authorization, revoke behavior, expiry behavior, max-use behavior, group join, space join, already-member behavior, block behavior, and cap enforcement.
- Frontend tests prove create/list/copy/revoke controls, invite join success/error states, and direct/encrypted hidden states.
- Visual QA covers desktop and mobile invite management plus invite join success/failure.
- Lint and build pass.

## Security And Privacy Boundaries

- Raw invite tokens must not be logged, stored, emitted over sockets, or returned after creation.
- Invite metadata must not include private emails, reset data, cookies, or session metadata.
- Join failures should not reveal whether a private group/space exists beyond a generic invalid/unavailable invite message.
- All invite management endpoints require normal cookie auth and existing CSRF handling.
- Invite creation and revocation are audit-worthy, but this phase only needs sanitized operational logs if logging is added.

## Ambiguity Score

- Scope: 0.10. The phase is bounded to group/space links, not broad onboarding.
- Data/security: 0.15. Token hashing, expiry, revocation, caps, and auth boundaries are clear.
- UI: 0.20. Existing spaces sidebar/detail surfaces are usable anchors; exact placement can follow existing More/details patterns.
- Integration: 0.15. Existing group and space membership flows provide the join behavior.
- Overall: 0.15. Gate passes.
