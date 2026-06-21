# Phase 38: Bounded Spaces And Channels - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning
**Source:** Auto-selected recommendations from roadmap, Phase 38 spec, and current codebase scout.

<spec_lock>
## Specification Lock

Requirements are locked by `38-SPEC.md`. Planning and execution must build the bounded private-space/channel capability described there and must not expand into public community, bot, integration, thread, or encrypted-channel scope.
</spec_lock>

<domain>
## Phase Boundary

Phase 38 adds small private spaces with scoped text channels on top of existing group-message reliability. A space is a private membership boundary. A channel is a message conversation inside that boundary. The product should feel like a focused extension of Chatify's messenger, not a broad public community platform.
</domain>

<decisions>
## Implementation Decisions

### Product Shape
- Spaces are private by default and only visible to authenticated members.
- The first version supports text channels only.
- Every space gets a default channel, recommended name `general`.
- Spaces stay small. Recommended backend limits: 25 members per space and 10 channels per space unless code constraints suggest lower limits during implementation.
- The UI should live inside the existing chat shell with a Conversations/Spaces switch, not as a separate landing page.

### Data Model
- Add explicit space persistence instead of overloading group chat names.
- Recommended approach: add `Space` and `SpaceChannel`/channel metadata, while backing channel messages with existing `Chat` and `Message` contracts where feasible.
- Channel conversation records must carry enough metadata to distinguish direct, group, and space-channel contexts.
- Do not migrate existing group chats into spaces.

### Roles And Membership
- Roles are `owner`, `admin`, and `member`.
- The creator is the owner.
- Owner/admin can add members by username and create channels.
- Owner/admin can remove non-owner members.
- Admin cannot remove owner or transfer ownership in this phase.
- Member flows must never require or serialize email.

### Channel Access
- Default channels include all active space members.
- Private channel scoping may be supported by member lists only if it stays bounded; otherwise channels are all-member in this phase and private-channel member overrides are deferred.
- Removed members lose access to space metadata, channel metadata, channel messages, attachments, unread counts, and realtime events.

### Reuse Existing Reliability
- Channel messages should reuse existing message create/list, read receipts, unread updates, reactions, attachments, search where authorized, notification eligibility, and socket room behavior.
- Notification copy remains privacy-safe and must include no private channel content beyond existing user preference rules.
- Conversation organization state can apply to channel conversations if the existing cache model supports it; otherwise defer per-channel organization.

### Moderation
- Abuse reports can include redacted `spaceId` and `channelId` context.
- Admin/reviewer surfaces should show enough context to understand the report without exposing unnecessary private membership data.
- Existing report authorization and redaction rules still apply.

### Explicitly Deferred
- Public space directory, public joining, invite links, expiring invite tokens, bots, integrations, webhooks, channel categories, threads, voice rooms, and encrypted channel mode.
</decisions>

<canonical_refs>
## Canonical References

Downstream work should read these before implementation:

- `.planning/phases/38-bounded-spaces-and-channels/38-SPEC.md` - Locked Phase 38 requirements and boundaries.
- `.planning/ROADMAP.md` - Phase 38 goal, dependencies, and future phase boundaries.
- `.planning/REQUIREMENTS.md` - V2-SPACE requirements and adjacent privacy/moderation constraints.
- `.planning/phases/33-conversation-organization-and-focus-controls/33-VERIFICATION.md` - Existing organization/cache behavior for conversations.
- `.planning/phases/34-advanced-message-and-asset-search/34-VERIFICATION.md` - Existing scoped search and jump-to-message behavior.
- `.planning/phases/37-rich-profiles-and-presence-privacy/37-VERIFICATION.md` - Presence/privacy behavior that must hold for future spaces.
</canonical_refs>

<code_context>
## Code Context

Reusable assets and integration points:

- Backend models/controllers: `Backend/Chatify/Models/chatModel.mjs`, `Backend/Chatify/Models/messageModel.mjs`, `Backend/Chatify/Controller/chatController.mjs`, `Backend/Chatify/Controller/messageController.mjs`.
- Backend authorization helpers: `Backend/Chatify/Middlewares/protectRoutes.mjs`, `Backend/Chatify/Utils/conversationControls.mjs`, membership checks in message/chat controllers.
- Backend realtime: `Backend/Chatify/Config/socket.mjs` and existing chat-room message events.
- Backend notifications/moderation: `Backend/Chatify/Services/notificationService.mjs`, `Backend/Chatify/Controller/moderationController.mjs`.
- Frontend API/hooks/types: `Frontend/Chatify/src/api/chatApi.ts`, `Frontend/Chatify/src/hooks/useChatQueries.ts`, `Frontend/Chatify/src/hooks/useChatSocket.ts`, `Frontend/Chatify/src/types/chat.ts`.
- Frontend UI: `Frontend/Chatify/src/pages/chat/chat.tsx`, `ChatSidebar`, `ConversationPane`, `ConversationHeader`, `NewChatDialog`.
</code_context>

<deferred>
## Deferred Ideas

- Invite links and expiring invitations.
- Channel categories, threads, announcements, and voice/stage rooms.
- Public or discoverable spaces.
- Bot/integration runtime and permissions.
- Encrypted channels and channel key management.
- Ownership transfer and enterprise admin controls.
</deferred>

---

*Phase: 38-bounded-spaces-and-channels*
*Context gathered: 2026-06-20*
