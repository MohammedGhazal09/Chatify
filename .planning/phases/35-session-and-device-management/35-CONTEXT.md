# Phase 35 Context

## Existing Session Code

- `Backend/Chatify/Models/sessionModel.mjs` stores refresh-token sessions.
- `Backend/Chatify/Utils/tokenCookieGenerator.mjs` issues, rotates, and revokes refresh sessions.
- `Backend/Chatify/Utils/authToken.mjs` verifies access tokens.
- `Backend/Chatify/Middlewares/protectRoutes.mjs` protects HTTP APIs.
- `Backend/Chatify/Config/socket.mjs` authenticates Socket.IO connections from the access-token cookie.
- `Frontend/Chatify/src/components/SettingsModal.tsx` is the best existing account/settings surface.

## Constraints

- Do not expose secrets, token hashes, raw user agents, raw IPs, or emails in session responses.
- Preserve existing refresh-token reuse detection and family revocation behavior.
- Keep local and production cookie behavior aligned.
- Keep UI changes inside the existing settings workflow.

## Implementation Notes

- Add request metadata capture at session issue/rotate time.
- Carry the previous session metadata across refresh rotation.
- Add active-session lookup helper shared by HTTP and socket auth.
- Add protected auth routes for list, revoke one, and revoke all.
- Add frontend API/hook and Settings section with loading/error/empty states.
