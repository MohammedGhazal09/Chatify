# Phase 39 Research - Data Privacy Controls And Account Portability

## Existing Code Reality

- Backend user routes already use `protect` and CSRF middleware for mutating account/profile/privacy routes.
- Existing rate limiter patterns can be extended with a privacy workflow limiter.
- The message model already supports user-specific visibility through `deletedFor` and `deletedForEveryone`.
- The abuse report model already stores redacted report context and audit trail records.
- The frontend Settings modal is the established account/privacy/session control surface.
- A selected-conversation text export exists in `chat.tsx`, but it is not a server-authorized account export.

## Recommended Technical Shape

- Add a `PrivacyRequest` model for export/deletion/cancel audit records.
- Add user routes under `/api/user/privacy/*` to avoid a new router namespace.
- Add a privacy export serializer that allowlists fields and counts records.
- Keep deletion as a pending request with cancellation; do not remove users/messages in this phase.
- Add frontend `privacyApi`/hook helpers or extend `userApi` with privacy methods.
- Add focused backend tests for export scope, deletion idempotence, audit redaction, and encrypted message limitation.
- Add Settings component tests for user-visible controls.

## Risks

- Export can accidentally leak peer emails if it serializes full populated users. Use explicit allowlists.
- Export can accidentally include deleted-for-user messages. Filter with existing visibility rules.
- Deletion copy can overpromise irreversible deletion. Keep language accurate and scheduled.
- Audit records can become a second copy of private data. Store metadata/counts only.
