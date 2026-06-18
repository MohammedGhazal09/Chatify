---
phase: 22
status: specified
created_at: 2026-06-18
---

# Phase 22 UI Spec

## New Conversation Dialog

- Replace the single-purpose direct chat dialog with a two-mode dialog:
  - Direct
  - Group
- Use a compact segmented control at the top of the form.
- Direct mode keeps the Phase 21 username input and direct-chat submit behavior.
- Group mode includes:
  - Group name input.
  - Username input for adding members.
  - Add member button.
  - Selected username chips with remove controls.
  - Member counter: `N/10 members`, where N includes the current user.
  - Submit button labeled `Create group`.

## Validation Copy

- Missing/invalid group name: `Enter a group name.`
- Missing members: `Add at least two other members.`
- Too many members: `Groups can have up to 10 members.`
- Duplicate/self username: `Each member username must be unique.`
- Missing/blocked backend resolution: `We could not create that group. Check the usernames and try again.`

## Group Display

- Sidebar rows use group name and member count; no online dot for groups.
- Header uses group name and member count.
- Detail rail shows group member count and existing authenticated/member-only/security rows.
- Audio/video controls are disabled with group-unavailable copy.

## Accessibility

- Segmented controls must expose `aria-pressed`.
- Username chips must have accessible remove buttons.
- Errors must use `role="alert"`.
- The existing focus trap and Escape behavior must remain.

## Visual Constraints

- Keep the current dark messenger styling and compact modal dimensions.
- Do not add a marketing/landing surface.
- Avoid nested cards; chips and form rows are enough.
