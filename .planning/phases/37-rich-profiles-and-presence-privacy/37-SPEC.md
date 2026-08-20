# Phase 37 Specification - Rich Profiles And Presence Privacy

## Objective

Add profile bio/status fields and user-controlled presence visibility without exposing private email addresses or stale presence state to unauthorized users.

## Recommendation

Implement this as a bounded profile/privacy upgrade on top of the existing username, identity mark, profile image, and presence work. Keep email private, keep profile fields text-only and length-bounded, and use the existing contact/member authorization boundary for presence snapshots and broadcasts.

## In Scope

- User model fields for public profile bio and status message.
- A profile update endpoint with validation and sanitized serialization.
- Existing presence settings extended to cover online visibility, last-seen visibility, and status visibility.
- Presence snapshots and realtime broadcasts that avoid stale online state after privacy changes.
- Block-aware contact presence lists.
- Settings UI controls for profile bio/status and presence privacy.
- Conversation detail/header surfaces that show approved public profile and status data only.
- Tests for validation, privacy filtering, stale presence prevention, frontend settings updates, and conversation surface rendering.

## Out Of Scope

- Public directory or global profile browsing.
- Rich profile links, pronouns, locations, birthdays, or external social handles.
- Per-chat presence privacy rules.
- Organization/team profile administration.
- Profile field localization beyond using ordinary UI strings.

## Acceptance Criteria

- Users can update bio and status from Settings with clear validation and save feedback.
- Profile and conversation surfaces show only approved public identity fields and never expose email addresses.
- Users can hide online status, last-seen time, and status text from other users.
- Presence snapshots and Socket.IO status updates do not leave hidden users displayed as online.
- Blocked users do not receive or fetch presence details.
- Frontend and backend tests cover profile validation, privacy settings, block-aware presence, and UI rendering.
