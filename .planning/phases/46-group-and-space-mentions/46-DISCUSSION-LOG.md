# Phase 46: Group And Space Mentions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 46-group-and-space-mentions
**Areas discussed:** mention semantics, conversation scope, UI behavior, privacy boundaries

---

## Mention Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Username token mentions | Mentions are created from `@username` tokens and validated against submitted user ids. | yes |
| Free text parsing only | Server infers mentions only from text with no explicit ids. | |
| Arbitrary hidden target ids | Client sends ids even when not visible in text. | |

**User's choice:** Auto-approved recommendation from full-pipeline instruction.
**Notes:** Username token mentions are easiest to verify, privacy-safe, and consistent with recent username identity phases.

---

## Conversation Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Group and space standard messages only | Direct and encrypted mentions are deferred. | yes |
| All conversation types | Mentions also work in direct chats and encrypted conversations. | |
| Space channels only | Group chat mentions wait for a later phase. | |

**User's choice:** Auto-approved recommendation from full-pipeline instruction.
**Notes:** Group and space mentions match the roadmap title while avoiding E2EE metadata leakage.

---

## UI Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Compact composer suggestions | A small member list appears for active `@` tokens and inserts `@username`. | yes |
| Separate mention modal | Open a full dialog to choose members. | |
| No suggestions | Users manually type usernames and metadata is inferred. | |

**User's choice:** Auto-approved recommendation from full-pipeline instruction.
**Notes:** Compact suggestions fit the messenger composer and avoid interrupting message flow.

---

## Privacy Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| Public snapshots only | Persist user id, username, and display name; never email. | yes |
| Full member snapshots | Persist full public profile details. | |
| User ids only | Persist ids and resolve display entirely client-side. | |

**User's choice:** Auto-approved recommendation from full-pipeline instruction.
**Notes:** Public snapshots survive reloads and sockets without leaking private auth data.

## the agent's Discretion

- Exact class names, ordering, and compact keyboard behavior.
- Focused test split.

## Deferred Ideas

- Mention notifications and counters.
- Role/everyone/channel mentions.
- E2EE mention metadata.
