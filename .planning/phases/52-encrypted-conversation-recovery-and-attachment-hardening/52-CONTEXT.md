# Phase 52 Context

## Current Behavior

- Phase 36 added opt-in encrypted conversations with local AES-GCM secrets in `Frontend/Chatify/src/utils/encryptedMessages.ts`.
- Encrypted message envelopes are sent to the server without plaintext.
- The backend rejects plaintext, replies, mentions, search, edit, and attachment uploads in encrypted conversations.
- The composer disables attachments and voice messages for encrypted conversations.
- Conversation details currently explain that the local conversation secret is required, but they do not let a user export or import that secret.

## Relevant Files

- `Frontend/Chatify/src/utils/encryptedMessages.ts`
- `Frontend/Chatify/src/utils/encryptedMessages.test.ts`
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx`
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.test.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx`
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.test.tsx`
- `Backend/Chatify/Controller/messageController.mjs`
- `Backend/Chatify/test/message/message.e2ee.test.mjs`

## Constraints

- Preserve the local-only E2EE threat model.
- Avoid editing `Frontend/Chatify/src/pages/chat/chat.tsx` unless absolutely necessary.
- Do not expose recovery keys in tests, logs, screenshots, or production smoke artifacts.
- Keep UI copy honest: recovery is a manually copied local key, not server-backed account recovery.
