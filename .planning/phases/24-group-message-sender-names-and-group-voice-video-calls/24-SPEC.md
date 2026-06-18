# Phase 24: Group Message Sender Names And Group Voice/Video Calls - Specification

**Created:** 2026-06-18
**Ambiguity score:** 0.15 (gate: <= 0.20)
**Requirements:** 5 locked

## Goal

Group conversations show a sender name above every text message and expose working voice/video call controls that can start an authenticated group-originated call without dead controls.

## Background

Phase 22 delivered private group conversations and intentionally kept group call/video controls hidden or honestly disabled until a separate group call phase existed. The current call stack is direct-chat first: the frontend call controller returns "Calls are available only in direct chats" for group chats, and the backend call session state rejects group chats as `not_direct_chat`. The current frontend call state and WebRTC session model own one peer connection and one remote media stream, so this phase must be explicit about the first group-call increment.

Group messages also need attribution. In group threads, message bubbles must identify the sender above the message so participants can tell who sent each message without relying on alignment or context.

## Requirements

1. **Group sender labels**: Every normal group message renders a readable sender name above the bubble.
   - Current: Group message bubbles can render without a visible sender name above the message.
   - Target: Each group message shows the sender's display name from chat members, including the current user's own messages, with a fallback when the sender is not in the loaded member list.
   - Acceptance: A focused component test renders a group message from a member and asserts the sender name is visible above the bubble.

2. **Group-originated call controls**: Group conversations expose audio and video call controls only when a real call start can be attempted.
   - Current: The call controller marks all group chats unavailable with "Calls are available only in direct chats."
   - Target: Group chats can start audio/video calls when the user is authenticated, the socket is connected, the conversation is active, WebRTC is supported, and at least one other group member is reachable.
   - Acceptance: Frontend tests prove group audio/video controls become enabled for an eligible group chat and remain unavailable with a concrete reason when no eligible members are reachable.

3. **Authenticated group call signaling**: Starting a group call from a group chat rings eligible online group members through the existing socket-authenticated call channel.
   - Current: Backend call start computes a single direct-chat callee and rejects group chats.
   - Target: Backend call start accepts authorized group chats, records a session tied to the group, delivers incoming call events to reachable non-caller group members, and rejects outsiders or chats with no reachable callees.
   - Acceptance: Backend socket tests prove a group caller receives a successful `call:start` ack, reachable group members receive `call:incoming`, outsiders cannot start calls, and empty/unreachable groups fail with `callee_unavailable`.

4. **Single answered media peer for this phase**: The first eligible group member who accepts becomes the active media peer for the session.
   - Current: The WebRTC controller supports one peer connection and one remote stream.
   - Target: Group-originated calls use the existing single-peer media path after one member accepts; other multi-party conference semantics are not claimed in this phase.
   - Acceptance: Tests prove the accepting group member can accept the call, the caller receives the accepted session, and later stale accepts are rejected or no-op according to the existing single-session rules.

5. **Honest call-state and history behavior**: Group call failures and terminal states do not create misleading UI or private-data leaks.
   - Current: Direct call activity messages store caller/callee and group calls are rejected before activity creation.
   - Target: Group call activity remains compatible with the existing call activity UI and does not expose emails or raw private identifiers in user-facing copy.
   - Acceptance: Call activity serialization and UI tests continue to pass for direct calls, group call sessions serialize only member ids already present in the chat context, and generated UI copy uses names/generic call labels rather than email.

## Boundaries

**In scope:**
- Sender name rendering above normal group message bubbles.
- Frontend group call availability logic for audio and video controls.
- Backend socket/session support for starting an authorized group-originated call from a group chat.
- Incoming group call delivery to reachable online group members.
- One answered media peer per group-originated session, using the current single-peer WebRTC controller.
- Focused frontend/backend tests and local lint/build verification.

**Out of scope:**
- Full multi-party conference rooms with multiple simultaneous remote streams - the existing frontend controller and session model are single-peer and need a separate larger phase for multi-peer media.
- Persistent voice rooms or always-on channels - Phase 22 explicitly excluded Slack/Discord-style voice rooms.
- TURN/provider readiness or hosted production call readiness - existing Phase 14 and Phase 15 blockers still require separate smoke environments.
- Group admin/moderation controls for calls - no requirement currently defines call moderation.
- Email exposure or contact-discovery changes - username/privacy boundaries are already owned by earlier phases and must not be expanded here.

## Constraints

- Preserve existing direct one-to-one call behavior and tests.
- Preserve the React/Vite frontend, Express/Mongoose backend, Socket.IO transport, TanStack Query, Zustand, Tailwind, and existing npm package layout.
- Do not overwrite unrelated local work, especially `Frontend/Chatify/src/pages/chat/chat.tsx`.
- Socket call actions must remain cookie-authenticated and membership-scoped.
- UI must not show enabled call controls when the next action cannot reach any eligible recipient.
- Do not claim production or TURN readiness without the required smoke environment evidence.

## Acceptance Criteria

- [ ] Group message bubbles render the sender display name above every normal group message.
- [ ] Group call controls are enabled for eligible group chats and disabled with concrete reasons for ineligible group chats.
- [ ] Backend `call:start` accepts authorized group chats and rings reachable non-caller members.
- [ ] Backend rejects unauthorized group call starts and group starts with no reachable recipients.
- [ ] A group-originated call can be accepted by one recipient and continue through the existing single-peer media signaling path.
- [ ] Direct chat call behavior remains covered and passing.
- [ ] Local frontend lint and build pass, or failures are recorded with phase-relevant detail.
- [ ] Hosted/provider call readiness is not claimed without smoke/TURN evidence.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.90  | 0.75  | PASS   | Locks sender labels and group-originated call availability. |
| Boundary Clarity    | 0.85  | 0.70  | PASS   | Full multi-party rooms and provider readiness excluded. |
| Constraint Clarity  | 0.78  | 0.65  | PASS   | Preserves single-peer media and authenticated socket boundary. |
| Acceptance Criteria | 0.84  | 0.70  | PASS   | Criteria map to frontend/backend tests and build checks. |
| **Ambiguity**       | 0.15  | <=0.20| PASS   | Gate passed after auto-approved recommendations. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today for group messages and calls? | Group messaging exists; calls are blocked in groups by frontend and backend direct-chat gates. |
| 2 | Simplifier | What is the smallest honest group call increment? | Group-originated calls ring eligible online members, with one accepting media peer in this phase. |
| 3 | Boundary Keeper | What is not included? | Full conference rooms, voice rooms, production readiness, and call moderation are out of scope. |
| 4 | Failure Analyst | What would make the phase unacceptable? | Dead controls, unauthorized signaling, email leaks, or claims of multi-party/provider readiness without evidence. |
| 5 | Seed Closer | How should unanswered details be resolved? | Prefer authenticated, testable behavior over visual-only controls; preserve direct-call compatibility. |

---

*Phase: 24-group-message-sender-names-and-group-voice-video-calls*
*Spec created: 2026-06-18*
*Next step: $gsd-discuss-phase 24 - implementation decisions*
