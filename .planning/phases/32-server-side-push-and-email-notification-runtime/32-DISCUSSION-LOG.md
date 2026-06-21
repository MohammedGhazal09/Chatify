# Phase 32 Discussion Log

## Auto Mode Summary

The user approved executing target phases 32 through 41 inline from the pasted mission. Repo instructions disallow subagents, so spec, discussion, UI, planning, execution, review, and verification are handled directly in this thread.

## Decisions

| Decision | Recommendation | Rationale |
|---|---|---|
| Preference ownership | Store email/push/mute preferences on the backend; keep sound and foreground browser alerts local | External delivery must be enforceable server-side, but sound and current-tab browser alerts are per-device behavior. |
| Notification copy | Generic title/body by default, no previews in Phase 32 | Avoids leaking message text or attachment names and keeps the design compatible with future E2EE. |
| Delivery architecture | Durable outbox plus bounded processor | Provides dedupe, retry, sanitized status, and testable provider boundaries. |
| Provider verification | Dry-run provider in test/local unless real env is explicitly configured | Allows complete local evidence without storing or requesting provider secrets. |
| Message enqueue point | Enqueue only after a new message is created, not during idempotent retry repair | Preserves existing retry behavior without duplicate external delivery. |

## Questions Treated As Approved

1. Should notification previews be allowed in the first runtime phase?
   - Recommendation: no; keep `messagePreviewMode` stored but defaulted to `none`.
   - Reason: privacy and future E2EE are higher priority than convenience previews.
2. Should server-side mute reuse the local muted list?
   - Recommendation: synchronize mute IDs into server preferences while preserving local fallback.
   - Reason: the backend cannot suppress outbox jobs using localStorage-only state.
3. Should local verification require Brevo or VAPID secrets?
   - Recommendation: no; use dry-run provider outcomes and document real-secret production setup.
   - Reason: tests and CI must not depend on secret-bearing shells.
4. Should push subscription support be added now?
   - Recommendation: add the backend and frontend subscription contract with safe storage/logging, but let delivery use dry-run unless VAPID config is available.
   - Reason: this satisfies runtime plumbing without blocking local work on browser/provider setup.
