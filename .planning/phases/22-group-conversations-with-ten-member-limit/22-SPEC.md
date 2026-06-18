---
phase: 22
title: Group Conversations With Ten-Member Limit
status: specified
created_at: 2026-06-18
---

# Phase 22 Spec: Group Conversations With Ten-Member Limit

## Goal

Users can create and participate in small private group conversations selected by username, with server-enforced membership authorization and a hard 10-member maximum.

## Recommended Product Decisions

- Use a dedicated group creation endpoint: `POST /api/chat/create-group-chat`.
  - Rationale: direct-chat idempotency stays isolated from group validation and naming rules.
- Require 3 to 10 total members, including the creator.
  - Rationale: two-person conversations remain direct chats; the 10-member cap is enforced consistently.
- Select group members by exact username only.
  - Rationale: Phase 21 intentionally avoids public directory/autocomplete enumeration.
- Require a group name on creation.
  - Rationale: group rows need a stable title that does not expose member emails or depend on ordered member display names.
- Keep group calls/video disabled or unavailable.
  - Rationale: existing call logic is direct-chat only; group call support needs a separate phase.

## Requirements

- V2-GRP-01: Authenticated users can create private group conversations by username.
- V2-GRP-02: The backend enforces 3 to 10 total members including the creator.
- V2-GRP-03: Group member identifiers are unique and resolved from normalized usernames.
- V2-GRP-04: Group conversations use existing message, unread, attachment, pin, and realtime contracts without direct-chat assumptions.
- V2-PRIV-01: Group creation and participant surfaces never expose email.
- V2-PRIV-03: Missing, duplicate, blocked, self, and invalid member submissions fail without leaking private email or account data.
- TEST-02/03/05: Backend, socket/cache, component, and UI tests cover group creation, cap enforcement, privacy guardrails, and desktop/mobile states.

## Acceptance Criteria

1. `POST /api/chat/create-group-chat` validates `chatName` and `memberUsernames`, resolves members by username, adds the creator, assigns `groupAdmin`, and returns a populated group chat with public member identity only.
2. The backend rejects fewer than 3 total members, more than 10 total members, duplicate usernames, self-only/self-duplicate submissions, invalid usernames, missing usernames, blocked creator/member pairs, and unauthorized reads/writes.
3. Group messages, unread counts, attachments, pinned messages, search, edit/delete/reactions, typing, and socket room membership continue to work for group members through the existing message and socket contracts.
4. The frontend lets users choose direct or group conversation creation from the existing new-chat entry point, enter a group name, add username chips, see the 10-member cap, and submit a recoverable form.
5. Group rows, headers, message bubbles, detail surfaces, and security copy use group name, member count, usernames/display identity, and no email.
6. Group audio/video controls stay disabled or hidden with honest copy until a later group call phase exists.

## Out Of Scope

- Group member removal, promotion, invite links, public groups, channels, moderation tooling, group calls, group avatars, and username autocomplete.
- Username change workflows.
- Production smoke proof beyond the existing release-readiness gates.
