---
phase: 24
status: drafted
created_at: 2026-06-18
---

# Phase 24 Research

## Code Findings

- `Frontend/Chatify/src/pages/chat/components/MessageBubble.tsx` already receives `isGroupChat`, `members`, and `message.sender`, so sender labels can be added without changing the chat page or message API.
- `Frontend/Chatify/src/hooks/useCallController.ts` currently blocks all group chats with "Calls are available only in direct chats." This is the main frontend availability gate.
- `useCallController.ts` stores one `peer`, one `RTCPeerConnection`, and one remote stream. Full multi-party media would require a larger state model than this phase should take on.
- `Backend/Chatify/Utils/callSessionState.mjs` currently uses a required direct `calleeId`, direct-chat participant checks, and active-call queries that only consider caller/callee pairs.
- `Backend/Chatify/Config/socket.mjs` currently derives a single direct peer, emits `call:incoming` only to that peer, and forwards SDP/ICE to `getCallPeerForParticipant`.
- `Backend/Chatify/test/socket/socket.calls.test.mjs` has an explicit test that group chat calls return `not_direct_chat`; this test must change to the new Phase 24 contract.

## Recommended Implementation Path

1. Keep the sender-label change in `MessageBubble` narrow and covered by component tests.
2. Add group-aware availability helpers in the call controller without adding socket logic to UI components.
3. Extend call session persistence and serialization with backward-compatible group metadata.
4. Make the backend derive reachable group recipients from authenticated membership and online sockets.
5. Preserve the one-peer media path by assigning the first accepted group recipient as the active peer.
6. Update focused backend and frontend tests before broad lint/build verification.

## Risk Notes

- Full multi-party conferencing is out of scope; implementing it partially would create misleading UI and brittle WebRTC behavior.
- Changing `calleeId` from required to optional must preserve direct-call tests and call activity behavior.
- Incoming group calls need enough payload context for the frontend to identify the active peer after acceptance.
- Existing dirty Phase 23/local work must not be reverted or mixed into broad refactors.
