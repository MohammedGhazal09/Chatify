---
phase: 22
status: drafted
created_at: 2026-06-18
---

# Phase 22 Context

## Current Backend Shape

- `Backend/Chatify/Models/chatModel.mjs` already has `members`, `chatName`, `isGroupChat`, `groupAdmin`, `groupImage`, and `groupDescription`.
- `chatModel.mjs` creates `directKey` only for non-group two-member chats.
- `Backend/Chatify/Controller/chatController.mjs` currently owns direct chat creation, chat listing, block/unblock controls, and deletion.
- `Backend/Chatify/Routes/chatRouter.mjs` mounts `/create-new-chat`, `/get-all-chats`, `/:chatId/block`, and `/:chatId`.
- `Backend/Chatify/app.mjs` protects `/api/chat` with auth and CSRF before the router.
- `Backend/Chatify/Utils/conversationControls.mjs` already treats non-direct/group chats as not blockable and keeps `canSendMessage` true when no direct block exists.

## Current Frontend Shape

- `Frontend/Chatify/src/pages/chat/components/NewChatDialog.tsx` starts direct chats by username.
- `Frontend/Chatify/src/pages/chat/components/ChatSidebar.tsx` owns the new chat button/dialog and chat list.
- `Frontend/Chatify/src/pages/chat/chat.tsx` owns create-chat mutation success, selected chat, and cache behavior.
- `Frontend/Chatify/src/pages/chat/utils/chatDisplay.ts` already returns `chat.chatName` for group titles.
- `ConversationHeader`, `ConversationDetailContent`, `MessageBubble`, and `ChatListItem` already contain some group-aware states.
- `useCallController` rejects group calls; call buttons can show disabled copy from the chat page.

## Privacy Boundary

- Phase 20/21 removed email from public chat member surfaces and discovery.
- Phase 22 must preserve username/display identity only in group creation, group member lists, realtime events, tests, screenshots, and leak guards.

## Implementation Recommendation

Use the existing chat model and add backend controller-level group validation first. Add model-level max-member validation only where it will not break existing tests. Keep frontend group creation additive inside the current dialog rather than replacing the entire chat shell.
