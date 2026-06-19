# Phase 31 Research

## Existing Backend Surface

- `Backend/Chatify/Routes/moderationRouter.mjs` mounts `/api/moderation/reports` and `/api/moderation/reports/:reportId/review`.
- `Backend/Chatify/app.mjs` wraps moderation routes with `protect` and `csrfProtection`.
- `Backend/Chatify/Middlewares/requireAdmin.mjs` loads the persisted user role with `select("+role")`.
- `Backend/Chatify/Controller/moderationController.mjs` redacts emails, bearer tokens, secret/password/cookie values, and long token-like strings.
- `Backend/Chatify/Models/abuseReportModel.mjs` stores report status, moderation action, reviewer note, and audit trail.

## Existing Frontend Surface

- `Frontend/Chatify/src/api/moderationApi.ts` only supports report creation.
- `Frontend/Chatify/src/App.tsx` has no admin route.
- `Frontend/Chatify/src/types/auth.ts` does not include `role`.
- `Frontend/Chatify/src/pages/chat/chat.css` provides reusable theme variables for a dense internal workspace.

## Gaps

- No API read endpoint for a single report.
- No populated reporter/reported identity labels for queue rows.
- No persisted enforcement effect for stored moderation actions.
- No frontend admin page or hook for listing/reviewing reports.
- No frontend forbidden/loading/empty/error coverage for admin moderation.

## Recommended Implementation Shape

1. Extend the moderation API contract in place.
2. Add a hidden user moderation state for warning/restriction effects.
3. Block restricted users at the message-send boundary.
4. Add admin page, hook, route, and admin navigation affordance.
5. Verify with focused backend and frontend tests before full build/lint.
