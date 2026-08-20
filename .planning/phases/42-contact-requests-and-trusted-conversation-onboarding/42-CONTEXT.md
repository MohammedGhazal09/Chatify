# Phase 42 Context - Contact Requests And Trusted Conversation Onboarding

**Gathered:** 2026-06-30
**Status:** Ready for planning
**Source:** Auto-approved recommendations from the phase objective and codebase scout.

<domain>
## Phase Boundary

Phase 42 adds a trusted onboarding step for new standard direct conversations. A valid username can create a pending request, but the recipient must accept before a new direct chat appears. Existing direct chats remain immediately continuable.
</domain>

<spec_lock>
## Locked Requirements

- `.planning/phases/42-contact-requests-and-trusted-conversation-onboarding/42-SPEC.md` is the locked requirements source.
- Discuss and planning must focus on implementation decisions only.
</spec_lock>

<decisions>
## Implementation Decisions

### D-01 Request Gate Placement
- Put the new-contact gate in the shared backend direct-chat creation path so UI-only bypasses cannot create a new standard direct chat.
- Recommendation auto-approved because this is the smallest root-cause location; every current direct-start caller routes through `createChat`.

### D-02 Trust Source
- Treat an existing direct chat as trusted. Treat an accepted contact request between the two users as trusted for future direct chat creation.
- Do not create a separate contacts collection yet; accepted request history is enough for this phase.

### D-03 Request Model
- Add a `ContactRequest` Mongoose model with `requester`, `recipient`, `status`, timestamps, optional `respondedAt`, and uniqueness for one pending requester/recipient pair.
- Statuses: `pending`, `accepted`, `declined`, `canceled`.

### D-04 Existing Direct Chats
- Existing direct chats return normally before checking request state. This avoids breaking current users and legacy data.

### D-05 Encrypted Conversations
- Do not gate or implement encrypted contact requests in Phase 42. If a direct chat already exists, encrypted creation can continue under the existing Phase 36 limitations. New-contact encrypted onboarding is deferred.

### D-06 UI Surface
- Reuse `NewChatDialog` for sending a request and add a compact contact-requests panel in the existing messenger sidebar/start-conversation flow.
- Copy should say "Send request", "Request sent", "Accept", "Decline", and "Cancel request" rather than promising immediate chat start.

### D-07 Realtime
- Emit simple request lifecycle events to involved users when possible, but keep HTTP refetch as the source of truth. Socket updates are cache accelerators, not the only correctness path.

### D-08 Privacy
- Serialize requester/recipient through public identity fields only: `_id`, `username`, names, profile image, profile bio/status if allowed, and identity mark. Never include `email`.

### D-09 Deferred Ideas
- Request expiration, invite links, and external notifications are deferred to later phases.
</decisions>

<canonical_refs>
## Canonical References

### Locked Requirements
- `.planning/phases/42-contact-requests-and-trusted-conversation-onboarding/42-SPEC.md` - Phase 42 requirements, boundaries, and acceptance criteria.

### Existing Direct Chat And Privacy Contracts
- `Backend/Chatify/Controller/chatController.mjs` - Current direct chat creation, block checks, serialization, and socket fanout.
- `Backend/Chatify/Models/chatModel.mjs` - Direct chat key and direct/group validation.
- `Backend/Chatify/Controller/userController.mjs` - Public identity serialization and username lookup behavior.
- `Frontend/Chatify/src/pages/chat/components/NewChatDialog.tsx` - New direct/group conversation dialog.
- `Frontend/Chatify/src/pages/chat/components/StartConversationDialog.tsx` - Contact picker and new conversation entry.
- `Frontend/Chatify/src/hooks/useChatQueries.ts` - Chat creation mutation and cache merge pattern.
- `Frontend/Chatify/src/api/chatApi.ts` - Chat API transport wrapper.

### Prior Phase Decisions
- `.planning/phases/20-username-identity-and-privacy-foundation/20-SPEC.md` - Username and email privacy baseline.
- `.planning/phases/21-username-based-contact-discovery/21-VERIFICATION.md` - Username-only direct discovery closure.
- `.planning/phases/37-rich-profiles-and-presence-privacy/37-SPEC.md` - Presence/profile privacy constraints.
</canonical_refs>

<code_context>
## Code Context

- `createChat` currently validates `targetUsername`, rejects self/missing/blocked targets, finds existing direct chats, and creates a new `Chats` document when none exists.
- `getAllUsers` currently returns shared-chat contacts only, so pending contacts need a separate list endpoint.
- Chat routes are mounted under `/api/chat`, and test helpers auto-attach CSRF tokens for unsafe chat methods.
- Frontend mutations already invalidate `chatsQueryKey`; request mutations should mirror that pattern and invalidate a new `contactRequestsQueryKey`.
- Current dialog styles are compact dark messenger surfaces with lucide icons, labels, focus trapping, and no new component dependency.
</code_context>

<specifics>
## Auto-Approved Recommendations

- Use a direct-pair request model instead of a broad contacts table.
- Do not add autocomplete or discovery expansion.
- Keep request state explicit in the UI, with no hidden auto-accept except when a direct chat already exists.
- Keep HTTP list/refetch as the source of truth; realtime events are a convenience.
</specifics>

<deferred>
## Deferred Ideas

- Expiring requests and revokable invite links - Phase 47.
- Push/email notification for requests - future notification expansion.
- Full contact graph, import, suggestions, or directory - future product phase only if needed.
- Encrypted contact request and key-sharing handshake - future encrypted conversation phase.
</deferred>

---

*Phase: 42-contact-requests-and-trusted-conversation-onboarding*
*Context gathered: 2026-06-30*
