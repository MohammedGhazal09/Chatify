# Phase 25 UI Spec

**Created:** 2026-06-19
**Status:** No new runtime UI surface

## Scope Decision

Phase 25 does not create or modify Chatify runtime UI. The phase exercises existing Playwright browser surfaces for production live acceptance, local call acceptance, and profile-image acceptance, then writes operational evidence artifacts.

## Existing UI Surfaces Exercised

| Surface | Source | Phase 25 Role |
|---|---|---|
| Production messenger smoke | `Frontend/Chatify/e2e/chat-production-live-acceptance.spec.ts` | Confirms deployed chat behavior only when production env is configured. |
| Local call overlay and call controls | `Frontend/Chatify/e2e/chat-calls.spec.ts` | Confirms local fake-media direct/group call readiness only when local env is configured. |
| Profile image visibility | `Frontend/Chatify/e2e/profile-picture.spec.ts` | Confirms cross-user profile-image visibility only when local profile env is configured. |

## Non-UI Artifact Surface

The only new surface is the markdown artifact `.planning/phases/25-production-evidence-closure-and-live-smoke-execution/25-PRODUCTION-EVIDENCE.md`. It is an operational evidence file, not product UI.

## Visual And UX Constraints

- Do not edit the chat page or any runtime UI component in Phase 25.
- Do not add user-facing release dashboards or banners.
- Existing smoke screenshots/traces, if produced in a configured run, are evidence only.
- Missing env must be represented as blocked evidence, not hidden in UI copy.

## Verification

- UI review should confirm no runtime UI files changed.
- If configured smoke runs produce screenshots later, review those screenshots against the existing Phase 14/15/16 acceptance criteria.

---

*Phase: 25-production-evidence-closure-and-live-smoke-execution*
