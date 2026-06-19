# Phase 28 UI Specification

## Supported User Actions

- Direct conversation menu: show `Report user`.
- Group conversation menu: show `Report conversation`.
- Received message action menu: show `Report message`.

## States

- Success: `Report sent for moderation review.`
- Failure: use backend error message when available, otherwise `Could not send this report.`
- Own message self-report: `You cannot report your own message.`

## Accessibility

- Report actions are real buttons/menuitems with accessible names.
- Existing menu focus and Escape behavior remain unchanged.
- Report actions stay available even when message activity is blocked, because reporting abuse is a safety action rather than conversation activity.

## Out Of Scope

- Report category modal.
- Admin review UI.
- Enforcement banners for restricted/reviewed outcomes.
