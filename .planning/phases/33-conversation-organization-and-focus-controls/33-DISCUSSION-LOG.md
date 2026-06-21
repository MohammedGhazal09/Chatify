# Phase 33 Discussion Log

## Recommendation Set

- Use a dedicated `ConversationOrganization` model for archive, pin, and favorite.
- Derive `muted` from the existing notification preference mute list and update that list from the same organization endpoint.
- Keep the sidebar default view focused on non-archived chats, with a separate archived filter.
- Preserve selected-chat continuity by keeping the selected conversation visible when it is hidden by the active filter.
- Add targeted backend and frontend regression tests before closeout.

## Accepted Defaults

- Pinned sorting: pinned first, newest updated chat first within pinned and unpinned groups.
- Filter names: All, Unread, Direct, Groups, Archived, Starred.
- Archive does not delete messages, clear unread counts, or block delivery.
- Favorite is renamed in UI as Starred to match the existing star control.
