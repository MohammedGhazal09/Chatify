# Phase 45 Spec: Two-Factor Authentication And Backup Codes

## Goal

Local-account users can protect sign-in with time-based one-time passwords and one-time backup codes without weakening the existing cookie/session model.

## Recommended Decisions

- Use TOTP for the primary second factor. It is standards-based, offline-capable, and avoids SMS delivery risk.
- Scope Phase 45 to local password accounts. OAuth provider MFA remains provider-owned unless a later phase designs OAuth re-verification.
- Keep refresh/access session issuance unchanged after successful 2FA. The login password step creates only a short-lived pending challenge.
- Encrypt recoverable TOTP secrets at rest and hash backup codes. Raw secrets and backup codes must never be logged or returned after initial setup.
- Require the current password before setup, disabling, or regenerating backup codes. Require a valid second factor before disabling or regenerating codes when 2FA is already enabled.

## Requirements

- **V2-2FA-01**: A local-account user can set up TOTP 2FA from Settings after re-entering the current password, confirm with a valid 6-digit code, and receive backup codes exactly once.
- **V2-2FA-02**: Login for a 2FA-enabled account returns a pending challenge without setting access or refresh cookies until a valid TOTP or unused backup code is submitted.
- **V2-2FA-03**: Backup codes are single-use, stored only as hashes, and visible only immediately after generation.
- **V2-2FA-04**: Users can view 2FA status, remaining backup-code count, disable 2FA, and regenerate backup codes from Settings with password and second-factor verification.
- **V2-2FA-05**: TOTP secrets are encrypted at rest, 2FA endpoints are CSRF protected/rate limited through the existing auth route boundary, and responses/logs never expose raw secrets except the one-time setup payload.
- **V2-2FA-06**: Backend and frontend tests cover setup, challenge login, backup-code use, disable/regeneration, and UI error/loading states.

## Non-Goals

- SMS, email OTP, WebAuthn/passkeys, and device trust prompts.
- OAuth-account MFA enrollment inside Chatify.
- QR-code image generation as a required dependency. The setup UI may show the otpauth URI and secret if no QR package is added.
- Cross-device secret recovery beyond the initial setup secret and backup codes.

## Acceptance Criteria

- A non-2FA login still issues cookies and behaves as before.
- A 2FA-enabled login returns `twoFactorRequired` challenge data and no session cookies.
- A valid challenge verification issues the normal session cookies and consumes the challenge.
- Invalid challenge attempts are bounded and do not reveal account existence.
- Backup code login marks only the matched code as used and rejects reuse.
- Settings reflects enabled/disabled state and remaining backup-code count.
- Setup/disable/regenerate paths require CSRF, current password, and appropriate second-factor evidence.
- Focused backend/frontend tests, lint/build, visual QA, and code review are recorded before Phase 45 is marked complete.
