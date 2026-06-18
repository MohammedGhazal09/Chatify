# Phase 24: Group Message Sender Names And Group Voice/Video Calls - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-18
**Phase:** 24-group-message-sender-names-and-group-voice-video-calls
**Areas discussed:** Group message attribution, group call availability, backend group call signaling, media model, privacy and verification

---

## Group Message Attribution

| Option | Description | Selected |
|--------|-------------|----------|
| Sender labels on received group messages only | Label only non-current-user messages. | |
| Sender labels on every group message | Label all group messages, including current-user messages. | Yes |
| Rework group message layout | Change grouping/avatars/timeline in addition to labels. | |

**User's choice:** Auto-approved recommendation: sender labels on every group message.
**Notes:** The reported bug says there is no name above messages in groups. Labeling every sender is the most direct, verifiable fix and avoids a broader chat layout change.

---

## Group Call Availability

| Option | Description | Selected |
|--------|-------------|----------|
| Visual controls only | Show group call buttons but leave backend direct-only behavior. | |
| Bounded group-originated call | Enable group calls only when at least one eligible member can be reached. | Yes |
| Full conference room | Build multi-party simultaneous remote streams and room semantics. | |

**User's choice:** Auto-approved recommendation: bounded group-originated call.
**Notes:** Visual-only controls would recreate the dead-control problem. Full conference rooms are larger than the current single-peer controller/session model supports safely in one phase.

---

## Backend Group Call Signaling

| Option | Description | Selected |
|--------|-------------|----------|
| Trust client recipient list | Let frontend send member ids for group invites. | |
| Server derives recipients | Backend derives reachable non-caller members from the authorized chat. | Yes |
| New REST endpoint | Add separate HTTP endpoint for group call invitation. | |

**User's choice:** Auto-approved recommendation: server derives recipients.
**Notes:** Socket identity and membership checks are security-sensitive; the existing call socket channel is the right boundary.

---

## Media Model

| Option | Description | Selected |
|--------|-------------|----------|
| First accepted peer | One accepting group member connects through existing single-peer WebRTC path. | Yes |
| Multiple simultaneous peers | One peer connection per remote group member. | |
| Audio-only group calls | Limit group calls to audio and keep video direct-only. | |

**User's choice:** Auto-approved recommendation: first accepted peer.
**Notes:** This is the smallest coherent media model because `useCallController` and `CallOverlay` currently own one remote stream.

---

## Privacy And Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Names/usernames only | Use display names/usernames already in chat member context. | Yes |
| Include emails in tests/artifacts | Use emails to make fixture identity obvious. | |
| Skip backend tests | Treat UI tests as enough. | |

**User's choice:** Auto-approved recommendation: names/usernames only with backend and frontend verification.
**Notes:** Prior username/group phases prohibit public email exposure. Backend socket behavior is the security boundary, so backend tests are required.

---

## the agent's Discretion

- Exact helper names, payload fields, and test fixture names can be selected during planning and execution.
- The implementation can preserve direct-call payload compatibility while adding group session metadata.

## Deferred Ideas

- Full multi-party WebRTC rooms.
- Always-on voice channels.
- Call moderation and host controls.
- Hosted production/TURN readiness proof without smoke environment evidence.
