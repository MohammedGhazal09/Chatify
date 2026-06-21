# Phase 36 Research

## Repository Findings

- Direct chat uniqueness currently uses `directKey` based only on sorted member ids. Phase 36 must preserve existing standard keys and add a distinct key for encrypted direct conversations.
- Messages currently require plaintext `text` unless they are call messages or attachments. Phase 36 needs a separate encrypted message type/envelope path.
- Search currently relies on plaintext `text` and attachment display names. Encrypted conversations must not be passed through this path as if server search still works.
- Notification templates are already generic and do not include message content. Phase 36 should add an encrypted-specific template to make privacy behavior explicit.
- Frontend optimistic send and message cache merge by `clientMessageId`; encrypted sends should reuse that reliability path with encrypted payload fields.

## Phase 29 Carry-Forward

- Use `encryptionMode` with `standard` and `e2ee_v1`.
- Store encrypted envelopes containing ciphertext, iv/nonce, algorithm, key version, sender device id, and encrypted timestamp.
- Keep plaintext `text` empty for encrypted messages.
- Do not backfill old history to new devices without explicit approval or recovery.
- Search is local/decrypted only for the first implementation.

## Implementation Recommendation

Use the browser Web Crypto API for AES-GCM text encryption in the first client path. Store the local conversation secret in browser storage only as a Phase 36 MVP compromise, label missing-secret states clearly, and do not store plaintext keys or decrypted message content on the server.

## Verification Recommendation

Favor contract tests over cryptographic marketing claims:

- Backend: prove storage shape and plaintext rejection.
- Frontend: prove plaintext is transformed before the API call and decryption requires local secret material.
- Copy guard: grep for unsupported claims such as "Signal", "metadata hidden", "military-grade", "guaranteed recovery", and "secure forever".
