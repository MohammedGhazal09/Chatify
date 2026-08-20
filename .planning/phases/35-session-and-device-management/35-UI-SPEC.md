# Phase 35 UI Spec

## Settings Sessions Section

- Add an Account security section in Settings.
- Show active sessions in a compact list.
- Row fields:
  - Device label.
  - Current session badge.
  - Last active approximate timestamp.
  - Created timestamp.
  - Remember-me indicator.
  - Expiry timestamp.
- Row actions:
  - Revoke for non-current sessions.
  - Current session uses existing logout behavior.
- Global action:
  - Log out everywhere.

## States

- Loading: compact skeleton or status row.
- Empty: "No active sessions" state.
- Error: recoverable retry state.
- Success: toast or inline status after revocation.

## Privacy Copy

- Do not show raw IP, precise location, browser fingerprint, full user-agent, token values, or cookie metadata.
- Use labels such as "Chrome on Windows" or "Mobile browser".
