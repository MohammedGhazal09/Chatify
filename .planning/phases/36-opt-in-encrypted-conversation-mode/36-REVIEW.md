# Phase 36 Code Review

## Findings

No blocking findings found in the reviewed Phase 36 changes.

## Review Notes

- Standard and encrypted direct conversations are separated by encryption mode, with legacy standard direct chats still recognized.
- Encrypted message creation stores an encrypted envelope and empty plaintext body, and encrypted idempotency compares payload fingerprints instead of plaintext text.
- Plaintext sends, normal attachments, server search, and edit flows are rejected for encrypted conversations where the feature is not supported.
- Notifications use generic encrypted-message copy and do not include plaintext previews or ciphertext envelopes.
- Frontend sends encrypted text through the encrypted branch and keeps decrypted optimistic/display text local to the browser cache.
- UI copy avoids Signal-grade, hidden-metadata, guaranteed-recovery, and permanent-security claims.

## Residual Risk

- Device-local secrets are stored in browser local storage and are not hardware-backed.
- This phase does not implement Signal-grade double ratchet, forward secrecy, sealed sender, metadata hiding, audited protocol parity, backup, rotation, or cross-device key recovery.
- Server-visible metadata remains available for delivery and authorization, including conversation membership, participants, timestamps, sender ids, and message ids.
- Encrypted attachments, local encrypted search indexing, encrypted edit semantics, and moderation tooling for encrypted content remain deferred.
- Losing the local conversation secret means this device cannot decrypt prior encrypted messages.
