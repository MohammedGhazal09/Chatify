# Phase 46: Group And Space Mentions - Context

**Gathered:** 2026-06-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 46 adds member-only mention workflows to existing standard group conversations and space channels. It must use the current message creation, socket, cache, and UI component structure rather than creating a parallel mention delivery path.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `46-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `46-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Message model, serializer, and message creation support for standard group/space mentions.
- Frontend send payload typing, optimistic message metadata, and retry preservation.
- Composer member suggestion list for group chats and space channels.
- Message bubble inline rendering of mention tokens.
- Focused backend/frontend tests and visual QA evidence.

**Out of scope (from SPEC.md):**
- Direct-message mentions.
- Encrypted conversation mentions.
- Mention notifications, unread mention counters, and notification preference routing.
- `@everyone`, role mentions, channel mentions, and bot mentions.
- Server-side mention search filters.

</spec_lock>

<decisions>
## Implementation Decisions

### Mention Semantics
- **D-01:** Mentions are username-based and must appear in message text as `@username`.
- **D-02:** Mention targets are stored as user ids plus public snapshots: username and display name only.
- **D-03:** The backend validates mention ids against current chat membership and rejects non-member targets.
- **D-04:** The backend rejects hidden mentions where a target id is provided but the normalized plaintext does not include that member's `@username`.
- **D-05:** A message can mention up to 10 unique members.

### Conversation Scope
- **D-06:** Mentions are available only in standard group chats and standard space channels.
- **D-07:** Direct chats ignore raw `@username` text unless no mention metadata is submitted; if mention metadata is submitted, the request is rejected.
- **D-08:** Encrypted conversations reject mention metadata for this phase to avoid plaintext metadata leakage.

### UI Behavior
- **D-09:** The composer shows suggestions only in group chats and space channels when the user is editing an active `@` token.
- **D-10:** Suggestions list only eligible conversation members other than the current user, with display name and `@username`.
- **D-11:** Selecting a suggestion inserts `@username ` at the caret and sends mention ids derived from message text and members.
- **D-12:** Message bubbles highlight serialized mention tokens and add stronger emphasis when the current user is mentioned.

### the agent's Discretion
- Use the existing Tailwind/CSS variable visual language for mention suggestions and tokens.
- Keep keyboard support compact: Enter inserts the first suggestion when a mention menu is open; otherwise Enter keeps the existing send behavior.
- Prefer focused tests over broad fixtures.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning
- `.planning/phases/46-group-and-space-mentions/46-SPEC.md` - Locked requirements and acceptance criteria.
- `.planning/REQUIREMENTS.md` - Requirement traceability, including the new V2 mention requirements added by this phase.
- `.planning/ROADMAP.md` - Phase status and plan list.

### Backend
- `Backend/Chatify/Controller/messageController.mjs` - Message creation, idempotency, reply snapshots, sockets, notifications.
- `Backend/Chatify/Models/messageModel.mjs` - Message persistence schema and indexes.
- `Backend/Chatify/Utils/messageState.mjs` - Message serialization and cache-facing contracts.
- `Backend/Chatify/Models/chatModel.mjs` - Group chat and space channel membership fields.

### Frontend
- `Frontend/Chatify/src/types/chat.ts` - Message, chat, composer, and API payload types.
- `Frontend/Chatify/src/api/messageApi.ts` - Message creation JSON/FormData payload builder.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Send mutation, optimistic messages, cache updates.
- `Frontend/Chatify/src/hooks/messageCache.ts` - Optimistic/canonical message merge behavior.
- `Frontend/Chatify/src/pages/chat/components/MessageComposer.tsx` - Composer UI and send payload.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - Message text rendering.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MessageComposer` already owns attachment/voice/reply state and can add a bounded mention suggestion panel without changing the route shell.
- `useSendMessage` already supports optimistic state, retries, upload progress, and encrypted send branching.
- `serializeMessage` is the single message response contract used by history, sockets, and search.

### Established Patterns
- Message features are validated in `messageController.mjs`, persisted in `messageModel.mjs`, serialized in `messageState.mjs`, and then merged through frontend cache helpers.
- Privacy-safe public member shapes include `_id`, username, display name fields, profile image, identity mark, and no email.
- Space channels reuse `Chats` with `isSpaceChannel: true`, `isGroupChat: true`, `space`, and `members`.

### Integration Points
- New mention metadata belongs on the message model and in `serializeMessage`.
- Message creation should resolve mentions before storing attachments so invalid mention targets do not leave uploaded files.
- The composer should receive `selectedChat.members` from `ConversationPane` and compute mention ids from text.

</code_context>

<specifics>
## Specific Ideas

- Suggestion panel copy should stay functional, not explanatory: display name, `@username`, and "Group member" or "Space member".
- Inline mention tokens should be compact chips inside message text, not separate cards or notification badges.

</specifics>

<deferred>
## Deferred Ideas

- Mention notifications and unread mention counters.
- `@everyone`, role mentions, channel mentions, and bots.
- Encrypted mention metadata design.
- Mention-specific search filters.

</deferred>

---

*Phase: 46-group-and-space-mentions*
*Context gathered: 2026-06-30*
