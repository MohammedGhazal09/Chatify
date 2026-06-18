# Roadmap: Chatify

## Overview

Chatify v1.0 reconstructs the existing chat app into a trustworthy real-time messenger. The roadmap moves vertically: first make security and tests block risky work, then authenticate realtime communication, then rebuild message state, then reconstruct the chat UI, then finish the messenger baseline features, then lock reference-driven visual parity across desktop and mobile light/dark variants, then restore full product behavior behind the reference UI, implement real media/detail surfaces, enforce an interaction quality gate, and now remediate production-live gaps that proved fixture-backed tests were not enough, including duplicate sends and missing realtime delivery. After the core reconstruction, the roadmap closes release readiness, operational supportability, and product polish without hiding unresolved production or security blockers. The next v2 feature chain promotes group messaging by first introducing unique public usernames, then replacing email-based discovery with username-based contact flows, then adding private groups capped at 10 members.

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
- [ ] **Phase 10: Production Messenger Reality Audit And Fixture Removal** - Reproduce the live product failures, remove fixture/static production fallbacks, and make panel/navigation behavior honestly testable.
- [ ] **Phase 10.1: Production Message Delivery Reliability Repair (INSERTED)** - Fix duplicate sends, false delivered status, and missing realtime receive before new feature work continues.
- [x] **Phase 11: Conversation Controls And User Safety Implementation** - Make search, More, blocking, conversation actions, and static detail surfaces real backend-backed behavior. (completed 2026-06-17)
- [x] **Phase 12: Live Media Voice And Identity Implementation** - Make user identity images/marks, attachments, shared media/files, and voice messages real persisted workflows. (completed 2026-06-17)
- [x] **Phase 13: Realtime Call And Video Implementation** - Make call and video controls initiate reliable authenticated realtime sessions instead of dead buttons. (completed 2026-06-13)
- [ ] **Phase 14: Production Live Acceptance Gate** - Prove the deployed Vercel/Render product works with real accounts and no fixture bypass.
- [ ] **Phase 15: Investigate And Fix Audio And Video Call Reliability** - Make audio and video calls connect, fail honestly, clean up safely, and report readiness with evidence. (blocked pending local/prod smoke env 2026-06-17)
- [x] **Phase 16: Profile Picture Upload And Shared Avatar Visibility** - Let users upload a profile picture from their own PC and show it consistently to other users. (completed 2026-06-16)
- [ ] **Phase 17: V1 Readiness Closure And Release Gate** - Close the remaining security, production, delivery, and call-readiness evidence before any v1 release claim. (blocked 2026-06-17: missing production/local smoke evidence)
- [x] **Phase 18: Operational Observability And Runbook Hardening** - Make Chatify diagnosable, supportable, and repeatable in local and deployed environments. (completed 2026-06-17)
- [x] **Phase 19: Messenger Product Polish And Notifications** - Add post-readiness messenger polish, notification behavior, and account/session UX refinements without expanding into full platform scope. (completed 2026-06-17)
- [x] **Phase 20: Username Identity And Privacy Foundation** - Add unique public usernames, signup collection, existing-user username setup, and private-email boundaries. (completed 2026-06-18)
- [x] **Phase 21: Username-Based Contact Discovery** - Replace email-based direct chat creation and contact discovery with username-based lookup. (completed 2026-06-18)
- [x] **Phase 22: Group Conversations With Ten-Member Limit** - Add private group conversations with username-selected members and a server-enforced 10-member cap. (completed 2026-06-18)

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
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 10.1 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20 -> 21 -> 22

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
| 10. Production Messenger Reality Audit And Fixture Removal | 0/0 | Not planned | - |
| 10.1. Production Message Delivery Reliability Repair | 2/3 | In Progress | 2026-06-13 |
| 11. Conversation Controls And User Safety Implementation | 3/3 | Complete    | 2026-06-17 |
| 12. Live Media Voice And Identity Implementation | 0/3 | Planned | - |
| 13. Realtime Call And Video Implementation | 3/3 | Complete   | 2026-06-13 |
| 14. Production Live Acceptance Gate | 3/3 | Blocked pending live env | - |
| 15. Investigate And Fix Audio And Video Call Reliability | 4/4 | Blocked pending local/prod call smoke env | - |
| 16. Profile Picture Upload And Shared Avatar Visibility | 4/4 | Complete    | 2026-06-16 |
| 17. V1 Readiness Closure And Release Gate | 4/4 | Blocked pending release evidence | - |
| 18. Operational Observability And Runbook Hardening | 4/4 | Complete | 2026-06-17 |
| 19. Messenger Product Polish And Notifications | 5/5 | Complete   | 2026-06-17 |
| 20. Username Identity And Privacy Foundation | 3/3 | Complete | 2026-06-18 |
| 21. Username-Based Contact Discovery | 3/3 | Complete | 2026-06-18 |
| 22. Group Conversations With Ten-Member Limit | 4/4 | Complete | 2026-06-18 |

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

**Plans:** 4/4 plans executed; release blocked

Plans:

- [x] 17-01: Evidence inventory and blocker matrix
- [x] 17-02: Security foundation and local quality gate reconciliation
- [x] 17-03: Production, delivery, and call readiness gate
- [x] 17-04: Final v1 decision, roadmap state, and release recommendation

**Cross-cutting constraints:**

- Do not claim release readiness from local-only evidence.
- Missing production origins, accounts, deploy refs, or TURN configuration must produce a blocked result, not a pass.
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
