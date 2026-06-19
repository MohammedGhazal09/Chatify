# Phase 29 Migration And Compatibility Design

## Compatibility Decision

Keep existing conversations as standard server-readable conversations. Add E2EE as a new opt-in conversation mode.

## Why Not In-Place Retrofit

- Current messages are already plaintext in MongoDB.
- Server-side search, reports, notifications, shared assets, and pinned summaries depend on readable content.
- Server-side migration cannot produce true E2EE because the server would process plaintext.
- Users need explicit informed consent because recovery and moderation behavior changes.

## Migration Options

| Option | Recommendation | Rationale |
|---|---|---|
| New encrypted conversation | Recommended first | Clean boundary, easy rollback, no silent behavior changes. |
| Client-side encrypt old history into same chat | Defer | Complex, slow, risky for groups and devices. |
| Server-side encrypt existing plaintext | Reject for E2EE | Improves at-rest storage but is not end-to-end encryption. |

## Later Phase Breakdown

1. **Phase 31: E2EE Prototype Contract**
   - Add `encryptionMode`, encrypted envelope types, device key registration, and unit tests.
   - Acceptance: encrypted conversations reject plaintext sends and standard conversations remain unchanged.

2. **Phase 32: Client Encryption And Device Enrollment**
   - Implement browser key generation, key storage, send/decrypt flows, and device approval/recovery UX.
   - Acceptance: two devices exchange encrypted messages without server plaintext.

3. **Phase 33: Encrypted Attachments And Group Key Rotation**
   - Encrypt attachment bytes and rotate group keys on membership changes.
   - Acceptance: removed members cannot decrypt future messages or attachments.

4. **Phase 34: E2EE Product Evidence And Safety Tradeoffs**
   - Add local search limits, generic notifications, report evidence submission, export behavior, and production acceptance.
   - Acceptance: users can understand recovery loss, moderation evidence sharing, and notification limitations.

## Rollback Plan

- Keep `standard` mode unchanged.
- Gate `e2ee_v1` behind a feature flag until evidence passes.
- If encrypted send/decrypt fails, disable new encrypted chat creation without affecting existing standard chats.
