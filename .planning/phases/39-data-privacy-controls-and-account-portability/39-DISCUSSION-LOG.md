# Phase 39 Discussion Log

## Auto-Selected Recommendations

| Area | Recommendation | Rationale |
|------|----------------|-----------|
| Export scope | Server-authorized account export, not client-loaded chat export | Prevents missing data and blocks unauthorized records. |
| Deletion behavior | Reversible deletion request | Safer than destructive deletion without retention/job infrastructure. |
| Audit storage | Metadata/counts only | Avoids creating a second copy of private export payloads. |
| UI placement | Settings privacy/portability section | Matches existing account/privacy control surface. |
| Encrypted messages | Export encrypted envelopes and limitation metadata | Server cannot recover browser-local decrypted plaintext. |

## Deferred

- Irreversible purge, backup deletion, admin privacy queue, and legal policy language remain out of scope for this phase.
