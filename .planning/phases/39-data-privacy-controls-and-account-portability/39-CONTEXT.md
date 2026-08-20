# Phase 39: Data Privacy Controls And Account Portability - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning
**Source:** Auto-selected recommendations from SPEC.md, roadmap, privacy-by-design guidance, and codebase scout.

<domain>
## Phase Boundary

Phase 39 adds user-facing privacy controls for data export and account deletion request handling. The phase should make personal data portable and deletion intent auditable without doing irreversible account purges in this local implementation.
</domain>

<spec_lock>
## Locked Requirements

Downstream work MUST follow `.planning/phases/39-data-privacy-controls-and-account-portability/39-SPEC.md`.
</spec_lock>

<decisions>
## Implementation Decisions

### Export Scope
- Export is generated on demand from server-side authorization checks, not from client-loaded message state.
- Export includes the current user's account/profile/settings, sessions summary, chats/spaces/channels the user belongs to, visible messages, attachment metadata/download references, reports filed by the user, and user-visible enforcement summary.
- Export excludes other users' emails, password hashes, tokens, reset codes, raw cookies, raw push endpoints, provider secrets, admin-only notes, and messages hidden from the requester.

### Deletion Request
- Account deletion is a reversible request in this phase, not immediate destructive deletion.
- Pending requests include requested date, scheduled date, retention summary, anonymization/tombstone behavior, and cancel status.
- Duplicate pending requests return the existing pending request rather than creating multiple deletion jobs.

### Audit And Retention
- Use a dedicated privacy request/audit model that stores request metadata, counts, status, and retention summary.
- Do not store full export payloads in MongoDB.
- Logs and audit records use user ids and counts only; they do not include raw messages, emails, tokens, or attachment contents.

### Frontend
- Put privacy and portability controls in Settings, near existing privacy/session controls.
- Export uses a button that downloads a JSON file from the server response.
- Deletion request copy must say "request deletion" and "scheduled" rather than "delete now".
- If a deletion request is pending, show scheduled date, retention summary, and a cancel action.

### the agent's Discretion
- Use existing React Query patterns for hooks and API clients.
- Keep first UI version compact and text-heavy enough for clarity; no separate route is required.
</decisions>

<canonical_refs>
## Canonical References

Downstream agents MUST read these before planning or implementing.

### Phase Contract
- `.planning/phases/39-data-privacy-controls-and-account-portability/39-SPEC.md` - Locked Phase 39 requirements and boundaries.
- `.planning/ROADMAP.md` - Phase 39 goal, dependency, and success criteria.
- `.planning/REQUIREMENTS.md` - V2-DATA requirements plus privacy/security constraints.

### Adjacent Implementations
- `Backend/Chatify/Controller/userController.mjs` - Existing account/profile/privacy settings controller.
- `Backend/Chatify/Routes/userRouter.mjs` - Existing protected user routes and CSRF patterns.
- `Backend/Chatify/Models/userModel.mjs` - Account, profile, privacy, notification, session, and moderation fields.
- `Backend/Chatify/Models/messageModel.mjs` - Message visibility, encrypted payloads, attachments, and deletion flags.
- `Backend/Chatify/Models/abuseReportModel.mjs` - Moderation-visible reports and redacted context.
- `Frontend/Chatify/src/components/SettingsModal.tsx` - Settings UI surface for privacy controls.
- `Frontend/Chatify/src/api/userApi.ts` - Existing frontend user API client.
</canonical_refs>

<code_context>
## Reusable Assets And Patterns

- User routes already apply `protect` and mutating routes apply `csrfProtection`.
- `rateLimiters.mjs` has feature-specific limiter patterns with test skips.
- Settings already handles profile/privacy/session/notification mutations with status and error copy.
- Message visibility already uses `deletedFor`, `deletedForEveryone`, and membership checks.
- Attachment downloads are already protected by attachment id URLs; export should include metadata/download references rather than file bytes.
</code_context>

<deferred>
## Deferred Ideas

- Immediate account purge job and backup retention enforcement - requires operational approval and production retention runbooks.
- Admin privacy request queue - better aligned with Phase 40 reviewer operations.
- Machine-readable legal policy export - separate documentation/legal artifact.
</deferred>

---

*Phase: 39-data-privacy-controls-and-account-portability*
*Context gathered: 2026-06-21*
