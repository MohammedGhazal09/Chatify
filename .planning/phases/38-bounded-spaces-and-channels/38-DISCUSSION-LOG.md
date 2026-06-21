# Phase 38 Discussion Log

## Mode

Auto-selected recommendations because the active workstream is executing the expansion phases without subagents and the roadmap already defines the bounded private-space scope.

## Decisions Captured

- Keep spaces private, small, and member-only.
- Support text channels only.
- Use username-based member adds; do not expose or require email.
- Reuse existing chat/message/socket/unread/notification reliability wherever possible.
- Keep public discovery, bots, integrations, invite links, threads, voice rooms, and encrypted channels out of scope.

## Recommendations

- Implement space/channel backend boundaries before frontend UI so message authorization stays server-owned.
- Use the existing conversation pane for channel messages rather than building a second timeline.
- Prefer all-member channels for the first pass unless private channel scoping is straightforward after backend modeling.

## Deferred

- Public communities, invite links, channel categories, threads, bots/integrations, encrypted channels, ownership transfer, and enterprise admin workflows.
