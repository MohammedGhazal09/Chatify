# Phase 13: realtime-call-and-video-implementation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 13-realtime-call-and-video-implementation
**Areas discussed:** dependency gate, session persistence, socket contract, WebRTC/ICE, permissions, frontend ownership, backend ownership, call UI, lifecycle edge cases, verification

---

## Dependency Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Hard gate dependencies | Phase 13 execution completion requires final evidence from Phases 10.1, 11, and 12. | Yes |
| Continue without gate | Treat Phase 13 as independent from delivery, block, and media/identity phases. | |

**User's choice:** Approved recommendation.
**Notes:** Calls depend on message delivery truth, block safety, and identity/media surface reliability.

---

## Call Session Storage

| Option | Description | Selected |
|--------|-------------|----------|
| CallSession metadata model | Persist safe call lifecycle metadata and use safe timeline activity records. | Yes |
| In-memory only | Keep all call lifecycle state in process memory. | |
| Message-only records | Use message system rows as the only call state source. | |

**User's choice:** Approved recommendation.
**Notes:** In-memory state is too weak for reconnect, timeout, and audit behavior. Message-only records are not enough for active session validation.

---

## Call Activity Retention

| Option | Description | Selected |
|--------|-------------|----------|
| Persist safe activity | Persist call activity rows with metadata only. | Yes |
| No history | Do not show call history in the conversation timeline. | |
| Persist signaling details | Store SDP/ICE payloads for debugging. | |

**User's choice:** Approved recommendation.
**Notes:** Users need call history, but privacy rules forbid storing signaling or media payloads.

---

## Socket Event Contract

| Option | Description | Selected |
|--------|-------------|----------|
| `call:*` namespace | Use dedicated events such as `call:start`, `call:incoming`, `call:accept`, `call:reject`, `call:end`, `call:offer`, `call:answer`, `call:ice-candidate`, `call:sync`. | Yes |
| Reuse message events | Add call payloads into existing message event names. | |

**User's choice:** Approved recommendation.
**Notes:** A dedicated event family isolates signaling, authorization, and tests.

---

## Acknowledgement Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Ack every action | Every call action receives structured server ack or error. | Yes |
| Fire and forget | UI updates optimistically without waiting for server ack. | |

**User's choice:** Approved recommendation.
**Notes:** Server ack prevents false call states, matching the reliability lessons from message delivery.

---

## Simultaneous And Multi-Tab Calls

| Option | Description | Selected |
|--------|-------------|----------|
| Server-first wins | First accepted call session wins; competing attempts return busy or sync. Ring all callee sockets; first accept/reject wins. | Yes |
| Client decides | Let caller/callee clients resolve race conditions. | |

**User's choice:** Approved recommendation.
**Notes:** Server authority avoids duplicate rings, glare, and inconsistent multi-tab state.

---

## ICE Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Backend-provided config | Backend env supplies sanitized ICE config to the frontend via endpoint or socket-ready payload. | Yes |
| Frontend env only | Put ICE configuration entirely in Vite env. | |
| Hardcoded config | Commit default STUN/TURN configuration in source. | |

**User's choice:** Approved recommendation.
**Notes:** TURN credentials must not be bundled or hardcoded in frontend source.

---

## TURN Production Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Block production readiness without TURN | Local implementation can pass, but production readiness remains blocked until TURN is configured and documented. | Yes |
| Accept STUN-only production | Treat STUN-only calls as production ready. | |

**User's choice:** Approved recommendation.
**Notes:** TURN is needed for reliable connectivity across NAT/firewall cases.

---

## WebRTC Abstraction

| Option | Description | Selected |
|--------|-------------|----------|
| Native wrapper | Use native `RTCPeerConnection` behind a focused local hook/service. | Yes |
| Add dependency now | Introduce a WebRTC helper package before implementation research proves need. | |

**User's choice:** Approved recommendation.
**Notes:** The scope is narrow enough for native APIs, and fewer dependencies reduce brownfield risk.

---

## Frontend Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Focused call controller | Add `useCallSession` or `useCallController`; keep `useChatSocket` as transport boundary. | Yes |
| Put logic in `chat.tsx` | Add WebRTC and socket handling directly to the chat route. | |
| Put listeners in components | Let header/detail/menu components own call listeners. | |

**User's choice:** Approved recommendation.
**Notes:** Keeps WebRTC state testable and prevents component-owned socket listeners.

---

## Backend Ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Socket-adjacent call helpers | Add call model/helpers and socket handlers adjacent to existing socket auth/membership logic. | Yes |
| REST-first call control | Build the feature primarily around new REST endpoints. | |
| UI-only signaling | Let clients pass call events without durable server authority. | |

**User's choice:** Approved recommendation.
**Notes:** Calls are realtime; server-side socket authority is required for busy, timeout, block, and stale-state enforcement.

---

## Permission Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Permission before invite/accept | Request required media access before sending an invite or accepting an incoming call. | Yes |
| Invite first | Ring the peer before knowing whether the caller can access media. | |

**User's choice:** Approved recommendation.
**Notes:** Prevents false incoming calls when the initiator cannot actually start media.

---

## Video Permission Failure

| Option | Description | Selected |
|--------|-------------|----------|
| Offer audio fallback | If camera fails but mic works, show recoverable error and offer audio call. | Yes |
| Fail silently | Hide the failure or leave the button inert. | |
| Send failed video invite | Ring the peer even though the caller cannot start video. | |

**User's choice:** Approved recommendation.
**Notes:** The fallback is useful without creating a false remote call state.

---

## Unsupported Browser Or Insecure Context

| Option | Description | Selected |
|--------|-------------|----------|
| Honest disabled reason | Disable controls with explicit reason across all surfaces. | Yes |
| Hide everything | Remove all call controls when unsupported. | |
| Try anyway | Let call attempts fail after click without preflight. | |

**User's choice:** Approved recommendation.
**Notes:** Honest disabled state matches existing Chatify control policy and accessibility expectations.

---

## Incoming Call Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Global overlay/banner | Incoming calls appear at route level, independent of the detail rail. | Yes |
| Detail rail only | Put incoming calls inside the right rail/drawer. | |

**User's choice:** Approved recommendation.
**Notes:** The rail must remain closable and calls must be visible outside the detail panel.

---

## Active Call Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Audio compact, video larger | Audio uses compact centered panel; video uses larger panel with preview/remote state; mobile uses full-screen overlay. | Yes |
| Same panel for all calls | Use one generic panel for audio and video. | |

**User's choice:** Approved recommendation.
**Notes:** Different media modes need different UI without broad scope creep.

---

## Active Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Essential controls only | End, mute/unmute, camera on/off for video, local preview, remote state, elapsed time. | Yes |
| Full calling suite | Add screen share, recording, captions, device picker, and mode switching. | |

**User's choice:** Approved recommendation.
**Notes:** Essential controls meet Phase 13 while avoiding new feature phases.

---

## Detail Rail During Calls

| Option | Description | Selected |
|--------|-------------|----------|
| Keep closable | Do not force-close; overlay sits above the chat surface. | Yes |
| Force-close rail | Automatically close the detail rail whenever a call begins. | |

**User's choice:** Approved recommendation.
**Notes:** Avoids trapping the user and preserves the Phase 10/11 rail close contract.

---

## Offline Recipient Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| No false missed record | Caller sees unavailable/failed; recipient gets no missed-call record unless invite reached a socket. | Yes |
| Always create missed record | Create missed-call activity for offline recipients. | |

**User's choice:** Approved recommendation.
**Notes:** Prevents false delivery or ringing claims.

---

## Block During Active Call

| Option | Description | Selected |
|--------|-------------|----------|
| End immediately | Blocking ends the active call and rejects further signaling. | Yes |
| Let active call continue | Apply block only to future calls/messages. | |

**User's choice:** Approved recommendation.
**Notes:** Phase 11 block safety must cover live call events.

---

## Call Rate Limiting

| Option | Description | Selected |
|--------|-------------|----------|
| Socket and user cooldown | Extend socket rate limits and add call-start cooldown. | Yes |
| No extra limits | Rely only on generic socket limits. | |

**User's choice:** Approved recommendation.
**Notes:** Ringing can be abused more visibly than typing or receipts.

---

## Timeline Copy

| Option | Description | Selected |
|--------|-------------|----------|
| Inline system rows | Render safe rows like missed audio call, rejected video call, call ended. | Yes |
| Normal message bubbles | Render calls as ordinary user messages. | |
| No call timeline | Do not show call history. | |

**User's choice:** Approved recommendation.
**Notes:** System rows are clear without polluting message content.

---

## Verification Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Full layered proof | Backend socket tests, frontend mocked media/RTC tests, Playwright fake-media smoke, lint, build, fixture guards. | Yes |
| Unit tests only | Skip browser smoke. | |
| Manual only | Rely on manual browser testing. | |

**User's choice:** Approved recommendation.
**Notes:** WebRTC browser behavior and permission states need browser-level proof.

---

## Production Acceptance Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Defer final live acceptance to Phase 14 | Phase 13 records deploy readiness and blockers; Phase 14 proves live Vercel/Render acceptance. | Yes |
| Require Phase 13 live production pass | Block Phase 13 on full deployed acceptance. | |

**User's choice:** Approved recommendation.
**Notes:** The roadmap assigns final live acceptance to Phase 14, and TURN/deploy access may block honest live proof.

---

## the agent's Discretion

- Exact helper, model, route, hook, component, socket payload, and test file names.
- Whether ICE config is delivered by HTTP endpoint, socket-ready payload, or both.
- Whether call activity records render from a system message subtype or separate activity projection.
- Exact user-facing copy for call states, permission errors, busy/offline states, and block endings.

## Deferred Ideas

- Group calls.
- Screen share.
- Recording.
- Transcription, captions, or AI call summaries.
- Push notifications or native background calling.
- Device picker.
- Mid-call audio/video upgrade or downgrade.
- E2EE media.
- Call analytics dashboard.
- Final deployed Vercel/Render acceptance, owned by Phase 14.
