# Phase 52 Spec: Encrypted Conversation Recovery And Attachment Hardening

## Goal

Users can recover an opt-in encrypted conversation on another browser by moving a local recovery key, while Chatify continues to block plaintext attachments in encrypted conversations until encrypted attachment upload has a complete design and implementation.

## Recommendation

Implement local recovery-key export/import for the existing `e2ee_v1` browser secret. Do not add server key escrow in this phase. Server escrow would change the threat model from Phase 29/36, while an explicit recovery key makes the current local-only model usable and testable without weakening server privacy.

## Requirements

- E2EE-REC-01: An encrypted conversation exposes a recovery status in the conversation detail rail/drawer.
- E2EE-REC-02: A device with the conversation secret can copy a recovery key in an explicit user action.
- E2EE-REC-03: A device without the conversation secret can import a valid recovery key for that conversation.
- E2EE-REC-04: Invalid, empty, malformed, or wrong-version recovery keys fail closed and do not overwrite an existing valid local secret.
- E2EE-REC-05: Recovery keys are never sent to the backend, logged, included in screenshots, or rendered unless the user explicitly reveals/copies them.
- E2EE-ATT-01: Client attachment and voice controls remain disabled for encrypted conversations.
- E2EE-ATT-02: Backend encrypted message creation rejects uploaded files before any message is stored.
- E2EE-ATT-03: Tests cover recovery-key round trips, invalid imports, encrypted attachment rejection, and UI copy.

## Non-Goals

- No server-side escrow, account recovery vault, key backup service, or multi-device sync.
- No encrypted file upload, encrypted thumbnail generation, or attachment manifest decryption.
- No migration of existing encrypted conversations beyond using their existing local secret format.

## Acceptance Criteria

1. Frontend encryption helper tests prove export/import round trips and invalid imports.
2. Conversation details show an encrypted recovery panel only for encrypted conversations.
3. Users can copy the recovery key when this device has the secret.
4. Users can paste/import the recovery key when this device is missing the secret.
5. Attachment and voice controls remain disabled in the composer for encrypted conversations.
6. Backend encrypted attachment upload tests prove no message is created after rejection.
7. Hercules-compatible visual QA screenshots cover desktop detail rail, mobile drawer, and missing-secret import state.
