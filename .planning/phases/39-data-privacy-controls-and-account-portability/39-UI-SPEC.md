# Phase 39 UI Spec - Data Privacy Controls And Account Portability

## Product Surface

Add a compact "Privacy and portability" section inside Settings. It should feel like an account control panel, not a marketing page or separate privacy center.

## Layout Contract

- Place the section after existing account privacy controls and before account security/session controls.
- Use a full-width unframed settings section, matching existing Settings spacing and typography.
- Use two primary rows:
  - Export account data
  - Account deletion request
- Each row has a short label, concise explanatory copy, and a right-aligned action button on desktop.
- On narrow screens, actions wrap below copy without overlapping text.

## States

- Loading summary: show a small inline pending text, not a blocking modal.
- Export idle: button label `Export data`.
- Export pending: button label `Preparing...` with spinner and disabled state.
- Export success: inline success copy with generated filename.
- Export failure: inline error copy.
- No deletion request: button label `Request deletion`.
- Deletion pending: show scheduled date, retention summary, and `Cancel request`.
- Deletion request pending action: disabled buttons with spinner.
- Cancellation success/failure: inline status/error copy.

## Copy Rules

- Use "request deletion" and "scheduled deletion" instead of "delete account now".
- State that some abuse/security records may be retained.
- State that encrypted messages export as encrypted records when plaintext is unavailable.
- Do not display the user's email as the primary identifier in this section.
- Do not mention legal guarantees beyond product behavior.

## Visual Rules

- Keep border radius at the existing settings/card radius.
- Use `ShieldCheck`, `Download`, `Trash2`, and `RotateCcw`/spinner icons from lucide where appropriate.
- Destructive action uses existing danger text/border treatment, not a full red panel.
- Avoid nested cards.

## Accessibility

- Buttons must have stable accessible names.
- Status and error messages use `role="status"` or `role="alert"` as appropriate.
- Disabled states must retain readable contrast.
- Download action must be keyboard reachable and not depend on hover.

## Verification

- Component tests cover idle export, export success, export failure, deletion request, pending deletion state, and cancellation.
- Frontend lint and build must pass.
