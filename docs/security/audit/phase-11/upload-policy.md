# Chatify Security Audit — Phase 11 Upload Policy

This document is generated deterministically from the repository-owned upload implementation. Run `npm run security:phase11:generate` after changing upload surfaces and `npm run security:phase11:check` to detect drift.

## Scope and provider boundary

- Primary upload storage: **mongodb-gridfs**.
- Attachment bucket: **chatifyAttachments**.
- Profile-image bucket: **chatifyProfileImages**.
- Cloudinary detected in the runtime upload path: **no**.
- External antivirus detected: **no**.
- Implemented malware boundary: deterministic allowlisting, structure inspection, active-content rejection, and lifecycle cleanup.
- Residual decision: External antivirus or content-moderation scanning is not implemented and must not be represented as executed evidence.

## Resource limits

| Limit | Value |
| --- | ---: |
| Attachments per message | 5 |
| Per attachment | 10485760 bytes |
| Aggregate attachments | 20971520 bytes |
| Profile image | 2097152 bytes |
| Maximum image dimension | 10000 pixels |
| Maximum image pixels | 40000000 |
| Cleanup batch | 50 |
| Minimum cleanup interval | 60000 ms |

## Accepted extensions

- `.csv`
- `.docx`
- `.gif`
- `.jpeg`
- `.jpg`
- `.ogg`
- `.opus`
- `.pdf`
- `.png`
- `.txt`
- `.webm`
- `.webp`
- `.xlsx`

## Source-backed controls

| Control | Present |
| --- | --- |
| filenameAndTypeAgreement | yes |
| activeContentRejection | yes |
| polyglotRejection | yes |
| imageDimensionAndPixelLimits | yes |
| imageMetadataSanitization | yes |
| aggregateUploadLimit | yes |
| voiceContainerValidation | yes |
| privateDeliveryHeaders | yes |
| currentAuthorizationAtDelivery | yes |
| failedWriteCleanup | yes |
| messageDeletionStorageCleanup | yes |
| chatDeletionStorageCleanup | yes |
| retryableOrphanCleanup | yes |

## Exit gate

| Gate | Result |
| --- | --- |
| typeAndFilenameValidation | passed |
| activeAndPolyglotContentRejected | passed |
| resourceLimitsEnforced | passed |
| metadataPrivacyEnforced | passed |
| privateDeliveryEnforced | passed |
| lifecycleCleanupEnforced | passed |
| providerBoundaryAccurate | passed |
| malwareBoundaryAccurate | passed |

Overall result: **passed**.
