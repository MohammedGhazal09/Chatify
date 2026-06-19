# Phase 28 Context

## Existing Foundation

- Direct-chat blocking exists through `Backend/Chatify/Models/userBlockModel.mjs`, chat block routes, conversation controls, and UI states.
- Chat and message controllers already enforce membership boundaries for private resources.
- Username identity phases removed email-based chat discovery from public chat workflows.
- Existing CSRF middleware protects unsafe cookie-authenticated chat/message routes.

## Gap

There was no report model, no moderation route, no admin authorization boundary, and no user-facing report entry point. Blocking alone does not let users escalate abuse for maintainer review.

## Chosen Shape

Phase 28 adds a standalone moderation boundary:

- `AbuseReport` model stores reporter, target, status, redacted context, and audit trail.
- `/api/moderation/reports` accepts user, message, and conversation reports.
- `/api/moderation/reports` and `/api/moderation/reports/:id/review` admin paths require server-loaded `role`.
- Existing chat menus submit reports through a small frontend API hook.

## Constraints

- Do not expose private emails in report responses or snapshots.
- Do not trust client-supplied admin state.
- Do not promise immediate enforcement in user-facing copy.
- Phase 25 live evidence is closed by maintainer confirmation; Phase 31 should turn this API foundation into a protected admin UI and enforcement workflow.
