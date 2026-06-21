# Phase 33 UI Spec

## Sidebar

- Add a compact horizontal filter row below search.
- Filter options: All, Unread, Direct, Groups, Archived, Starred.
- Keep buttons fixed-height and non-wrapping on desktop; horizontal overflow is acceptable on narrow mobile.
- The All view hides archived chats unless the selected chat is archived.
- Empty copy changes based on active filter.

## Conversation Rows

- Show pinned and starred indicators near the title.
- Keep muted and unread badges visible together.
- Pinned chats appear before unpinned chats.
- Archived chats remain selectable when visible through the Archived filter or selected continuity exception.

## Conversation Actions

- Add Archive/Unarchive, Pin/Unpin, and Star/Unstar to the conversation action menu.
- Keep Mute/Unmute using the notification mute source of truth.
- Existing block/report/call/search/export actions stay in place.

## Detail Surface

- Existing star button becomes server-backed.
- Favorite state should update the sidebar and detail surface from the same chat cache.
