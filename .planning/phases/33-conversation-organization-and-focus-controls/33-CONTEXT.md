# Phase 33 Context

## Existing Contracts

- `Backend/Chatify/Controller/chatController.mjs` serializes chats per requester with latest visible message and `conversationControls`.
- `Backend/Chatify/Utils/conversationControls.mjs` owns block-derived send/call availability and must stay separate from user organization state.
- `Backend/Chatify/Utils/notificationPreferences.mjs` and `User.notificationPreferences.mutedChatIds` are the Phase 32 mute source of truth.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` owns chat query cache and mutation helpers.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` owns conversation search and list rendering.
- `Frontend/Chatify/src/pages/chat/hooks/useSelectedChatPersistence.ts` keeps selected chat continuity across navigation.

## Constraints

- Organization choices are private per user and must not mutate the shared `Chats` record.
- Mute must keep notification delivery eligibility aligned with Phase 32.
- The existing local work in `Frontend/Chatify/src/pages/chat/chat.tsx` must be edited narrowly and not rewritten.
- No subagents.

## Key Risks

- Duplicating mute state could make UI and notification delivery disagree.
- Filtering archived chats could make the selected chat appear to disappear.
- Sorting changes could reorder active chats unpredictably if pinned handling is not explicit.
- Organization payloads must not reintroduce email exposure in chat responses.
