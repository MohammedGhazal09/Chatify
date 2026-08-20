# Phase 37 UI Specification

## Settings

- Add a compact Profile section in the existing Settings modal.
- Show editable bio and status fields with visible character limits and validation errors.
- Add presence privacy toggles for online status, last seen, and profile status.
- Keep account email in the signed-in account summary only; do not copy it into public profile sections.
- Save controls need loading, success, and error states.

## Conversation Header And Detail

- Show profile status where space allows and where the user permits it.
- Show bio in the conversation detail panel as contact-card text.
- Keep fallbacks concise when bio/status is absent.
- Do not show private email in direct, group, report, admin, or presence surfaces.
- Presence-hidden users should appear unavailable rather than stale online.

## Accessibility

- Text fields require labels, character-limit hints, and alert/status feedback.
- Toggles must expose pressed state and useful accessible names.
- Hidden/disabled presence copy must be screen-reader visible and not rely on color alone.

## Layout Recommendation

- Use dense Settings sections rather than a new page.
- Keep cards at the existing small radius and avoid nested card layouts.
- Avoid large display headings inside Settings; profile controls are operational, not marketing.
