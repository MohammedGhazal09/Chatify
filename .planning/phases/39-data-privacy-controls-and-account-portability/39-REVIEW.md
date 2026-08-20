# Phase 39 Code Review - Data Privacy Controls And Account Portability

## Findings

No unresolved blocking findings remain.

## Fixed During Review

- Hardened `requestAccountDeletion` against concurrent duplicate-key races by returning the existing pending request when the unique pending-deletion index wins the race.
- Added deletion-request and cancellation CSRF regression coverage to match the export CSRF test.
- Filtered deleted attachment summaries and attachments on deleted-for-everyone messages out of privacy exports, then locked that behavior with export manifest/count regression coverage.

## Reviewed Areas

- Backend privacy export uses explicit serializers for own account data, public peer identity, spaces, chats, messages, filed reports, session summaries, attachment references, and moderation summary.
- Export excludes unauthorized chats/messages, messages hidden for the requester, deleted attachment manifest entries, peer emails, raw tokens, reset codes, push subscription endpoints, report details, moderation notes, and raw export payload persistence.
- Deletion request endpoints are authenticated, CSRF-protected, rate-limited, audited, reversible, and idempotent for existing pending requests.
- Audit records store counts, retention summaries, and action events only; they do not persist the export JSON.
- Encrypted messages export encrypted payload material and limitation copy without fabricating plaintext.

## Residual Limitations

- The actual deletion worker/anonymization job remains a later operational implementation; Phase 39 records and exposes the request/retention contract.
- Large account exports are generated synchronously in memory. A background export job with expiring downloadable artifacts is recommended before high-volume production use.
- Backup deletion timing remains provider-lifecycle-bound and is disclosed in retention copy.
- Fresh production smoke with real attachment storage credentials is still recommended before release-candidate claims.
