# Phase 36 Specification - Opt-In Encrypted Conversation Mode

## Objective

Implement a conservative `e2ee_v1` conversation mode that stores encrypted message payloads separately from standard plaintext conversations, keeps existing standard chats unchanged, and presents honest limitations for recovery, search, notifications, moderation, and device access.

## Recommendation

Use the Phase 29 design as the boundary: add opt-in encrypted conversations and encrypted envelope persistence now, but do not claim Signal-grade double-ratchet security. The implementation should use browser-side authenticated encryption for the first local text workflow, store only ciphertext envelopes on the server, and keep device/key distribution explicit and limited rather than silently granting old history to new devices.

## In Scope

- `Chats.encryptionMode` with `standard` and `e2ee_v1`.
- Separate direct-chat identity for standard and encrypted direct conversations.
- Encrypted message envelope model fields and serialization.
- Server validation that encrypted conversations reject plaintext message bodies.
- Server search/notification/report behavior that does not inspect encrypted content.
- Frontend types, API payloads, local encryption helpers, and encrypted send/decrypt display for text messages.
- New chat UI controls for creating encrypted conversations with recovery limitation copy.
- Tests for standard-chat compatibility, encrypted payload persistence, plaintext rejection, local decrypt fallback, and honest limitation states.

## Out Of Scope

- Silent migration of existing plaintext chats.
- Signal-grade double ratchet, forward secrecy, sealed sender, metadata hiding, or audited protocol parity.
- Server-side encrypted-message search.
- Automatic cross-device history recovery after password reset.
- Client-side malware scanning or automated moderation of encrypted content.
- Production cryptographic audit or release-grade E2EE certification.

## Acceptance Criteria

- Existing standard direct/group conversations continue to work unchanged.
- Users can create an encrypted direct or group conversation without overwriting an existing standard conversation.
- Encrypted message records store ciphertext envelope fields and no plaintext body.
- Standard message endpoints reject plaintext sends into encrypted conversations.
- Encrypted conversations use generic notification templates and do not enqueue plaintext previews.
- Search UI/API states clearly communicate that server-side search is unavailable for encrypted conversations.
- Frontend can decrypt messages on a device with the local conversation secret and shows an honest unavailable state without that secret.
- Review notes explicitly document residual cryptographic limitations and the next recommended hardening path.
