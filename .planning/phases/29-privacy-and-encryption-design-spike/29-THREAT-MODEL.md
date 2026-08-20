# Phase 29 E2EE Threat Model

## Assets

- Message plaintext, voice-message bytes, media/file attachment bytes, and attachment filenames.
- Conversation membership and relationship graph.
- User identity, session cookies, refresh tokens, reset flows, and OAuth handoffs.
- Device keys, conversation keys, encrypted key backups, and recovery secrets.
- Moderation reports and any user-submitted decrypted excerpts.

## Trust Boundaries

| Boundary | Current State | E2EE Target |
|---|---|---|
| Browser to backend | TLS plus cookie session | TLS plus encrypted message payloads before network send |
| Backend to database | Server can read messages and attachments | Server stores ciphertext and metadata only |
| Socket.IO | Server routes trusted user/chat events | Server routes ciphertext without plaintext access |
| Attachments | Server stores original bytes in GridFS | Client encrypts bytes before upload; server stores encrypted blob |
| Search | Server searches plaintext | Search only local decrypted cache or client-side encrypted index design |
| Moderation | Server can inspect report context | Reporter must intentionally submit decrypted evidence |

## Attacker Model

- Network attacker without TLS termination access.
- Malicious or compromised app server/database reader.
- Authenticated user trying to read another user's conversations.
- Former group member after removal.
- Lost or stolen device.
- Malicious client sending malformed ciphertext or metadata.
- Insider with database access.

## Non-Goals

- Hiding all metadata from the server. Chatify still needs server-known membership, sender id, timestamps, delivery state, and approximate attachment metadata unless a much larger private-messaging protocol is designed.
- Retrofitting old plaintext history into E2EE without client-side user consent.
- Guaranteed content moderation of encrypted messages without user-submitted evidence.

## Required Invariants

- The server must never receive plaintext for E2EE messages or attachments.
- Clients must authenticate ciphertext to conversation id, sender device id, message id, and key version.
- New devices must not silently receive old encrypted history unless explicitly approved by an existing device or recovery mechanism.
- Group membership changes must rotate content keys for future messages.
- Password reset must not grant access to encrypted history unless the user also has the recovery secret.
- Logs, reports, and errors must not include decrypted content, raw keys, IVs with key material, or recovery secrets.
