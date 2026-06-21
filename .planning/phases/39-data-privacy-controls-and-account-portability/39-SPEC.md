# Phase 39: Data Privacy Controls And Account Portability - Specification

**Created:** 2026-06-21
**Ambiguity score:** 0.11 (gate: <= 0.20)
**Requirements:** 8 locked

## Goal

Authenticated users can export their authorized Chatify data and submit or cancel a scheduled account deletion request with privacy-safe retention, anonymization, and audit behavior clearly described.

## Background

Chatify already has authenticated cookie sessions, CSRF protection for unsafe API routes, per-user message visibility through `deletedFor`, authorized attachment access, encrypted conversation envelopes, active session management, notification preferences, profile/privacy controls, spaces/channels, and moderation report snapshots. No account-data export endpoint, privacy request/audit model, retention summary surface, or deletion request workflow exists today. Phase 39 adds a bounded privacy-control layer on top of those existing authorization boundaries without claiming full legal compliance, hosted-provider deletion, backup deletion, irreversible purge execution, or bulk archive delivery.

## Requirements

1. **Authorized export package**: The user can request a portable JSON export containing only data they are authorized to see.
   - Current: No export API or export UI exists.
   - Target: An authenticated export returns account profile/settings, active-session summaries, conversation metadata for chats/spaces the user belongs to, messages visible to that user, authorized attachment metadata, encrypted-message envelopes, notification preferences, and moderation records visible to that user.
   - Acceptance: Backend tests prove the export excludes non-member chats, messages hidden by `deletedFor`, deleted-for-everyone bodies, unauthorized attachment internals, password hashes, token hashes, OAuth ids, reset codes, push endpoint secrets, and other users' private profile fields.

2. **Portable media manifest**: Exported media/file data is represented as a privacy-safe manifest tied to authorized conversations.
   - Current: Attachments are stored as message summaries plus `Attachments` records and protected download routes, but no account export manifest exists.
   - Target: Export includes attachment id, message id, chat id, display name, mime type, size, kind, status, and timestamp for attachments the user can access; raw storage ids and hashes remain excluded.
   - Acceptance: Tests prove the manifest includes authorized active attachments and excludes deleted attachments, hidden messages, storage file ids, and attachment hashes.

3. **Encrypted data honesty**: Encrypted conversations are exported according to existing E2EE limitations.
   - Current: Encrypted messages store server-visible encrypted envelopes only; plaintext recovery is not supported.
   - Target: Export includes encrypted conversation metadata and encrypted payload envelopes exactly as server-held data, plus an explicit limitation note that the server cannot export decrypted plaintext or recover local keys.
   - Acceptance: Tests prove encrypted exports include ciphertext envelope metadata but no fabricated plaintext, no local secret, and no unsupported attachment export.

4. **Deletion impact preview**: The user can inspect what account deletion will remove, anonymize, retain, or leave as conversation tombstones before submitting deletion.
   - Current: No deletion preview or retention summary exists.
   - Target: A protected privacy surface returns a structured impact summary covering account fields, sessions, profile image, notification subscriptions, conversations/messages, attachments, spaces, moderation/security retention, and irreversible confirmation.
   - Acceptance: Backend and frontend tests prove the preview renders deterministic retention categories and does not expose private payloads beyond the requesting account's scope.

5. **Deletion request lifecycle**: The user can submit and cancel a deliberate pending deletion request.
   - Current: There is no self-service account deletion flow.
   - Target: A deletion request requires an authenticated, CSRF-protected, rate-limited request with explicit confirmation; it creates or returns one pending request with scheduled date, retention summary, and cancellation state. It does not immediately purge or anonymize the account in this local phase.
   - Acceptance: Tests prove duplicate requests return the existing pending request, cancellation is limited to the requesting user, cancelled requests no longer appear as pending, and no account/session/message/profile data is destructively changed by the request itself.

6. **Retention and tombstone rules**: Deletion request records clearly describe what a future deletion would remove, anonymize, retain, or leave as tombstones.
   - Current: Messages, chats, reports, sessions, and notification records have feature-specific retention behavior but no account-deletion policy.
   - Target: The pending request stores a structured retention summary for account identifiers, sessions, notification subscriptions, profile images, chats/messages, attachments, spaces/channels, encrypted records, and abuse/security exceptions.
   - Acceptance: Tests prove the retention summary is deterministic, user-visible, and stored without message text, email addresses, tokens, raw push endpoints, storage ids, or raw export payloads.

7. **Privacy-safe audit trail**: Export and deletion workflows write audit records without storing private payloads.
   - Current: Moderation reports have audit trails, but privacy export/deletion actions do not.
   - Target: Export, deletion preview, deletion submit, and deletion completion write a privacy request/audit record with actor id, action type, status, timestamps, and counts/categories only.
   - Acceptance: Tests prove audit records do not contain message text, attachment names when not needed, email addresses, token values, push endpoints, reset codes, OAuth ids, or raw export payloads.

8. **User-facing privacy controls**: The frontend exposes export, deletion preview, retention copy, and deletion confirmation from the authenticated settings/privacy area.
   - Current: Settings includes profile, presence, notification, and session controls but no account portability/deletion controls.
   - Target: Authenticated users can download/export JSON, view retention/deletion impact, and submit deletion confirmation from a clear settings surface with loading/error/success states.
   - Acceptance: Frontend tests cover export request, download/error state, preview categories, confirmation validation, deletion success handoff, and no private data leakage in rendered copy.

## Boundaries

**In scope:**
- Authenticated JSON export endpoint and frontend download flow.
- Authorized account, chat, message, attachment-manifest, encrypted-envelope, moderation-visible, notification-preference, session-summary, and space/channel export data.
- Structured deletion/retention preview.
- Pending self-service deletion request creation, idempotent duplicate handling, cancellation, scheduled date, and retention/anonymization/tombstone summary.
- Documentation of future deleted-account tombstone behavior for retained conversations without executing destructive purge in this phase.
- Privacy request/audit records with redacted metadata.
- Focused backend and frontend tests plus lint/build/ops verification.

**Out of scope:**
- Legal compliance certification or jurisdiction-specific policy language - this phase implements product controls, not legal advice.
- Backup erasure guarantees - backup retention requires infrastructure/provider policy outside this local app scope.
- Bulk ZIP archives, async export delivery, or email delivery of exports - JSON download is the bounded portable format for this phase.
- Admin privacy-request operations - Phase 40 owns moderation/reviewer operations.
- Cross-device E2EE key backup or plaintext recovery - Phase 36 explicitly does not support server-side encrypted plaintext recovery.
- Immediate destructive deletion/anonymization execution - this phase records and audits deletion intent; purge execution requires operational approval and retention jobs.
- Hard-deleting all messages from other participants' conversations - conversation integrity and abuse/security retention require tombstones.

## Constraints

- All unsafe privacy routes must be authenticated and CSRF-protected.
- Export and deletion submit routes must be rate-limited.
- Export list data must remain bounded and use existing authorization filters; no unbounded "all database data" query is allowed.
- Audit/log output must be count/category based and must not store export payloads or user-identifying secrets.
- Deletion requests must not mutate account/session/message/profile data beyond privacy request records in this local phase.
- Frontend UI must live inside the existing Settings/privacy experience and preserve current React/Vite/TanStack Query patterns.

## Acceptance Criteria

- [ ] Export returns only the requesting user's authorized account, conversation, message, attachment-manifest, encrypted-envelope, space/channel, notification, session-summary, and moderation-visible data.
- [ ] Export excludes secrets and private fields: password hashes, token hashes, reset codes, OAuth ids, push endpoint secrets, storage ids, attachment hashes, unauthorized emails, and hidden/deleted message bodies.
- [ ] Encrypted messages export server-held ciphertext/envelope metadata with an explicit no-plaintext/no-key-recovery limitation.
- [ ] Deletion preview returns clear remove/anonymize/retain/tombstone/security-retention categories.
- [ ] Deletion request creates or returns one pending request per user with scheduled date, retention summary, and explicit cancellation state.
- [ ] Deletion cancellation is limited to the requester and clears the pending deletion state without destructive account mutation.
- [ ] Privacy request/audit records are created for export and deletion without storing private payloads.
- [ ] Frontend settings/privacy controls cover export, preview, confirmation validation, deletion success, and error states.
- [ ] Focused backend tests, frontend tests, lint/build, root ops checks, and Phase 39 traceability verification pass.

## Ambiguity Report

| Dimension          | Score | Min   | Status | Notes |
|--------------------|-------|-------|--------|-------|
| Goal Clarity       | 0.92  | 0.75  | met    | Export and deletion outcomes are measurable. |
| Boundary Clarity   | 0.90  | 0.70  | met    | Explicitly excludes legal certification, backup erasure, ZIP/archive delivery, admin operations, and E2EE recovery. |
| Constraint Clarity | 0.82  | 0.65  | met    | Auth, CSRF, rate limits, redaction, bounded export, and compatibility constraints are specified. |
| Acceptance Criteria| 0.88  | 0.70  | met    | Criteria are pass/fail and map to backend/frontend verification. |
| **Ambiguity**      | 0.11  | <=0.20| met    | Ready for discuss-phase. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What exists today for privacy/export/deletion? | Sessions, privacy settings, deletedFor, attachments, encrypted envelopes, moderation snapshots exist; export/deletion/privacy audit does not. |
| 2 | Simplifier | What is the minimum portable export? | Bounded JSON export plus media manifest, not ZIP/archive delivery. |
| 3 | Boundary Keeper | What deletion behavior is in scope? | Confirmed self-service anonymization/tombstone flow with session revocation and retention categories. |
| 4 | Failure Analyst | What would make the phase unsafe? | Exporting unauthorized data/secrets, deleting other participants' conversation history, or claiming E2EE plaintext recovery. |
| 5 | Seed Closer | Which gray-area recommendations were auto-approved? | Use authenticated/CSRF/rate-limited routes, redacted privacy audit, Settings privacy UI, and explicit out-of-scope legal/provider claims. |

---

*Phase: 39-data-privacy-controls-and-account-portability*
*Spec created: 2026-06-21*
*Next step: $gsd-discuss-phase 39 - implementation decisions (how to build what's specified above)*
