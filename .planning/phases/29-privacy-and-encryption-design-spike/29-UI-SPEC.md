# Phase 29 UI Specification

No production UI changes are implemented in this phase.

## Future UI Requirements

- Encrypted conversation creation must explain that lost recovery material can make history unrecoverable.
- Device approval must be explicit and must not happen silently after password reset.
- Encrypted message notification settings must default to generic copy.
- Report flow must clearly state when decrypted evidence is being shared with maintainers.
- Search UI must distinguish local decrypted search from server-backed standard conversation search.

## Recommendation

Recommendation: do not expose an "encrypted" badge until the full send, receive, attachment, recovery, and device-verification flows pass. A partial badge would overpromise privacy.
