# Phase 3 Secret and Credential Exposure

This evidence is sanitized. It never stores discovered credential values, value hashes, source lines, or command output.

## Scan summary

| Scope | Scanned | Bytes | Findings | Suppressed | Unsuppressed | Content SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| Current tree | 1405 | 8436385 | 3 | 0 | 3 | aca9b410d92f45426a669ec04f8952649468e07293a7b6fb069941cb7cb356ee |
| Git history | 2913 | 28012741 | 2 | 0 | 2 | 78dff5ca2d2de4f5fb556dd92ac8e8e84ffbc93477cf7a4e3c96f149584c86c5 |

## Current-tree candidates

| Candidate | Detector | Severity | Confidence | Location | State |
| --- | --- | --- | --- | --- | --- |
| sec_d52d2aadac6733bf4304aaa7 | generic-secret-assignment | high | medium | Backend/Chatify/.env.example:13:1 | open |
| sec_883197b195713e847a19d63d | generic-secret-assignment | high | medium | Frontend/Chatify/e2e/chat-phase52-encrypted-recovery.spec.ts:12:27 | open |
| sec_fd021d00ff1a2dc89559be57 | generic-secret-assignment | high | medium | scripts/security/__tests__/phase3-secret-scan.test.mjs:133:39 | open |

## Historical candidates

| Candidate | Detector | Severity | Confidence | Location | State |
| --- | --- | --- | --- | --- | --- |
| sec_61357386e36dc3bcec1642e9 | generic-secret-assignment | high | medium | Backend/Chatify/.env.example:13:1 | open |
| sec_fc6be141b0c0b8c9844e6f29 | generic-secret-assignment | high | medium | Frontend/Chatify/e2e/chat-phase52-encrypted-recovery.spec.ts:12:27 | open |

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
| noUnsuppressedFindings | false |
| noFrontendSecretReferences | true |
| noWeakSecretFallbacks | true |
| noEnvironmentDumps | true |
| noCredentialLogging | true |
| productionValidationInstalled | true |
| distinctCryptoPurposeKeys | true |
| responseProcedureDocumented | true |

Candidates require provider-side ownership verification and rotation. The scanner does not replay credentials or make provider API calls.
