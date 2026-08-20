# Phase 46: Group And Space Mentions - Specification

**Created:** 2026-06-30
**Ambiguity score:** 0.10 (gate: <= 0.20)
**Requirements:** 5 locked

## Goal

Users can mention authorized members in private group conversations and space channels with persisted, privacy-safe mention metadata and clear composer/display behavior.

## Background

Chatify already supports private group chats and space channels through the shared chat/message pipeline. Messages persist text, attachments, replies, sockets, unread counts, and search through `Backend/Chatify/Controller/messageController.mjs`, `Backend/Chatify/Models/messageModel.mjs`, `Frontend/Chatify/src/hooks/useChatQueries.ts`, and chat UI components. There is no mention metadata, no member suggestion picker, and no server validation that a requested mention target is a member of the conversation.

## Requirements

1. **Member-only mention persistence**: Standard messages in group chats and space channels can persist a bounded set of mentioned members.
   - Current: Message records do not store mentions.
   - Target: Standard message creation accepts mention target user ids, validates them against chat membership, stores public mention snapshots, and serializes them with message history, sockets, search, and idempotent responses.
   - Acceptance: Backend tests prove group and space channel messages return `mentions` containing only authorized public user id, username, and display name fields.

2. **Hidden mention prevention**: Mention metadata must match visible `@username` text.
   - Current: There is no mention target validation.
   - Target: The backend rejects mention target ids that are not visible as `@username` tokens in the normalized plaintext message.
   - Acceptance: Backend tests prove a message cannot silently mention a member whose username is absent from the message text.

3. **Authorization and privacy boundary**: Direct chats, non-members, removed space members, and encrypted conversations cannot create unsupported mention metadata.
   - Current: Group and space message authorization exists, but mention-specific target validation does not.
   - Target: Mention creation is limited to standard group chats and space channels; invalid targets return deterministic 400/403-style failures without exposing private emails or outsider identity.
   - Acceptance: Backend tests cover outsider mention rejection, direct-chat mention rejection, and encrypted mention rejection.

4. **Composer suggestion workflow**: Group and space composers expose member suggestions when the user types `@`.
   - Current: The composer accepts raw text and attachments only.
   - Target: Typing `@` or `@prefix` in a group or space channel shows a compact accessible list of eligible members, inserts `@username`, and sends normalized mention ids with the existing message payload.
   - Acceptance: Frontend tests prove selection inserts the username token and sends the expected mention ids.

5. **Mention rendering**: Mentioned usernames render as distinguishable inline tokens without breaking message layout.
   - Current: Message text renders as plain text.
   - Target: Serialized mention snapshots cause matching `@username` tokens to render as bounded inline highlights, with an emphasized style when the current user is mentioned.
   - Acceptance: Frontend tests prove mention tokens render from persisted metadata and still preserve automatic text direction behavior.

## Boundaries

**In scope:**
- Message model, serializer, and message creation support for standard group/space mentions.
- Frontend send payload typing, optimistic message metadata, and retry preservation.
- Composer member suggestion list for group chats and space channels.
- Message bubble inline rendering of mention tokens.
- Focused backend/frontend tests and visual QA evidence.

**Out of scope:**
- Direct-message mentions - not useful until broader contact cards and user profile mentions are designed.
- Encrypted conversation mentions - encrypted metadata leakage needs a separate E2EE design.
- Mention notifications, unread mention counters, and notification preference routing - notification behavior needs its own privacy review.
- `@everyone`, role mentions, channel mentions, and bot mentions - those are broader space semantics.
- Server-side mention search filters - advanced search is a separate capability.

## Constraints

- Mention snapshots must never expose email addresses.
- Mention targets must be validated by server-side membership, not trusted from the client.
- Mention metadata must be bounded to 10 targets per message.
- Existing message idempotency must reject same `clientMessageId` retries with different mention target sets.
- UI must fit the existing dense messenger composer on desktop and mobile without overlapping the send controls.

## Acceptance Criteria

- [ ] Group messages persist and serialize valid mention snapshots.
- [ ] Space channel messages persist and serialize valid mention snapshots.
- [ ] Direct chats, encrypted chats, outsiders, self-only hidden metadata, and absent visible username tokens cannot create mention metadata.
- [ ] Idempotent sends detect different mention target sets for the same client message id.
- [ ] Composer suggestions insert `@username` and send mention ids.
- [ ] Message bubbles render mention tokens, including current-user emphasis.
- [ ] Focused backend tests, frontend tests, lint/build, and visual QA pass.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.95 | 0.75 | met | Group and space member mentions only. |
| Boundary Clarity | 0.95 | 0.70 | met | Notifications, counters, E2EE, and role mentions excluded. |
| Constraint Clarity | 0.85 | 0.65 | met | Privacy, membership, cap, and idempotency constraints locked. |
| Acceptance Criteria | 0.90 | 0.70 | met | Backend, frontend, and visual checks are explicit. |
| **Ambiguity** | 0.10 | <=0.20 | met | Ready for implementation. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today? | Group/space messages share the existing message pipeline but have no mention metadata. |
| 2 | Simplifier | What is the irreducible slice? | Member-only `@username` mentions, persisted snapshots, composer suggestions, and inline rendering. |
| 3 | Boundary Keeper | What stays out? | Notifications, counters, roles, direct mentions, and E2EE mentions are deferred. |
| 4 | Failure Analyst | What would make this unsafe? | Hidden targets, non-member targets, email leakage, and idempotency drift are blocking failures. |

---

*Phase: 46-group-and-space-mentions*
*Spec created: 2026-06-30*
*Next step: $gsd-discuss-phase 46 - implementation decisions*
