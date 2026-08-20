# Phase 48 Visual QA

## Status

Passed after fixes.

## Scope Tested

- Local frontend via Playwright fallback under the Hercules visual QA workflow.
- Browser target: `http://127.0.0.1:4177` from the project Playwright dev server.
- Test data: mocked authenticated chat fixture with saved text and encrypted saved entries.
- Credentials: none; no live private account data used.

## Identity Evidence

- Source repo: `D:\Projects\Chatify`
- Browser runner: Playwright fallback, not legacy Hercules CLI.
- App marker: `data-testid="chat-root"` and selected chat heading `IN-8B21`.
- Artifact root: `C:\Users\saieh\.agents\artifacts\hercules-visual-qa\20260630-190234-phase48-saved-messages-127.0.0.1-4173`

## Findings

### Fixed: Duplicate direct-chat metadata

- Severity: Info
- Route/page/state: Saved messages dialog, desktop.
- Expected: Direct-chat saved rows should identify the conversation once.
- Actual: The first row repeated the same label as conversation and sender.
- Fix: Collapse metadata when sender label equals conversation title.
- Evidence after fix: `screenshots/phase48-desktop-saved-dialog.png`, `screenshots/phase48-mobile-saved-dialog.png`.

## Coverage Ledger

| Area | Route/state | Control/workflow/scenario | Expected | Evidence | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Saved indicator | Chat timeline desktop | Saved message metadata icon | Compact icon visible without displacing timestamp/status | `screenshots/phase48-desktop-initial.png` | tested | Existing mocked socket reconnect banner is out of scope. |
| Saved dialog | Desktop populated | Open saved messages | Dialog opens, count renders, rows fit | `screenshots/phase48-desktop-saved-dialog.png` | fixed | Duplicate metadata fixed. |
| Saved dialog | Desktop encrypted row | Encrypted saved preview | Generic `Encrypted message`, no plaintext | `screenshots/phase48-desktop-saved-dialog.png` | tested | Playwright also asserted plaintext absence. |
| Saved dialog | Desktop row action | Unsave from list | Row count updates and control stays stable | Playwright spec `chat-saved-messages.spec.ts` | tested | Mocked API removes row. |
| Saved dialog | Desktop row action | Jump to saved message | Dialog closes and target context is visible | Playwright spec `chat-saved-messages.spec.ts` | tested | Uses existing context route. |
| Message actions | Desktop action menu | Save message command | Save item appears and saved icon renders after mutation | `screenshots/phase48-desktop-message-actions.png` | tested | Playwright asserted post-save icon. |
| Saved dialog | Mobile populated | Sidebar shortcut opens dialog | Dialog fits viewport and controls are usable | `screenshots/phase48-mobile-saved-dialog.png` | tested | No horizontal clipping observed. |
| Saved dialog states | Unit/component | Loading, empty, error, populated, unsave error | All states render with accessible controls | `SavedMessagesDialog.test.tsx` | tested | Covered in component tests, not all screenshotted. |
| Network/console | Desktop Playwright | Failed non-socket requests and runtime errors | No unexpected failures | Playwright spec result | tested | Socket.IO intentionally aborted in fixture. |

## Visual Evidence

- `C:\Users\saieh\.agents\artifacts\hercules-visual-qa\20260630-190234-phase48-saved-messages-127.0.0.1-4173\screenshots\phase48-desktop-initial.png`
- `C:\Users\saieh\.agents\artifacts\hercules-visual-qa\20260630-190234-phase48-saved-messages-127.0.0.1-4173\screenshots\phase48-desktop-saved-dialog.png`
- `C:\Users\saieh\.agents\artifacts\hercules-visual-qa\20260630-190234-phase48-saved-messages-127.0.0.1-4173\screenshots\phase48-desktop-message-actions.png`
- `C:\Users\saieh\.agents\artifacts\hercules-visual-qa\20260630-190234-phase48-saved-messages-127.0.0.1-4173\screenshots\phase48-mobile-saved-dialog.png`

## Verification Command

`cd Frontend/Chatify; $env:HERCULES_ARTIFACT_DIR='C:\Users\saieh\.agents\artifacts\hercules-visual-qa\20260630-190234-phase48-saved-messages-127.0.0.1-4173'; npm exec -- playwright test e2e/chat-saved-messages.spec.ts --config=playwright.config.ts`

Result: passed, 2 tests.
