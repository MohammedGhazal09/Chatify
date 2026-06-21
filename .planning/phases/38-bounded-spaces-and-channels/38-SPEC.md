# Phase 38: Bounded Spaces And Channels - Specification

**Created:** 2026-06-20
**Ambiguity score:** 0.13 (gate: <= 0.20)
**Requirements:** 6 locked

## Goal

Authenticated users can create small private spaces with scoped text channels that reuse Chatify's existing membership, message, unread, attachment, notification, and moderation reliability model.

## Background

Chatify already supports direct chats, group chats, member-only message access, unread counts, attachments, reactions, notifications, abuse reports, session-bound sockets, and profile/presence privacy. It does not have a parent space concept, channel navigation, space roles, or invite-scoped channel membership. The safest path is to extend the existing private group-chat model into bounded spaces rather than adding a broad public community product.

## Requirements

1. **Private space records**: A user can create a private space with bounded name/description fields, explicit members, and owner/admin/member roles.
   - Current: Group chats have members and one group admin, but no parent space or role model.
   - Target: Backend persists spaces with creator ownership, member roles, small member limits, and no public directory.
   - Acceptance: Tests prove only authenticated members can list/read a space and only owner/admin roles can mutate membership.

2. **Scoped channels**: A space contains text channels with explicit membership scope and at least one default channel.
   - Current: Messages belong to chats only; no channel concept exists.
   - Target: Channels are represented as server-authorized conversation records under a space, with clear channel names and member scope.
   - Acceptance: Creating a space creates a default channel; non-members cannot read channel metadata or messages.

3. **Invite and membership controls**: Owner/admin users can add members by username and remove non-owner members without exposing email.
   - Current: Group creation uses usernames, but group member administration is limited.
   - Target: Space membership changes use usernames/public identity only and update channel membership safely.
   - Acceptance: Tests prove email is not accepted or returned for invite/member flows and removed members lose channel access.

4. **Channel messaging reuse**: Channel messages reuse the existing message, unread, attachment, reaction, socket, and notification contracts.
   - Current: Those contracts work for direct and group chats.
   - Target: Space channels flow through the same server-truth behavior with space/channel authorization checks.
   - Acceptance: Existing message tests plus channel-specific tests prove sends, reads, unread updates, reactions, and attachments are member-only.

5. **Frontend workspace**: The chat UI exposes a focused Spaces surface where users can create spaces, select channels, and keep the existing conversation pane for channel messages.
   - Current: The chat sidebar lists conversations only.
   - Target: Users can switch between conversations and spaces, select a space channel, and send/read messages without a marketing or directory page.
   - Acceptance: Component tests prove empty, loading, create, channel-select, and unauthorized/error states render correctly.

6. **Moderation and platform boundaries**: Reports and moderation context can reference space/channel ids, while bots, integrations, public discovery, and broad community features remain disabled.
   - Current: Abuse reports know chat/message context only.
   - Target: Reports preserve privacy-safe space/channel context for reviewers without expanding bot/integration runtime.
   - Acceptance: Tests prove report payloads can include redacted space/channel context and bot/integration entry points are not exposed.

## Boundaries

**In scope:**
- Space persistence, listing, creation, membership, and basic roles.
- Text channels scoped to a space and backed by the existing message/conversation reliability model.
- Username-based member add/remove controls.
- Space/channel UI inside the existing messenger shell.
- Member-only socket, unread, notification, attachment, reaction, and report behavior.
- Focused backend/frontend tests plus review and traceability.

**Out of scope:**
- Public space directory or search - violates the private-by-default phase boundary.
- Invite links, expiring invite tokens, or external sharing - username-based adds are enough for the first bounded version.
- Threads, forums, stages, channel categories, voice rooms, or large community moderation - these are separate product surfaces.
- Bots and integrations runtime - Phase 30 deferred runtime permissioning.
- Encrypted space channels - Phase 36 encrypted mode remains separate until channel key management is designed.
- Enterprise roles, SSO, audit exports, or organization administration - beyond the small private spaces scope.

## Constraints

- Keep the existing MERN, Socket.IO, TanStack Query, Zustand, Tailwind, and npm package layout.
- Preserve direct/group chat behavior while adding space/channel paths.
- Use username/public identity for member flows; do not expose or require email.
- Enforce membership and role checks on the server for every space/channel read and mutation.
- Keep limits conservative: small member count, small channel count, text channels only.
- Do not overwrite unrelated local work in `Frontend/Chatify/src/pages/chat/chat.tsx`.

## Acceptance Criteria

- [ ] Authenticated users can create a private space with a default channel.
- [ ] Space list and channel list show only spaces/channels the requester belongs to.
- [ ] Owner/admin users can add/remove members by username without email exposure.
- [ ] Removed members cannot fetch space channels, channel messages, attachments, unread counts, or realtime updates.
- [ ] Channel messages support send/read/unread/reaction/attachment flows through existing server-truth contracts.
- [ ] Reports can carry redacted space/channel context.
- [ ] Frontend renders spaces, channels, empty states, create flows, and access errors in the existing chat shell.
- [ ] Bots, integrations, and public discovery are not exposed.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|-----------|-------|-----|--------|-------|
| Goal Clarity | 0.90 | 0.75 | met | Bounded private spaces and text channels only. |
| Boundary Clarity | 0.92 | 0.70 | met | Public discovery, bots, rich community features, and encrypted channels are out. |
| Constraint Clarity | 0.82 | 0.65 | met | Reuse existing chat reliability and membership patterns. |
| Acceptance Criteria | 0.84 | 0.70 | met | Backend, frontend, realtime, and moderation checks are explicit. |
| **Ambiguity** | 0.13 | <=0.20 | met | Auto-selected recommendations from roadmap and prior phase constraints. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today? | Direct/group chat, message reliability, notifications, reports, and presence exist; spaces/channels do not. |
| 2 | Simplifier | What is the minimum viable space? | Small private space with default text channel and username member adds. |
| 3 | Boundary Keeper | What is not this phase? | No public directory, invite links, bots, threads, voice rooms, or encrypted channels. |
| 4 | Failure Analyst | What would make this unsafe? | Client-trusted membership, email exposure, stale channel access, or broad discovery. |

---

*Phase: 38-bounded-spaces-and-channels*
*Spec created: 2026-06-20*
*Next step: $gsd-discuss-phase 38 - implementation decisions*
