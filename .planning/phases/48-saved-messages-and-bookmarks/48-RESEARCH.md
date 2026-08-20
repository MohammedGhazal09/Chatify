# Phase 48: Saved Messages And Bookmarks - Research

**Created:** 2026-06-30
**Mode:** Inline research, no subagents

## Current System

- Message authority lives in `Backend/Chatify/Controller/messageController.mjs` with `loadChatForUser`, `canUserSeeMessage`, and `buildVisibleMessageFilter`.
- Message serialization is centralized in `Backend/Chatify/Utils/messageState.mjs`; current serialized messages include shared pin state but no requester-specific saved state.
- Shared pinned-message behavior is implemented through message fields (`pinned`, `pinnedBy`, `pinnedAt`) and routes in `Backend/Chatify/Routes/messageRouter.mjs`.
- Frontend message state flows through `Frontend/Chatify/src/api/messageApi.ts`, `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/hooks/messageCache.ts`, and `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Existing UI surfaces for message actions, context lists, and modals live in `MessageActionMenu`, `MessageBubble`, `ConversationDetailContent`, and `InviteLinksDialog`.

## Recommended Implementation

1. Add a separate backend `SavedMessage` model with `user`, `message`, `chat`, and `savedAt`/timestamps.
2. Add `GET /api/message/saved`, `POST /api/message/:messageId/save`, and `DELETE /api/message/:messageId/save`.
3. Use existing message membership and visibility helpers before save/list responses.
4. Add controller-level helpers that decorate serialized messages with `savedByRequester` for history/context and saved-list responses.
5. Add frontend types, API methods, React Query hooks, cache updates, action-menu toggle, bubble indicator, sidebar entry, and saved-message dialog.
6. Add focused backend and frontend tests before broad verification.

## Privacy Notes

- Do not store saved state directly on `Messages`; doing so would turn personal bookmarks into shared document state.
- Do not include decrypted encrypted-message plaintext in saved-list payloads or UI. Use generic encrypted fallback copy.
- Do not expose private email fields in saved-list `chat` or sender context.
- Do not return deleted-for-self-hidden or deleted-for-everyone messages as visible saved entries.

## Test Targets

- Backend: personal save isolation, idempotency, non-member rejection, hidden/deleted rejection, direct/group/space coverage, safe encrypted serialization.
- Frontend: API methods, hooks/cache updates, message action toggles, saved dialog empty/loading/error/populated states, jump and unsave flows.
- Visual QA: desktop action menu saved state, desktop saved dialog, mobile saved dialog, encrypted saved fallback, no overflow in long conversation/message previews.
