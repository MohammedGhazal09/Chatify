# Phase 45 UI Spec

## Login Challenge

- The existing login card becomes a two-step card only when the backend returns a 2FA challenge.
- Step 1 remains email, password, remember-me, social login, and forgot password.
- Step 2 shows one input for either a 6-digit authenticator code or a backup code.
- The challenge step keeps the email context but does not keep or display the password.
- Provide Back to sign in, Verify, loading, invalid-code, expired-challenge, and retry states.

## Settings Security

- Add a 2FA panel inside the existing Security section before active sessions.
- Disabled state:
  - Shows status `Off`.
  - Requires current password to start setup.
  - Shows the setup secret and otpauth URI after setup starts.
  - Requires a 6-digit code to confirm.
- Enabled state:
  - Shows status `On` and backup codes remaining.
  - Offers regenerate backup codes and disable 2FA.
  - Both actions require current password and a second-factor code.
- Backup codes:
  - Display only immediately after enable/regenerate.
  - Use monospace, wrap-safe cells, and a copy button if simple to add.
  - Clearly indicate they should be stored now, without exposing them later.

## Hardening Recommendations

- Keep controls compact and consistent with the existing Settings section.
- Use icons in action buttons where local patterns already use them.
- Handle long API messages, empty status, loading, network failure, invalid password, invalid code, and repeated clicks.
- Inputs use autocomplete hints: `current-password` for password and `one-time-code` for TOTP.
- Do not show raw setup secret after setup confirmation or modal close.
- Visual QA must cover desktop settings setup, enabled state, backup-code display, login challenge, invalid code, and mobile layout.
