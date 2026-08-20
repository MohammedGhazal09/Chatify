# Phase 52 Research

## Existing Local Encryption

- `ensureConversationSecret(chatId)` creates a random 32-byte AES key and stores it in localStorage.
- `encryptMessageText` and `decryptMessageText` import that secret as an AES-GCM key.
- `hasConversationSecret(chatId)` already provides a boolean status.

## Existing Attachment Guardrails

- `MessageComposer` disables file and voice controls when `isEncryptedConversation` is true.
- `messageController.mjs` rejects uploaded files in encrypted conversations with `encrypted_attachments_unavailable`.
- `message.e2ee.test.mjs` already asserts encrypted plaintext and file upload rejection.

## Implementation Notes

- Add helper functions to export/import a versioned recovery key around the existing local secret.
- Bind recovery keys to `chatId` to reduce accidental wrong-chat imports.
- Keep the helper format deterministic and testable.
- Add a focused `EncryptedRecoveryPanel` or inline subcomponent inside `ConversationDetailContent` to avoid touching `chat.tsx`.
