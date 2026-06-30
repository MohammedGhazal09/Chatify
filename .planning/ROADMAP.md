# Roadmap: Chatify

## Overview

Chatify v1.0 reconstructs the existing chat app into a trustworthy real-time messenger. The roadmap moves vertically: first make security and tests block risky work, then authenticate realtime communication, then rebuild message state, then reconstruct the chat UI, then finish the messenger baseline features, then lock reference-driven visual parity across desktop and mobile light/dark variants, then restore full product behavior behind the reference UI, implement real media/detail surfaces, enforce an interaction quality gate, and remediate production-live gaps that proved fixture-backed tests were not enough. After the core reconstruction, the roadmap closes release readiness, operational supportability, group messaging, safety, moderation, and platform-design work without hiding unresolved production or security blockers. The next expansion chain turns the deferred feature recommendations into concrete GSD phases: notification runtime, conversation organization, advanced search, device/session management, opt-in encrypted conversations, richer profiles and presence, bounded spaces, data privacy controls, moderation operations, and localization/RTL.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Security And Test Foundation** - Establish blocking security controls, test harnesses, and auth/session safety. (completed 2026-06-17)
- [x] **Phase 2: Authenticated Realtime Contract** - Rebuild Socket.IO identity, membership checks, presence, and reconnect behavior.
- [x] **Phase 3: Canonical Message State** - Make send, receive, status, delete, edit, reaction, unread, and pagination behavior deterministic. (completed 2026-06-08)
- [x] **Phase 4: Messenger UI Reconstruction** - Rebuild the chat page into a polished responsive messenger interface. (completed 2026-06-09)
- [x] **Phase 5: Messenger Baseline Completion** - Add search, conversation continuity, and final account/session polish for v1. (completed 2026-06-09)
- [x] **Phase 6: Messenger Visual Parity** - Match the supplied desktop and mobile light/dark messenger references as closely as possible. (completed 2026-06-12)
- [x] **Phase 7: Messenger Functional Parity Restoration** - Rewire the reference UI to real chat state, actions, navigation, search, status, and session behavior so no production surface is static-only. (completed 2026-06-12)
- [x] **Phase 8: Media Files And Conversation Detail Implementation** - Implement real attachments, previews, downloads, shared media/files, pinned items, and conversation detail/security panels. (completed 2026-06-12)
- [x] **Phase 9: Messenger Interaction Quality Gate** - Prove the messenger works end-to-end across desktop, mobile, light theme, and dark theme with behavior tests and screenshot evidence. (completed 2026-06-12)
- [x] **Phase 10: Production Messenger Reality Audit And Fixture Removal** - Reproduce the live product failures, remove fixture/static production fallbacks, and make panel/navigation behavior honestly testable. (closed by Phase 25 evidence reconciliation 2026-06-20)
- [x] **Phase 10.1: Production Message Delivery Reliability Repair (INSERTED)** - Fix duplicate sends, false delivered status, and missing realtime receive before new feature work continues. (closed by Phase 25 evidence reconciliation 2026-06-20)
- [x] **Phase 11: Conversation Controls And User Safety Implementation** - Make search, More, blocking, conversation actions, and static detail surfaces real backend-backed behavior. (completed 2026-06-17)
- [x] **Phase 12: Live Media Voice And Identity Implementation** - Make user identity images/marks, attachments, shared media/files, and voice messages real persisted workflows. (completed 2026-06-17)
- [x] **Phase 13: Realtime Call And Video Implementation** - Make call and video controls initiate reliable authenticated realtime sessions instead of dead buttons. (completed 2026-06-13)
- [x] **Phase 14: Production Live Acceptance Gate** - Prove the deployed Vercel/Render product works with real accounts and no fixture bypass. (user-confirmed complete 2026-06-19)
- [x] **Phase 15: Investigate And Fix Audio And Video Call Reliability** - Make audio and video calls connect, fail honestly, clean up safely, and report readiness with evidence. (user-confirmed complete 2026-06-19)
- [x] **Phase 16: Profile Picture Upload And Shared Avatar Visibility** - Let users upload a profile picture from their own PC and show it consistently to other users. (completed 2026-06-16)
- [x] **Phase 17: V1 Readiness Closure And Release Gate** - Close the remaining security, production, delivery, and call-readiness evidence before any v1 release claim. (user-confirmed complete 2026-06-19)
- [x] **Phase 18: Operational Observability And Runbook Hardening** - Make Chatify diagnosable, supportable, and repeatable in local and deployed environments. (completed 2026-06-17)
- [x] **Phase 19: Messenger Product Polish And Notifications** - Add post-readiness messenger polish, notification behavior, and account/session UX refinements without expanding into full platform scope. (completed 2026-06-17)
- [x] **Phase 20: Username Identity And Privacy Foundation** - Add unique public usernames, signup collection, existing-user username setup, and private-email boundaries. (completed 2026-06-18)
- [x] **Phase 21: Username-Based Contact Discovery** - Replace email-based direct chat creation and contact discovery with username-based lookup. (completed 2026-06-18)
- [x] **Phase 22: Group Conversations With Ten-Member Limit** - Add private group conversations with username-selected members and a server-enforced 10-member cap. (completed 2026-06-18)
- [x] **Phase 23: Per-User Message Deletion For Received And Group Messages** - Let users hide any visible message for themselves in direct and group chats without deleting it for other participants. (completed by reconciliation 2026-06-20)
- [x] **Phase 24: Group message sender names and group voice/video calls** - Show sender names in groups and expose authenticated, honest group call entry points. (completed 2026-06-19)
- [x] **Phase 25: Production Evidence Closure And Live Smoke Execution** - Close production/live smoke evidence from user-confirmed prior runs with sanitized records. (user-confirmed complete 2026-06-19)
- [x] **Phase 26: CI Quality Parity And Release Gate Automation** - Align CI with local quality and release evidence gates. (completed locally 2026-06-19)
- [x] **Phase 27: Remaining Messenger Requirement Closure** - Close voice-message recovery and production-backed media/file traceability. (completed 2026-06-19)
- [x] **Phase 28: Trust And Abuse Safety Foundation** - Add abuse reporting, admin review APIs, redaction, and audit trails. (completed locally 2026-06-19)
- [x] **Phase 29: Privacy And Encryption Design Spike** - Decide E2EE tradeoffs, key-management, and migration scope before implementation. (design complete 2026-06-19)
- [x] **Phase 30: External Notifications And Platform Expansion** - Design opt-in notifications, bounded spaces, bots, and integrations. (design complete 2026-06-19)
- [x] **Phase 31: Admin Moderation UI And Enforcement Workflow** - Build the protected reviewer workspace and enforcement workflow on top of Phase 28. (completed 2026-06-19)
- [x] **Phase 32: Server-Side Push And Email Notification Runtime** - Implement opt-in push/email delivery with privacy-safe templates, outbox processing, and delivery observability. (completed 2026-06-20)
- [x] **Phase 33: Conversation Organization And Focus Controls** - Add mute, archive, pin, favorite, unread, and focus filters across direct and group conversations. (completed 2026-06-20)
- [x] **Phase 34: Advanced Message And Asset Search** - Add scoped search filters for sender, date, media, files, links, voice messages, and jump-to-message navigation. (completed 2026-06-20)
- [x] **Phase 35: Session And Device Management** - Let users inspect active sessions and devices, revoke sessions, and understand suspicious session activity. (completed 2026-06-20)
- [x] **Phase 36: Opt-In Encrypted Conversation Mode** - Implement the Phase 29 E2EE decision as a separate opt-in conversation mode without weakening standard conversations. (completed 2026-06-20)
- [x] **Phase 37: Rich Profiles And Presence Privacy** - Add profile bios/status and user-controlled presence visibility without leaking private identity data. (completed 2026-06-20)
- [x] **Phase 38: Bounded Spaces And Channels** - Add small private spaces/channels as a conservative community extension on top of trusted group behavior. (completed 2026-06-21)
- [x] **Phase 39: Data Privacy Controls And Account Portability** - Add export, deletion, retention, and account portability controls with auditable privacy behavior. (completed 2026-06-21)
- [x] **Phase 40: Moderation Appeals And Reviewer Operations** - Extend moderation with appeals, assignments, enforcement history, and operational review analytics. (completed 2026-06-21)
- [x] **Phase 41: Localization And RTL Experience** - Add English/Arabic localization, RTL layout support, and bilingual verification gates. (completed 2026-06-21)
- [x] **Phase 42: Contact Requests And Trusted Conversation Onboarding** - Gate new standard direct chats behind recipient-approved contact requests. (completed locally 2026-06-30)
- [x] **Phase 43: Reply To Message With Quoted Context** - Let users reply to a visible message with durable, privacy-safe quoted context.
- [x] **Phase 44: Per-Conversation Message Drafts** - Preserve unsent text per conversation with local-only draft persistence. (completed locally 2026-06-30)
- [x] **Phase 45: Two-Factor Authentication And Backup Codes** - Add TOTP two-factor authentication and backup codes for local accounts. (completed locally 2026-06-30)
- [x] **Phase 46: Group And Space Mentions** - Let group and space-channel users mention authorized members with server-validated public metadata. (completed locally 2026-06-30)
- [x] **Phase 47: Expiring And Revokable Invite Links** - Safer shareable invite workflows with expiry, revocation, and max-use limits. (completed locally 2026-06-30)
- [x] **Phase 48: Saved Messages And Bookmarks** - Plan and implement personal saved-message workflows. (completed locally 2026-06-30)
- [ ] **Phase 49: Delivery Health Dashboard** - Plan and implement delivery diagnostics and operational visibility.

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

- [x] 01-01: Add backend/security test harness and baseline auth/message authorization coverage

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02: Enforce CSRF, session, reset, OAuth redirect, and environment safety controls

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03: Replace sensitive debug logging with redacted operational logging

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

### Phase 7: Messenger Functional Parity Restoration

**Goal**: Users get the Phase 6 visual design as a working messenger: conversations, messages, composer, search, presence, status, retry, selection, navigation, and theme behavior are backed by real state and existing APIs instead of static placeholders.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: PARITY-01, PARITY-02, PARITY-03, UI-01, UI-02, UI-03, UI-04, UI-05, BASE-01, BASE-02, BASE-03, BASE-04, BASE-05, MSG-01, MSG-02, MSG-04, MSG-05, RT-04, TEST-03, TEST-05
**Success Criteria** (what must be TRUE):

  1. Conversation list, selected header, message list, unread badges, delivery/read states, typing, presence, and connection/session surfaces render from TanStack Query, Zustand, Socket.IO, and API data instead of reference fixtures.
  2. Composer send, retry failed send, edit/delete/reaction entry points, search, conversation selection, mobile back/drawer navigation, and theme switching perform real supported behavior without breaking the reference layout.
  3. Any visible control that is not supported yet is removed, hidden, or rendered as an honest disabled state; the UI must not expose decorative buttons that look functional but do nothing.
  4. Desktop and mobile light/dark variants preserve the same real workflows, with no layout-only fork that skips app state, auth/session handling, socket state, or error recovery.
  5. Component tests and Playwright smoke tests cover real send/search/navigation/status workflows and fail if static demo data replaces production state.

**Plans**: 3 plans

Plans:

**Wave 1**

- [x] 07-01: Isolate Phase 6 visual fixtures from production runtime and add fixture-leak guardrails

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-02: Restore live-state UI behavior and honest disabled or unavailable surfaces

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-03: Add behavior-first Playwright coverage and after-interaction evidence

Cross-cutting constraints:

- Execution must be inline in the current Codex thread; do not use subagents.

### Phase 8: Media Files And Conversation Detail Implementation

**Goal**: Users can attach, view, preview, download, and inspect shared conversation assets through real data-backed media, file, pinned-item, and detail/security surfaces without weakening message privacy or the responsive reference design.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: MEDIA-01, MEDIA-02, MEDIA-03, PARITY-01, PARITY-02, UI-01, UI-02, UI-04, UI-05, MSG-03, MSG-04, TEST-05
**Success Criteria** (what must be TRUE):

  1. The composer attachment control opens a supported upload/selection flow with validation for file type, size, auth, ownership, and recoverable failure states.
  2. Image/media previews, file cards, download actions, and message attachments render from persisted message data and survive reload, pagination, search, and realtime updates.
  3. Shared files, shared media, pinned messages, and conversation security/detail panels are backed by real conversation data or are intentionally hidden until a specific backend capability exists.
  4. File/media access is membership-checked on the backend and does not expose private assets, object keys, unauthorized previews, or stale conversation details.
  5. Desktop right panel and mobile detail surfaces work in both themes without overflow, dead controls, or decorative static content.

**Plans**: 3 plans

**Wave 1**

- [x] 08-01: Build protected attachment storage, canonical send, preview/download, shared assets, and pin backend contracts.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02: Wire attachment composer, message bubbles, shared panels, and mobile detail UI to server state.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-03: Add pin/detail realtime, filename search integration, fixture guardrails, and behavior evidence.

### Phase 9: Messenger Interaction Quality Gate

**Goal**: The rebuilt messenger is accepted only when the UI behaves like a real website across critical workflows, not just a visually accurate screenshot.
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: TEST-03, TEST-05, PARITY-01, PARITY-02, PARITY-03, UI-01, UI-02, UI-03, UI-04, UI-05, BASE-01, BASE-02, MEDIA-01, MEDIA-02, MEDIA-03
**Success Criteria** (what must be TRUE):

  1. End-to-end tests exercise login/session recovery, conversation selection, send/retry, search, read/delivery state, typing/presence, theme switching, mobile navigation, attachments, and detail panels against app behavior.
  2. Visual screenshot tests for desktop/mobile and light/dark themes run after behavior interactions, proving the real UI remains aligned after data changes instead of only at initial render.
  3. Accessibility and keyboard checks cover the chat shell, composer, actions, drawers/panels, media/file controls, and disabled/unsupported states.
  4. Test fixtures are centralized, named, and separated from production UI paths so reference-demo data cannot accidentally ship as product behavior.
  5. The phase summary records exact lint, build, unit, integration, Playwright, and screenshot outcomes before the messenger can be considered v1-ready.

**Plans**: 3 plans

Plans:

**Wave 1**

- [x] 09-01: Build the dedicated behavior-first Phase 09 Playwright gate and fixture guardrails

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02: Add accessibility, keyboard, responsive layout, and privacy guardrails

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 09-03: Run the full quality gate, capture evidence, and reconcile readiness records

Cross-cutting constraints:

- Execution must be inline in the current Codex thread; do not use subagents.
- Preserve unrelated local work and stage only Phase 09 planning/evidence artifacts plus normal state/roadmap updates.

### Phase 10: Production Messenger Reality Audit And Fixture Removal

**Goal**: Users and reviewers get a production-truth baseline: the live deployed messenger failures are reproduced, static/demo fallbacks are removed from production runtime paths, and the right-side detail rail/drawer can be closed, reopened, and tested on desktop and mobile.
**Mode:** mvp
**Depends on**: Phase 9
**Requirements**: PROD-01, PROD-02, PROD-03, PARITY-01, PARITY-02, TEST-05
**Success Criteria** (what must be TRUE):

  1. The Vercel frontend and Render backend are exercised with real authenticated accounts, not only local fixtures, and the current dead-control/static-content failures are documented as failing baseline evidence.
  2. Production chat runtime code no longer imports or synthesizes placeholder pinned messages, shared files, shared media, message text, or detail-panel rows as if they were real data.
  3. The desktop right rail and mobile detail drawer have explicit open, close, escape, overlay, route-state, and focus-return behavior.
  4. Any visible control that is not implemented yet is hidden or rendered with an honest disabled state until the phase that implements it.
  5. Unit, browser, and production-smoke checks fail when static fixture data or non-closable panels return.

**Plans**: 0 plans

Plans:

- [ ] TBD (run `$gsd-spec-phase 10`, `$gsd-discuss-phase 10`, then `$gsd-plan-phase 10`)

### Phase 10.1: Production Message Delivery Reliability Repair (INSERTED)

**Goal**: Users can send one message and have exactly one message persist and render for both participants in realtime, with delivery indicators that reflect server truth instead of optimistic or stale assumptions.
**Mode:** mvp
**Depends on**: Phase 10
**Requirements**: DELIV-01, DELIV-02, DELIV-03, DELIV-04, DELIV-05, MSG-01, MSG-02, RT-04, TEST-02, TEST-05
**Success Criteria** (what must be TRUE):

  1. A single send action creates exactly one persisted message and one rendered sender bubble across click, Enter, retry, websocket echo, mutation response, and refetch paths.
  2. Frontend merge logic and backend idempotency use `clientMessageId` and durable message ids so optimistic, HTTP, socket, retry, and pagination updates cannot duplicate the same message.
  3. The recipient receives the new message through Socket.IO without refreshing the page, and the sender/recipient conversation lists update from the same canonical event stream.
  4. Delivered/read indicators are server-truth based and never show delivered merely because the sender request succeeded or an optimistic bubble rendered.
  5. Two-account local and deployed smoke tests prove no duplicate send, instant realtime receive, correct delivery status, reconnect reconciliation, and refresh parity.

**Plans**: 3 plans
Plans:

**Wave 1**

- [x] 10.1-01: Harden backend message identity, idempotency, receipt truth, and redacted diagnostics

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10.1-02: Make frontend send, cache, retry, reconnect, and socket receive converge on one canonical message

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 10.1-03: Prove delivery reliability with local and production two-account smoke evidence

**Cross-cutting constraints:**

- Execution must be inline in the current Codex thread; do not use subagents.

### Phase 11: Conversation Controls And User Safety Implementation

**Goal**: Users can operate the conversation header and detail controls for real: message search, More actions, blocking/unblocking, pinned state, and detail content all reflect server-backed conversation state and authorization.
**Mode:** mvp
**Depends on**: Phase 10.1
**Requirements**: CTRL-01, CTRL-02, CTRL-03, BLOCK-01, BLOCK-02, BASE-02, MEDIA-03, TEST-05
**Success Criteria** (what must be TRUE):

  1. Header and rail search buttons open a working message-search experience backed by the existing API/query flow, with results that jump to loaded messages or fetch the needed range.
  2. The More menu opens reliably on desktop and mobile and exposes only implemented actions with accessible labels, keyboard support, loading states, and error recovery.
  3. Users can block and unblock a direct-message participant; blocked state prevents new messages, call attempts, and inappropriate realtime events while preserving prior authorized history.
  4. Pinned messages, shared files, shared media, and security rows render from server-backed conversation data or disappear when no data exists.
  5. Tests cover the controls against live-like API responses, authorization failures, blocked users, empty states, and mobile drawer behavior.

**Plans**: 3 plans

Plans:

**Wave 1**

- [x] 11-01: Backend Conversation Controls and Block Enforcement

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 11-02: Frontend Controls, Search, Detail Data, and Accessibility

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 11-03: Integrated Verification and Static Fixture Guard

**Cross-cutting constraints:**

- Phase 11 depends on Phase 10.1 production delivery reliability evidence before any production-ready claim.
- Every visible conversation control must either perform a real action or render an honest disabled/unavailable state.
- Pinned messages, shared files, shared media, and security rows must be server-backed or absent; no production fixture leakage.
- Execution must be inline in the current Codex thread; do not use subagents.

### Phase 12: Live Media Voice And Identity Implementation

**Goal**: Users can change their conversation identity mark/image, attach real media/files, send and play voice messages, and see shared media/files update from persisted data instead of static cards.
**Mode:** mvp
**Depends on**: Phase 11
**Requirements**: ID-01, ID-02, MEDIA-01, MEDIA-02, MEDIA-04, VOICE-01, VOICE-02, TEST-05
**Success Criteria** (what must be TRUE):

  1. User identity imagery is changeable through a validated settings/profile flow and renders consistently in the sidebar, header, message surfaces, and detail panel.
  2. The attachment button opens a real picker/uploader with type and size validation, progress, cancellation, retry, persisted metadata, and membership-checked access.
  3. Shared media and shared files are derived from persisted message attachments and update after send, reload, search, pagination, and realtime events.
  4. Voice messages can be recorded, previewed, cancelled, sent, loaded, played, paused, and retried with clear permission and unsupported-browser states.
  5. Backend and frontend tests prove privacy, authorization, persistence, playback states, and production-build behavior.

**Plans**: 3 plans

Plans:

- [ ] 12-01 Identity Contract, Settings, And Propagation
- [ ] 12-02 Attachment Progress, Abort, Retry, And Voice Contract
- [ ] 12-03 Shared Asset Truth, Voice Playback, Realtime, Privacy, And Evidence

### Phase 13: Realtime Call And Video Implementation

**Goal**: Users can start, receive, accept, reject, and end authenticated one-to-one audio and video calls from the messenger controls with reliable state, permission handling, and blocked-user safety.
**Mode:** mvp
**Depends on**: Phase 12
**Requirements**: CALL-01, CALL-02, CALL-03, CALL-04, BLOCK-02, RT-01, RT-02, TEST-02, TEST-05
**Success Criteria** (what must be TRUE):

  1. Call and video buttons initiate real authenticated signaling flows instead of decorative UI actions.
  2. Incoming, outgoing, ringing, connected, rejected, missed, busy, permission-denied, and ended states are visible and recoverable.
  3. WebRTC signaling is scoped to authorized direct-message participants and rejects blocked, unauthorized, stale, or cross-chat attempts.
  4. Audio/video permissions, device absence, network failure, reconnect, and tab lifecycle behavior are handled without leaving stuck call state.
  5. Automated tests cover signaling contracts, state machines, blocked-user behavior, and browser call UI with mocked media streams.

**Plans**: 3 plans
Plans:

**Wave 1**

- [x] 13-01 Backend Call Session And Signaling Authority

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 13-02 Frontend Call Controller, WebRTC Media, And Entry Points

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 13-03 Call Activity, Reconnect/Unload, Regression Gates, And Evidence

**Cross-cutting constraints:**

- Execution must be inline in the current Codex thread; do not use subagents.

### Phase 14: Production Live Acceptance Gate

**Goal**: Chatify is called functionally ready only after the deployed product passes live end-to-end acceptance across real accounts, real backend data, desktop/mobile, light/dark themes, and every visible chat control.
**Mode:** mvp
**Depends on**: Phase 13
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, TEST-01, TEST-02, TEST-05
**Success Criteria** (what must be TRUE):

  1. A live Vercel/Render smoke suite signs in with real test accounts and verifies conversation selection, detail rail close/open, send/receive, search, More, block/unblock, attachments, voice, call, video, and logout/session recovery.
  2. The live gate runs without importing local fixture data, route-only mocks, screenshot-only assertions, or static fallback detail content.
  3. Production screenshots and traces are captured after successful behavior interactions for desktop/mobile and light/dark variants.
  4. Deployment configuration, CORS, cookies, sockets, file access, and call signaling are verified against the actual deployed origins.
  5. The final acceptance artifact records exact commands, URLs, commit hashes, test accounts used safely, evidence paths, and remaining risks before v1 readiness can be claimed.

**Plans**: 3 plans

Plans:

**Wave 1**

- [x] 14-01: Production Harness, Environment Contract, And Evidence Reporter

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 14-02: Live Messaging, Controls, Attachments, And Static-Content Acceptance

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 14-03: Call/Video, Deployment Evidence, And Final Readiness Gate

**Cross-cutting constraints:**

- Execution must be inline in the current Codex thread; do not use subagents.
- The phase must fail closed when live credentials/origins are unavailable; no local fixture fallback can count as production readiness.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 10.1 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22 -> 23 -> 24 -> 25 -> 26 -> 27 -> 28 -> 29 -> 30 -> 31

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security And Test Foundation | 3/3 | Complete    | 2026-06-17 |
| 2. Authenticated Realtime Contract | 3/3 | Complete    | 2026-06-17 |
| 3. Canonical Message State | 3/3 | Complete    | 2026-06-17 |
| 4. Messenger UI Reconstruction | 3/3 | Complete    | 2026-06-17 |
| 5. Messenger Baseline Completion | 2/2 | Complete    | 2026-06-17 |
| 6. Messenger Visual Parity | 3/3 | Complete    | 2026-06-17 |
| 7. Messenger Functional Parity Restoration | 3/3 | Complete    | 2026-06-17 |
| 8. Media Files And Conversation Detail Implementation | 3/3 | Complete    | 2026-06-17 |
| 9. Messenger Interaction Quality Gate | 3/3 | Complete    | 2026-06-17 |
| 10. Production Messenger Reality Audit And Fixture Removal | 3/3 | Complete by Phase 25 evidence reconciliation | 2026-06-20 |
| 10.1. Production Message Delivery Reliability Repair | 3/3 | Complete by Phase 25 evidence reconciliation | 2026-06-20 |
| 11. Conversation Controls And User Safety Implementation | 3/3 | Complete    | 2026-06-17 |
| 12. Live Media Voice And Identity Implementation | 3/3 | Complete | 2026-06-17 |
| 13. Realtime Call And Video Implementation | 3/3 | Complete   | 2026-06-13 |
| 14. Production Live Acceptance Gate | 3/3 | User-confirmed complete through Phase 25 | 2026-06-19 |
| 15. Investigate And Fix Audio And Video Call Reliability | 4/4 | User-confirmed complete through Phase 25 | 2026-06-19 |
| 16. Profile Picture Upload And Shared Avatar Visibility | 4/4 | Complete    | 2026-06-16 |
| 17. V1 Readiness Closure And Release Gate | 4/4 | User-confirmed complete through Phase 25 | 2026-06-19 |
| 18. Operational Observability And Runbook Hardening | 4/4 | Complete | 2026-06-17 |
| 19. Messenger Product Polish And Notifications | 5/5 | Complete   | 2026-06-17 |
| 20. Username Identity And Privacy Foundation | 3/3 | Complete | 2026-06-18 |
| 21. Username-Based Contact Discovery | 3/3 | Complete | 2026-06-18 |
| 22. Group Conversations With Ten-Member Limit | 4/4 | Complete | 2026-06-18 |
| 23. Per-User Message Deletion For Received And Group Messages | 1/1 | Complete by reconciliation | 2026-06-20 |
| 24. Group message sender names and group voice/video calls | 2/2 | Complete | 2026-06-19 |
| 25. Production Evidence Closure And Live Smoke Execution | 3/3 | User-confirmed complete | 2026-06-19 |
| 26. CI Quality Parity And Release Gate Automation | 3/3 | Complete locally | 2026-06-19 |
| 27. Remaining Messenger Requirement Closure | 3/3 | Complete | 2026-06-19 |
| 28. Trust And Abuse Safety Foundation | 3/3 | Complete locally | 2026-06-19 |
| 29. Privacy And Encryption Design Spike | 3/3 | Design complete | 2026-06-19 |
| 30. External Notifications And Platform Expansion | 4/4 | Design complete | 2026-06-19 |
| 31. Admin Moderation UI And Enforcement Workflow | 3/3 | Complete | 2026-06-19 |

### Phase 15: Investigate and fix audio and video call reliability

**Goal:** Users can trust Chatify audio and video calls to connect, fail honestly, clean up safely, and report local/production readiness with evidence instead of assumptions.
**Requirements**: CALL-01, CALL-02, CALL-03, CALL-04, BLOCK-02, RT-01, RT-02, RT-04, RT-05, SEC-02, PROD-01, PROD-03, PROD-04, TEST-02, TEST-03, TEST-05, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, PARITY-02, PARITY-03
**Depends on:** Phase 14
**Plans:** 4/4 plans executed; readiness blocked by external smoke env
Plans:

- [x] 15-01: Investigation, failure report, and test harness
- [x] 15-02: Backend signaling, session authority, TURN, and privacy hardening
- [x] 15-03: Frontend WebRTC controller and call UI repair
- [x] 15-04: Acceptance, regression, evidence, and production decision

**Cross-cutting constraints:**

- D-02: Create 15-FAILURE-REPORT.md before claiming fixes.
- D-06: Local two-account fake-media Playwright acceptance is mandatory and blocking.
- D-11: Reuse the Phase 14 production smoke environment contract.
- D-51: Create 15-FAILURE-REPORT.md for reproduction and layer classification.
- D-57: Do not use subagents for this phase work.
- D-17: Production readiness requires working TURN or an honest blocker.
- D-19: Verify CALL_TURN_URLS, CALL_TURN_USERNAME, and CALL_TURN_CREDENTIAL.
- D-22: Preserve server-authoritative call sequencing.
- D-25: Keep the 15 second socket disconnect grace unless reproduction proves change is required.
- D-26: Do not implement ICE renegotiation unless the failure report proves it is required.
- D-28: Video camera failure must not silently become an audio call.

### Phase 16: Profile Picture Upload And Shared Avatar Visibility

**Goal:** Authenticated users can upload, preview, replace, and remove a profile picture from Settings, and other authenticated users see it through existing chat identity surfaces with safe fallback behavior.
**Requirements**: ID-01, ID-02, SEC-01, SEC-02, TEST-01, TEST-04, TEST-05, UI-04, UI-05, UI-06
**Depends on:** Phase 15
**Plans:** 4/4 plans complete
Plans:

- [x] 16-01: Backend profile image contract, storage, and security
- [x] 16-02: Settings profile picture workflow and cache propagation
- [x] 16-03: Avatar rendering surfaces and fixture guardrails
- [x] 16-04: Acceptance evidence, privacy scan, and regression gate

**Cross-cutting constraints:**

- D-04: Never expose raw storage internals in client payloads.
- D-20: Unsafe profile-picture methods must use CSRF or a documented verified exemption.
- D-22: Logs and errors must not expose image internals or user-identifying secrets.
- D-35: Fixture guardrails must remain narrow and active.
- D-36: Verification must include backend, frontend, fixture guard, and local two-account Playwright evidence.
- D-37: Production E2E is not required for Phase 16.
- D-39: Preserve unrelated local work and stage only focused Phase 16 files.
- D-38: Avoid direct edits to Frontend/Chatify/src/pages/chat/chat.tsx unless integration requires it.

### Phase 17: V1 Readiness Closure And Release Gate

**Goal:** Chatify can only be called v1-ready after the open security foundation, production reality, delivery reliability, live acceptance, and call reliability gates are either passed with evidence or explicitly blocked with release-stopping reasons.
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, AUTH-01, AUTH-02, AUTH-03, DELIV-01, DELIV-02, DELIV-03, DELIV-04, DELIV-05, PROD-01, PROD-02, PROD-03, PROD-04, CALL-01, CALL-02, CALL-03, CALL-04, TEST-01, TEST-04, TEST-05
**Depends on:** Phase 16 plus closure of Phase 1, Phase 10, Phase 10.1, Phase 14, and Phase 15 readiness blockers
**Success Criteria** (what must be TRUE):

  1. Phase 1 security foundation requirements are implemented or the release decision remains blocked with exact missing controls.
  2. Phase 10 and Phase 10.1 production reality and delivery evidence prove no static fixture fallback, no duplicate sends, realtime receive, and honest delivery/read state.
  3. Phase 14 production live acceptance runs against configured deployed frontend/backend origins and disposable smoke accounts, or records a release-blocking environment gap.
  4. Phase 15 call reliability records local fake-media acceptance and production TURN/smoke readiness as passed, failed, or blocked without overstating readiness.
  5. A final v1 readiness artifact lists commands, deploy refs, evidence paths, residual risks, and a release decision of ready, blocked, or failed.

**Plans:** 4/4 plans executed; user-confirmed complete

Plans:

- [x] 17-01: Evidence inventory and blocker matrix
- [x] 17-02: Security foundation and local quality gate reconciliation
- [x] 17-03: Production, delivery, and call readiness gate
- [x] 17-04: Final v1 decision, roadmap state, and release recommendation

**Cross-cutting constraints:**

- Release evidence closure is user-confirmed from prior runs and recorded without secrets.
- Fresh production origins, accounts, deploy refs, or TURN configuration still require the Phase 25 smoke commands when a new release candidate is cut.
- This phase closes and reconciles existing readiness gates; it should not create unrelated feature scope.
- Execution must be inline in the current Codex thread; do not use subagents.

### Phase 18: Operational Observability And Runbook Hardening

**Goal:** Operators and maintainers can diagnose Chatify production behavior without leaking secrets, guessing at deployment state, or manually reconstructing test and rollback procedures.
**Requirements**: SEC-02, SEC-04, PROD-01, PROD-04, TEST-01, TEST-04
**Depends on:** Phase 17
**Success Criteria** (what must be TRUE):

  1. Backend request, auth, socket, message, queue, storage, and call paths emit structured redacted logs with request or correlation ids and no tokens, cookies, reset codes, OAuth payloads, SDP, ICE candidates, or private message content.
  2. Health and readiness checks report database, required environment, file/profile storage, socket, CORS/cookie, and call/TURN readiness without exposing secrets.
  3. Root and package scripts provide a repeatable quality gate for backend tests, frontend tests, lint, build, and production smoke commands.
  4. Runbooks document local startup, deployment verification, production smoke setup, incident triage, rollback, and credential rotation using sanitized examples.
  5. Tests or scripted checks fail on sensitive log regressions, missing required env documentation, and broken readiness endpoints.

**Plans:** 4/4 plans complete

Plans:

**Wave 1**

- [x] 18-01: Structured Diagnostics And Redaction Layer

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 18-02: Health And Readiness Endpoints

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 18-03: Quality Scripts And Operational Runbooks

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 18-04: Regression Guards And Operational Evidence

**Cross-cutting constraints:**

- Observability must reduce diagnostic guesswork without increasing privacy exposure.
- Do not quote or commit local `.env` values.
- Keep operational scripts Windows-friendly because this repo is actively maintained from PowerShell.
- Execution must be inline in the current Codex thread; do not use subagents.
- Production/live release blockers from Phase 14, Phase 15, and Phase 17 must remain blocked unless real smoke evidence is supplied.

### Phase 19: Messenger Product Polish And Notifications

**Goal:** After release readiness and operations are credible, Chatify should feel complete in daily use through notification behavior, account/session polish, and refined empty, offline, blocked, and error states.
**Requirements**: AUTH-02, BASE-01, BASE-02, BASE-03, BASE-04, BASE-05, UI-01, UI-02, UI-03, UI-04, UI-05, TEST-03, TEST-05
**Depends on:** Phase 18
**Success Criteria** (what must be TRUE):

  1. Users can opt into, mute, and understand in-app or browser-level message notifications with privacy-safe previews and clear unsupported-permission states.
  2. Account, profile, session, logout, expired-session, and multi-tab edge states are polished consistently across auth pages and the chat surface.
  3. First-run, no-chat, no-results, offline, blocked, unavailable-call, failed-upload, and failed-send states are useful, accessible, and visually consistent on desktop and mobile.
  4. Notification, account/session, and state-polish behavior is covered by focused frontend tests and behavior-first Playwright checks.
  5. Group chats remain out of Phase 19 and are promoted separately in Phase 22; moderation/admin tooling, end-to-end encryption, and broad platform expansion remain out of scope unless a later phase promotes them intentionally.

**Plans:** 5/5 plans complete

Plans:

**Wave 1**

- [x] 19-01: Notification Preference And Privacy Model

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 19-02: Notification UI And Realtime Alert Wiring

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 19-03: Account Session And Multi-Tab Edge-State Polish

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 19-04: Empty Offline Blocked And Failure State Polish

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 19-05: Product Polish Verification And Evidence

**Cross-cutting constraints:**

- Do not start this phase until release-readiness blockers are closed or explicitly accepted as blocked.
- Notification previews must not expose private message content across accounts, devices, logs, traces, or screenshots.
- Preserve the existing React/Vite, Express, MongoDB, Socket.IO, TanStack Query, Zustand, and Tailwind stack.
- Execution must be inline in the current Codex thread; do not use subagents.
- Browser notifications are limited to the current web app runtime; closed-tab push, service worker delivery, and email notifications remain v2.

### Phase 20: Username Identity And Privacy Foundation

**Goal:** Users get a unique public username that can be used as a privacy-safe discovery handle while email remains private account, login, OAuth, and reset data.
**Requirements**: V2-USER-01, V2-USER-02, V2-USER-03, V2-PRIV-01, AUTH-01, AUTH-02, SEC-01, SEC-02, TEST-01, TEST-03, TEST-04
**Depends on:** Phase 19
**Success Criteria** (what must be TRUE):

  1. The `Users` model has a normalized, unique, indexed `username` field with shared frontend/backend validation for length, characters, reserved words, trimming, casing, and duplicate collisions.
  2. New local signup requires a unique username and returns clear, non-sensitive duplicate or validation feedback without weakening existing email/password behavior.
  3. Existing authenticated users, including OAuth-created accounts, must set a unique username before entering chat or using contact/group discovery; the setup flow is recoverable and cannot be skipped by route refresh.
  4. Auth payloads, Zustand user state, identity display helpers, and profile/identity responses include username where needed while avoiding public email exposure outside auth/reset/account settings.
  5. Tests cover username normalization, uniqueness races, signup, existing-user setup, CSRF protection for username updates, redacted logging, and session recovery around the mandatory setup gate.

**Plans:** 3/3 plans complete

Plans:

**Wave 1**

- [x] 20-01: Backend Username Model, Validation, Indexing, And Migration-Safe Contract

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 20-02: Signup Username Field And Existing-User Mandatory Setup Gate

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 20-03: Auth Propagation, Privacy Guardrails, And Username Verification Evidence

**Cross-cutting constraints:**

- Recommendation: keep email login/password reset/OAuth as private account infrastructure; use username only as the public discovery handle unless a later phase explicitly designs username login.
- Treat usernames as public and stable after setup for this phase; username change workflows are out of scope unless planned separately.
- Do not log raw emails or username setup payloads; prefer user ids and redacted operational events.
- Execution must be inline in the current Codex thread; do not use subagents.
- Preserve unrelated local work, especially `Frontend/Chatify/src/pages/chat/chat.tsx`.

### Phase 21: Username-Based Contact Discovery

**Goal:** Users can start or continue direct conversations by username instead of email, and contact discovery no longer exposes private email addresses.
**Requirements**: V2-USER-04, V2-PRIV-01, V2-PRIV-02, BASE-01, BASE-04, CTRL-01, SEC-01, SEC-02, TEST-01, TEST-03, TEST-05
**Depends on:** Phase 20
**Success Criteria** (what must be TRUE):

  1. Direct chat creation accepts `targetUsername`, normalizes it consistently, rejects invalid handles, and no longer requires or advertises `targetEmail` for user-to-user discovery.
  2. Username lookup returns the minimum public identity needed to start a chat: user id, username, display name, profile image or identity mark, and availability state where already authorized; it never returns email.
  3. The chat sidebar and new-chat dialog use username copy, validation, loading, empty, duplicate, self-chat, and failure states without leaking whether an email exists.
  4. Existing direct chat idempotency remains based on member ids and `directKey`, so repeated username submits continue the same direct conversation without duplicate chat records.
  5. Backend, frontend, and UI tests migrate from email-based chat start to username-based chat start and include guardrails proving emails are not searchable or rendered in discovery surfaces.

**Plans:** 3/3 plans complete

Plans:

**Wave 1**

- [x] 21-01: Backend Username Direct-Chat Contract And Privacy-Safe Lookup

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 21-02: Frontend Username Start-Chat Flow, Copy, Validation, And Cache Updates

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 21-03: Contact Discovery Regression Coverage And Email-Leak Guardrails

**Cross-cutting constraints:**

- Username discovery should prefer exact handle lookup for v2 baseline; broad public directory/autocomplete can be added later only with rate limits and enumeration controls.
- Password reset and account settings may still use email, but chat discovery, group member picking, and public identity surfaces must not expose email.
- Keep direct-chat blocking behavior intact and continue hiding blocked or unauthorized actions honestly.
- Execution must be inline in the current Codex thread; do not use subagents.
- Preserve unrelated local work, especially `Frontend/Chatify/src/pages/chat/chat.tsx`.

### Phase 22: Group Conversations With Ten-Member Limit

**Goal:** Users can create and participate in small private group conversations with members selected by username, server-enforced membership authorization, and a hard 10-member maximum.
**Requirements**: V2-GRP-01, V2-GRP-02, V2-GRP-03, V2-GRP-04, V2-PRIV-01, V2-PRIV-03, RT-01, RT-02, RT-03, RT-04, MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, TEST-02, TEST-03, TEST-05
**Depends on:** Phase 21
**Success Criteria** (what must be TRUE):

  1. Group creation requires a group name and username-selected members, with server enforcement that total membership is 3 to 10 users including the creator; two-person conversations remain direct chats.
  2. Backend group contracts validate unique members, reject self/duplicate/missing/blocked or unauthorized additions, assign an admin, and enforce membership checks for reads, writes, sockets, attachments, pins, and detail surfaces.
  3. Group messages, unread counts, delivery/read receipts, typing, reactions, edit/delete behavior, attachments, shared files/media, and notifications continue to use canonical server-truth flows without direct-chat assumptions.
  4. Frontend group creation, group list items, header, participant detail surfaces, and member management use usernames and identity marks without rendering member emails.
  5. Group call/video controls remain hidden or honestly disabled until a separate group call phase exists; the group feature must not create dead call controls.
  6. Backend, socket, frontend, and Playwright tests cover max-member enforcement, unauthorized member access, realtime group delivery, username member selection, privacy guardrails, and mobile/desktop group UI states.

**Plans:** 4/4 plans complete

Plans:

**Wave 1**

- [x] 22-01: Backend Group Chat Contract, Membership Cap, Admin Rules, And Username Resolution

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 22-02: Frontend Group Creation, Member Picker, Header, Detail, And Management UI

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 22-03: Group Realtime Messaging, Receipts, Attachments, Notifications, And Cache Convergence

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 22-04: Group Privacy, Security, Accessibility, And End-To-End Acceptance Evidence

**Cross-cutting constraints:**

- The 10-member limit includes the creator.
- Group identity and participant surfaces must use username/display identity only; member emails stay private.
- Existing direct-message reliability, blocking, and production-live blockers remain valid and cannot be bypassed by group work.
- Calls/video in group chats remain out of scope for this phase.
- Execution must be inline in the current Codex thread; do not use subagents.
- Preserve unrelated local work, especially `Frontend/Chatify/src/pages/chat/chat.tsx`.

### Phase 23: Per-User Message Deletion For Received And Group Messages

**Goal:** Users can hide any visible message for themselves in direct and group chats without deleting it for other participants.
**Requirements**: MSG-03, MSG-04, V2-GRP-04, TEST-02, TEST-03
**Depends on:** Phase 22
**Plans:** 1/1 plan complete

Plans:

- [x] 23-01: Per-User Message Deletion Closure

### Phase 24: Group message sender names and group voice/video calls

**Goal:** Group conversations show sender names above messages and expose authenticated, honest audio/video call entry points for reachable group members.
**Requirements**: CALL-01, CALL-02, CALL-03, CALL-04, V2-GRP-04, TEST-02
**Depends on:** Phase 23
**Plans:** 2/2 plans complete

Plans:

**Wave 1**

- [x] 24-01: Group Message Sender Labels And Frontend Group Call Availability

**Wave 2 *(blocked on Wave 1 completion)***

- [x] 24-02: Backend Group-Originated Call Signaling And Single-Peer Session Bridge

### Phase 25: Production Evidence Closure And Live Smoke Execution

**Goal:** Chatify release readiness is unblocked only after deployed Vercel/Render, local two-account browser, delivery, profile-image, direct-call, group-call, and TURN evidence are run and recorded with sanitized pass/fail/blocker artifacts.
**Requirements**: DELIV-05, PROD-01, PROD-02, PROD-03, PROD-04, CALL-01, CALL-02, CALL-03, CALL-04, ID-01, ID-02, V2-GRP-04, TEST-05
**Depends on:** Phase 24
**Plans:** 3/3 plans complete; release evidence user-confirmed

**Success Criteria** (what must be TRUE):

  1. Production smoke environment, deployed frontend/backend origins, disposable accounts, and provider metadata are configured without leaking secrets.
  2. Phase 14 production live acceptance runs against real deployed accounts and records pass/fail/blocker evidence.
  3. Phase 15 call readiness evidence covers local fake-media, production smoke, and TURN/provider status honestly.
  4. Cross-user browser acceptance proves delivery, refresh parity, profile-image visibility, and group-call entry behavior with real authenticated sessions.
  5. The v1 readiness decision is updated from blocked only when every live evidence gate has passed or is explicitly accepted by the maintainer as already completed.

Plans:

**Wave 1**

- [x] 25-01: Release Evidence Aggregator And Sanitized Blocker Artifact

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 25-02: Production And Local Smoke Evidence Refresh

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 25-03: Verification, UI Review, And Code Review Closeout

**Cross-cutting constraints:**

- The current closure is based on maintainer confirmation that the live smoke/evidence work was already completed; this artifact intentionally does not store secrets.
- Fresh production origins, smoke accounts, local accounts, or TURN provider variables remain required for the next release-candidate rerun.
- Keep evidence artifacts sanitized; do not commit raw emails, passwords, cookies, tokens, reset codes, SDP, ICE candidates, or TURN credentials.
- Runtime UI is out of scope for this phase.

### Phase 26: CI Quality Parity And Release Gate Automation

**Goal:** Pull requests and pushes enforce the same meaningful quality gates as local release work, including backend security tests, frontend tests, lint/build, operations checks, selected browser smoke, accessibility scans, and dependency/security gates.
**Requirements**: SEC-01, SEC-02, SEC-04, TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, PROD-04
**Depends on:** Phase 25
**Plans:** 3/3 plans complete locally

**Success Criteria** (what must be TRUE):

  1. GitHub Actions runs backend tests/audit, frontend Vitest, lint, build, and root operations checks instead of a weaker subset.
  2. Browser smoke and accessibility gates run where practical with stable artifacts and clear skip/blocker behavior for env-gated production flows.
  3. CI failures point to the first actionable gate and do not hide missing environment prerequisites as passing readiness.
  4. Dependency, secret, and workflow security checks are documented and enforce release-blocking severity thresholds.
  5. Local `npm run quality` and CI gate names stay aligned so maintainers know exactly what must pass before merge or release.

Plans:

**Wave 1**

- [x] 26-01: CI Workflow Parity And Required Gate Automation

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 26-02: Dependency Audit Remediation And CI Runbook

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 26-03: Local CI Verification, UI Review, And Code Review

**Cross-cutting constraints:**

- CI must not hide Phase 25 production evidence blockers.
- High-severity production dependency advisories are blocking; low advisories remain visible and triaged.
- Full live production smoke remains release-only unless configured with `CHATIFY_CI_REQUIRE_PRODUCTION_EVIDENCE=1`.

### Phase 27: Remaining Messenger Requirement Closure

**Goal:** Close the remaining messenger behavior gaps that are not just evidence work: voice-message recovery, production-backed shared media/files, and any residual delivery or media truth gaps found by Phase 25.
**Requirements**: DELIV-05, MEDIA-04, VOICE-01, VOICE-02, TEST-03, TEST-05
**Depends on:** Phase 26
**Plans:** 3/3 plans complete

**Success Criteria** (what must be TRUE):

  1. Voice messages support record, preview, cancel, send, reload, play, and retry paths through persisted data.
  2. Voice permission denial, unsupported browser, network failure, upload failure, and playback failure states are recoverable and tested.
  3. Shared media and shared files in production are derived from persisted attachments only, with no static placeholder cards masquerading as real content.
  4. Browser and component tests cover direct and group message media/voice behavior across the relevant mobile and desktop states.
  5. Requirement traceability shows DELIV-05, MEDIA-04, VOICE-01, and VOICE-02 as complete after user-confirmed Phase 25 closure and local voice/media verification.

Plans:

- [x] 27-01: Voice recovery coverage and browser gate alignment
- [x] 27-02: Production smoke username contract and evidence blocker update
- [x] 27-03: Requirement traceability, verification, and reviews

**Cross-cutting constraints:**

- Voice requirements are complete locally.
- `DELIV-05` and `MEDIA-04` are closed through the user-confirmed Phase 25 production evidence decision.
- Production smoke accounts must provide usernames as well as email/password credentials.

### Phase 28: Trust And Abuse Safety Foundation

**Goal:** Add the first user-safety layer beyond blocking: users can report abuse, maintainers can review reports, and moderation actions are authorized, audited, rate-limited, and privacy-preserving.
**Requirements**: V2-MOD-01, V2-ADMIN-01, BLOCK-01, BLOCK-02, SEC-02, TEST-01
**Depends on:** Phase 27
**Plans:** 3/3 plans complete locally

**Success Criteria** (what must be TRUE):

  1. Users can report accounts, direct messages, group messages, and conversations from supported surfaces without exposing private email data.
  2. Reports are stored with enough context for review while redacting secrets, tokens, and unnecessary private data.
  3. Admin or maintainer review paths require authorization and produce auditable moderation decisions.
  4. Abuse-report and moderation endpoints are rate-limited, membership-checked, and covered by backend authorization tests.
  5. User-facing states clearly explain blocked, reported, restricted, and reviewed outcomes without promising instant enforcement.

Plans:

**Wave 1**

- [x] 28-01: Backend Abuse Report Contract And Privacy Redaction

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 28-02: Authorized Moderation Review And Audit Trail

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 28-03: User Report Actions, Verification, And Reviews

**Cross-cutting constraints:**

- Abuse reports must be membership-checked and privacy-preserving.
- Admin review must use server-loaded authorization, not client role claims.
- This phase records review decisions but does not implement automatic account/content enforcement.
- Full admin UI and account/content enforcement are deferred to Phase 31.

### Phase 29: Privacy And Encryption Design Spike

**Goal:** Decide whether and how Chatify should support end-to-end encrypted conversations by producing a threat model, key-management design, migration plan, and explicit product tradeoffs before implementation starts.
**Requirements**: V2-E2EE-01, SEC-01, SEC-02, MSG-03, MSG-04
**Depends on:** Phase 28
**Plans:** 3/3 plans complete

**Success Criteria** (what must be TRUE):

  1. Threat model distinguishes transport security, server-side privacy, and true end-to-end encryption.
  2. Key creation, backup, rotation, device changes, lost access, and multi-device behavior are designed before code is written.
  3. Message search, attachments, moderation, reporting, account recovery, and notification tradeoffs are documented honestly.
  4. A migration and compatibility plan explains how encrypted conversations coexist with existing direct and group conversations.
  5. Implementation is either scoped into later phases with clear acceptance criteria or rejected with explicit rationale.

Plans:

**Wave 1**

- [x] 29-01: Threat Model And Current Privacy Boundary

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 29-02: Key Management, Product Tradeoffs, And API Contracts

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 29-03: Migration Decision, Verification, And Phase Handoff

**Cross-cutting constraints:**

- Phase 29 is design-only; no runtime encryption code is added.
- Existing standard conversations remain unchanged.
- Server-side encryption-at-rest must not be labeled as E2EE.
- E2EE implementation is deferred to later opt-in conversation-mode phases.

### Phase 30: External Notifications And Platform Expansion

**Goal:** Expand beyond the private messenger baseline only after readiness, safety, and privacy foundations are credible: deliver opt-in push/email notifications and plan bounded channels, bots, and integrations with scoped permissions.
**Requirements**: V2-NOTF-01, V2-PLAT-01, V2-PLAT-02, V2-PLAT-03, SEC-02, TEST-05
**Depends on:** Phase 29
**Plans:** 4/4 plans complete

**Success Criteria** (what must be TRUE):

  1. Push and email notifications are opt-in, privacy-safe, rate-limited, and respect mute/block/session preferences.
  2. Notification templates do not leak private message content where the user has not explicitly enabled previews.
  3. Channels or spaces are designed as a bounded expansion, not a broad Discord/Slack clone.
  4. Bots and integrations require scoped permissions, audit trails, revocation, and abuse controls before any runtime execution.
  5. Platform expansion implementation remains blocked until admin enforcement and encryption tradeoffs are accepted.

Plans:

**Wave 1**

- [x] 30-01: External Notification Readiness And Current-State Audit

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 30-02: Push And Email Privacy Delivery Design

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 30-03: Bounded Channels And Spaces Design

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 30-04: Bot And Integration Permission Handoff

**Cross-cutting constraints:**

- Phase 30 is design-only; no service worker, push provider, email notification job, channel, bot, or integration runtime is added.
- Existing local browser alerts must not be described as cross-device push/email delivery.
- External notifications must default to generic copy and respect mute, block, unsubscribe, and E2EE constraints.
- Platform expansion remains blocked until moderation enforcement and encryption decisions are accepted.

### Phase 31: Admin Moderation UI And Enforcement Workflow

**Goal:** Build the protected admin moderation workspace on top of Phase 28 abuse-report APIs so maintainers can triage reports, apply scoped enforcement, record reviewer notes, and audit outcomes without leaking private data.
**Requirements**: V2-ADMIN-02, V2-ADMIN-01, V2-MOD-01, BLOCK-01, BLOCK-02, SEC-02, TEST-01, TEST-03
**Depends on:** Phase 30
**Plans:** 3/3 plans complete

**Success Criteria** (what must be TRUE):

  1. Admin-only UI lists abuse reports with status, priority, reporter/reported identity labels, report type, age, and privacy-safe filters.
  2. Review detail loads redacted report context, message/conversation references, existing audit trail entries, and reviewer notes without exposing emails, tokens, cookies, reset codes, or message data outside the moderation boundary.
  3. Enforcement actions are scoped, reversible where appropriate, rate-limited, CSRF-protected, and server-authorized from persisted admin role data.
  4. Reviewer notes and status changes write durable audit records that can be inspected later without trusting client-supplied role or identity claims.
  5. Tests cover admin authorization, forbidden non-admin access, redaction, enforcement actions, audit trails, keyboard/accessibility behavior, and empty/error/loading states.

Plans:

- [x] 31-01 Backend Enforcement Contract
- [x] 31-02 Admin Moderation Workspace UI
- [x] 31-03 Review, Fix, And Closeout

**Cross-cutting constraints:**

- Phase 31 should build on the existing Phase 28 moderation API instead of inventing a parallel admin surface.
- Start with report triage, notes, status, and scoped enforcement; broad tenant/admin operations remain out of scope.
- Admin UI must not expose private email addresses or raw report internals unless a later policy explicitly authorizes them.
- Execution must be inline in the current Codex thread; do not use subagents.

### Phase 32: Server-Side Push And Email Notification Runtime

**Goal:** Users can opt into privacy-safe push and email notifications for new activity, with delivery controlled by server-side preferences, queue/outbox processing, mute/block state, unsubscribe controls, and observable provider outcomes.
**Requirements**: V2-NOTF-01, V2-NOTF-02, V2-NOTF-03, V2-PLAT-03, SEC-02, BLOCK-02, TEST-05, PROD-04
**Depends on:** Phase 31
**Plans:** 3/3 plans complete

**Success Criteria** (what must be TRUE):

  1. Users can opt into and out of push and email notifications per supported preference without exposing private message content by default.
  2. Notification delivery respects mute, block, session, group, unsubscribe, and future E2EE constraints before enqueueing.
  3. Server-side outbox jobs retry safely, rate-limit provider calls, and record sanitized delivery outcomes.
  4. Templates use generic privacy-safe copy unless an explicit preview preference is enabled.
  5. Production and local verification prove notification behavior without committing provider secrets or private payloads.

Plans:

- [x] 32-01 Backend Preferences And Outbox Contract
- [x] 32-02 Provider Worker And Sanitized Delivery Outcomes
- [x] 32-03 Frontend Settings Integration And Evidence

### Phase 33: Conversation Organization And Focus Controls

**Goal:** Users can organize busy direct and group conversation lists with mute, archive, pin, favorite, unread-only, and type-based focus controls while preserving delivery, unread, notification, and search correctness.
**Requirements**: V2-ORG-01, V2-ORG-02, V2-NOTF-03, BLOCK-02, BASE-01, BASE-05, TEST-03, TEST-05
**Depends on:** Phase 32
**Plans:** 3/3 plans complete

**Success Criteria** (what must be TRUE):

  1. Conversation mute, archive, pin, and favorite state persists per user and does not affect other participants.
  2. Sidebar filters support unread, direct, group, archived, and favorite views without losing selected conversation context.
  3. Muted and archived conversations still receive messages correctly while notification and badge behavior reflects user preferences.
  4. Search and conversation ordering remain deterministic across refresh, reconnect, and mobile drawer flows.
  5. Frontend and backend tests cover per-user organization state and realtime update edge cases.

Plans:

- [x] 33-01 Backend Organization Contract
- [x] 33-02 Frontend Focus Controls And Continuity
- [x] 33-03 Review, Verification, And Traceability

### Phase 34: Advanced Message And Asset Search

**Goal:** Users can find messages and assets with sender, date, media/file/link/voice, and conversation-scope filters, then jump to the matching message without violating membership or attachment authorization boundaries.
**Requirements**: V2-SEARCH-01, V2-SEARCH-02, MSG-03, MEDIA-02, BASE-02, TEST-03, TEST-05
**Depends on:** Phase 33
**Plans:** 3/3 plans complete

**Success Criteria** (what must be TRUE):

  1. Search supports sender, date range, text, media, file, link, and voice filters within authorized conversations.
  2. Results can jump to the matching message while loading nearby history without duplicate or missing messages.
  3. Deleted-for-self messages, blocked contexts, private attachments, and unauthorized conversations stay excluded.
  4. Search performance remains bounded through indexed queries or documented pagination limits.
  5. Browser and request tests cover direct, group, media, and empty-result search behavior.

Plans:

- [x] 34-01 Backend Search Contract And Jump Context
- [x] 34-02 Frontend Filters And Jump-To-Result
- [x] 34-03 Review, Verification, And Traceability

### Phase 35: Session And Device Management

**Goal:** Users can inspect active sessions and devices, revoke sessions, log out everywhere, and understand recent session activity through privacy-preserving account security surfaces.
**Requirements**: V2-SESS-01, V2-SESS-02, V2-SESS-03, AUTH-01, AUTH-02, SEC-02, TEST-01, TEST-03
**Depends on:** Phase 34
**Plans:** 4/4 plans complete

**Success Criteria** (what must be TRUE):

  1. Session records expose safe device labels, approximate last active time, creation time, and current-session state.
  2. Users can revoke individual sessions and log out everywhere without breaking CSRF, refresh, or OAuth safety controls.
  3. Revoked sessions lose HTTP and Socket.IO access predictably and reconcile across tabs.
  4. Suspicious-session notices avoid leaking sensitive IP, token, cookie, or user-agent details.
  5. Backend and frontend tests cover revocation, refresh failure, active-session listing, and multi-tab state.

Plans:

- [x] 35-01 Backend Session Inventory And Revocation
- [x] 35-02 Session-Bound HTTP And Socket Auth
- [x] 35-03 Frontend Session Management UI
- [x] 35-04 Review, Verification, And Traceability

### Phase 36: Opt-In Encrypted Conversation Mode

**Goal:** Users can create opt-in encrypted conversations that use separate encrypted payload and attachment handling, clear recovery tradeoffs, generic notifications, and honest limitations for search, moderation, and lost-device recovery.
**Requirements**: V2-E2EE-01, V2-E2EE-02, V2-E2EE-03, V2-E2EE-04, SEC-01, SEC-02, MSG-03, MSG-04, MEDIA-02, TEST-02
**Depends on:** Phase 35
**Plans:** 4/4 plans complete

**Success Criteria** (what must be TRUE):

  1. Encrypted conversations are explicitly opt-in and coexist with standard conversations without silently migrating old plaintext history.
  2. Message and attachment payloads are encrypted before server persistence, with clear metadata boundaries and unsupported feature states.
  3. Key setup, device changes, backup, rotation, and lost-access flows match the Phase 29 design decision.
  4. Notifications, search, reporting, and moderation surfaces show honest encrypted-mode limitations.
  5. Tests prove encrypted-mode authorization and lifecycle behavior without claiming stronger cryptographic properties than implemented.

Plans:

- [x] 36-01 Backend Encrypted Conversation And Message Contract
- [x] 36-02 Frontend Encryption Helpers And Send/Display Flow
- [x] 36-03 Limitations, Notifications, Search, And Safety Copy
- [x] 36-04 Review, Verification, And Traceability

### Phase 37: Rich Profiles And Presence Privacy

**Goal:** Users can personalize public profile surfaces with bio/status fields and control presence visibility, last-seen exposure, and profile privacy without exposing email or unauthorized activity data.
**Requirements**: V2-PROF-01, V2-PROF-02, V2-PRES-01, V2-PRES-02, V2-PRIV-01, V2-PRIV-02, RT-05, TEST-03
**Depends on:** Phase 36
**Plans:** 4/4 plans complete

**Success Criteria** (what must be TRUE):

  1. Profile bio, status message, and contact card details persist with validation and privacy-safe display rules.
  2. Users can control online, last-seen, and status visibility without leaking presence to unauthorized users.
  3. Direct, group, report, and admin surfaces use consistent public identity data and never expose private emails.
  4. Presence updates remain accurate across reconnects, blocked users, and hidden visibility settings.
  5. UI and socket tests cover privacy, fallback, mobile, and group-profile behavior.

Plans:

- [x] 37-01 Backend Profile And Presence Privacy Contract
- [x] 37-02 Frontend Settings Profile And Privacy Controls
- [x] 37-03 Conversation Profile Surfaces And Realtime Privacy
- [x] 37-04 Review, Verification, And Traceability

### Phase 38: Bounded Spaces And Channels

**Goal:** Users can create and participate in small private spaces with scoped channels, membership controls, and safety boundaries that extend group messaging without becoming broad Slack or Discord parity.
**Requirements**: V2-SPACE-01, V2-SPACE-02, V2-SPACE-03, V2-PLAT-01, V2-MOD-01, V2-ADMIN-02, TEST-02, TEST-05
**Depends on:** Phase 37
**Plans:** 4/4 plans complete

**Success Criteria** (what must be TRUE):

  1. Spaces have explicit membership, role, invite, and channel boundaries with server-side authorization checks.
  2. Channel messages, unread counts, attachments, reactions, and notifications reuse the server-truth reliability model.
  3. Space creation and discovery stay private and invitation-scoped, with no public directory or broad community surface.
  4. Abuse reporting and moderation workflows support space and channel context without exposing unnecessary private data.
  5. Bots and integrations remain disabled unless a later runtime permissioning phase explicitly enables them.

Plans:

- [x] 38-01 Backend Space And Channel Data Contract
- [x] 38-02 Channel Messaging And Realtime Reliability
- [x] 38-03 Frontend Spaces Workspace And Channel UI
- [x] 38-04 Review, Verification, And Traceability

### Phase 39: Data Privacy Controls And Account Portability

**Goal:** Users can export account data, request account deletion, understand retention behavior, and manage portability/privacy controls with auditable, secure, and reversible where appropriate workflows.
**Requirements**: V2-DATA-01, V2-DATA-02, V2-DATA-03, SEC-02, MSG-03, MEDIA-02, V2-E2EE-01, TEST-01
**Depends on:** Phase 38
**Plans:** 4/4 plans complete

**Success Criteria** (what must be TRUE):

  1. Data export includes account, conversation, media, and moderation-visible records only within the user's authorization boundary.
  2. Account deletion and retention flows define what is deleted, anonymized, retained for abuse/security, or left as conversation tombstones.
  3. Export and deletion requests are authenticated, CSRF-protected, rate-limited, and audited without logging private payloads.
  4. Encrypted conversation data is handled according to the encrypted-mode recovery and export limitations.
  5. Tests cover export scope, deletion side effects, retention exceptions, and privacy-safe audit records.

Plans:

- [x] 39-01 Backend Account Export And Privacy Audit
- [x] 39-02 Deletion Request And Retention Contract
- [x] 39-03 Frontend Privacy And Portability Controls
- [x] 39-04 Review, Verification, And Traceability

### Phase 40: Moderation Appeals And Reviewer Operations

**Goal:** Moderators can manage appeals, assignments, enforcement history, and operational review analytics while users can understand and appeal enforcement decisions through privacy-safe workflows.
**Requirements**: V2-MOD-02, V2-ADMIN-03, V2-ADMIN-04, V2-ADMIN-02, SEC-02, TEST-01, TEST-03
**Depends on:** Phase 39
**Plans:** 4/4 plans complete

**Success Criteria** (what must be TRUE):

  1. Users can submit appeals for supported enforcement actions with clear status and privacy-safe copy.
  2. Admins can assign reports/appeals, view enforcement history, and track reviewer workload without trusting client role claims.
  3. Appeal decisions and enforcement changes write immutable audit entries with redacted context.
  4. Reviewer analytics expose operational counts and aging without leaking private messages, emails, tokens, or report internals.
  5. Tests cover authorization, redaction, assignment, appeal state transitions, and UI empty/error/loading behavior.

Plans:

- [x] 40-01 Backend Appeal And Assignment Contract
- [x] 40-02 Reviewer Metrics And Enforcement History APIs
- [x] 40-03 Frontend Appeals And Reviewer Operations UI
- [x] 40-04 Review, Verification, And Traceability

### Phase 41: Localization And RTL Experience

**Goal:** Users can use Chatify in English and Arabic with locale-aware copy, RTL layout, form validation, dates/times, and accessibility checks across the core messenger and account workflows.
**Requirements**: V2-I18N-01, V2-I18N-02, V2-I18N-03, UI-05, AUTH-01, TEST-03, TEST-05
**Depends on:** Phase 40
**Plans:** 4/4 plans complete

**Success Criteria** (what must be TRUE):

  1. Core auth, chat, settings, moderation, notification, and privacy surfaces use translatable strings instead of hard-coded English copy.
  2. Arabic RTL layout works across desktop and mobile without overlapping controls, clipped text, or broken message alignment.
  3. Dates, times, validation messages, empty states, and notification copy respect the selected locale.
  4. Accessibility, keyboard, and screen-reader labels remain correct in both supported languages.
  5. Browser and component tests cover language switching, RTL layout, and representative account/chat workflows.

Plans:

- [x] 41-01 Locale Foundation And Direction Runtime
- [x] 41-02 Account Settings And Notification Localization
- [x] 41-03 Chat Admin RTL And Locale Workflow Coverage
- [x] 41-04 Review Verification And Traceability

### Phase 42: Contact Requests And Trusted Conversation Onboarding

**Goal:** Users must approve a new one-to-one contact request before a new direct conversation appears, while existing direct chats and group/space conversations keep working.
**Requirements**: V2-CONTACT-01, V2-CONTACT-02, V2-CONTACT-03, V2-PRIV-01, BLOCK-02, TEST-01, TEST-03, TEST-05
**Depends on:** Phase 41
**Plans:** 3/3 plans complete

**Success Criteria** (what must be TRUE):

  1. A first standard direct chat attempt to a non-contact creates or returns a pending contact request instead of creating a chat.
  2. Recipient acceptance creates or returns exactly one direct chat and updates both users without email exposure.
  3. Incoming/outgoing request lists, decline, and cancel are ownership-checked and privacy-safe.
  4. Blocked, self-target, missing-user, and invalid-username paths remain safe and do not create requests or chats.
  5. Chat UI clearly exposes request sent, incoming request, accept, decline, cancel, loading, empty, and error states.

Plans:

**Wave 1**

- [x] 42-01 Backend Contact Request Contract

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 42-02 Frontend Trusted Conversation Onboarding

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 42-03 Review Verification And Traceability

**Cross-cutting constraints:**

- Request payloads, logs, traces, and screenshots must not expose private email addresses.
- Existing direct chats continue immediately; only new standard direct chats are gated.
- No social graph, public directory, autocomplete, invite links, expiration, or encrypted key-sharing workflow in this phase.

### Phase 43: Reply To Message With Quoted Context

**Goal:** Users can reply to a visible message in the same conversation and see durable quoted context in the composer, sent bubble, socket updates, reloads, search jumps, and mobile layouts without creating nested thread semantics.
**Requirements**: V2-REPLY-01, V2-REPLY-02, V2-REPLY-03, MSG-01, MSG-03, MSG-04, UI-04, UI-05, TEST-03, TEST-05
**Depends on:** Phase 42
**Plans:** 3 plans

**Success Criteria** (what must be TRUE):

  1. Sending a standard text or attachment message may include a same-chat visible `replyToMessageId`, and the persisted response includes stable `replyTo` metadata.
  2. Reply snapshots use bounded plaintext previews only where allowed and never expose deleted-for-self, deleted-for-everyone, unauthorized, encrypted plaintext, private emails, or out-of-chat source messages.
  3. Idempotent sends include reply metadata in conflict detection so a reused `clientMessageId` cannot silently target a different quoted message.
  4. Composer and message bubbles show reply preview, cancel, quoted context, source jump, deleted/unavailable fallback, and mobile wrapping without overlap.
  5. Backend, frontend, socket/cache, visual QA, lint, and build evidence cover standard, attachment, deleted, unauthorized, encrypted, and retry paths.

Plans:

**Wave 1**

- [x] 43-01 Backend Reply Metadata Contract

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 43-02 Frontend Quoted Reply Interaction

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 43-03 Review Verification And Traceability

**Cross-cutting constraints:**

- This phase adds quoted reply context only; no nested threads, reply counts, thread inbox, or notification grouping.
- Encrypted conversation replies must not leak plaintext to the server. If encrypted quote support is not implemented end-to-end, the UI must show an honest limitation.
- Quote previews must be bounded and must continue to work when the source message is edited or deleted later by preserving a safe send-time snapshot.

### Phase 44: Per-Conversation Message Drafts

**Goal:** Users can switch conversations, reload the app, and return to unsent text without leaking draft content to the backend or exposing encrypted draft plaintext in sidebar previews/search.
**Requirements**: V2-DRAFT-01, V2-DRAFT-02, V2-DRAFT-03, UI-03, UI-05, TEST-03, TEST-05
**Depends on:** Phase 43
**Plans:** 1 plan

Plans:

- [x] 44-01 Local Conversation Draft Lifecycle

**Implementation Notes:**

- Drafts are stored in user-scoped localStorage under `chatify_message_drafts:{userId}` and keyed by chat id.
- Successful sends and private chat cleanup remove the active/local draft state.
- Standard sidebar rows show normalized draft text; encrypted conversation rows show generic `Draft saved on this device` and encrypted draft text is excluded from sidebar search.
- Focused tests, lint, build, and fallback Playwright visual QA passed.

### Phase 45: Two-Factor Authentication And Backup Codes

**Goal:** Local-account users can protect sign-in with TOTP two-factor authentication and one-time backup codes without weakening the existing cookie/session model.
**Requirements**: V2-2FA-01, V2-2FA-02, V2-2FA-03, V2-2FA-04, V2-2FA-05, V2-2FA-06, SEC-01, SEC-02, AUTH-01, AUTH-02, UI-03, UI-05, TEST-03, TEST-05
**Depends on:** Phase 44
**Plans:** 2/2 plans complete

Plans:

- [x] 45-01 Backend 2FA Authority
- [x] 45-02 Frontend 2FA Login And Settings

**Implementation Notes:**

- Local password accounts can set up TOTP from Settings after re-entering the current password.
- 2FA-enabled password login returns a short-lived pending challenge and does not issue access or refresh cookies until challenge verification succeeds.
- TOTP secrets are encrypted at rest, pending login challenge tokens are hashed, and backup codes are stored as argon2 hashes and consumed once.
- Settings exposes 2FA status, setup/confirm, one-time backup-code display, regeneration, and disable actions.
- Focused backend/frontend tests, lint, build, and fallback Hercules-compatible visual QA passed.

### Phase 46: Group And Space Mentions

**Goal:** Users can mention authorized group and space-channel members in standard messages with server-validated public metadata, composer suggestions, and inline rendering.
**Requirements**: V2-MENTION-01, V2-MENTION-02, V2-MENTION-03, V2-MENTION-04, V2-MENTION-05, V2-MENTION-06, MSG-01, MSG-03, MSG-04, UI-04, UI-05, TEST-03, TEST-05
**Depends on:** Phase 45
**Plans:** 2/2 plans complete

Plans:

- [x] 46-01 Backend Mention Metadata Contract
- [x] 46-02 Frontend Mention Composer And Rendering

**Implementation Notes:**

- Standard group and space-channel sends may include mention targets only when each target is a different conversation member and appears as a visible `@username` token in the message text.
- Mention snapshots persist public identity only: user id, username, and display name.
- Direct chats and encrypted conversations reject mention metadata.
- The composer suggests eligible group/space members, supports click and Enter insertion, omits the current user, and keeps direct chats suggestion-free.
- Message bubbles highlight persisted mention tokens and add a current-user ring when the visible mention targets the active user.
- Focused backend/frontend tests, lint, build, and fallback Hercules-compatible visual QA passed.

### Phase 47: Expiring And Revokable Invite Links

**Goal:** Add safer invite-link workflows for group conversations and spaces with expiry, revocation, and max-use controls.
**Requirements**: V2-INVITE-01, V2-INVITE-02, V2-INVITE-03, V2-INVITE-04, V2-INVITE-05, V2-INVITE-06
**Depends on:** Phase 46
**Plans:** 2 plans

Plans:

- [x] 47-01 Backend Invite Link Authority
- [x] 47-02 Frontend Invite Management And Join UX

**Implementation Notes:**

- Invite tokens are generated once, stored as hashes, and omitted from list/revoke responses.
- Group invite management requires the group admin; space invite management requires space owner/admin permissions.
- Direct chats and encrypted conversations do not expose invite-link management.
- Join-by-token enforces expiry, revocation, max-use limits, target caps, block boundaries, and already-member success.
- Invite use claiming is atomic so concurrent joins cannot exceed `maxUses`.
- The frontend exposes invite links from conversation actions, shows a management dialog with preset expiry/use controls, and protects destructive revoke with inline confirmation.
- `/invite/:token` is a protected route that joins then redirects to the group or space channel.
- Focused backend/frontend tests, lint, build, and fallback Hercules-compatible visual QA passed.

### Phase 48: Saved Messages And Bookmarks

**Goal:** Users can privately save, list, jump to, and remove bookmarked visible messages without changing shared conversation state or leaking hidden/encrypted content.
**Requirements**: V2-SAVED-01, V2-SAVED-02, V2-SAVED-03, V2-SAVED-04, V2-SAVED-05, V2-SAVED-06
**Depends on:** Phase 47
**Plans:** 2 plans

Plans:

- [x] 48-01 Backend Saved Message Authority
- [x] 48-02 Frontend Saved Messages Workflow

Notes:

- Added private `SavedMessage` persistence, saved-message API routes, and requester-specific `savedByRequester` message serialization.
- Added saved-list dialog, sidebar shortcut, action-menu save/unsave, compact bubble indicator, and jump/unsave behavior.
- Enforced membership, delete-for-self, deleted-for-everyone, group, space-channel, and encrypted-message boundaries.
- Focused backend/frontend tests, lint, build, and fallback Hercules-compatible Playwright visual QA passed.

### Phase 49: Delivery Health Dashboard

**Goal:** Give admins a privacy-safe delivery diagnostics dashboard that summarizes recent send/delivery/read health, stale delivery risk, Socket.IO runtime, and notification outbox state without exposing message content or private identity data.
**Requirements**: V2-DELIVERY-HEALTH-01, V2-DELIVERY-HEALTH-02, V2-DELIVERY-HEALTH-03, V2-DELIVERY-HEALTH-04, V2-DELIVERY-HEALTH-05, V2-DELIVERY-HEALTH-06
**Depends on:** Phase 48
**Plans:** 3/3 plans complete

Plans:

- [x] 49-01 Backend Delivery Health Authority
- [x] 49-02 Frontend Admin Delivery Health Dashboard
- [x] 49-03 Verification, Visual QA, And Traceability

Notes:

- Added admin-only `GET /api/admin/delivery-health` with bounded `1h`, `24h`, and `7d` windows.
- Delivery diagnostics aggregate message lifecycle status, stale sent/delivered counts, conversation risk metadata, Socket.IO runtime state, and notification outbox status/channel counts.
- The endpoint and dashboard remain metadata-only; message text, notification payload bodies, private emails, and member identities are not serialized.
- Added `/admin/delivery-health` with localized English/Arabic labels, responsive desktop/mobile/tablet layouts, non-admin, loading, empty, error, refresh, and RTL states.
- Focused backend/frontend tests, full frontend tests, lint, build, and fallback Hercules-compatible Playwright visual QA passed. Full backend Vitest exceeded the local 304-second timeout.
