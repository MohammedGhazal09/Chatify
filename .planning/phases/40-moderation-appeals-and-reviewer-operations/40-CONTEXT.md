# Phase 40 Context - Current Moderation Foundation

## Existing Foundation

- `Backend/Chatify/Models/abuseReportModel.mjs` stores reports, redacted context, enforcement snapshots, and audit trail entries.
- `Backend/Chatify/Controller/moderationController.mjs` supports report creation, admin listing/detail, review status updates, scoped warning/restriction/content-removal actions, and redacted serialization.
- `Backend/Chatify/Routes/moderationRouter.mjs` is mounted behind auth and CSRF in `app.mjs`; admin routes use `requireAdmin`.
- `Frontend/Chatify/src/api/moderationApi.ts`, `useModerationReports.ts`, and `pages/admin/AdminModeration.tsx` provide the protected reviewer workspace.
- Settings already hosts account, profile, notification, session, privacy, and portability controls and can host a compact user appeal surface.

## Key Constraints

- User-facing appeal endpoints must only expose the current user's enforcement outcomes.
- Admin assignment and appeal review must load admin identity server-side.
- Notes and reasons must go through existing redaction helpers.
- Operations metrics must expose counts and aging, not raw private messages or emails.
- The existing admin UI should remain a dense work surface, not a landing page.

## Risks

- Adding a separate appeals collection would require more joins and consistency handling than this phase needs.
- Surfacing raw report internals to the appealed user would leak reporter data.
- Metrics can accidentally become a data-exfiltration surface if they include report details instead of counts.
