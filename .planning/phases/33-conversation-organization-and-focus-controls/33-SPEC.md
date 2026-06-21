# Phase 33: Conversation Organization And Focus Controls - Specification

**Created:** 2026-06-20
**Mode:** Auto-approved inline execution
**Requirements:** V2-ORG-01, V2-ORG-02, V2-NOTF-03, BLOCK-02, BASE-01, BASE-05, TEST-03, TEST-05

## Goal

Add per-user conversation organization controls so users can mute, archive, pin, and favorite conversations, then filter the sidebar by unread, direct, group, archived, and favorite views without changing other participants' chat state.

## Current State

- Sidebar search and selected-chat persistence already exist.
- Local favorite state is stored in browser localStorage only and is not portable across devices.
- Muting is backed by Phase 32 notification preferences and suppresses external notification delivery.
- The chat list returns all member conversations with requester-specific latest-message and block controls.
- There is no archive or pinned-conversation state, and no focus filter control in the sidebar.

## Target State

- Conversation organization state is requester-specific and serialized with each chat.
- Muting continues to update the notification preference source of truth so notification delivery stays suppressed.
- Archive, pin, and favorite states are persisted server-side and never affect other members.
- Sidebar filters support all, unread, direct, group, archived, and favorite views with deterministic ordering.
- Default all view hides archived chats unless the archived chat is currently selected.
- Selected conversation continuity is preserved when filters change or when a selected archived chat would otherwise be hidden.

## Recommendations

1. Store archive, pin, and favorite state in a dedicated per-user conversation organization model.
   - Rationale: this avoids mutating shared chat records for private user choices.
2. Keep mute backed by notification preferences while exposing it in the chat organization payload.
   - Rationale: Phase 32 delivery suppression already depends on `notificationPreferences.mutedChatIds`.
3. Sort pinned chats before regular chats, then use existing `updatedAt` ordering inside each group.
   - Rationale: this is predictable and avoids adding manual pin-order UI in this phase.
4. Use one authenticated PATCH endpoint for conversation organization changes.
   - Rationale: UI actions can share optimistic/cache behavior and the backend can enforce membership once.
5. Put filters in the sidebar as a compact segmented control.
   - Rationale: users can scan and switch views without entering settings or detail panels.

## Acceptance Criteria

- [ ] Authenticated users can update muted, archived, pinned, and favorite state for a conversation they belong to.
- [ ] Organization state is per user; other members do not receive the same archive, pin, or favorite state.
- [ ] Muting through organization controls updates the notification mute list used by external notification delivery.
- [ ] Chat list serialization includes organization state and preserves privacy-safe member payloads.
- [ ] Sidebar filters support all, unread, direct, group, archived, and favorite views without losing selected conversation continuity.
- [ ] Pinned conversations render before unpinned conversations with stable ordering.
- [ ] Frontend and backend tests cover organization persistence, isolation, filters, and selected-chat behavior.

## Out Of Scope

- Drag-and-drop custom ordering, folders, labels, multi-select bulk operations, or admin-visible organization state.
- Server-side query pagination for huge chat lists.
- Push/email notification analytics or delivery-provider changes beyond mute preservation.
