# Phase 48: Saved Messages And Bookmarks - Patterns

**Created:** 2026-06-30
**Mode:** Inline pattern map, no subagents

## Backend Analog Files

- `Backend/Chatify/Models/conversationOrganizationModel.mjs` - Per-user chat state model pattern with user/chat uniqueness.
- `Backend/Chatify/Models/inviteLinkModel.mjs` - Recent new model pattern with indexes and metadata-only serialization.
- `Backend/Chatify/Controller/messageController.mjs` - Message-level membership, visibility, pin, context, and response-shaping patterns.
- `Backend/Chatify/Routes/messageRouter.mjs` - Static routes before parameterized routes to avoid route shadowing.
- `Backend/Chatify/test/message/message.pins.test.mjs` - Focused message mutation/list test pattern.

## Frontend Analog Files

- `Frontend/Chatify/src/api/messageApi.ts` - API method and response interface placement.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Query key, useQuery, useMutation, invalidation, and cache update placement.
- `Frontend/Chatify/src/hooks/messageCache.ts` - Canonical message merge behavior.
- `Frontend/Chatify/src/pages/chat/components/MessageActionMenu.tsx` - Message action menu command pattern.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - Bubble metadata and action trigger layout.
- `Frontend/Chatify/src/pages/chat/components/InviteLinksDialog.tsx` - Modal focus, Escape handling, dense row UI, loading/error states.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` - Pinned-message row, jump, and unpin controls.

## Required Source-Grounding Checks

- Route order must put `/saved` before `/:chatId/...` and `/:messageId/...`.
- Any saved-state field added to `Message` must be optional and requester-specific.
- Cache updates must preserve optimistic send, reply, mention, pin, edit, delete, reaction, and socket merge behavior.
- New UI controls must preserve action-menu keyboard/Escape behavior and sidebar footer layout.

## Artifacts This Phase Produces

- `Backend/Chatify/Models/savedMessageModel.mjs`
- `Backend/Chatify/test/message/message.saved.test.mjs`
- `Frontend/Chatify/src/pages/chat/components/SavedMessagesDialog.tsx`
- `Frontend/Chatify/src/pages/chat/components/SavedMessagesDialog.test.tsx`
- New message API methods: `listSavedMessages`, `saveMessage`, `unsaveMessage`
- New query hooks: `useSavedMessages`, `useSaveMessage`, `useUnsaveMessage`
- New types: `SavedMessage`, `SavedMessagesResponse`, `SavedMessageResponse`
