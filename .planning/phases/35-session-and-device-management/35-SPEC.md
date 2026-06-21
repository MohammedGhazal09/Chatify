# Phase 35: Session And Device Management - Specification

**Created:** 2026-06-20
**Mode:** Auto-approved inline execution
**Requirements:** V2-SESS-01, V2-SESS-02, V2-SESS-03, AUTH-01, AUTH-02, SEC-02, TEST-01, TEST-03

## Goal

Let users inspect active sessions and devices, revoke individual sessions, log out everywhere, and understand recent session activity through privacy-preserving labels and notices.

## Current State

- Refresh-token rotation is already backed by `Sessions`.
- Sessions track user id, refresh token hash, family id, remember-me state, expiry, last use, revocation, and replacement hash.
- Access tokens do not currently carry a session id, so session revocation primarily affects refresh-token use.
- Socket authentication verifies the access token cookie but does not check session revocation.
- Frontend settings has account and notification controls but no active-session management surface.

## Target State

- New sessions store safe device labels and hashed request metadata.
- New access tokens carry the active session id.
- Protected HTTP requests and Socket.IO handshake reject revoked or expired sessions when a session id claim is present.
- Users can list active sessions with current-session state, safe device labels, and approximate timestamps.
- Users can revoke another session or log out everywhere.
- Frontend settings exposes active sessions without raw IP, user-agent, token, cookie, or email data.

## Recommendations

1. Extend the existing `Sessions` model instead of creating a separate device registry.
   - Rationale: refresh-token sessions are already the source of truth for durable login state.
2. Store only safe labels and hashes for request metadata.
   - Rationale: users need recognizable devices, not raw user-agent strings or IP addresses.
3. Add session id to access tokens and validate active sessions in auth boundaries.
   - Rationale: revocation should affect HTTP and socket access consistently after new tokens are issued.
4. Keep current-session revoke behavior explicit.
   - Rationale: `logout` already covers the current session; session management should avoid surprising self-kicks except for "log out everywhere".
5. Put session controls in Settings.
   - Rationale: account security belongs next to existing profile and notification settings.

## Acceptance Criteria

- [ ] Users can list active sessions with safe device labels, current-session state, created time, last-used time, expiry, and remember-me state.
- [ ] Users can revoke a non-current active session.
- [ ] Users can log out everywhere and clear current cookies.
- [ ] Revoked sessions cannot refresh, and new access tokens tied to revoked sessions are rejected by protected HTTP and Socket.IO auth.
- [ ] Session management responses do not expose raw IPs, user agents, tokens, cookie values, hashes, or email addresses.
- [ ] Backend and frontend tests cover listing, individual revocation, logout everywhere, session auth rejection, and UI states.

## Out Of Scope

- Geolocation, exact IP display, risk scoring, alert emails, trusted-device enrollment, or passkey/device-bound credentials.
- Revoking legacy access tokens that were issued before session id claims existed; they naturally expire on their normal access-token lifetime.
