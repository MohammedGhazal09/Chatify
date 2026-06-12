# Phase 10: Production Messenger Reality Audit And Fixture Removal - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 10-production-messenger-reality-audit-and-fixture-removal
**Areas discussed:** Production smoke and evidence model, Fixture and static runtime guardrails, Desktop and mobile detail panel control, Server-truth detail surfaces and honest controls, Delivery reliability baseline handoff, Verification and repository hygiene

---

## Production Smoke And Evidence Model

| Option | Description | Selected |
|--------|-------------|----------|
| Automated only | Use live Playwright smoke as the only evidence source. | |
| Manual only | Use human audit notes and screenshots without repeatable automation. | |
| Hybrid automated plus manual | Use opt-in live Playwright for repeatable checks and manual notes for production context that is hard to automate. | yes |

**User's choice:** Approved recommendation.
**Notes:** Smoke credentials and URLs are environment-driven. Live production smoke must not mock auth, chat, message, attachment, or Socket.IO traffic. Evidence goes into `10-PRODUCTION-AUDIT.md`.

---

## Fixture And Static Runtime Guardrails

| Option | Description | Selected |
|--------|-------------|----------|
| Source guard only | Extend static fixture leak tests but do not inspect live UI output. | |
| Production smoke only | Check only the deployed UI for fake content. | |
| Source guard plus live assertions | Combine source/CSS guardrails with production smoke assertions for forbidden fake rows. | yes |

**User's choice:** Approved recommendation.
**Notes:** Guardrails should target known fixture identifiers and fake reference names, not broad terms that would create false positives.

---

## Desktop And Mobile Detail Panel Control

| Option | Description | Selected |
|--------|-------------|----------|
| Always open | Keep desktop rail permanently visible at wide widths. | |
| Default open and closeable | Match the reference layout initially but allow close, Escape, focus return, and reopen. | yes |
| Default closed | Hide the desktop detail rail until manually opened. | |

**User's choice:** Approved recommendation.
**Notes:** Desktop rail is not modal and should not trap focus. Mobile drawer keeps the current implementation model but gains regression proof for all close paths and focus return.

---

## Server-Truth Detail Surfaces And Honest Controls

| Option | Description | Selected |
|--------|-------------|----------|
| Allow placeholders | Keep static rows/cards when server data is empty. | |
| Server truth or explicit states | Render only real data, loading, empty, error, auth, membership, or socket states. | yes |
| Hide all detail sections | Remove detail surfaces until later phases. | |

**User's choice:** Approved recommendation.
**Notes:** Unsupported controls remain disabled or hidden. Header details opens the rail/drawer; in-panel More, call, video, favorite, and voice remain unavailable until their owning phases.

---

## Delivery Reliability Baseline Handoff

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in Phase 10 | Repair duplicate sends and realtime receive while doing production fixture cleanup. | |
| Document and defer to Phase 10.1 | Reproduce and record the defects, then repair in the dedicated reliability phase. | yes |
| Ignore in Phase 10 | Leave delivery defects out of the audit. | |

**User's choice:** Approved recommendation.
**Notes:** Phase 10 must not claim delivery reliability while duplicate-send, false delivered state, or recipient refresh defects remain.

---

## Verification And Repository Hygiene

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal source scan | Only scan code for fixture strings. | |
| Focused frontend plus production smoke | Run focused frontend tests, fixture guard, lint, build, local Playwright quality checks, and opt-in production smoke. | yes |
| All backend and frontend tests always | Require full backend/frontend suites even if backend code is untouched. | |

**User's choice:** Approved recommendation.
**Notes:** Backend tests are required if backend code changes. Preserve unrelated dirty files and stage only focused Phase 10 artifacts/source changes plus normal GSD state updates.

---

## the agent's Discretion

- Exact production smoke spec/config names.
- Exact screenshot and trace filenames under the Phase 10 directory.
- Exact implementation placement for local desktop rail state, provided query/socket ownership boundaries stay intact.
- Exact disabled-control copy, provided the UI remains truthful and accessible.

## Deferred Ideas

- Duplicate-send and realtime recipient repair: Phase 10.1.
- Block/unblock, More actions, and safety controls: Phase 11.
- Identity image editing, voice, and expanded media: Phase 12.
- Audio/video calls: Phase 13.
- Final production readiness: Phase 14.
