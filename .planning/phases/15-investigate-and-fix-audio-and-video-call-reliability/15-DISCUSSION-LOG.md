# Phase 15: Investigate And Fix Audio And Video Call Reliability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 15-investigate-and-fix-audio-and-video-call-reliability
**Areas discussed:** investigation and traceability, local acceptance harness, production readiness, TURN and ICE, WebRTC negotiation, reachability and multi-tab truth, call UI repair, diagnostics and privacy, verification matrix, artifacts and work shape

---

## Investigation And Traceability

| Option | Description | Selected |
|--------|-------------|----------|
| Investigation first | Reproduce/classify audio and video failures before implementing fixes. | yes |
| Implementation first | Patch likely failures before a dedicated reproduction artifact. | |

**User's choice:** Approved recommendation.
**Notes:** Phase 15 must create a failure report and map every fix to a finding, blocked evidence item, or reliability gap.

---

## Local Acceptance Harness

| Option | Description | Selected |
|--------|-------------|----------|
| Real local full-stack harness | Use local backend, authenticated sockets, disposable users, direct chat, and fake media. | yes |
| Static fixture smoke | Keep fixture-backed or skipped call smoke as sufficient local evidence. | |
| Manual-only local validation | Rely on manual browser checks instead of deterministic automation. | |

**User's choice:** Approved recommendation.
**Notes:** Local two-account fake-media audio and video acceptance is mandatory and blocking.

---

## Production Readiness

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 14 env contract | Use existing production smoke env names and produce ready/blocked/failed artifact rows. | yes |
| Add separate Phase 15 env names | Create a parallel production smoke contract for call repair. | |
| Skip production when local passes | Treat local call acceptance as enough for production readiness. | |

**User's choice:** Approved recommendation.
**Notes:** Missing production env produces `production_blocked`, not a false readiness claim.

---

## TURN And ICE

| Option | Description | Selected |
|--------|-------------|----------|
| TURN-gated production readiness | Require working TURN env or an explicit blocked/unavailable production state. | yes |
| Accept STUN-only if it works once | Allow a successful STUN-only production run to count as ready. | |
| Ignore TURN in Phase 15 | Leave TURN evidence to a later phase. | |

**User's choice:** Approved recommendation.
**Notes:** STUN fallback is acceptable locally but not enough for production readiness.

---

## WebRTC Negotiation And Media Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Server-authoritative accept then offer | Create WebRTC offer only after server sync/connected state. | yes |
| Early offer before accept | Start peer negotiation before callee accepts. | |
| Buffer early ICE | Queue ICE candidates until peer session exists, then drain. | yes |
| Drop early ICE | Keep current behavior where ICE without a peer session is ignored. | |
| Explicit audio retry for video failure | Do not silently downgrade video to audio; require user choice. | yes |
| Silent audio fallback | Let video capture failure automatically start audio. | |

**User's choice:** Approved recommendation.
**Notes:** Current code and tests still encode silent video-to-audio fallback, so Phase 15 must change implementation and tests.

---

## Reachability And Multi-Tab Truth

| Option | Description | Selected |
|--------|-------------|----------|
| Ring all authenticated callee sockets | First accepted tab wins; other tabs sync and clean up. | yes |
| Ring one active tab only | Target a single callee socket. | |
| Truthful offline behavior | No ring or missed call when no authenticated socket received the invite. | yes |
| Fake missed call for offline peer | Create missed-call activity even when nothing was delivered. | |

**User's choice:** Approved recommendation.
**Notes:** Phase 15 must preserve Phase 13 server-authoritative multi-tab behavior and prove it with tests.

---

## Call UI Repair

| Option | Description | Selected |
|--------|-------------|----------|
| Redesign call-related surfaces as needed | Header, detail, More, overlay, disabled reasons, failure/retry, video surfaces, and cleanup states may be redesigned. | yes |
| Overlay-only patch | Limit UI work to `CallOverlay` regardless of cause. | |
| Broad chat redesign | Redesign unrelated messenger surfaces in the same phase. | |

**User's choice:** Approved recommendation.
**Notes:** `chat.tsx` may be edited only for call integration and only while preserving unrelated local work.

---

## Diagnostics, Privacy, And Security

| Option | Description | Selected |
|--------|-------------|----------|
| Sanitized diagnostics only | Record event names, codes, statuses, origins, booleans, and redacted IDs. | yes |
| Verbose WebRTC payload capture | Record SDP, ICE, device, or media details for debugging. | |
| Preserve security checks | Keep auth, direct-chat membership, block checks, stale/cross-chat rejection, and rate limits. | yes |

**User's choice:** Approved recommendation.
**Notes:** Phase 15 artifacts must not expose secrets or private call payloads.

---

## Verification Matrix

| Option | Description | Selected |
|--------|-------------|----------|
| Targeted backend plus frontend plus Playwright gates | Cover lifecycle, security, UI, local full-stack calls, production smoke/block, and messenger regressions. | yes |
| Chromium mandatory, others optional | Make Chromium fake media blocking; Firefox/WebKit optional if deterministic. | yes |
| Real-device checklist optional | Add manual mic/camera checklist as supporting evidence only. | yes |

**User's choice:** Approved recommendation.
**Notes:** Automated fake-media evidence remains the blocking gate.

---

## Artifacts And Work Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Separate failure and acceptance artifacts | Write `15-FAILURE-REPORT.md` and `15-CALL-ACCEPTANCE.md`. | yes |
| Single final summary only | Put all evidence only in the final response or plan summary. | |
| Three-wave plan | Investigation/harness; signaling/media/UI repairs; acceptance/regression/evidence. | yes |

**User's choice:** Approved recommendation.
**Notes:** The final implementation summary needs a fix-to-finding table.

---

## the agent's Discretion

- Exact helper names, fixture names, test file names, marker formats, report table shape, and selector details.
- Whether local harness orchestration uses Playwright `webServer`, npm scripts, or documented pre-run commands.
- Where to implement ICE buffering if the behavior and tests are clear.
- Exact UI copy for truthful call states and production blockers.

## Deferred Ideas

- Group calls, screen share, recording, transcription, captions, push notifications, native app calling, device picker, and broad scaling infrastructure remain outside Phase 15 unless a current deployment fact proves one is blocking the direct-call repair path.
