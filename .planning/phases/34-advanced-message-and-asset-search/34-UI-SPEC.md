# Phase 34 UI Spec

## Search Panel

- Keep the existing message search panel inside the conversation pane.
- Add compact filter controls below the search input.
- Controls:
  - Sender menu: Anyone, You, and current conversation members.
  - Type segmented control: All, Text, Links, Media, Files, Voice.
  - Date inputs: From and To.
- Keep controls stable-height and non-overlapping on mobile; wrap date inputs to a second row when needed.

## Results

- Show sender, timestamp, and a short match label.
- Preserve current snippet highlighting for text matches.
- For attachment matches, show the active attachment display name and kind.
- For link matches, show the visible URL snippet from message text.
- Keep result rows keyboard-operable.

## Jump Behavior

- Loaded results jump immediately and highlight the bubble.
- Unloaded results request the message context window, replace or merge the message cache, scroll to the target, and highlight it.
- Show a transient loading state on the selected result while context is loading.
- If the target is no longer visible, show a recoverable error and keep search open.

## Empty And Error States

- Empty filtered result copy should mention the active filters.
- Invalid filters should not crash the pane; the server error is displayed as search unavailable.
- Clearing search resets query text and filters.
