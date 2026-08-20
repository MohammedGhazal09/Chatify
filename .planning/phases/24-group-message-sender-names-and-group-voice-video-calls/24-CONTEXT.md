# Phase 24: Group Message Sender Names And Group Voice/Video Calls - Context

**Gathered:** 2026-06-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 24 makes group messages attributable and makes audio/video call entry points available from group conversations through an authenticated, bounded group-originated call flow. It does not claim full multi-party conference rooms or hosted provider readiness.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**5 requirements are locked.** See `24-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `24-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Sender name rendering above normal group message bubbles.
- Frontend group call availability logic for audio and video controls.
- Backend socket/session support for starting an authorized group-originated call from a group chat.
- Incoming group call delivery to reachable online group members.
- One answered media peer per group-originated session, using the current single-peer WebRTC controller.
- Focused frontend/backend tests and local lint/build verification.

**Out of scope (from SPEC.md):**
- Full multi-party conference rooms with multiple simultaneous remote streams.
- Persistent voice rooms or always-on channels.
- TURN/provider readiness or hosted production call readiness.
- Group admin/moderation controls for calls.
- Email exposure or contact-discovery changes.

</spec_lock>

<decisions>
## Implementation Decisions

### Group Message Attribution
- **D-01:** Render sender names above every normal message in group chats, including the current user's own messages.
- **D-02:** Resolve names from `selectedChat.members` using display name first, username second, and a neutral unknown-member fallback.
- **D-03:** Do not change message ordering, grouping, delivery status, reactions, attachments, or deletion behavior while adding the sender label.

### Group Call Availability
- **D-04:** Replace the frontend direct-chat-only availability gate with group-aware availability for group conversations.
- **D-05:** Group calls may be attempted only when the socket is connected, WebRTC is supported, conversation activity is enabled, the user is authenticated, no call is active, and at least one other group member is online/reachable.
- **D-06:** Unavailable group call controls must keep concrete accessible reasons; no enabled control may knowingly emit a call that cannot reach a recipient.

### Backend Group Call Signaling
- **D-07:** Keep all call start/accept/reject/end/sync/signaling events under the existing authenticated Socket.IO contract.
- **D-08:** Server membership, conversation activity, active-call, and stale-call checks remain authoritative; do not trust client-provided participant ids.
- **D-09:** For a group-originated start, ring reachable non-caller group members and store the delivered recipients in the call session.
- **D-10:** Reject outsiders and unreachable group starts with existing-style structured call ack errors.

### Media Model
- **D-11:** Preserve the current single-peer WebRTC controller for this phase.
- **D-12:** First accepted reachable group member becomes the active media peer; full multi-peer media requires a later phase.
- **D-13:** Existing direct-call sequencing stays intact: caller starts, callee/member accepts, server syncs connected state, caller sends offer, peer answers.

### Privacy And UI Copy
- **D-14:** User-facing group call and sender-label copy may use display names and usernames already available in chat member context.
- **D-15:** Do not expose emails, raw tokens, cookies, SDP bodies, ICE candidate strings, or private message content in UI, logs, tests, or planning artifacts.
- **D-16:** Call activity copy must remain generic or member-name based and compatible with existing message bubble call activity rendering.

### Verification
- **D-17:** Add or update focused frontend tests for group sender labels and group call availability.
- **D-18:** Add or update backend socket tests for authorized group call start, incoming delivery, outsider rejection, unreachable recipient failure, and single accepted peer behavior.
- **D-19:** Run focused tests first, then frontend lint and build. Record any blocked browser/full-stack smoke proof honestly.

### the agent's Discretion
- The implementation may choose exact helper names and payload field names if direct-call compatibility remains intact.
- The frontend may use existing presence data or server ack fallback for reachability, but visible controls must not become dead controls.
- The backend may keep `calleeId` for direct compatibility while adding group session metadata, as long as serialization remains backward-compatible for current clients.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked Scope
- `.planning/phases/24-group-message-sender-names-and-group-voice-video-calls/24-SPEC.md` - locked Phase 24 requirements, boundaries, constraints, and acceptance criteria.
- `.planning/ROADMAP.md` - Phase 24 entry and Phase 22 note that group calls were intentionally deferred until a separate group call phase.
- `.planning/REQUIREMENTS.md` - CALL-01 through CALL-04 and V2-GRP-01 through V2-GRP-04 traceability.
- `.planning/STATE.md` - current state, deferred group-call note, production readiness blockers, and repository hygiene notes.
- `.planning/phases/22-group-conversations-with-ten-member-limit/22-CONTEXT.md` - group chat model, group-aware UI surfaces, and privacy boundary.
- `.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability/15-CONTEXT.md` - call reliability, server-authoritative sequencing, fake-media/prod readiness policy, and direct-call constraints to preserve.

### Codebase Maps
- `.planning/codebase/STACK.md` - React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, npm, Vercel, and Render stack.
- `.planning/codebase/ARCHITECTURE.md` - layered HTTP/API/query/socket architecture and anti-patterns around page-owned socket logic.
- `.planning/codebase/CONVENTIONS.md` - TypeScript, ESM, naming, imports, logging, and local style conventions.

### Backend Runtime And Tests
- `Backend/Chatify/Config/socket.mjs` - call socket handlers, reachability, timeouts, disconnect cleanup, rate limits, and signaling forwarding.
- `Backend/Chatify/Utils/callSessionState.mjs` - server-owned call lifecycle, active-call checks, participant authorization, and call activity creation.
- `Backend/Chatify/Utils/callSocketContract.mjs` - call event names, ack payloads, and structured error messages.
- `Backend/Chatify/Models/callSessionModel.mjs` - persisted call session fields and indexes.
- `Backend/Chatify/Utils/conversationControls.mjs` - direct/group conversation activity and block behavior.
- `Backend/Chatify/test/socket/socket.calls.test.mjs` - existing call lifecycle tests and current group-chat rejection test to update.

### Frontend Runtime And Tests
- `Frontend/Chatify/src/hooks/useCallController.ts` - call availability, media request, WebRTC session lifecycle, and socket action integration.
- `Frontend/Chatify/src/hooks/useChatSocket.ts` - call event routing and socket acknowledgements.
- `Frontend/Chatify/src/pages/chat/chat.tsx` - route-level call orchestration and overlay mounting; preserve unrelated local work.
- `Frontend/Chatify/src/pages/chat/components/ConversationHeader.tsx` - visible header call/video entry points.
- `Frontend/Chatify/src/pages/chat/components/ConversationDetailContent.tsx` - detail rail call/video entry points.
- `Frontend/Chatify/src/pages/chat/components/CallOverlay.tsx` - incoming/outgoing/connected call UI and remote media sink.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` - group message sender labels and call activity rows.
- `Frontend/Chatify/src/hooks/useCallController.test.tsx` - frontend call-controller behavior tests.
- `Frontend/Chatify/src/pages/chat/components/MessageBubble.test.tsx` - group sender-label component coverage.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MessageBubble.tsx` already receives `isGroupChat`, `members`, and `message.sender`; it is the correct narrow surface for sender labels.
- `useCallController.ts` already centralizes call availability, start/accept/end, setup timeout, and WebRTC state. Group call controls should be enabled from this hook rather than directly in components.
- `useChatSocket.ts` already wraps `call:*` emits and incoming event callbacks. It should remain the frontend transport boundary.
- `socket.mjs` already has authenticated `call:start`, `call:accept`, `call:reject`, `call:end`, `call:sync`, and signal forwarding handlers.
- `callSessionState.mjs` already owns session lifecycle and is the right place for participant/session model changes.

### Established Patterns
- Backend socket events use `socket.data.userId`; clients do not supply trusted participant ids.
- Chat membership checks are server-side before emitting private realtime data.
- Components receive call state/callbacks; they do not create socket connections or register direct socket listeners.
- Unavailable controls should provide honest disabled reasons, not no-op behavior.
- Production smoke/TURN readiness is opt-in and cannot be inferred from local unit tests.

### Integration Points
- Update the `useCallController` availability path for group chats.
- Extend backend session serialization and socket routing enough to carry group-originated sessions without breaking direct clients.
- Update call socket tests where they currently assert group calls are rejected as `not_direct_chat`.
- Preserve existing direct-call tests and direct-call payload compatibility.
- Avoid broad edits to `chat.tsx`; only touch route integration if the hook/component API requires it.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly reported two bugs: group messages have no name above the sender message, and voice/video calls are not available in groups.
- Recommendations were auto-approved by the mission instructions: use sender labels for all group messages, implement a bounded group-originated call path, keep one media peer in this phase, and defer full conference-room behavior.

</specifics>

<deferred>
## Deferred Ideas

- Full multi-party WebRTC rooms with multiple remote streams.
- Always-on voice channels and Discord/Slack-style voice rooms.
- Call moderation, host controls, participant kicking, and group call admin tools.
- Hosted production call readiness and TURN proof without configured smoke credentials and provider evidence.

</deferred>

---

*Phase: 24-group-message-sender-names-and-group-voice-video-calls*
*Context gathered: 2026-06-18*
