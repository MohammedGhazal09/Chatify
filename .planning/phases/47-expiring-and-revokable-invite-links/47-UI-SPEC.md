# Phase 47 UI Spec: Invite Links

## Feature Summary

Invite links let authorized group admins and space managers safely grow private conversations without public discovery. The interface must make link status, expiry, max uses, copy, and revoke behavior obvious while keeping raw tokens visible only at creation time.

## Primary User Action

Create a bounded invite link, copy it, and revoke it when it should no longer work.

## Design Direction

- Color strategy: Restrained.
- Scene: A focused workspace admin is managing membership in a quiet chat surface and needs confidence that shared access can be limited and revoked.
- References: Slack private-channel invite controls, Linear admin settings density, GitHub access-token creation disclosure pattern.

## Scope

- Fidelity: production-ready.
- Breadth: invite management flow plus join route.
- Interactivity: shipped-quality React controls.
- Time intent: implement as a complete Phase 47 baseline.

## Layout Strategy

- Invite management should appear as a compact security/management panel, not a large marketing surface.
- Use existing icon buttons and modal/panel patterns.
- Emphasize current active links, expiry, usage count, and revoke action.
- The raw generated invite link should be highlighted immediately after creation with a copy action and one-time visibility copy.
- Join route should be a focused centered state surface with target name on success only after the API validates access.

## Key States

- Loading invite list.
- Empty invite list.
- Create controls with expiry and max-use presets.
- Create success with one-time raw link display.
- Copy success/failure.
- Revoke pending/success/error.
- Invite expired/revoked/exhausted invalid state.
- Already-member join success.
- Group join success.
- Space join success.
- Full group/space error.
- Unauthorized manager state hidden.
- Direct/encrypted conversation hidden state.

## Interaction Model

- Management entry point opens from group/space detail or More menu.
- Create submits expiry and max-use presets and disables while pending.
- Copy uses `navigator.clipboard` with visible feedback.
- Revoke requires an explicit button action and changes the row state after success.
- Join route calls the invite API once, then shows success with an action to open Chatify or a generic unavailable state.

## Content Requirements

- Use "Invite links" for the surface label.
- Use "Create invite link", "Copy link", "Revoke", and "Expires" labels.
- One-time link copy: "Copy this link now. It will not be shown again."
- Invalid join copy: "This invite is unavailable. Ask a manager for a new link."
- Success copy: "You joined {targetName}."
- Already-member copy: "You already have access to {targetName}."

## Accessibility Requirements

- Buttons must have accessible names.
- Copy and revoke outcomes must use `role="status"` or `role="alert"`.
- Preset controls must be native selects or segmented/radio controls with labels.
- Generated links must be selectable and not hidden behind icon-only affordances.
- Mobile layouts must avoid clipped token/link text; long links wrap or truncate with an adjacent copy button.

## Visual QA Coverage

- Desktop group invite management.
- Desktop invite join success.
- Desktop invalid invite state.
- Mobile space invite management.
- Mobile invite join success.
