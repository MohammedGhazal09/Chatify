# Phase 21 Research: Username-Based Contact Discovery

## Current State

- Backend direct chat creation is in `Backend/Chatify/Controller/chatController.mjs`.
- Username validation exists in `Backend/Chatify/Utils/usernameValidation.mjs`.
- Public identity serialization exists in `Backend/Chatify/Controller/userController.mjs`.
- Frontend username validation exists in `Frontend/Chatify/src/utils/usernameValidation.ts`.
- The chat start UI is split across `chat.tsx`, `ChatSidebar.tsx`, `NewChatDialog.tsx`, `chatApi.ts`, and `types/chat.ts`.

## Recommended Approach

1. Add exact backend username lookup and switch direct chat creation to `targetUsername`.
2. Update frontend types, dialog props, chat page state, validation, copy, and mutation payload.
3. Add focused tests and privacy searches proving email is no longer in discovery surfaces.

## Risks

- `Frontend/Chatify/src/pages/chat/chat.tsx` has unrelated local edits. Use narrow patches and stage only Phase 21 changes.
- Current broad `getAllUsers` was tightened in Phase 20; do not re-expand it.
- Phase 21 should not build autocomplete because that would need enumeration and rate-limit design.
