# Phase 36 Plan 01 Summary - Backend Encrypted Conversation And Message Contract

## Completed

- Added `Chats.encryptionMode` with `standard` and `e2ee_v1` normalization and serialization.
- Partitioned direct-chat identity so standard and encrypted direct conversations can coexist for the same members while legacy standard direct chats still resolve correctly.
- Added encrypted message envelope persistence with `messageType: encrypted`, empty plaintext `text`, encrypted payload fields, and encrypted payload fingerprints for idempotency.
- Rejected plaintext text and normal file uploads in encrypted conversations.
- Disabled encrypted-message search and edit behavior on the backend with explicit unsupported responses.
- Added generic encrypted-message notification behavior that avoids plaintext previews and ciphertext leakage.

## Verification

- Passed: `npm test -- chat.e2ee.test.mjs message.e2ee.test.mjs notification.outbox.test.mjs`
- Passed: `npm test -- chat.direct.test.mjs chat.group.test.mjs chat.e2ee.test.mjs message.idempotency.test.mjs message.mutations.test.mjs message.search.test.mjs message.e2ee.test.mjs notification.outbox.test.mjs`
- Passed: `npm test -- chat.e2ee.test.mjs message.e2ee.test.mjs notification.outbox.test.mjs auth.lifecycle.test.mjs`

## Notes

- The server stores encrypted envelopes and metadata needed for delivery, but this is not a Signal-grade protocol implementation.
- Encrypted attachment byte upload remains blocked until an encrypted attachment pipeline exists.
