# Phase 3 Secret and Credential Exposure

This evidence is sanitized. It never stores discovered credential values, value hashes, source lines, or command output.

## Scan summary

| Scope | Scanned | Bytes | Findings | Suppressed | Unsuppressed | Content SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| Current tree | 1463 | 8822901 | 0 | 0 | 0 | bd8eed12aed28ea5101b54831f04a1e7b3311f9205fbed3d4cb38c15ef71a21b |
| Git history | 3119 | 29800537 | 6 | 6 | 0 | 5231576944ec328dccfbc1282913dd88aed36bb798c9bb208b425fb35cf34f6d |

## Current-tree candidates

No candidates detected.

## Historical candidates

| Candidate | Detector | Severity | Confidence | Location | State |
| --- | --- | --- | --- | --- | --- |
| sec_037ccc0a7047f29fc27074b3 | generic-secret-assignment | high | medium | Backend/Chatify/test/auth/phase5-authentication-security.test.mjs:98:23 | suppressed |
| sec_2d69a40e6bf4ed3a0f03c29a | generic-secret-assignment | high | medium | Frontend/Chatify/src/utils/validationSchemas.test.ts:36:18 | suppressed |
| sec_123ee46a8ff37e4b121ba5b1 | generic-secret-assignment | high | medium | Frontend/Chatify/src/utils/validationSchemas.test.ts:44:18 | suppressed |
| sec_ba995af4e5dcfc5219be0638 | generic-secret-assignment | high | medium | scripts/security/__tests__/phase3-secret-scan.test.mjs:133:39 | suppressed |
| sec_546bd95d64cad340862517ce | generic-secret-assignment | high | medium | scripts/security/temporary-phase5-runtime.mjs:1002:18 | suppressed |
| sec_1fe6944cca3a46236bd97f19 | generic-secret-assignment | high | medium | scripts/security/temporary-phase5-runtime.mjs:994:18 | suppressed |

## Secret-loading review

| Control | Result |
| --- | --- |
| Frontend secret references | 0 |
| Weak literal fallbacks | 0 |
| Environment dumps | 0 |
| Credential logging candidates | 0 |
| Startup validation installed | true |
| Distinct cryptographic-purpose keys | true |
| Credential response procedure | true |

## Exit gate

| Requirement | Passed |
| --- | --- |
| currentTreeScanCompleted | true |
| historyScanCompleted | true |
| noUnsuppressedFindings | true |
| noFrontendSecretReferences | true |
| noWeakSecretFallbacks | true |
| noEnvironmentDumps | true |
| noCredentialLogging | true |
| productionValidationInstalled | true |
| distinctCryptoPurposeKeys | true |
| responseProcedureDocumented | true |

Candidates require provider-side ownership verification and rotation. The scanner does not replay credentials or make provider API calls.
