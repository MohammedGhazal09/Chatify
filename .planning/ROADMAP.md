# Roadmap: Chatify

## Overview

Chatify v1.0 reconstructs the existing chat app into a trustworthy real-time messenger. The roadmap moves vertically: first make security and tests block risky work, then authenticate realtime communication, then rebuild message state, then reconstruct the chat UI, then finish the messenger baseline features, then lock reference-driven visual parity across desktop and mobile light/dark variants, then restore full product behavior behind the reference UI, implement real media/detail surfaces, enforce an interaction quality gate, and now remediate production-live gaps that proved fixture-backed tests were not enough, including duplicate sends and missing realtime delivery.

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
- [x] **Phase 7: Messenger Functional Parity Restoration** - Rewire the reference UI to real chat state, actions, navigation, search, status, and session behavior so no production surface is static-only. (completed 2026-06-12)
- [x] **Phase 8: Media Files And Conversation Detail Implementation** - Implement real attachments, previews, downloads, shared media/files, pinned items, and conversation detail/security panels. (completed 2026-06-12)
- [x] **Phase 9: Messenger Interaction Quality Gate** - Prove the messenger works end-to-end across desktop, mobile, light theme, and dark theme with behavior tests and screenshot evidence. (completed 2026-06-12)
- [ ] **Phase 10: Production Messenger Reality Audit And Fixture Removal** - Reproduce the live product failures, remove fixture/static production fallbacks, and make panel/navigation behavior honestly testable.
- [ ] **Phase 10.1: Production Message Delivery Reliability Repair (INSERTED)** - Fix duplicate sends, false delivered status, and missing realtime receive before new feature work continues.
- [ ] **Phase 11: Conversation Controls And User Safety Implementation** - Make search, More, blocking, conversation actions, and static detail surfaces real backend-backed behavior.
- [ ] **Phase 12: Live Media Voice And Identity Implementation** - Make user identity images/marks, attachments, shared media/files, and voice messages real persisted workflows.
- [x] **Phase 13: Realtime Call And Video Implementation** - Make call and video controls initiate reliable authenticated realtime sessions instead of dead buttons. (completed 2026-06-13)
- [ ] **Phase 14: Production Live Acceptance Gate** - Prove the deployed Vercel/Render product works with real accounts and no fixture bypass.
- [ ] **Phase 15: Investigate And Fix Audio And Video Call Reliability** - Make audio and video calls connect, fail honestly, clean up safely, and report readiness with evidence.
- [ ] **Phase 16: Profile Picture Upload And Shared Avatar Visibility** - Let users upload a profile picture from their own PC and show it consistently to other users.

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

- [ ] 11-01: Backend Conversation Controls and Block Enforcement

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 11-02: Frontend Controls, Search, Detail Data, and Accessibility

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 11-03: Integrated Verification and Static Fixture Guard

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
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 10.1 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security And Test Foundation | 0/3 | Not started | - |
| 2. Authenticated Realtime Contract | 3/3 | Complete | 2026-06-08 |
| 3. Canonical Message State | 3/3 | Complete | 2026-06-08 |
| 4. Messenger UI Reconstruction | 3/3 | Complete | 2026-06-09 |
| 5. Messenger Baseline Completion | 2/2 | Complete | 2026-06-09 |
| 6. Messenger Visual Parity | 3/3 | Complete   | 2026-06-12 |
| 7. Messenger Functional Parity Restoration | 3/3 | Complete   | 2026-06-12 |
| 8. Media Files And Conversation Detail Implementation | 3/3 | Complete | 2026-06-12 |
| 9. Messenger Interaction Quality Gate | 3/3 | Complete | 2026-06-12 |
| 10. Production Messenger Reality Audit And Fixture Removal | 0/0 | Not planned | - |
| 10.1. Production Message Delivery Reliability Repair | 2/3 | In Progress | 2026-06-13 |
| 11. Conversation Controls And User Safety Implementation | 0/0 | Not planned | - |
| 12. Live Media Voice And Identity Implementation | 0/3 | Planned | - |
| 13. Realtime Call And Video Implementation | 3/3 | Complete   | 2026-06-13 |
| 14. Production Live Acceptance Gate | 3/3 | Blocked pending live env | - |
| 15. Investigate And Fix Audio And Video Call Reliability | 0/4 | Planned | - |
| 16. Profile Picture Upload And Shared Avatar Visibility | 3/4 | In Progress | - |

### Phase 15: Investigate and fix audio and video call reliability

**Goal:** Users can trust Chatify audio and video calls to connect, fail honestly, clean up safely, and report local/production readiness with evidence instead of assumptions.
**Requirements**: CALL-01, CALL-02, CALL-03, CALL-04, BLOCK-02, RT-01, RT-02, RT-04, RT-05, SEC-02, PROD-01, PROD-03, PROD-04, TEST-02, TEST-03, TEST-05, UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, PARITY-02, PARITY-03
**Depends on:** Phase 14
**Plans:** 4 plans
Plans:

- [ ] 15-01: Investigation, failure report, and test harness
- [ ] 15-02: Backend signaling, session authority, TURN, and privacy hardening
- [ ] 15-03: Frontend WebRTC controller and call UI repair
- [ ] 15-04: Acceptance, regression, evidence, and production decision

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
**Plans:** 3/4 plans executed
Plans:

- [x] 16-01: Backend profile image contract, storage, and security
- [x] 16-02: Settings profile picture workflow and cache propagation
- [x] 16-03: Avatar rendering surfaces and fixture guardrails
- [ ] 16-04: Acceptance evidence, privacy scan, and regression gate

**Cross-cutting constraints:**

- D-04: Never expose raw storage internals in client payloads.
- D-20: Unsafe profile-picture methods must use CSRF or a documented verified exemption.
- D-22: Logs and errors must not expose image internals or user-identifying secrets.
- D-35: Fixture guardrails must remain narrow and active.
- D-36: Verification must include backend, frontend, fixture guard, and local two-account Playwright evidence.
- D-37: Production E2E is not required for Phase 16.
- D-39: Preserve unrelated local work and stage only focused Phase 16 files.
- D-38: Avoid direct edits to Frontend/Chatify/src/pages/chat/chat.tsx unless integration requires it.
