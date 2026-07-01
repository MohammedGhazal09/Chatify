# Phase 50 Visual QA

## Overall Status

Passed with fallback Playwright evidence after fixing two stale smoke assertions and one mobile attachment layout defect.

## Scope Tested

- Chat route: `http://127.0.0.1:4177/?chatId=phase06-chat-in-8b21&chatTheme=light|dark`.
- Admin route: `http://127.0.0.1:4177/admin/delivery-health?chatTheme=light`.
- Browser mode: Chromium through the project Playwright runner.
- Viewports: desktop `1440x900`, mobile `390x844`, admin desktop `1366x768`, admin mobile `390x844`, admin tablet RTL `768x1024`.
- Test data: mocked local users, chats, messages, attachments, and aggregate admin diagnostics only.

## Identity Evidence

- App markers: `Chatify messenger`, `IN-8B21`, `Delivery health`, and Arabic `صحة التسليم`.
- Routes: `/` and `/admin/delivery-health`.
- Port/process: Vite dev server started by `Frontend/Chatify/playwright.config.ts` on `127.0.0.1:4177`.
- Session: mocked local auth/admin and non-admin users; no production tenant or credentials used.

## Redaction Note

Screenshots use synthetic fixture identities and aggregate metrics. No real tokens, cookies, private messages, passwords, TURN credentials, or provider secrets are included.

## Findings

- Fixed stale smoke coverage that still expected email-based new-chat copy after username discovery replaced email targeting.
- Fixed stale mobile header coverage that expected the desktop audio call button to be visible on a narrow viewport.
- Fixed mobile file attachment rendering where action buttons compressed the filename to one character.

## Coverage Ledger

| Area | Route/state | Scenario | Evidence | Status |
| --- | --- | --- | --- | --- |
| Chat | desktop light | Conversation shell, message states, attachments, details rail, search reuse | `visual-qa/screenshots/08-ui-desktop-light.png` | tested |
| Chat | desktop dark | Dark theme conversation shell and attachment rendering | `visual-qa/screenshots/08-ui-desktop-dark.png` | tested |
| Chat | mobile light | Header controls, message stack, attachment chip, composer | `visual-qa/screenshots/08-ui-mobile-light.png` | tested |
| Chat | mobile dark | Dark mobile header, message stack, attachment chip, composer | `visual-qa/screenshots/08-ui-mobile-dark.png` | tested |
| Chat | mobile drawer | Conversation search filters to DS-4C9A without horizontal overflow | Playwright assertion | tested |
| Chat | direct continuation | Username-based existing conversation continuation | Playwright assertion | tested |
| Chat | URL restore/auth expired | Selected chat restore, invalid fallback, private content hidden after auth expiry | Playwright assertion | tested |
| Admin | desktop dashboard | Aggregate delivery health cards, risk row, runtime, outbox | `visual-qa/screenshots/phase49-desktop-delivery-health.png` | tested |
| Admin | desktop 7d | Window selector updates selected range and metrics | `visual-qa/screenshots/phase49-desktop-window-7d.png` | tested |
| Admin | mobile dashboard | Responsive stacked admin metrics | `visual-qa/screenshots/phase49-mobile-delivery-health.png` | tested |
| Admin | tablet RTL empty | Arabic RTL empty risk state | `visual-qa/screenshots/phase49-tablet-rtl-empty.png` | tested |
| Admin | non-admin | Permission boundary blocks diagnostics | `visual-qa/screenshots/phase49-non-admin.png` | tested |
| Admin | backend error | Recoverable diagnostics unavailable state | `visual-qa/screenshots/phase49-error.png` | tested |

## Verification Commands

- `npx playwright test e2e/chat-ui-smoke.spec.ts e2e/admin-delivery-health.spec.ts --config=playwright.config.ts` from `Frontend/Chatify` - passed 13/13.
- `npm --prefix Frontend/Chatify run test -- AttachmentPreview MessageBubble` - passed 19/19.
- `npm --prefix Frontend/Chatify run lint` - passed.
- `npm --prefix Frontend/Chatify run build` - passed.

## Runner Note

The local Hercules checkout exists at `C:\Users\saieh\Tools\testzeus-hercules`, but the available launchers require external provider configuration or a subagent-style runner. Because project instructions forbid subagents, this QA pass used the skill-approved Playwright fallback with screenshots and behavior assertions.

## Recommendation

For the real release-candidate pass, run the same visual suite after the secret-bearing production smoke is green. Local mock visual evidence is useful regression coverage, but it cannot replace live production acceptance.
