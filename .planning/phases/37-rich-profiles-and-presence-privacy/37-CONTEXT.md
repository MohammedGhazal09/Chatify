# Phase 37 Context - Rich Profiles And Presence Privacy

## Current State

- `Users` already stores username, profile image, identity mark, `isOnline`, `lastSeen`, `showOnlineStatus`, and `showLastSeen`.
- `userController` exposes username lookup, contact list, online status, online users, identity updates, profile image updates, and privacy settings.
- `socket.mjs` sends `socket:ready` presence snapshots and `user:status-change` events to authorized contacts.
- `SettingsModal` already contains account, identity, notification, session, and local preference sections.
- Chat detail/header surfaces already render profile image, identity mark, online/last-seen state, block state, and conversation security.

## Important Existing Constraints

- Public identity surfaces must not expose email addresses.
- Blocked contacts should not receive inappropriate realtime events or presence data.
- Presence must reconcile from server truth on reconnect.
- Existing local work in `Frontend/Chatify/src/pages/chat/chat.tsx` must be preserved.
- Phase 36 encrypted-mode limitations should not be disturbed.

## Recommended Implementation Shape

- Add `profileBio`, `profileStatus`, and `showProfileStatus` to the user model.
- Add a small profile validation utility instead of embedding validation in route handlers.
- Add `PATCH /api/user/profile` for current-user profile text changes.
- Extend `PATCH /api/user/privacy-settings` to accept `showProfileStatus`.
- Reuse public identity serialization, adding profile fields only when allowed.
- Make presence broadcasts emit a redacted offline/unreachable state when online visibility is hidden.
- Add Settings controls in the existing Account area to avoid a new page or modal.
