# Phase 3 Secret and Credential Exposure

This evidence is sanitized. It never stores discovered credential values, value hashes, source lines, or command output.

## Scan summary

| Scope | Scanned | Bytes | Findings | Suppressed | Unsuppressed | Content SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| Current tree | 1405 | 8432777 | 10 | 0 | 10 | c24d6e60f2ceac7abc024c75bf9eac2929bc675f021453bd47ddce501ae866a2 |
| Git history | 2895 | 27924198 | 14 | 0 | 14 | bccf856ff5d918249f4e6b79cfc0cce927bc11f44283b3809bae7b02d6881136 |

## Current-tree candidates

| Candidate | Detector | Severity | Confidence | Location | State |
| --- | --- | --- | --- | --- | --- |
| sec_676fa629e0d13176e603af23 | generic-secret-assignment | high | medium | .planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-USER-SETUP.md:31:37 | open |
| sec_70599eb29cdf74e127f37fe1 | generic-secret-assignment | high | medium | .planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-USER-SETUP.md:33:37 | open |
| sec_6e0a1aec0bf7b7cb30af4b89 | generic-secret-assignment | high | medium | .planning/phases/14-production-live-acceptance-gate/14-USER-SETUP.md:38:37 | open |
| sec_2af005dafb7d95740eec9126 | generic-secret-assignment | high | medium | .planning/phases/14-production-live-acceptance-gate/14-USER-SETUP.md:40:37 | open |
| sec_62bed3622c024cc387b8e900 | bearer-token | high | medium | Backend/Chatify/test/moderation/abuse-report.test.mjs:28:55 | open |
| sec_cde570aa5b4a90ad025372cb | generic-secret-assignment | high | medium | Backend/Chatify/test/notification/notification.outbox.test.mjs:183:22 | open |
| sec_e7277ba484bab0f423116981 | generic-secret-assignment | high | medium | Backend/Chatify/test/notification/notification.preferences.test.mjs:73:18 | open |
| sec_883197b195713e847a19d63d | generic-secret-assignment | high | medium | Frontend/Chatify/e2e/chat-phase52-encrypted-recovery.spec.ts:12:27 | open |
| sec_f1e6947e764538b2182b7eef | generic-secret-assignment | high | medium | Frontend/Chatify/src/api/axios.ts:7:36 | open |
| sec_2eac94e163c1a44df6083e53 | generic-secret-assignment | high | medium | Frontend/Chatify/src/utils/encryptedMessages.ts:3:37 | open |

## Historical candidates

| Candidate | Detector | Severity | Confidence | Location | State |
| --- | --- | --- | --- | --- | --- |
| sec_aa68d024f3ce80cdfbfb71db | generic-secret-assignment | high | medium | .planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-USER-SETUP.md:31:37 | open |
| sec_e0a63fc57ceff8929e1f8318 | generic-secret-assignment | high | medium | .planning/phases/10-production-messenger-reality-audit-and-fixture-removal/10-USER-SETUP.md:33:37 | open |
| sec_88dcc40c2cf9dad1c1d2c09a | generic-secret-assignment | high | medium | .planning/phases/14-production-live-acceptance-gate/14-USER-SETUP.md:38:37 | open |
| sec_9cc1569154ba4eb69293dd2e | generic-secret-assignment | high | medium | .planning/phases/14-production-live-acceptance-gate/14-USER-SETUP.md:40:37 | open |
| sec_133198eb10920e896b4bced0 | bearer-token | high | medium | Backend/Chatify/test/moderation/abuse-report.test.mjs:27:55 | open |
| sec_a3fd3bd417181414835dfe3c | bearer-token | high | medium | Backend/Chatify/test/moderation/abuse-report.test.mjs:28:55 | open |
| sec_77eb25acbd3bb298323819dd | generic-secret-assignment | high | medium | Backend/Chatify/test/notification/notification.outbox.test.mjs:183:22 | open |
| sec_c62396a657e15c580061b766 | generic-secret-assignment | high | medium | Backend/Chatify/test/notification/notification.preferences.test.mjs:73:18 | open |
| sec_fc6be141b0c0b8c9844e6f29 | generic-secret-assignment | high | medium | Frontend/Chatify/e2e/chat-phase52-encrypted-recovery.spec.ts:12:27 | open |
| sec_d47802131df50d88a813eb7d | generic-secret-assignment | high | medium | Frontend/Chatify/src/api/axios.ts:4:36 | open |
| sec_c872e85ffe92d416bb527ee7 | generic-secret-assignment | high | medium | Frontend/Chatify/src/api/axios.ts:5:36 | open |
| sec_198716a4eb7f07a9431d2d00 | generic-secret-assignment | high | medium | Frontend/Chatify/src/api/axios.ts:6:36 | open |
| sec_391328153686ff6c3081b202 | generic-secret-assignment | high | medium | Frontend/Chatify/src/api/axios.ts:7:36 | open |
| sec_a781d1f2578b2f5abf25bfe0 | generic-secret-assignment | high | medium | Frontend/Chatify/src/utils/encryptedMessages.ts:3:37 | open |

## Secret-loading review

| Control | Result |
| --- | --- |
| Frontend secret references | 0 |
| Weak literal fallbacks | 1 |
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
| noWeakSecretFallbacks | false |
| noEnvironmentDumps | true |
| noCredentialLogging | true |
| productionValidationInstalled | true |
| distinctCryptoPurposeKeys | true |
| responseProcedureDocumented | true |

Candidates require provider-side ownership verification and rotation. The scanner does not replay credentials or make provider API calls.
