# Phase 37 Research - Rich Profiles And Presence Privacy

## Codebase Findings

- `Backend/Chatify/Models/userModel.mjs` is the right place for profile text and visibility fields.
- `Backend/Chatify/Controller/userController.mjs` already centralizes public identity serialization and presence privacy behavior.
- `Backend/Chatify/Config/socket.mjs` currently suppresses broadcasts when `showOnlineStatus` is false, which can leave clients with stale online state after a privacy change.
- `Frontend/Chatify/src/components/SettingsModal.tsx` is already the Settings surface for profile image, identity mark, notifications, sessions, and local preferences.
- `Frontend/Chatify/src/hooks/useProfileImageMutation.ts` already updates auth, chat, users, user search, and presence caches after identity changes and can be extended for profile text updates.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` is the main contact-card surface for selected conversations.

## Risk Notes

- Adding profile text increases public identity data. Validation should reject control characters, URLs, and excessive length.
- Presence privacy changes must actively clear stale online state for contacts.
- `getOnlineUsers` should use the same block-aware filtering as Socket.IO snapshots.
- Settings already contains many sections, so Phase 37 UI should stay compact and avoid adding a separate profile page.

## Test Targets

- Backend user profile/privacy tests under `Backend/Chatify/test/user`.
- Socket presence/reconnect tests under `Backend/Chatify/test/socket`.
- Frontend Settings and conversation detail tests under `Frontend/Chatify/src`.
