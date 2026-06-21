# Phase 36 Context

## Background

Phase 29 established that Chatify currently provides authenticated transport and server-side authorization, not end-to-end encryption. The approved direction is a new opt-in `e2ee_v1` conversation mode rather than retrofitting existing standard chats.

Phase 35 completed session/device management, so Phase 36 can build on active-session enforcement while keeping key/device claims conservative.

## Design Inputs

- Phase 29 threat model: server must not receive E2EE plaintext, but metadata such as membership, sender, timestamps, delivery state, and approximate attachment metadata remains visible.
- Phase 29 E2EE design: encrypted messages store ciphertext envelope fields; plaintext `text` is empty or absent for E2EE messages.
- Phase 29 migration design: existing conversations remain `standard`; encrypted conversations are new opt-in conversations.
- Phase 29 UI recommendation: do not expose strong encryption badges until the full send/receive/recovery/device-verification flow is implemented.

## Existing Code Surfaces

- Backend chat model/controller: `Backend/Chatify/Models/chatModel.mjs`, `Backend/Chatify/Controller/chatController.mjs`.
- Backend message model/controller/state: `Backend/Chatify/Models/messageModel.mjs`, `Backend/Chatify/Controller/messageController.mjs`, `Backend/Chatify/Utils/messageState.mjs`.
- Backend notifications: `Backend/Chatify/Services/notificationService.mjs`, `Backend/Chatify/Utils/notificationTemplates.mjs`.
- Frontend chat types/APIs/hooks: `Frontend/Chatify/src/types/chat.ts`, `Frontend/Chatify/src/api/chatApi.ts`, `Frontend/Chatify/src/api/messageApi.ts`, `Frontend/Chatify/src/hooks/useChatQueries.ts`.
- Frontend UI: `Frontend/Chatify/src/pages/chat/chat.tsx`, `NewChatDialog`, `ConversationPane`, `MessageBubble`, `MessageSearchResults`, and detail surfaces.

## Recommended Implementation Boundary

Start with encrypted text-message payloads and server contract hardening. Encrypted attachments should be represented by an encrypted manifest boundary and normal plaintext attachment upload should be disabled for encrypted conversations until encrypted byte upload is implemented with browser-side encryption. This is safer than accepting plaintext files while claiming encrypted mode.

## Verification Focus

- Backend request tests must prove standard compatibility, encrypted chat creation, encrypted send, plaintext rejection, search limitation, and generic notification behavior.
- Frontend tests must prove encrypted chat creation payloads, local encrypt/decrypt helpers, encrypted send payload shape, missing-secret fallback, and search limitation UI.
- `rg` checks should verify no UI copy claims Signal-grade encryption, guaranteed recovery, or hidden metadata.
