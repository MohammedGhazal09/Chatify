# Chatify Canonical Security Remediation Design

## Goal

Create one directly reviewable cumulative security branch that contains the Phase 1–17 implementation, the missing Phase 6 authorization controls, all validated fixes from the August 25, 2026 review, and an actual Phase 18 privacy/data-lifecycle implementation.

## Branch model

`security/canonical-remediation-20260825` is the sole authoritative remediation branch. It begins at the Phase 17 head. The hidden Phase 6 bundle is unpacked only through a temporary read-only export job, then converted into ordinary source commits. Temporary export, patch-application, bundle-transport, dependency-refresh, and self-writing workflows are absent from the final tree.

## Security boundaries

1. Secret exceptions bind to immutable finding content and repository location, not location alone.
2. Session metadata derives client addresses only through Express's configured proxy trust chain.
3. Authorization controls are present before database, upload, notification, Socket.IO, browser, and PWA phases.
4. Critical index verification compares complete expected option semantics, including exact partial filters.
5. Complex documents are parsed semantically or rejected; byte-regex scanning is not represented as sanitization.
6. Connected sockets are revalidated against shared database session state across processes, while local invalidation remains immediate.
7. Presence response failures always reach the global error handler and cannot leave requests open.
8. Production TURN access uses short-lived derived credentials rather than reusable global username/password pairs.
9. Socket rate-limit state is bounded and expired state is reclaimed.
10. Browser deployment policy has one canonical origin model and does not silently route to a repository-hard-coded backend.
11. Account export/deletion covers retained authentication, notification, attachment, profile-image, moderation, and lifecycle metadata with atomic worker claims and auditable retention summaries.

## Compatibility

Existing HTTP and Socket.IO payload shapes remain stable unless the old shape itself leaks or weakens a security boundary. Existing direct, group, space-channel, encrypted-message, upload, notification, calling, and PWA flows retain their tested behavior. Production configuration changes fail closed and include explicit migration errors.

## Verification

Each finding receives a focused regression test that fails against the vulnerable implementation and passes after the patch. The final immutable head must pass backend tests, frontend tests, frontend lint, production build, production dependency audits, workflow-policy checks, inherited phase checks, and a new canonical remediation workflow. No completion claim is made from focused workflows alone.
