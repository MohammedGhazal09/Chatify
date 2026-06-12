# Roadmap: Chatify

## Overview

Chatify v1.0 reconstructs the existing chat app into a trustworthy real-time messenger. The roadmap moves vertically: first make security and tests block risky work, then authenticate realtime communication, then rebuild message state, then reconstruct the chat UI, then finish the messenger baseline features, then lock reference-driven visual parity across desktop and mobile light/dark variants.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Security And Test Foundation** - Establish blocking security controls, test harnesses, and auth/session safety.
- [x] **Phase 2: Authenticated Realtime Contract** - Rebuild Socket.IO identity, membership checks, presence, and reconnect behavior.
- [x] **Phase 3: Canonical Message State** - Make send, receive, status, delete, edit, reaction, unread, and pagination behavior deterministic. (completed 2026-06-08)
- [x] **Phase 4: Messenger UI Reconstruction** - Rebuild the chat page into a polished responsive messenger interface. (completed 2026-06-09)
- [x] **Phase 5: Messenger Baseline Completion** - Add search, conversation continuity, and final account/session polish for v1. (completed 2026-06-09)
- [x] **Phase 6: Messenger Visual Parity** - Match the supplied desktop and mobile light/dark messenger references as closely as possible. (completed 2026-06-12)

## Phase Details

### Phase 1: Security And Test Foundation

**Goal**: Users get safer auth/session behavior and the project gets automated tests that block regressions before chat reconstruction continues.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, AUTH-01, AUTH-02, AUTH-03, TEST-01, TEST-04
**Success Criteria** (what must be TRUE):

  1. Unsafe cookie-authenticated HTTP methods have active CSRF protection or documented safe exemptions.
  2. Auth, OAuth, reset, token, socket, and request logs redact secrets and user-identifying data.
  3. Backend tests cover auth lifecycle, CSRF behavior, message authorization boundaries, validation boundaries, and reset behavior.
  4. Session expiration, refresh failure, logout, and OAuth redirects behave predictably and safely.
  5. Sanitized environment examples document required frontend and backend variables without exposing secrets.

**Plans**: 3 plans

Plans:
**Wave 1**

- [ ] 01-01: Add backend/security test harness and baseline auth/message authorization coverage

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02: Enforce CSRF, session, reset, OAuth redirect, and environment safety controls

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03: Replace sensitive debug logging with redacted operational logging

### Phase 2: Authenticated Realtime Contract

**Goal**: Users can only connect, join, and emit realtime chat events through verified identity and server-side membership checks.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: RT-01, RT-02, RT-03, RT-04, RT-05, TEST-02
**Success Criteria** (what must be TRUE):

  1. Socket.IO derives `userId` from verified session data and no longer trusts `user:connect` user ids.
  2. Chat room joins and chat-scoped socket events are rejected unless the server verifies membership.
  3. Typing, delivery, read, edit, delete, reaction, notification, and presence flows are covered by socket integration tests.
  4. Reconnect behavior reconciles conversation list, selected messages, unread counts, and presence from server truth.
  5. Presence updates do not expose unauthorized status or persist stale online state after reconnect/disconnect cycles.

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 02-01: Authenticate Socket.IO handshake and derive trusted socket identity

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02: Centralize chat membership authorization for room joins and socket events

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03: Add reconnect, presence, and socket integration verification

### Phase 3: Canonical Message State

**Goal**: Users can send, receive, edit, delete, react, read, and paginate messages without duplicates, stale state, or unread-count drift.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, MSG-06, MSG-07
**Success Criteria** (what must be TRUE):

  1. A direct message follows one canonical sending, sent, delivered, and read lifecycle.
  2. Optimistic updates, mutation responses, socket events, and refetches merge without duplicate messages.
  3. Reloaded chat history excludes messages deleted for the current user and rejects unauthorized message actions.
  4. Unread counts stay consistent with per-user read receipt state.
  5. Message history uses scalable pagination and consistent validation boundaries across frontend, controller, and model layers.

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 03-01: Define canonical message contracts and idempotent backend state transitions

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02: Rebuild frontend message merge, optimistic rollback, and unread synchronization

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03: Replace offset history behavior and align validation boundaries

### Phase 4: Messenger UI Reconstruction

**Goal**: Users get a polished desktop and mobile chat experience with clear layout, message states, recovery paths, and testable component boundaries.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, TEST-03
**Success Criteria** (what must be TRUE):

  1. The chat page renders a responsive messenger layout with sidebar, conversation header, message list, composer, and actions.
  2. Loading, empty, offline, error, sending, failed-send, deleted, edited, delivered, read, and typing states are visually clear.
  3. Failed sends and network errors are recoverable without losing message context.
  4. Message actions work without layout shifts, overlapping controls, or hidden state changes on desktop and mobile.
  5. Chat UI code is split into focused components/hooks with frontend tests for optimistic send, rollback, duplicate merge, unread updates, session-expired state, and core UI states.

**Plans**: 3 plans

Plans:

**Wave 1**

- [x] 04-01: Split the monolithic chat page into focused layout, sidebar, list, bubble, composer, and action units

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02: Redesign desktop and mobile messenger visual states and interactions

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03: Add frontend chat UI and optimistic-state regression coverage

### Phase 5: Messenger Baseline Completion

**Goal**: Users can search, continue conversations, understand presence, and finish the v1 messenger baseline with account/session polish.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: BASE-01, BASE-02, BASE-03, BASE-04, BASE-05
**Success Criteria** (what must be TRUE):

  1. User can search conversations or contacts from the sidebar.
  2. User can search messages within the selected conversation.
  3. User can distinguish online, offline, and typing status without unauthorized presence leakage.
  4. User can start or continue direct-message conversations from the existing data model.
  5. User can navigate away and return without losing selected conversation context unnecessarily.

**Plans**: 2 plans
Plans:
**Wave 1**

- [x] 05-01: Add conversation/contact search, message search, and direct-message continuation

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02: Polish presence, navigation continuity, account/session edge states, and v1 verification

### Phase 6: Messenger Visual Parity

**Goal**: Rebuild the chat surface so the desktop and mobile light/dark variants match the supplied reference images as closely as possible while preserving the Phase 3 canonical message state and Phase 5 baseline behavior.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, TEST-03
**Success Criteria** (what must be TRUE):

  1. The desktop light and dark messenger shells reproduce the same three-column information architecture, spacing, icon placement, and state surfaces shown in the reference images.
  2. The mobile light and dark messenger shells reproduce the same single-column chat screen, safe-area header, date divider, composer, typing row, and secure-session footer shown in the reference images.
  3. Abstract geometric identity tiles or monograms are used everywhere; no photographic avatars, life-form imagery, or mascot art appear in any variant.
  4. Theme switching is token-driven and changes only colors and surfaces, not layout, message flow, search behavior, or presence/session behavior.
  5. Screenshot verification proves the four reference variants remain visually aligned at desktop and mobile sizes without overflow, clipping, or overlapping controls.

**Plans**: 3 plans
Plans:

**Wave 1**

- [x] 06-01: Lock the shared messenger theme tokens and desktop three-column shell against the light and dark references

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 06-02: Rebuild the mobile single-column chat surface, composer, and status surfaces against the light and dark references

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 06-03: Add light/dark desktop/mobile screenshot checks and close remaining visual drift

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security And Test Foundation | 0/3 | Not started | - |
| 2. Authenticated Realtime Contract | 3/3 | Complete | 2026-06-08 |
| 3. Canonical Message State | 3/3 | Complete | 2026-06-08 |
| 4. Messenger UI Reconstruction | 3/3 | Complete | 2026-06-09 |
| 5. Messenger Baseline Completion | 2/2 | Complete | 2026-06-09 |
| 6. Messenger Visual Parity | 3/3 | Complete   | 2026-06-12 |
