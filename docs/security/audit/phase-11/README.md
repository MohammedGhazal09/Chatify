# Chatify Security Audit — Phase 11 Uploads and Attachments

## Audited scope

- Repository: `MohammedGhazal09/Chatify`
- Implementation branch: `security/phase-11-upload-attachments`
- Stacked base: `security/phase-10-mongodb-data-integrity`
- Base commit: `8531f7644fbcbf2b033645d4cbcf19247e30bbc2`
- Storage implementation reviewed: MongoDB GridFS buckets for message attachments and uploaded profile images

Cloudinary is not present in the audited Phase 10 base. Phase 11 therefore hardens the repository's actual GridFS upload boundary instead of introducing an unrelated storage migration.

## Implemented controls

### File validation and active-content policy

- Extension, declared MIME type, and magic-byte/container validation are combined before storage.
- PNG, JPEG, WebP, and GIF structure and dimensions are checked.
- PNG text/EXIF/time chunks, JPEG EXIF/IPTC/comment segments, and WebP EXIF/XMP chunks are stripped before the stored bytes and hash are created.
- Images with unexpected trailing data are rejected as polyglots.
- PDFs containing JavaScript, open actions, launch actions, embedded files, rich media, or XFA are rejected.
- Text and CSV uploads reject browser-active markup and dangerous spreadsheet formulas.
- DOCX and XLSX files use a bounded ZIP central-directory parser. The parser rejects ZIP64 and multi-disk containers, encrypted entries, unsupported compression, duplicate or traversal paths, excessive entry counts, excessive expanded size, high compression ratios, external relationships, macros, embedded objects, ActiveX content, external-link parts, and DDE-style XML content.

### Size, count, and quota controls

- Maximum attachment size: 10 MiB per file.
- Maximum combined attachment size: 25 MiB per request.
- Maximum attachments per message: 5.
- Maximum profile-image size: 2 MiB.
- Multipart field, part, header-pair, and declared request-size limits are enforced.
- Per-user daily upload budgets are persisted and updated atomically so concurrent requests cannot exceed the configured byte, file, or request limits.
- Upload-budget records use a unique identity/window index and a TTL index.

The default daily budgets are:

| Purpose | Bytes | Files | Requests |
| --- | ---: | ---: | ---: |
| Message attachments | 100 MiB | 100 | 50 |
| Profile images | 20 MiB | 20 | 20 |

The defaults can be reduced or raised within bounded maximums through the documented environment variables in `Backend/Chatify/.env.example`.

### Authorization and browser delivery

- Multipart parsing occurs before body-based membership authorization, while protected message operations retain query-level chat membership constraints.
- Attachment preview and download routes conceal missing and unauthorized resources with the same private-resource response.
- Membership removal immediately prevents later attachment access.
- Protected responses enforce `private, no-store`, `nosniff`, `no-referrer`, same-origin resource policy, and a sandboxed content-security policy.
- Only allowlisted images and audio may render inline. PDFs, text files, CSV files, and Office documents are forced to download.
- The frontend no longer embeds PDFs in an iframe.
- App-owned profile images and protected media previews use credentialed CORS requests; third-party provider images and local blob previews are not forced into that mode.
- Download filenames are bounded and stripped of control, path, quote, and header-delimiter characters.

### Lifecycle and orphan cleanup

- A periodic worker deletes aged soft-deleted attachment records and their GridFS objects.
- The worker reconciles both GridFS buckets against live attachment and user references and removes stale orphaned objects after a configurable grace period.
- Worker results contain counts and timestamps only; stored filenames, content, and private metadata are not copied into evidence or logs.
- Worker timers are disabled in tests, can be disabled operationally, and do not keep the Node.js process alive by themselves.

## Verification

The permanent workflow `.github/workflows/security-phase-11-upload-security.yml` uses the exact Node.js and npm toolchain, pinned GitHub Actions, controlled dependency installation, syntax checks, focused backend and frontend regressions, production dependency audits at the high-severity threshold, and patch-hygiene validation.

The focused backend matrix covers:

- The complete Phase 11 upload contract.
- OOXML archive traversal, active-content, and decompression-bomb cases.
- The inherited Phase 10 database-security contract.
- Message attachments, protected attachment delivery, voice messages, and profile images.

The focused frontend matrix covers:

- Download-only document behavior.
- Protected image preview behavior.
- Credentialed app-owned profile-image loading.

## Phase boundary and residual risks

- This phase does not introduce a third-party malware-scanning provider. The implemented boundary uses a strict allowlist, structural validation, active-content rejection, metadata stripping, forced download for documents, quotas, and lifecycle cleanup. A provider-backed malware quarantine workflow remains a product and operations decision rather than an assumed repository control.
- Reverse-proxy slow-upload protection, provider-side storage encryption, database backups, infrastructure quotas, WAF/CDN policy, and production host limits require deployment evidence and remain assigned to the later availability, infrastructure, and backup phases.
- The upload lifecycle worker removes database orphans after a grace period; it does not claim recovery of already deleted external backups.
- This phase does not implement Phase 12 integration, webhook, email, or push-notification changes.
