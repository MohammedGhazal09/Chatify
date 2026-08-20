# Phase 36 UI Specification

## New Chat

- Add an encryption toggle or segmented option inside the existing new conversation dialog.
- Default remains standard conversation.
- Encrypted mode must show concise recovery limitation copy before submit.
- The submit payload must include `encryptionMode: 'e2ee_v1'` only when encrypted mode is selected.

## Conversation Header And Detail

- Encrypted conversations should show factual copy such as "Encrypted conversation".
- Do not use copy that implies audited protocol parity, hidden metadata, or guaranteed recovery.
- If the device lacks the local secret, show "This device needs the conversation secret to read encrypted messages."

## Composer

- Standard chats continue using the existing composer.
- Encrypted chats send encrypted text payloads when a local secret exists.
- Plaintext attachment upload is disabled in encrypted chats until encrypted byte upload is implemented.

## Message Rendering

- If decrypted text is available locally, render it as normal message text with subtle encrypted-context metadata.
- If decryption is unavailable or fails, render an honest unavailable state instead of ciphertext.
- Deleted, receipts, reactions, and timestamps should remain consistent with existing message UI.

## Search And Detail Surfaces

- Server-backed message search is disabled for encrypted conversations.
- Shared media/files and pinned-message surfaces must avoid plaintext claims; encrypted attachment support remains blocked unless encrypted byte upload is implemented.

## Accessibility

- Encryption controls need accessible names and state.
- Missing-secret and unsupported-search states must be screen-reader-visible and not rely on color alone.
