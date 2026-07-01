---
phase: 54
created: 2026-07-01
---

# Phase 54 UI Spec

## Surface

Add an admin-only Integrations diagnostics page linked from the operations hub.

## Requirements

- Show aggregate registered apps, active installs, revoked installs, runtime access count, denied runtime count, and active scopes.
- Show a clear boundary note that message read/write and arbitrary bot execution are not enabled.
- Non-admin users see the existing restricted state pattern.
- Support English and Arabic labels.
- Verify desktop, mobile, RTL, restricted, and error states.

## Non-Goals

- No developer app creation UI in this phase.
- No marketplace, install approval UI, webhook editor, or manual token display.
