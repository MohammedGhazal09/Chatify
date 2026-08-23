# Phase 4 Dependency and Supply-Chain Policy

This file is generated deterministically from package manifests, lockfiles, workflow references, and committed policy files. Live advisory, registry-signature, and SBOM evidence is stored as workflow artifacts.

## Project summary

| Project | Packages | Production | Development | Optional | Integrity | Install scripts | Deprecated direct |
| --- | --- | --- | --- | --- | --- | --- | --- |
| backend | 350 | 197 | 153 | 32 | 350/350 | 3 | 0 |
| frontend | 426 | 173 | 253 | 81 | 420/420 | 4 | 0 |

## Reviewed install scripts

| Project | Package | Lock path | Decision |
| --- | --- | --- | --- |
| backend | argon2@0.43.1 | node_modules/argon2 | allow |
| backend | fsevents@2.3.3 | node_modules/fsevents | deny |
| backend | mongodb-memory-server@11.2.0 | node_modules/mongodb-memory-server | deny |
| frontend | @tailwindcss/oxide@4.1.11 | node_modules/@tailwindcss/oxide | allow |
| frontend | esbuild@0.27.7 | node_modules/esbuild | allow |
| frontend | fsevents@2.3.2 | node_modules/playwright/node_modules/fsevents | deny |
| frontend | fsevents@2.3.3 | node_modules/fsevents | deny |

## Remote GitHub Actions

| Workflow | Line | Action | Reference | Pinned | Trusted |
| --- | --- | --- | --- | --- | --- |
| .github/workflows/security-and-test-foundation.yml | 122 | actions/upload-artifact | ea165f8d65b6e75b540449e92b4886f43607fa02 | true | true |
| .github/workflows/security-and-test-foundation.yml | 139 | actions/checkout | 11d5960a326750d5838078e36cf38b85af677262 | true | true |
| .github/workflows/security-and-test-foundation.yml | 142 | actions/setup-node | 249970729cb0ef3589644e2896645e5dc5ba9c38 | true | true |
| .github/workflows/security-and-test-foundation.yml | 159 | actions/upload-artifact | ea165f8d65b6e75b540449e92b4886f43607fa02 | true | true |
| .github/workflows/security-and-test-foundation.yml | 29 | actions/checkout | 11d5960a326750d5838078e36cf38b85af677262 | true | true |
| .github/workflows/security-and-test-foundation.yml | 32 | actions/setup-node | 249970729cb0ef3589644e2896645e5dc5ba9c38 | true | true |
| .github/workflows/security-and-test-foundation.yml | 58 | actions/checkout | 11d5960a326750d5838078e36cf38b85af677262 | true | true |
| .github/workflows/security-and-test-foundation.yml | 61 | actions/setup-node | 249970729cb0ef3589644e2896645e5dc5ba9c38 | true | true |
| .github/workflows/security-and-test-foundation.yml | 89 | actions/checkout | 11d5960a326750d5838078e36cf38b85af677262 | true | true |
| .github/workflows/security-and-test-foundation.yml | 92 | actions/setup-node | 249970729cb0ef3589644e2896645e5dc5ba9c38 | true | true |
| .github/workflows/security-phase-1-inventory.yml | 25 | actions/checkout | 11d5960a326750d5838078e36cf38b85af677262 | true | true |
| .github/workflows/security-phase-1-inventory.yml | 30 | actions/setup-node | 249970729cb0ef3589644e2896645e5dc5ba9c38 | true | true |
| .github/workflows/security-phase-1-inventory.yml | 51 | actions/upload-artifact | ea165f8d65b6e75b540449e92b4886f43607fa02 | true | true |
| .github/workflows/security-phase-11-upload-security.yml | 27 | actions/checkout | 11d5960a326750d5838078e36cf38b85af677262 | true | true |
| .github/workflows/security-phase-11-upload-security.yml | 32 | actions/setup-node | 249970729cb0ef3589644e2896645e5dc5ba9c38 | true | true |
| .github/workflows/security-phase-2-threat-model.yml | 25 | actions/checkout | 11d5960a326750d5838078e36cf38b85af677262 | true | true |
| .github/workflows/security-phase-2-threat-model.yml | 30 | actions/setup-node | 249970729cb0ef3589644e2896645e5dc5ba9c38 | true | true |
| .github/workflows/security-phase-2-threat-model.yml | 53 | actions/upload-artifact | ea165f8d65b6e75b540449e92b4886f43607fa02 | true | true |
| .github/workflows/security-phase-3-secret-exposure.yml | 25 | actions/checkout | 11d5960a326750d5838078e36cf38b85af677262 | true | true |
| .github/workflows/security-phase-3-secret-exposure.yml | 42 | actions/setup-node | 249970729cb0ef3589644e2896645e5dc5ba9c38 | true | true |
| .github/workflows/security-phase-3-secret-exposure.yml | 60 | actions/upload-artifact | ea165f8d65b6e75b540449e92b4886f43607fa02 | true | true |
| .github/workflows/security-phase-4-supply-chain.yml | 25 | actions/checkout | 11d5960a326750d5838078e36cf38b85af677262 | true | true |
| .github/workflows/security-phase-4-supply-chain.yml | 45 | actions/setup-node | 249970729cb0ef3589644e2896645e5dc5ba9c38 | true | true |
| .github/workflows/security-phase-4-supply-chain.yml | 58 | actions/upload-artifact | ea165f8d65b6e75b540449e92b4886f43607fa02 | true | true |
| .github/workflows/security-phase-5-authentication-session.yml | 25 | actions/checkout | 11d5960a326750d5838078e36cf38b85af677262 | true | true |
| .github/workflows/security-phase-5-authentication-session.yml | 42 | actions/setup-node | 249970729cb0ef3589644e2896645e5dc5ba9c38 | true | true |
| .github/workflows/security-phase-5-authentication-session.yml | 65 | actions/upload-artifact | ea165f8d65b6e75b540449e92b4886f43607fa02 | true | true |

## Dependabot coverage

| Ecosystem | Directory | Schedule |
| --- | --- | --- |
| github-actions | / | weekly |
| npm | /Backend/Chatify | weekly |
| npm | /Frontend/Chatify | weekly |

## Active dependency exceptions

No dependency exceptions are active.

## Structural violations

No structural dependency or supply-chain violations detected.

## Exit gate

| Requirement | Passed |
| --- | --- |
| lockfilesUseVersion3 | true |
| manifestsMatchLockfiles | true |
| dependencyVersionsExact | true |
| dependencySourcesTrusted | true |
| dependencyIntegrityComplete | true |
| installScriptsReviewed | true |
| noDeprecatedDirectDependencies | true |
| remoteActionsPinned | true |
| remoteActionsTrusted | true |
| dependabotCoverageComplete | true |
| exceptionPolicyValid | true |
