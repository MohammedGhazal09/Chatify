# Phase 11 — Uploads and attachments

Phase 11 secures Chatify’s repository-owned message-attachment and profile-image paths from request parsing through private delivery and storage deletion.

## Actual provider boundary

Chatify stores both upload classes in private MongoDB GridFS buckets:

- `chatifyAttachments`
- `chatifyProfileImages`

No active Cloudinary upload implementation is present on the audited branch. Phase 11 therefore reviews and hardens GridFS rather than adding a provider migration. The generated policy also records that no external antivirus or content-moderation scanner is executed. The implemented controls are deterministic type allowlisting, file-structure inspection, active-content and polyglot rejection, bounded resources, private response policy, and lifecycle cleanup.

## Commands

```bash
npm run security:phase11:test
npm run security:phase11:generate
npm run security:phase11:check
npm run security:phase11:reproduce
```

`security:phase11:generate` writes:

- `docs/security/audit/phase-11/upload-policy.json`
- `docs/security/audit/phase-11/upload-policy.md`

`security:phase11:check` rebuilds both documents in memory, compares them byte-for-byte with the committed copies, and fails if any source-backed exit gate is false.

`security:phase11:reproduce` records sanitized command outcomes under `.artifacts/security/phase-11/run-evidence.json`. Evidence contains command names, exit codes, durations, toolchain metadata, and file hashes only. It does not contain file bytes, filenames uploaded by users, storage identifiers, message text, credentials, cookies, or provider tokens.

## Security behavior

Accepted uploads must pass all applicable checks:

- safe, nondeceptive filename;
- allowed extension and declared MIME type;
- recognized binary signature or container;
- parsed image dimensions and pixel limit;
- no image trailing-data polyglot;
- removal of JPEG, PNG, and WebP privacy metadata;
- no active PDF actions or embedded executable content;
- valid UTF-8 text without NUL bytes;
- valid WebM or Ogg voice container;
- per-file, count, aggregate-byte, and duration limits.

Private file responses require current authorization and apply `nosniff`, a sandboxed CSP, same-origin resource policy, frame denial, and private no-store caching.

Message deletion for everyone purges its GridFS files. Chat deletion purges GridFS files, attachment metadata, and messages before the chat record is removed. Failures become nonpublic retry state and are retried by a bounded worker. Delete-for-self remains a visibility action and does not destroy shared storage.

## Residual decisions

Phase 11 does not:

- claim external malware scanning;
- add Cloudinary;
- add end-to-end encrypted attachment payloads;
- add CDN signed URLs;
- perform third-party storage or transformation quota attacks;
- execute destructive tests against production data.

These are explicit product, infrastructure, or later-phase decisions rather than hidden completion claims.
