# Phase 45 Context

## Relevant Existing System

- `Backend/Chatify/Controller/authController.mjs` owns signup/login/logout, refresh rotation, OAuth handoff, and session management.
- `Backend/Chatify/Utils/tokenCookieGenerator.mjs` issues access/refresh cookies and creates opaque refresh sessions in `Session`.
- `Backend/Chatify/app.mjs` mounts `/api/auth` behind the custom double-submit CSRF middleware.
- `Backend/Chatify/Models/userModel.mjs` already stores local/OAuth account identity and hides sensitive selected fields.
- `Frontend/Chatify/src/hooks/useAuthQuery.ts` currently assumes a successful login immediately has cookies and fetches the logged-in user.
- `Frontend/Chatify/src/pages/login/login.tsx` is the only password login UI and should become a two-step form when required.
- `Frontend/Chatify/src/components/SettingsModal.tsx` already has a Security section for active sessions and is the right surface for 2FA management.

## Security Boundaries

- Login must not issue access or refresh cookies until the second factor is verified.
- Pending 2FA challenges should be server-side, short-lived, random, hashed, and single-use.
- TOTP secrets need encryption because verification requires recovering the secret.
- Backup codes need one-way hashing and single-use consumption.
- Raw TOTP secrets, backup codes, challenge tokens, password values, and cookie metadata must not be logged.

## Recommended API Shape

- `POST /api/auth/2fa/challenge`: verify pending login challenge with TOTP or backup code.
- `GET /api/auth/2fa/status`: return enabled state and backup-code count.
- `POST /api/auth/2fa/setup`: require current password, create pending encrypted TOTP secret, return setup secret and otpauth URI once.
- `POST /api/auth/2fa/confirm`: require valid TOTP for pending secret, enable 2FA, return one-time backup codes.
- `POST /api/auth/2fa/disable`: require current password and valid TOTP/backup code, disable 2FA.
- `POST /api/auth/2fa/backup-codes/regenerate`: require current password and valid TOTP, replace backup codes and return them once.

## Open Risk

Phase 45 will implement TOTP locally with Node `crypto` to avoid a new dependency. Recommendation: treat the helper tests as blocking and keep the implementation small and RFC 6238-compatible.
