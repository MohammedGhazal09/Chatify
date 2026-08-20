# Phase 35 Discussion Log

## 2026-06-20

- Decision: Extend `Sessions` as the source of truth.
  - Recommendation: avoid a parallel device table until there is a real trusted-device or push-device requirement.
- Decision: Use safe device labels and metadata hashes.
  - Recommendation: never show raw IP addresses or user-agent strings in the UI.
- Decision: Validate session id claims for new access tokens.
  - Recommendation: legacy access tokens without a session id can expire naturally; new tokens should be session-bound.
- Decision: Put management in Settings.
  - Recommendation: users already manage account-adjacent controls there, and this avoids another top-level route.
