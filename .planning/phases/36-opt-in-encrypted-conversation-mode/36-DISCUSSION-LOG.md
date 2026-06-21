# Phase 36 Discussion Log

## Decisions

| Topic | Decision | Rationale |
|---|---|---|
| Conversation model | Add `encryptionMode: standard | e2ee_v1` | Keeps existing chats unchanged and makes encrypted behavior explicit. |
| Existing chats | Do not migrate in place | Server-side migration would not be true E2EE and would surprise users. |
| Direct chat uniqueness | Keep standard direct keys unchanged; add separate encrypted direct keys | Allows one standard and one encrypted direct conversation between the same users. |
| Crypto claim | Do not claim Signal-grade or audited E2EE | Phase 36 is an opt-in encrypted-envelope implementation, not a full protocol audit. |
| Initial client key path | Use local device-held conversation secrets with honest missing-secret fallback | Avoids server-held plaintext keys and makes lost-device limitations visible. |
| Attachments | Block plaintext attachment upload in encrypted conversations until encrypted bytes are implemented | Safer than accepting plaintext files under encrypted-mode copy. |
| Notifications | Use generic encrypted-message templates | Prevents plaintext leakage through push/email. |
| Search | Disable server-side search for encrypted conversations and show honest copy | Server cannot search ciphertext without a separate client/local index design. |

## Recommendations

- Implement the backend encrypted-envelope contract first, then wire frontend encrypted send/display.
- Keep UI copy factual: "Encrypted conversation", "This device needs the conversation secret", and "Server search is unavailable".
- Treat browser local storage as non-ideal key storage and document it as a Phase 36 residual risk rather than a release-grade device key store.

## Non-Goals

- No silent key sharing to new devices after password reset.
- No server-readable backup secret.
- No hidden metadata claim.
- No production release claim without a dedicated cryptographic review.
