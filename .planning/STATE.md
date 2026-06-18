---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 20-22 added to promote username discovery and group chats into the roadmap; Phase 14/15/17 release blockers preserved.
stopped_at: Phase 20 context gathered
last_updated: "2026-06-18T06:11:59.559Z"
last_activity: 2026-06-18 -- Added Phase 20-22 for username identity, username-based discovery, and capped group conversations; v1 release remains blocked pending production/call evidence
progress:
  total_phases: 23
  completed_phases: 20
  total_plans: 65
  completed_plans: 68
  percent: 87
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-07)

**Core value:** Users can trust Chatify to deliver private real-time conversations reliably, securely, and clearly.
**Current focus:** Phase 20 — plan username identity and privacy foundation

## Current Position

Phase: 20 (username-identity-and-privacy-foundation) — PLANNED
Plan: Not planned yet
Status: Phase 20-22 added to promote username discovery and group chats into the roadmap; Phase 14/15/17 release blockers preserved.
Last activity: 2026-06-18 -- Added Phase 20-22 for username identity, username-based discovery, and capped group conversations; v1 release remains blocked pending production/call evidence

Progress: Phase 20 is the next planned phase with 0/3 plans complete; Phase 21 and Phase 22 are planned follow-ups. Release readiness remains blocked by missing production live, local/prod call, and final v1 evidence.

## Performance Metrics

**Velocity:**

- Total plans completed: 69
- Average duration: 34 min
- Total execution time: 5h 10m

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 02-authenticated-realtime-contract | 3 | 2h 15m | 45m |
| 03-canonical-message-state | 3 | 50m | 17m |
| 04-messenger-ui-reconstruction | 3 | 2h 05m | 42m |
| 05 | 2 | - | - |
| 16 | 4 | - | - |
| 1 | 3 | - | - |
| 2 | 3 | - | - |
| 3 | 3 | - | - |
| 4 | 3 | - | - |
| 5 | 2 | - | - |
| 6 | 3 | - | - |
| 7 | 3 | - | - |
| 8 | 3 | - | - |
| 9 | 3 | - | - |
| 11 | 3 | - | - |
| 19 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: 03-02, 03-03, 04-01, 04-02, 04-03
- Trend: Phase 3 canonical message state and Phase 4 messenger UI reconstruction completed with frontend tests, lint, build, and smoke evidence passing

| Phase 07 P01 | 12 min | 3 tasks | 5 files |
| Phase 07 P02 | 10 min | 4 tasks | 12 files |
| Phase 07 P03 | 20 min | 4 tasks | 12 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Project direction: Rebuild core chat before broad feature expansion.
- V1 scope: Professional messenger baseline, not minimal repair or full platform.
- Security posture: Blocking security acceptance criteria for auth, socket, and message phases.
- Project structure: Vertical MVP phases.
- Phase 03 backend contract: Message creation is HTTP-only and idempotent by sender/chat/clientMessageId.
- Phase 03 backend contract: Socket and HTTP receipt paths share monotonic status helpers; unread events use absolute `count`.
- Phase 03 backend contract: Delete-for-everyone is a stable redacted tombstone; delete-for-self filters visibility per user.
- Phase 03 frontend contract: TanStack Query owns durable message state; optimistic, socket, mutation, and refetch updates merge by `_id` and `clientMessageId`.
- Phase 03 frontend contract: Failed sends remain visible as failed optimistic messages and retry with the same `clientMessageId`.
- Phase 03 history contract: Message history uses `before`/`limit` cursor pagination over `createdAt` plus `_id`, with display-order responses.
- Phase 03 sidebar contract: Chat list `latestMessage` is projected per requester using message visibility rules instead of trusting stale chat-level state.
- Phase 03 validation contract: Outgoing message text trims before send/edit and shares the backend 1000-character maximum boundary.

### Roadmap Evolution

- Project initialized: Chatify reconstruction roadmap created.
- Phase 1 starts with security and tests because message and socket work is privacy-sensitive.
- Phase 2 planned with 3 sequential waves for authenticated realtime identity, authorization, presence, reconnect, and socket integration verification.
- Phase 2 completed with authenticated socket identity, membership-checked socket events, targeted private emits, privacy-aware presence, reconnect reconciliation, and socket integration tests.
- Phase 3 plan 03-01 completed with canonical backend message state primitives, idempotent create, read/delivery/unread contracts, tombstones, edit/reaction bounds, and 47 passing backend tests.
- Phase 3 plan 03-02 completed with frontend message cache helpers, Query-owned message state, sender-free create payloads, socket cache integration, and 8 passing frontend helper tests plus lint/build.
- Phase 3 plan 03-03 completed with cursor history, per-user latestMessage projection, shared validation boundaries, and full backend/frontend regression verification.
- Phase 3 completed; Phase 4 is ready to rebuild the messenger UI on top of the canonical message state contract.
- Phase 4 plan 04-01 completed with extracted chat components and a focused route orchestrator.
- Phase 4 plan 04-02 completed with UI-SPEC styling, explicit state surfaces, failed-send recovery, accessible controls, and lazy emoji loading.
- Phase 4 plan 04-03 completed with React 19 DOM regression tests, jsdom setup, and smoke evidence.
- Phase 4 completed; Phase 5 can build on the tested messenger baseline.
- Phase 6 planned with 3 waves for theme/desktop shell, mobile conversation parity, and four-variant visual smoke evidence.
- Phase 6 completed visual parity, but it did not sufficiently prove that every reference UI surface was wired to real product behavior.
- Phase 7 added: Messenger Functional Parity Restoration.
- Phase 7 planned with 3 waves: fixture isolation/guardrails, live-state UI repair/honesty, and behavior-first Playwright verification.
- Phase 8 added: Media Files And Conversation Detail Implementation.
- Phase 8 plan 08-01 completed with backend attachment, shared asset, and pinned-message contracts.
- Phase 8 plan 08-02 completed with real frontend attachment upload, message attachment rendering, server-backed desktop rail, and mobile detail drawer.
- Phase 8 plan 08-03 completed with socket/detail invalidation, privacy-scoped realtime tests, metadata search guardrails, fixture leak checks, full verification, and behavior-backed screenshots.
- Phase 9 added: Messenger Interaction Quality Gate.
- Phase 9 planned with 3 waves: behavior-first Playwright gate and fixtures, accessibility/keyboard/layout/privacy guardrails, and final quality-gate evidence.
- Phase 9 completed with a dedicated behavior-first Playwright gate, axe scans, keyboard/focus checks, layout/touch target checks, fixture/privacy guardrails, four post-interaction screenshots, and backend/API media-detail proof.
- Phase 10 added: Production Messenger Reality Audit And Fixture Removal.
- Phase 11 added: Conversation Controls And User Safety Implementation.
- Phase 12 added: Live Media Voice And Identity Implementation.
- Phase 12 completed local implementation, verification, UI review, and code review with Phase 14 production-live acceptance still deferred.
- Phase 13 completed local implementation, verification, UI review/fix, and resolved code review; live deployed two-party call acceptance remains a Phase 14/15 production-readiness boundary.
- Phase 13 added: Realtime Call And Video Implementation.
- Phase 14 added: Production Live Acceptance Gate.
- Production-live correction: Phase 9 evidence was not sufficient to claim the deployed messenger is fully functional because the live UI still exposes a non-closable right rail, dead call/video/search/more controls, static shared files/media/pinned surfaces, and static voice/media interactions.
- Phase 10.1 inserted after Phase 10: Production Message Delivery Reliability Repair (URGENT).
- Production delivery correction: live two-account behavior shows one send can render duplicate sender messages, delivered state can be false, and recipients may need refresh to see messages; this must be fixed before conversation controls, media, voice, or call features.
- Phase 11 planned with 3 waves: backend conversation controls and block enforcement, frontend controls/search/detail data/accessibility, and integrated verification with static-fixture guard evidence.
- Phase 13 planned with 3 waves: backend call session/signaling authority, frontend WebRTC call controller/UI entry points, and call activity/reconnect/regression evidence.
- Phase 14 planned with 3 waves: production harness/env/reporting, live messaging/controls/attachments/static-content acceptance, and call/video/deployment/final readiness evidence.
- Phase 14 plan 14-01 completed with a production-only Playwright config, strict Phase 14 env validator, sanitized acceptance artifact writer, no-env blocked report, and setup guide.
- Phase 14 plan 14-02 completed with the main production live acceptance spec for two-account messaging, controls, generated attachments, shared surfaces, static-content denial, blocked no-env reporting, and behavior-backed screenshot capture when smoke env is configured.
- Phase 14 plan 14-03 completed with call/video fake-media acceptance paths, deployment-origin/cookie/socket/file evidence, optional deployed commit metadata, final readiness decision reporting, and local quality gates passing.
- Phase 14 review gap resolved with HTTPS-to-WSS backend evidence, no-env artifact preservation, server-backed pinned/security detail checks, logout/session recovery, and call cleanup coverage; production readiness remains blocked without smoke env.
- Phase 15 added: Investigate and fix audio and video call reliability.
- Phase 15 executed locally with failure report, local two-account fake-media harness, frontend call repairs verified, backend call authority verified, and acceptance artifact recording local/prod smoke env blockers.
- Phase 16 added: Profile Picture Upload And Shared Avatar Visibility.
- Phase 16 planned with 4 plans across 3 waves: backend profile image contract/storage/security, Settings workflow and cache propagation, avatar rendering surfaces with fixture guardrails, and acceptance evidence with local two-account verification.
- Phase 17 added: V1 Readiness Closure And Release Gate.
- Phase 18 added: Operational Observability And Runbook Hardening.
- Phase 19 added: Messenger Product Polish And Notifications.
- Phase 18 planned with four sequential operations plans: structured diagnostics/redaction, health/readiness, quality scripts/runbooks, and regression/evidence.
- Phase 18 completed with structured redacted logging, health/readiness endpoints, root quality/smoke scripts, operations runbooks, ops guard checks, and sanitized operations readiness evidence.
- Phase 19 planned with five sequential waves: notification preference/privacy model, notification UI and realtime alert wiring, account/session and multi-tab polish, empty/offline/blocked/failure state polish, and product-polish verification/evidence.
- Phase 19 completed with local notification/product-polish evidence, full frontend tests, Playwright checks, lint, build, ops check, and release blockers preserved.
- Phase 20 added: Username Identity And Privacy Foundation, with unique public usernames, signup collection, existing-user setup, and private-email boundaries.
- Phase 21 added: Username-Based Contact Discovery, replacing email-based direct chat creation and contact discovery with username lookup.
- Phase 22 added: Group Conversations With Ten-Member Limit, promoting group chats from deferred v2 scope into a planned feature phase after username discovery.
- Group chats are no longer deferred, but broader platform expansion such as cross-platform push/email delivery, moderation/admin tooling, end-to-end encryption, channels, bots, integrations, and group calls remains deferred.

### Pending Todos

- Address the earlier pending Phase 01 security foundation before claiming full v1 milestone readiness.
- Plan and execute Phase 10 before continuing feature claims; it must reproduce the production failures and remove fixture/static fallbacks.
- Provide production smoke credentials and run Phase 10.1 production delivery reliability before claiming deployed delivery reliability complete.
- Provide Phase 14 production smoke environment and rerun `cd Frontend/Chatify; npm run test:e2e:prod -- --grep "Phase 14 production live acceptance"` to move readiness from blocked to allowed.
- Provide Phase 15 local call smoke environment (`CHATIFY_LOCAL_CALL_SMOKE=1`, local frontend/backend URLs, and two disposable local accounts) and rerun `cd Frontend/Chatify; npm run test:ui -- --grep "Phase 15"` to prove local audio/video fake-media acceptance.
- Provide production smoke env plus TURN readiness evidence and rerun `cd Frontend/Chatify; npm run test:e2e:prod -- --grep "Phase 15|Phase 14 production live acceptance"` before claiming production call readiness.
- Plan Phase 17 so final readiness cannot pass until Phase 1, Phase 10, Phase 10.1, Phase 14, and Phase 15 evidence is reconciled.
- Phase 19 is complete; do not use it to claim release readiness until Phase 14, Phase 15, and Phase 17 blockers are resolved with evidence.
- Plan and execute Phase 20 before starting username discovery or group work; username uniqueness and mandatory setup are prerequisites.
- Plan and execute Phase 21 before group creation; group member selection must use username-based discovery, not email lookup.
- Plan and execute Phase 22 only after Phase 20 and Phase 21 are complete, preserving the 10-member cap and email privacy guardrails.

### Blockers/Concerns

- Open concern: Phase 06 screenshot parity is not enough acceptance evidence for a working messenger UI.
- Phase 09 local evidence did not catch the deployed static/dead-control failures; production-live acceptance is now deferred to Phase 14.
- Critical blocker: message delivery is unreliable in production until Phase 10.1 proves single-send idempotency, recipient realtime receive, and honest delivered/read state with real two-account evidence.
- Phase 10.1 local delivery reliability is proven, but production delivery reliability is still blocked pending live smoke credentials and deploy identifiers.
- Phase 14 production acceptance will remain blocked until deployed frontend/backend origins and two disposable production-safe accounts are configured through env vars.
- Phase 14 implementation is complete, but `14-LIVE-ACCEPTANCE.md` records readiness blocked because the production smoke environment was not configured in this run.
- Phase 15 call readiness remains blocked until local two-account fake-media smoke env and production smoke/TURN prerequisites are configured; current code/unit/backend/lint/build gates pass, but browser call acceptance is not proven in this environment.
- Phase 17 planned with four release-gate plans for evidence inventory, security/local quality reconciliation, production/call readiness gating, and final v1 decision.
- Phase 17 executed with green local backend/frontend quality gates but final v1 readiness blocked by missing production live, delivery, local call, and production TURN/smoke evidence.
- Remaining concern: Phase 01 security/test foundation requirements are still pending in the roadmap.
- New Phase 17 must not be used to bypass unresolved Phase 1, Phase 10, Phase 10.1, Phase 14, or Phase 15 blockers; it is a closure gate, not a substitute implementation.
- Repository hygiene note: unrelated local screenshot/config changes existed before these phase additions and should not be mixed into future focused commits unless intentionally refreshed.
- Phase 19 execution must not be used to imply release readiness; it is product polish and notification UX only.
- Username and group phases must not expose email in public discovery, participant lists, realtime events, logs, traces, screenshots, or test fixtures.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Platform | Cross-platform push/email notification delivery beyond Phase 19 baseline, moderation, admin tooling, end-to-end encryption, channels, bots, integrations, and group calls | Deferred to later v2 phases | Phase 20-22 planning |

## Session Continuity

Last session: 2026-06-18T06:11:59.549Z
Stopped at: Phase 20 context gathered
Resume file: .planning/phases/20-username-identity-and-privacy-foundation/20-CONTEXT.md
