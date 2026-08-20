# Phase 14: Production Live Acceptance Gate - Specification

**Created:** 2026-06-13
**Ambiguity score:** 0.06 (gate: <= 0.20)
**Requirements:** 12 locked

## Goal

Chatify can only be called functionally ready after the deployed Vercel frontend and Render backend pass a live end-to-end acceptance gate with real authenticated accounts, real persisted backend data, no fixture bypass, and every visible chat control verified or honestly unavailable.

## Background

Earlier local phases rebuilt the messenger UI, message delivery contract, media/detail surfaces, conversation controls, and call/video behavior. The production product still needs a hard live acceptance gate because prior local screenshot and fixture-backed evidence did not catch deployed failures: a non-closable right rail, dead call/video/search/more controls, static pinned/shared-file/shared-media surfaces, static voice/media interactions, duplicate sender messages, false delivered indicators, and recipient messages requiring page refresh. Existing Playwright coverage includes local behavior gates, Phase 10 production reality smoke scaffolding, Phase 10.1 production delivery smoke scaffolding, and a Phase 13 call placeholder that skips the live two-party fake-media path unless an explicit smoke environment is configured. Phase 14 turns those partial checks into a full production readiness gate.

## Requirements

1. **Explicit production target contract**: The live gate must run only against explicitly configured deployed origins.
   - Current: Production smoke helpers exist with default Vercel/Render URLs and opt-in env vars, but Phase 14 has no complete acceptance contract.
   - Target: The gate requires `CHATIFY_PRODUCTION_SMOKE=1`, deployed frontend/backend URLs, and two disposable account credentials before any live acceptance test runs.
   - Acceptance: A verifier can run the Phase 14 gate without required env vars and see a clear skipped/blocked reason; with env vars present, the gate records the frontend origin, backend origin, and redacted account labels in the acceptance artifact.

2. **Disposable real account authentication**: The gate must authenticate two real test accounts through the deployed backend.
   - Current: Existing production smoke helpers can log in via `/api/auth/login` and inject returned auth cookies, but this is only used by narrower Phase 10/10.1 smoke tests.
   - Target: Phase 14 uses two disposable production-safe accounts for all two-party workflows and never commits credentials, tokens, cookies, or full email addresses.
   - Acceptance: The acceptance artifact proves both accounts reached the live chat shell, shows only redacted account labels, and contains no raw passwords, tokens, cookies, or full account emails.

3. **Live data only, no fixture bypass**: The gate must fail if production behavior depends on local fixtures, route-only mocks, screenshot-only assertions, or static demo/detail content.
   - Current: Local E2E suites still use fixture-backed helpers for earlier visual/behavior phases, while production smoke coverage is narrow.
   - Target: Phase 14 creates or uses live persisted data through deployed APIs/UI only, with denylist checks for known static demo names, placeholder media, placeholder files, and screenshot fixture content.
   - Acceptance: The gate fails when known demo/static fixture text or media appears as conversation truth unless the Phase 14 live run created that exact marker.

4. **Two-account message delivery reliability**: One sender action must create exactly one sender bubble, one persisted message, and one real-time recipient bubble without refresh.
   - Current: Phase 10.1 has focused production delivery smoke scaffolding, but Phase 14 has no integrated readiness gate covering the full chat surface.
   - Target: The live gate sends a unique marker from user A to user B, verifies one sender bubble, verifies user B receives it through Socket.IO without reload, verifies sender and recipient remain correct after reload, and verifies HTTP create responses do not falsely claim recipient delivery.
   - Acceptance: The run fails if the marker appears twice for the sender, is missing for the recipient before refresh, disappears after reload, or shows delivered/read state before server-confirmed recipient delivery/read events.

5. **Conversation controls are functional or honestly unavailable**: Every visible header, detail rail, drawer, More, search, block/unblock, call, video, attachment, voice, and identity control must either complete its supported workflow or present an intentional disabled/hidden state.
   - Current: Earlier production observations showed visible controls that looked interactive but were static or dead.
   - Target: Phase 14 treats dead visible controls as product failures. Unsupported controls must be hidden or disabled with an accessible explanation; supported controls must perform real behavior against deployed state.
   - Acceptance: The gate opens and validates each visible control in the active conversation. It fails if any enabled visible control does nothing, opens static placeholder content, traps focus, cannot be closed, or lacks an accessible name/state.

6. **Details surfaces close, reopen, escape, and restore**: Desktop rails, mobile drawers, overlays, and panels must be controllable without trapping the user.
   - Current: A live production screenshot showed the right-side conversation rail open and not closable.
   - Target: The gate verifies open, close, Escape, focus return, reopen, mobile back/drawer behavior, and reload restoration for conversation details and overlays.
   - Acceptance: The gate fails if any rail/drawer/overlay remains stuck open, cannot be dismissed by its visible close control or expected keyboard path, loses focus recovery, or blocks the main chat workflow after dismissal.

7. **Shared files, shared media, pinned messages, and security rows use server-backed truth**: Detail content must be derived from live conversation data or disappear when empty.
   - Current: Requirements still mark production shared-media truth as pending, and previous reports saw static shared files/media/pinned rows.
   - Target: The gate sends at least one small image and one small document/text attachment through production, verifies message rendering, verifies shared media/files update from persisted attachments, verifies reload persistence, and verifies empty states do not show fake rows.
   - Acceptance: The gate fails if shared-file/media/pinned/security surfaces show placeholder cards, known fixture filenames, stale data from unrelated conversations, unauthorized assets, or content that does not correspond to persisted messages in the tested conversation.

8. **Call and video controls pass live fake-media acceptance**: Audio and video calls must complete a deterministic two-account production signaling path or be honestly unavailable.
   - Current: Phase 13 includes local call UI/unit coverage and a skipped live two-party fake-media placeholder.
   - Target: Phase 14 runs a live two-account fake-microphone/fake-camera Playwright path for call and video when controls are enabled, including outgoing, incoming, accept, connected, end, and cleanup states.
   - Acceptance: The gate fails if call/video buttons are enabled but do not create authenticated signaling, if either account misses the call event, if the connected/end states do not converge, or if stuck call UI remains after end/reload. If production call requirements are unavailable, controls must be disabled with a clear reason.

9. **Responsive and theme matrix is behavior-backed**: Desktop/mobile and light/dark evidence must be captured after real interactions, not at initial static render.
   - Current: Earlier phases produced screenshots, but production failures proved screenshot parity alone is insufficient.
   - Target: The gate runs core behavior on desktop dark and mobile light, then captures post-interaction screenshots/traces for desktop light, desktop dark, mobile light, and mobile dark.
   - Acceptance: The acceptance artifact includes evidence paths for all four variants after login, conversation selection, message send/receive, detail/control interaction, and dismissal paths have succeeded.

10. **Deployment configuration is verified against real origins**: Production CORS, cookies, sockets, file access, and call signaling must work from the deployed frontend to the deployed backend.
    - Current: Local tests cannot prove deployed cookie/CORS/socket alignment, and production reliability remains dependent on live origins and credentials.
    - Target: The gate records network evidence that API requests use the configured backend origin, auth cookies are present with production-safe attributes, Socket.IO connects to the deployed backend, file access is authorized, and call signaling flows through the live socket connection.
    - Acceptance: The gate fails on CORS errors, missing auth cookies after login, socket connection failure, unauthorized file access leakage, stale socket state after reload/reconnect, or mismatch between configured and observed API/socket origins.

11. **Readiness blockers are explicit**: Critical live failures must block v1 readiness instead of being documented as acceptable risk.
    - Current: Phase 14 has no spec-level blocker list, and earlier local completion claims did not prevent deployed dead-control and delivery failures.
    - Target: Duplicate sends, missing realtime receive, false delivered/read status, dead visible controls, non-closable panels, static fake data, broken upload/download, broken voice/call/video entry points, auth/session failure, and production CORS/socket errors all block Phase 14 completion.
    - Acceptance: The final artifact marks the phase as failed if any blocker is observed, and no summary claims Chatify is functionally ready while any blocker remains open.

12. **Final acceptance artifact is complete and sanitized**: Phase 14 must produce a durable acceptance report with exact evidence.
    - Current: Existing smoke tests append narrower Phase 10 and Phase 10.1 audit documents, but Phase 14 has no single production readiness artifact.
    - Target: Phase 14 produces `14-LIVE-ACCEPTANCE.md` under the phase directory with commands, URLs, deployed commit hashes when discoverable, redacted accounts, pass/fail table, screenshot/trace paths, blocker status, and remaining risks.
    - Acceptance: A verifier can read the artifact and determine exactly what was run, against which deployed origins, with which redacted accounts, which evidence files were produced, which checks passed/failed, and whether v1 functional readiness is allowed.

## Boundaries

**In scope:**

- A live production acceptance gate for the deployed Vercel frontend and Render backend.
- Two-account email/password authentication using disposable test accounts provided through environment variables.
- Real persisted conversation data created or exercised through deployed API/UI paths.
- Message send/receive/reload verification with duplicate-send and false-delivery blockers.
- Conversation selection, detail rail/drawer open/close/Escape/focus behavior, message search, More actions, block/unblock, attachments, shared media/files, pinned/security surfaces, voice controls, call controls, video controls, logout, and session recovery.
- Production fixture/static-content denial checks.
- Production CORS, cookie, Socket.IO, file access, and call signaling evidence.
- Desktop/mobile and light/dark post-interaction screenshots/traces.
- A sanitized `14-LIVE-ACCEPTANCE.md` acceptance artifact.
- Small test-harness or documentation changes required to run and report the gate.

**Out of scope:**

- Broad product feature implementation inside Phase 14 - discovered product failures should normally block the gate and feed follow-up phases unless the fix is small and required to run the acceptance harness.
- OAuth/social login acceptance - Phase 14 focuses on email/password chat readiness, avoiding third-party provider instability.
- Native mobile apps - the milestone is web-first.
- Group chats, notifications, moderation, admin tooling, and end-to-end encryption - these remain v2/out-of-scope requirements.
- Large-file stress testing - Phase 14 uses small representative attachments to prove the production path without polluting production storage.
- Permanent production data cleanup tooling - cleanup is desirable where supported, but disposable accounts and timestamped markers are acceptable if cleanup APIs are not available.
- CI scheduling as a blocking deliverable - the gate must be CI-ready through environment variables, but a scheduled CI job is not required in this phase.

## Constraints

- Do not use subagents; execution must stay inline in the current Codex thread.
- Do not commit or print production credentials, cookies, JWTs, reset codes, full emails, or raw private payloads.
- Production smoke runs must be explicitly opted in with environment variables and must not silently fall back to local fixture routes.
- Screenshots and traces must be captured after behavior interactions succeed.
- The gate must be deterministic enough for repeat local execution; fake mic/camera devices are required for automated call/video checks.
- The gate must preserve existing React/Vite, Express, MongoDB, Socket.IO, TanStack Query, Zustand, Tailwind, Vitest, and Playwright tooling unless a later phase explicitly replaces them.
- Existing unrelated dirty work in the repository must not be reverted, staged, or mixed into the Phase 14 spec commit.

## Acceptance Criteria

- [ ] Running the Phase 14 gate without required production env vars exits or skips with an explicit blocked reason and no false pass.
- [ ] Running with required production env vars signs in two real disposable accounts against the deployed backend and reaches the deployed chat UI.
- [ ] The gate creates or exercises a direct conversation using live persisted data, not local route mocks or fixture imports.
- [ ] One user send action produces exactly one sender bubble and one persisted message.
- [ ] The recipient sees the unique marker through Socket.IO without page refresh.
- [ ] Sender and recipient views remain correct after reload/reconnect.
- [ ] Delivered/read indicators reflect server-confirmed recipient state and never a sender-only success.
- [ ] Every enabled visible chat control performs real behavior; unsupported controls are hidden or disabled with accessible explanation.
- [ ] Desktop rail, mobile drawer, overlays, and menus can open, close, Escape/dismiss, restore focus, and reopen.
- [ ] Shared files, shared media, pinned messages, and security rows derive from live conversation data or disappear when empty.
- [ ] Small image and document/text attachments can be sent, rendered, opened/downloaded, and seen in shared surfaces after reload.
- [ ] Enabled audio and video call controls complete live two-account fake-media signaling or are disabled with a clear production reason.
- [ ] Logout and session recovery behave predictably without leaking private chat content.
- [ ] Production CORS, cookies, Socket.IO connection, file access, and call signaling are verified against actual deployed origins.
- [ ] Post-interaction screenshots/traces exist for desktop light, desktop dark, mobile light, and mobile dark.
- [ ] `14-LIVE-ACCEPTANCE.md` records commands, URLs, deployed commit hashes when discoverable, redacted accounts, pass/fail status, evidence paths, blockers, and remaining risks.
- [ ] The phase is marked failed if any blocker-grade issue remains.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.96  | 0.75  | met    | Live production readiness gate is the single outcome. |
| Boundary Clarity    | 0.94  | 0.70  | met    | Gate-first scope, limited harness fixes, and explicit exclusions are locked. |
| Constraint Clarity  | 0.90  | 0.65  | met    | Env vars, real accounts, redaction, no fixtures, fake media, and no subagents are locked. |
| Acceptance Criteria | 0.93  | 0.70  | met    | Pass/fail checks and blocker policy are explicit. |
| **Ambiguity**       | 0.06  | <=0.20| met    | Requirements are clear enough for discuss-phase. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | Should Phase 14 be gate-only or fix-and-gate? | Gate-first, with only small harness/config fixes allowed. |
| 1 | Researcher | Which production targets and accounts should be used? | Use explicit Vercel/Render URLs and two disposable env-var accounts. |
| 1 | Researcher | Should existing or generated production data be used? | Create timestamped live data and clean up where supported. |
| 2 | Simplifier | What is the irreducible core? | Real auth, real data, send/receive, controls, attachments, calls, layout/theme evidence, and blocker report. |
| 2 | Simplifier | Should OAuth be included? | Email/password auth only for Phase 14. |
| 3 | Boundary Keeper | What visible controls are in scope? | Every visible chat control must work or be honestly unavailable. |
| 3 | Boundary Keeper | What is out of scope? | Broad feature implementation, OAuth, v2 features, native apps, large-file stress, and CI scheduling. |
| 4 | Failure Analyst | What failures invalidate the phase? | Duplicate sends, missing realtime receive, false delivery, dead controls, static data, stuck panels, broken media/calls, auth/session, CORS/socket failures. |
| 4 | Failure Analyst | What proves fixture/static content is gone? | Denylist and live-data checks fail if production shows demo/placeholder content as truth. |
| 5 | Seed Closer | What artifact proves readiness? | `14-LIVE-ACCEPTANCE.md` with commands, origins, commit hashes when discoverable, redacted accounts, evidence paths, pass/fail table, blockers, and risks. |
| 5 | Seed Closer | How are secrets and privacy handled? | Disposable accounts, redacted artifacts, no committed credentials, no real user data. |

---

*Phase: 14-production-live-acceptance-gate*
*Spec created: 2026-06-13*
*Next step: $gsd-discuss-phase 14 - implementation decisions for the live production gate*
