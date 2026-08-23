# Security Audit Phase 15 — WebRTC and Call-Signaling Security

Phase 15 validates Chatify's call authorization, signaling identity, SDP/ICE handling, STUN/TURN configuration, call-state races, call-spam controls, and call privacy against the repository's actual Socket.IO and WebRTC implementation.

## Implemented controls

### Call authorization and identity

- Socket authentication remains mandatory before any call event handler is registered.
- Every call action loads the server-owned session and revalidates chat membership and conversation-block state.
- Offer, answer, and ICE forwarding derives `fromUserId` from the authenticated socket; client-supplied actor fields are discarded.
- Signaling is accepted only after the call reaches the `connected` state. Ringing, terminal, stale, outsider, and non-selected group-recipient paths fail closed with stable error codes.

### Signaling validation

- SDP offers and answers require the expected signal type and are bounded to 128,000 characters.
- ICE candidate strings are bounded to 8,000 characters; `sdpMid` and `usernameFragment` are bounded to 256 characters; `sdpMLineIndex` is restricted to integers from 0 through 1,024.
- Only normalized signal fields are forwarded to the authorized peer.

### STUN and TURN configuration

- Only `stun:`, `stuns:`, `turn:`, and `turns:` URLs are accepted.
- Malformed schemes, control characters, invalid ports, unsupported transports, private/local literal IP addresses, local hostnames, and excessive URL lists are rejected.
- TURN usernames and credentials are required together and length-bounded.
- Generic socket readiness exposes only configuration readiness and warnings; it does not distribute reusable TURN usernames or credentials.
- Full ICE configuration is returned only through an authorized active call start, incoming-call delivery, or active-participant synchronization.
- The browser gives the active call-session configuration priority over the credential-free readiness snapshot.

### State races and abuse controls

- A unique partial MongoDB index on `participantIds` serializes active `ringing` and `connected` calls per participant.
- The pre-insert availability check preserves clear errors, while duplicate-key races are mapped to `call_busy` rather than leaking database errors.
- The critical database-index policy verifies the active-participant index at startup and in operational checks.
- Call-event rate limits are keyed by authenticated user rather than socket ID, preventing tab, reconnect, or multi-device bypass within one process.
- Existing ring timeout, first-accept group-call transition, block-triggered termination, disconnect cleanup, and call-activity idempotency remain regression-tested.

## Permanent verification

The dedicated workflow is:

- `.github/workflows/security-phase-15-call-security.yml`

It runs:

- `Backend/Chatify/test/security/phase15-call-signaling-security.test.mjs`
- adjacent call, authorization, blocking, and session-lifecycle Socket.IO suites
- `Frontend/Chatify/src/hooks/useCallController.test.tsx`
- `Frontend/Chatify/src/hooks/useCallController.ice-config-security.test.tsx`
- source syntax checks, production dependency audits, and patch-hygiene validation

## Phase boundary and residual deployment requirements

This phase validates the single-process Socket.IO topology implemented by the repository. Horizontal deployment still requires a shared Socket.IO adapter and shared rate-limit state so user-scoped call limits and presence/call routing remain consistent across nodes; that belongs to the availability and infrastructure phases.

Chatify currently uses server-configured TURN credentials. Phase 15 prevents distribution before an authorized call exists, but long-lived static credentials remain reusable by an authorized participant after receipt. Production deployments with higher abuse risk should use short-lived TURN credentials issued for each call and enforce TURN-side quotas and expiry.

A pre-existing production database containing overlapping active call sessions will fail creation of the new unique partial index. That is intentional fail-closed behavior; operators must terminate or reconcile inconsistent active sessions before applying the index.
