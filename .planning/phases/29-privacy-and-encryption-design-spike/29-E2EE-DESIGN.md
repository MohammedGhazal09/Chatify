# Phase 29 E2EE Design Recommendation

## Recommended Architecture

Add `encryptionMode` to conversations in a later implementation phase:

- `standard`: existing server-readable message and attachment behavior.
- `e2ee_v1`: client-encrypted message and attachment payloads.

Do not mutate existing direct/group conversations in place. Users should create an encrypted conversation or explicitly migrate through a separate flow.

## Message Payload Shape

Future encrypted messages should store:

- `messageType`
- `ciphertext`
- `iv` or nonce
- `authTag` when not embedded by the cipher output
- `algorithm`
- `keyVersion`
- `senderDeviceId`
- `encryptedAt`
- optional encrypted attachment manifest

Plaintext `text` should be empty or absent for E2EE messages. Server-side validation should validate envelope shape, size, membership, and replay/idempotency, not plaintext content.

## Key Model

Recommendation for first implementation:

- Each device has a long-lived device identity key pair.
- Each encrypted conversation has a symmetric content key version.
- The conversation content key is encrypted separately for each authorized participant device.
- Clients use authenticated encryption for message content and attachment manifests.
- Group membership changes create a new key version for future messages.

This is not Signal-grade double-ratchet forward secrecy. If that level is required, use an audited protocol/library in a dedicated later phase.

## Backup And Recovery

- Recovery is opt-in and user-controlled.
- A recovery phrase or passphrase-derived backup key encrypts device/conversation key material before upload.
- Password reset alone does not recover E2EE history.
- If all devices and recovery material are lost, encrypted history is unrecoverable.

## Device Changes

- Adding a device requires existing-device approval or recovery phrase.
- New devices receive future keys after approval.
- Backfilling old history requires explicit user choice and re-encryption of keys for the new device.

## Attachments

- Encrypt attachment bytes in the browser before upload.
- Store encrypted blobs in GridFS.
- Keep server-visible metadata minimal: encrypted blob size, kind, status, and conversation id.
- Encrypt filenames and previews inside the attachment manifest where possible.

## Moderation And Reporting

- The server cannot inspect E2EE content.
- A report can include a user-submitted decrypted excerpt and selected attachment metadata.
- The UI must state that submitted evidence is shared with maintainers.
- Automated content scanning is not compatible with true E2EE unless scanning happens on client devices, which creates different trust and abuse concerns.

## Notifications

- Default notification copy must be generic: "New encrypted message".
- No email or push notification should include decrypted content unless a separate local-device notification path is designed.

## Search

- Server-side encrypted-message search is out of scope for `e2ee_v1`.
- First implementation should support local search over decrypted messages already present on the device.
- Cross-device encrypted search index can be a later phase if needed.
