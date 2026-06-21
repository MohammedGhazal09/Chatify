# Phase 33 Research Notes

## Codebase Findings

- Chat responses are already requester-specific, so adding `organizationState` to serialization fits the existing pattern.
- Muting currently lives in `notificationPreferences.mutedChatIds`; notification delivery checks this field before enqueue.
- The sidebar already receives `unreadCounts`, `mutedChatIds`, selected chat id, and search state.
- The detail rail already has a favorite/star action that currently uses local state.
- `useChatSocket` already updates chat cache for `conversation:controls-updated`, which gives a clear pattern for same-user organization updates.

## Implementation Direction

- Add a per-user organization persistence model and helpers.
- Extend chat serialization with `organizationState`.
- Add a protected PATCH route under `/api/chat/:chatId/organization`.
- Replace local favorite persistence with server-backed organization mutation.
- Add sidebar focus filters and archive/pin/favorite indicators.
