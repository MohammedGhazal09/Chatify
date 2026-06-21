# Phase 35 Research

## Findings

- Refresh-token sessions already exist and are rotated with family reuse detection.
- Logout revokes the current refresh token.
- Password reset completion revokes all refresh sessions for the user.
- Access tokens currently include `userId`, `type`, and `jti`, but not a session id.
- Socket auth currently validates access-token identity but not session revocation.
- Settings UI already has account, profile, notification, and moderation-adjacent controls.

## Recommendation

Implement session management as a narrow extension of the existing session system: metadata fields, session-bound access tokens, management endpoints, and a settings panel. Avoid exact location/risk features in this phase.
