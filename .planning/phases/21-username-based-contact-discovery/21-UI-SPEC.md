---
phase: 21
slug: username-based-contact-discovery
status: approved
created: 2026-06-18
---

# Phase 21 - UI Design Contract

## Design Direction

Keep the existing messenger sidebar and modal visual language. This phase changes the start-chat interaction from email to username; it must not redesign the chat shell.

## Copy

| Element | Copy |
|---------|------|
| Dialog title | New chat |
| Dialog body | Start or continue a private chat by username. |
| Field label | Username |
| Placeholder | ahmed.musa |
| Helper/error invalid | Enter a valid username. |
| Generic failure | We could not start that chat. Check the username and try again. |
| Empty sidebar CTA copy | Start a direct chat by username when you are ready to message. |
| Submit | Start or continue chat |

## Interaction Contract

- New-chat button opens the same modal and focuses the username field.
- Escape and backdrop close behavior remains unchanged.
- Client validation rejects empty or invalid username grammar before network request.
- Successful submit selects the returned chat, closes the modal, and clears the username.
- Missing/self/unauthorized failures use generic username copy.
- No email wording appears in the chat-start dialog or empty chat-start copy.

## Accessibility

- Keep `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, close-button labels, and alert role for errors.
- Username input uses `aria-invalid` and error `aria-describedby` when invalid.
- Button dimensions remain stable during loading.

## Responsive

- Keep current `max-w-sm` modal and sidebar widths.
- Text must fit at 320px width without horizontal scrolling.

## Checker Sign-Off

- Copywriting: PASS
- Visuals: PASS
- Color: PASS
- Typography: PASS
- Spacing: PASS
- Experience Design: PASS
