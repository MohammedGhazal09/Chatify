# Phase 14: production-live-acceptance-gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 14-production-live-acceptance-gate
**Areas discussed:** Production Gate Shape, Production Playwright Runtime, Credentials And Authentication, Live Data And Cleanup, Workflow Coverage, Evidence And Failure Policy, Commands And Scope Control

---

## Production Gate Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing Phase 10/10.1 specs | Reuse older production smoke specs and broaden them. | |
| Create one Phase 14 spec | Add one dedicated final production acceptance spec. | yes |
| Create several Phase 14 specs | Split acceptance into multiple production specs. | |

**User's choice:** Approved recommendation.
**Notes:** Create a dedicated `chat-production-live-acceptance.spec.ts` plus shared Phase 14 helper code. Evidence writes to Phase 14 artifacts, not older phase files.

---

## Production Playwright Runtime

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse current config | Keep using the local Playwright config that starts Vite. | |
| Add env-conditional config | Make the current config switch behavior based on env. | |
| Add separate production config | Add a production config with no local web server. | yes |

**User's choice:** Approved recommendation.
**Notes:** The production config must target deployed Vercel/Render origins and must not silently use local fixture routes.

---

## Credentials And Authentication

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `CHATIFY_SMOKE_*` | Keep the existing production smoke env contract. | yes |
| Rename to `CHATIFY_E2E_*` | Change variable names to a new convention. | |
| Support both | Add aliases while keeping existing names. | |

**User's choice:** Approved recommendation.
**Notes:** Reuse existing vars first. Use API login to seed two isolated browser contexts, then verify the deployed UI authenticated state.

---

## Live Data And Cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Create everything through UI | Every setup and action happens through user-visible UI. | |
| Use API setup | Prefer backend helpers for setup. | |
| UI workflows plus safe helpers | Use UI for product behavior, API only for deterministic setup/cleanup. | yes |

**User's choice:** Approved recommendation.
**Notes:** Generate unique Phase 14 markers and tiny image/text attachment fixtures. Cleanup should be best effort only for Phase 14-owned markers.

---

## Workflow Coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Full workflow on all four variants | Run every action on desktop/mobile and light/dark. | |
| Core workflow on two plus screenshots on four | Run core desktop dark and mobile light; capture all variants after interaction. | yes |
| Screenshots only | Capture visual evidence without behavior. | |

**User's choice:** Approved recommendation.
**Notes:** Include call/video fake-media checks when controls are enabled, targeted accessibility checks, block/unblock restoration, and explicit rail/drawer close/reopen checks.

---

## Evidence And Failure Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Stop on first failure | Abort as soon as a blocker is hit. | |
| Continue collecting evidence | Gather as many observations as possible, then fail if blockers exist. | yes |
| Soft assertions only | Record issues but do not fail the suite. | |

**User's choice:** Approved recommendation.
**Notes:** Collect filtered API/socket/console evidence, not full HAR or raw request bodies. Use a central static-content denylist plus live-marker allowlist.

---

## Commands And Scope Control

| Option | Description | Selected |
|--------|-------------|----------|
| Raw Playwright command only | Document a long command without package script. | |
| Add `test:e2e:prod` | Add a focused npm script for production acceptance. | yes |
| Use existing `test:ui` | Keep all Playwright commands under the local script. | |

**User's choice:** Approved recommendation.
**Notes:** Phase 14 may fix harness/reporting/config issues. Product bugs remain blockers unless a tiny fix is directly required for the gate to run.

---

## the agent's Discretion

- Choose exact helper names, Playwright fixture organization, test step names, artifact table shape, screenshot filenames, and marker formats.
- Decide whether to extend `productionSmoke.ts` or create a new Phase 14 helper module, while preserving older Phase 10 and 10.1 behavior.
- Choose exact selectors with a preference for accessible roles first and stable `data-testid` where roles are insufficient.

## Deferred Ideas

None.
