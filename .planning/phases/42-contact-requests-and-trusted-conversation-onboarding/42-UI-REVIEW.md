# Phase 42 UI Review

## Status

Passed after one fixed finding.

## Fixed Finding

- `NewChatDialog` was rendered inside the transformed sidebar, causing its fixed overlay to be scoped to the sidebar instead of the viewport. This made the modal visually left-bound on desktop and disappear in a mobile/off-canvas state.
- Fix: render the dialog with `createPortal(..., document.body)`.
- Evidence:
  - Before: `C:\Users\saieh\.agents\artifacts\hercules-visual-qa\20260630-053949-phase42-contact-requests-127.0.0.1-5175\screenshots\before-desktop-new-chat-dialog-sidebar-scoped.png`
  - After: `C:\Users\saieh\.agents\artifacts\hercules-visual-qa\20260630-053949-phase42-contact-requests-127.0.0.1-5175\screenshots\after-desktop-new-chat-dialog.png`
  - Mobile after: `C:\Users\saieh\.agents\artifacts\hercules-visual-qa\20260630-053949-phase42-contact-requests-127.0.0.1-5175\screenshots\after-mobile-new-chat-request-sent.png`

## Notes

- Request list, request sent, invalid username, decline/cancel, and accept states were visually exercised.
- Tablet chat header title truncation is an existing responsive density concern, not introduced by this phase.
