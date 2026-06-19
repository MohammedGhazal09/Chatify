# Phase 30 Platform Expansion Design

## Bounded Channels Or Shared Spaces

Recommendation: if Chatify expands beyond direct/group conversations, start with private shared spaces, not public servers.

Initial space constraints:

- Private invite-only membership.
- Small initial member cap.
- Reuse username identity and no email exposure.
- Reuse message authorization, attachment authorization, notification privacy, and moderation report primitives.
- No public directory, public posting, or anonymous access.
- No federation.

## Bots And Integrations

Bots and integrations are deferred until scoped permissions exist.

Required controls before runtime execution:

- Developer/app registration with owner identity.
- Explicit scopes such as `messages:read`, `messages:write`, `channels:read`, `webhooks:send`.
- Per-space or per-conversation installation.
- User/admin approval and revocation.
- Signed inbound webhooks.
- Outbound webhook allowlist and retry limits.
- Audit trail for install, revoke, token rotation, message send, and failure events.
- Rate limits per integration, per workspace/space, and per user.
- Abuse reports that can identify bot-originated messages.

## Non-Goals

- Broad Slack/Discord clone.
- Public discoverable servers.
- Arbitrary unreviewed bot code execution.
- Integrations that can bypass user block/mute/moderation boundaries.
