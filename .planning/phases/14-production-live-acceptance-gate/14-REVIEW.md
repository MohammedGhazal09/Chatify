---
phase: 14-production-live-acceptance-gate
review: 14
status: blocked
depth: standard
files_reviewed: 7
findings:
  critical: 4
  warning: 1
  info: 0
  total: 5
commands:
  - "git status --short --branch"
  - "rg review across Phase 14 e2e helpers, production config, and phase specification"
---

# Phase 14 Code Review

## Scope

Reviewed the Phase 14 production live acceptance gate implementation and its supporting helpers:

- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`
- `Frontend/Chatify/e2e/pages/phase14ProductionAcceptance.ts`
- `Frontend/Chatify/e2e/pages/productionSmoke.ts`
- `Frontend/Chatify/e2e/production-smoke-config.spec.ts`
- `Frontend/Chatify/playwright.production.config.ts`
- `Frontend/Chatify/package.json`
- `.planning/phases/14-production-live-acceptance-gate/14-SPEC.md`

## Findings

### CR-01: WebSocket evidence is dropped for deployed HTTPS backends

Severity: Critical

Files:

- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`
- `Frontend/Chatify/src/hooks/useChatSocket.ts`

Evidence:

`installNetworkObservations` stores the configured backend origin as `https://...`, then compares it directly to the WebSocket event origin. Production Socket.IO connects with `transports: ['websocket', 'polling']`, so the successful WebSocket URL is normally `wss://host/socket.io/...`. `new URL(webSocket.url()).origin` is `wss://host`, which does not equal the configured `https://host`, so the observation is skipped.

Relevant lines:

- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:67`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:81`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:84`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:531`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:547`
- `Frontend/Chatify/src/hooks/useChatSocket.ts:218`
- `Frontend/Chatify/src/hooks/useChatSocket.ts:220`

Why it matters:

The Phase 14 gate can fail the deployed Socket.IO evidence check even when production realtime works correctly. Worse, if polling traffic happens to be observed, the artifact may not prove the live WebSocket path that calls and realtime messaging actually depend on.

Recommendation:

Normalize socket origins before comparison. Treat `wss://backend-host` as the WebSocket peer for `https://backend-host` and `ws://backend-host` as the peer for `http://backend-host`, or compare host plus expected protocol family. Add a small unit/config test for a `wss://.../socket.io/` observation so this cannot regress.

### CR-02: The config self-test can overwrite the canonical live acceptance artifact

Severity: Critical

Files:

- `Frontend/Chatify/playwright.production.config.ts`
- `Frontend/Chatify/e2e/production-smoke-config.spec.ts`
- `Frontend/Chatify/e2e/pages/phase14ProductionAcceptance.ts`

Evidence:

The production Playwright config includes both `production-smoke-config.spec.ts` and `chat-production.*.spec.ts`. The config test `creates a sanitized blocked setup artifact` deliberately calls `writePhase14BlockedSetupReport`, which writes to the canonical `.planning/phases/14-production-live-acceptance-gate/14-LIVE-ACCEPTANCE.md` path.

Relevant lines:

- `Frontend/Chatify/playwright.production.config.ts:7`
- `Frontend/Chatify/playwright.production.config.ts:9`
- `Frontend/Chatify/e2e/production-smoke-config.spec.ts:153`
- `Frontend/Chatify/e2e/production-smoke-config.spec.ts:160`
- `Frontend/Chatify/e2e/pages/phase14ProductionAcceptance.ts:6`
- `Frontend/Chatify/e2e/pages/phase14ProductionAcceptance.ts:352`

Why it matters:

A full `npm run test:e2e:prod` run can leave the final readiness artifact in a blocked setup state even if the live acceptance test passed earlier in the same run. That makes the phase evidence order-dependent and can publish the wrong readiness decision.

Recommendation:

Do not let config self-tests write the canonical live acceptance report. Inject a temporary report path or mock the writer in `production-smoke-config.spec.ts`, and reserve `14-LIVE-ACCEPTANCE.md` for the actual live gate or an explicit blocked-setup command. A secondary option is to split scripts into config-only and live-gate commands so the canonical artifact has one owner.

### CR-03: Pinned/security detail surfaces are not verified as server-backed truth

Severity: Critical

Files:

- `.planning/phases/14-production-live-acceptance-gate/14-SPEC.md`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`

Evidence:

The spec requires shared files, shared media, pinned messages, and security rows to derive from live conversation data or disappear when empty. The implemented gate sends live attachments and checks shared file/media rows, but for pinned/security surfaces it only checks headings or static row text.

Relevant lines:

- `.planning/phases/14-production-live-acceptance-gate/14-SPEC.md:47`
- `.planning/phases/14-production-live-acceptance-gate/14-SPEC.md:50`
- `.planning/phases/14-production-live-acceptance-gate/14-SPEC.md:123`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:233`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:236`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:501`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:520`

Why it matters:

This was one of the production failures Phase 14 was created to catch: static pinned/detail content can still be present while the gate passes. A heading check does not prove pinned rows are tied to the tested conversation, nor that empty or unrelated data is suppressed.

Recommendation:

Pin the live marker message through the deployed UI, verify the detail rail shows exactly that pinned row, unpin it, and verify the row disappears or the empty state appears. For security rows, assert that rows reflect actual session/socket/block state rather than placeholder text, and fail if stale rows from unrelated conversations remain visible.

### CR-04: Logout and session recovery are still outside the live gate

Severity: Critical

Files:

- `.planning/phases/14-production-live-acceptance-gate/14-SPEC.md`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`

Evidence:

The Phase 14 acceptance criteria require logout and session recovery to behave predictably without leaking private chat content. The live test reaches final static-content, deployment-evidence, and screenshot checks, then writes the report. There is no logout action, post-logout private-content assertion, or re-auth/session recovery path.

Relevant lines:

- `.planning/phases/14-production-live-acceptance-gate/14-SPEC.md:85`
- `.planning/phases/14-production-live-acceptance-gate/14-SPEC.md:126`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:857`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:905`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:914`

Why it matters:

The gate can claim readiness even if the visible logout control is dead, inaccessible, fails to clear chat state, or leaves private message content visible after session termination. That is a direct auth/privacy risk in a production messenger.

Recommendation:

Add a late-run logout/session check after the screenshot matrix or in a fresh disposable context: activate the logout control, assert private chat content and socket state are cleared, assert protected API/chat routes no longer render private data, then re-authenticate or open a new context and verify the same live conversation can recover cleanly.

### WR-01: Failed call attempts do not clean up before later checks continue

Severity: Warning

Files:

- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts`

Evidence:

`exerciseCallMode` only ends and reloads both participants after the call has connected successfully. If any assertion fails after clicking the call button but before the end-call path, `recordCheck` catches the error and the serial gate continues to video, block/unblock, static-content, and screenshot checks with whatever call state remains.

Relevant lines:

- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:372`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:376`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:387`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:809`
- `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts:842`

Why it matters:

A single call failure can cascade into unrelated checks and leave the production smoke accounts in a noisy call state until disconnect cleanup catches up. That makes the blocker report harder to trust.

Recommendation:

Wrap the active part of `exerciseCallMode` in a `try/finally` that attempts to end any visible call dialogs, dismiss incoming call UI, and reload both pages before returning control to the rest of the gate. Keep the original failure as the recorded blocker.

## Questions

No blocking questions. My recommendation is to fix CR-01 and CR-02 first because they affect whether the Phase 14 artifact can be trusted at all, then add the missing live coverage in CR-03 and CR-04 before rerunning the production gate.

## Verification

No test commands were run during this review. This was a static code review over the Phase 14 implementation and specification.
