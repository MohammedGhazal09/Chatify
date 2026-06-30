# Phase 44: Per-Conversation Message Drafts - Discussion Log

> Audit trail only. Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-06-30
**Phase:** 44-per-conversation-message-drafts
**Areas discussed:** storage scope, composer lifecycle, sidebar visibility, privacy boundaries, verification

---

## Storage Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Local text drafts | Store text locally per user and chat id. | yes |
| Server-synced drafts | Persist drafts in MongoDB and sync across devices. | no |
| Full composer drafts | Persist text, attachments, voice, and reply target. | no |

**User's choice:** Approved recommended default from the global objective.
**Notes:** Local text drafts solve the core issue without new backend privacy contracts.

---

## Composer Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Hook beside selected-chat persistence | Add a focused draft hook under chat hooks. | yes |
| Inline in chat.tsx only | Keep all draft logic in the large page component. | no |
| Composer-internal persistence | Make MessageComposer own draft storage. | no |

**User's choice:** Approved recommended default from the global objective.
**Notes:** The hook approach matches existing localStorage patterns and keeps `MessageComposer` controlled.

---

## Sidebar Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Show standard draft preview | Display `Draft:` plus bounded text in conversation rows. | yes |
| Generic draft badge only | Show only that a draft exists. | no |
| No list indicator | Restore composer only. | no |

**User's choice:** Approved recommended default from the global objective.
**Notes:** Standard preview helps users find drafts. Encrypted rows remain generic to avoid plaintext in the collapsed list.

---

## Privacy Boundaries

| Option | Description | Selected |
|--------|-------------|----------|
| User-scoped key and logout cleanup | Key by user id and clear during private state cleanup. | yes |
| Global browser key | Share drafts across accounts on the same browser. | no |
| Keep drafts after logout | Preserve drafts even when session ends. | no |

**User's choice:** Approved recommended default from the global objective.
**Notes:** User isolation is required for shared browsers and private chat cleanup.

---

## Verification

| Option | Description | Selected |
|--------|-------------|----------|
| Focused hook/component tests plus visual QA | Test storage logic and visible row behavior, then inspect UI. | yes |
| Full backend/frontend integration | Add server tests too. | no |
| Visual-only verification | Skip source tests. | no |

**User's choice:** Approved recommended default from the global objective.
**Notes:** Phase 44 is frontend-local and should not touch backend routes or models.

---

## the agent's Discretion

- Exact helper names, preview length, and test fixture names may follow nearby code style.

## Deferred Ideas

- Cross-device synced drafts.
- Attachment, voice, and reply-target draft persistence.
- Spaces sidebar channel draft badges.
