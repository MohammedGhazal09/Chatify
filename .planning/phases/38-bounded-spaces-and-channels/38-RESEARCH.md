# Phase 38 Research - Bounded Spaces And Channels

## Current State

- Direct and group chat are backed by `Chat` and `Message` models.
- Message creation, read receipts, unread counts, attachments, reactions, socket events, notifications, and moderation already use chat membership as the authorization boundary.
- Group creation is username-based and does not require public email exposure.
- Conversation organization, search, encrypted mode, session enforcement, and profile/presence privacy were added in prior phases.
- There is no `Space` model, channel model, channel list UI, or space membership role model.

## Recommended Architecture

- Add a `Space` model for parent membership/roles.
- Add a channel representation that can map to an existing chat/conversation record so message reliability remains shared.
- Add backend controllers/routes for space create/list/detail, member add/remove, channel create/list/detail.
- Extend existing chat/message authorization to understand space-channel membership.
- Emit socket updates to space/channel members only.
- Keep frontend state under TanStack Query hooks and typed API clients.

## Key Risks

- Treating frontend membership as authoritative would leak channel metadata/messages.
- Reusing group chats without clear channel metadata would make search, notifications, and reports ambiguous.
- Adding invite links or public discovery would expand the abuse/privacy surface beyond the phase.
- Channel removal/member removal must clear unread and realtime access paths, not only hide UI entries.
- Adding too much UI into `chat.tsx` risks worsening an already large page component.

## Test Strategy

- Backend model/controller tests for space membership roles, channel access, member removal, and email privacy.
- Backend message tests proving channel sends/list/read/attachments/reactions are member-only.
- Socket tests proving channel realtime events only reach authorized channel members.
- Frontend hook/component tests for space list, create flow, channel selection, empty states, and access errors.
- Regression tests that direct/group chats still work.

## Recommendation

Implement in four plans:

1. Backend space/channel data contract and role checks.
2. Channel messaging integration and realtime reliability.
3. Frontend spaces workspace and channel UI.
4. Review, verification, and traceability.
