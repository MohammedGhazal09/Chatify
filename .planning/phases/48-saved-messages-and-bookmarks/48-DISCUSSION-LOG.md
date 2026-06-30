# Phase 48: Saved Messages And Bookmarks - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 48-saved-messages-and-bookmarks
**Areas discussed:** Saved-state semantics, API shape, authorization and privacy, frontend interaction, UI direction

---

## Saved-State Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated per-user model | Store saved entries separately from messages with unique user/message state. | yes |
| Message embedded array | Store user ids on message documents. | |
| Reuse pinned messages | Treat saved messages as pinned messages with a personal filter. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Dedicated per-user state matches conversation organization patterns and avoids mutating shared message state.

---

## API Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Existing message API boundary | Add saved-message list/save/unsave under `/api/message`. | yes |
| Separate `/api/saved` router | Add a new top-level saved-message API namespace. | |
| Frontend-only local saves | Persist saved messages only in browser storage. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Existing message API already owns message visibility, context, pins, and CSRF-protected mutations.

---

## Authorization And Privacy

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse visible-message rules | Save/list only messages visible to the requester; omit hidden/deleted entries. | yes |
| Preserve saved references after deletion | Keep unavailable saved rows for deleted or hidden messages. | |
| Allow encrypted plaintext preview | Attempt to show decrypted text in saved list. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Saved state cannot bypass membership, delete-for-self, delete-for-everyone, or encrypted-message privacy boundaries.

---

## Frontend Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Message action toggle plus global dialog | Add save/unsave to message actions and list saved messages from a sidebar dialog. | yes |
| Conversation-detail-only list | Show saved messages only in the selected conversation detail rail. | |
| Dedicated route | Add a new full saved-message page. | |

**User's choice:** Auto-selected recommended default.
**Notes:** Saved messages are personal account state across conversations, so a global sidebar entry is the most direct baseline.

---

## UI Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Restrained messenger tool | Dense, quiet dialog matching existing chat surfaces and icon-forward controls. | yes |
| Large card gallery | Visual card-heavy saved-message collection. | |
| Marketing-style hero surface | New standalone saved-message route with explanatory hero copy. | |

**User's choice:** Auto-selected recommended default.
**Notes:** The UI is a repeat-use retrieval tool inside a work-focused messenger, not a discovery or promotional surface.

---

## the agent's Discretion

- Decide whether saved-message query hooks belong in `useChatQueries.ts` or a new focused hook based on import clarity.
- Choose the exact saved-list limit based on nearby pinned/shared-surface patterns.
- Keep tests focused and local to the changed message/save workflow.

## Deferred Ideas

- Saved-message tags, folders, notes, and search.
- Shared bookmarks or collections.
- Export-specific saved-message formatting.
- Saved-message reminder notifications.
