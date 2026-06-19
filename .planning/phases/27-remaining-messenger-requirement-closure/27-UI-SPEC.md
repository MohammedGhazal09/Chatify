# Phase 27 UI Spec

**Status:** No new UI surface
**Date:** 2026-06-19

## UI Scope

Phase 27 verifies and aligns existing UI behavior:

- Composer voice control: `Record voice message` / `Stop recording voice message`.
- Voice recorder tray: recording state, cancel action, preview state, remove action.
- Voice player: protected preview/download, play/pause, playback failure, retry.
- Conversation detail surfaces: shared files/media/voice empty and persisted states.
- New chat dialog: direct chat starts by `Username`, not email.

## Required States

- Voice recording unavailable: control may be disabled with `Voice recording unavailable`.
- Permission denied: recorder reports a recoverable permission message.
- Missing microphone: recorder reports a recoverable no-device message.
- Upload failure: composer keeps the failure visible and tells the user to retry before leaving the session.
- Playback failure: voice player exposes `Playback failed` plus a retry button.

## Acceptance

- UI tests must assert accessible button/link names rather than implementation-only CSS selectors.
- Browser tests must not look for the old `Voice message unavailable in this phase` placeholder.
- Mobile tests may omit the desktop-only recorder button when the current layout hides it.

## Recommendation

Keep the current compact messenger controls. Do not redesign the composer or detail rail in this phase.
