# Chatify Security Audit Phase 2 Threat Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a deterministic, repository-scoped threat model that fails closed when Chatify's security-relevant runtime attack surface changes.

**Architecture:** Keep a human-reviewed JSON source separate from generated evidence. A dependency-free Node.js validator resolves references, maps Phase 1 runtime surfaces to model groups, rejects missing or ambiguous coverage, and renders machine-readable JSON plus reviewer Markdown. CI records command and evidence hashes without storing environment values or command output.

**Tech Stack:** Node.js 24.19.0 built-ins, npm 11.17.0, GitHub Actions on Ubuntu 24.04, Phase 1 JSON inventory.

**Spec:** `docs/security/audit/phase-2/README.md`

## Global Constraints

- Do not change Chatify application runtime behavior in Phase 2.
- Do not represent attacker stories or static hypotheses as confirmed vulnerabilities.
- Do not read or serialize live environment values.
- Do not execute application modules while constructing the model.
- Every current HTTP route, Socket.IO registration, service-worker event, runtime background job, data model, and external-provider group must map to exactly one model group.
- Generated evidence must be deterministic and timestamp-free.
- Phase 1 remains the source of repository/runtime inventory truth.

---

### Task 1: Authoritative threat-model source and validator

**Files:**
- Create: `docs/security/audit/phase-2/threat-model.source.json`
- Create: `scripts/security/lib/threat-model.mjs`
- Test: `scripts/security/__tests__/phase2-threat-model.test.mjs`

**Interfaces:**
- Consumes: Phase 1 `inventory.json` schema version 1.
- Produces: `validateThreatModelSource(source)`, `buildThreatModel({ source, inventory })`, `renderThreatModelMarkdown(model)`, generated-file helpers.

- [x] Write failing tests for broken references, missing severity calibration, unmapped/ambiguous HTTP routes, Socket.IO events, models, providers, service-worker events, and runtime jobs.
- [x] Verify the tests fail before the implementation exists.
- [x] Implement ID/reference validation, coverage grouping, development-only job filtering, exit gates, deterministic rendering, and generated-file drift detection.
- [x] Add the repository-wide actors, zones, data classes, assets, boundaries, data flows, invariants, attacker stories, exclusions, and severity calibration.
- [x] Verify all Phase 1 runtime surfaces map exactly once.

### Task 2: CLI and generated evidence

**Files:**
- Create: `scripts/security/phase2-threat-model.mjs`
- Create: `docs/security/audit/phase-2/threat-model.json`
- Create: `docs/security/audit/phase-2/threat-model.md`
- Test: `scripts/security/__tests__/phase2-threat-model.test.mjs`

**Interfaces:**
- Consumes: committed source and Phase 1 inventory.
- Produces: `--write`, `--check`, and `--json` CLI modes.

- [x] Write a failing end-to-end CLI test in a temporary repository fixture.
- [x] Implement strict mode selection and repository evidence loading.
- [x] Generate JSON and Markdown, verify byte-for-byte drift checks, and verify the exact repository/version footer.
- [x] Prove file-only Phase 1 inventory changes do not recursively change Phase 2 output.

### Task 3: Reproduction evidence and root commands

**Files:**
- Create: `scripts/security/lib/phase2-reproduction.mjs`
- Create: `scripts/security/phase2-reproduce.mjs`
- Modify: `package.json`
- Test: `scripts/security/__tests__/phase2-threat-model.test.mjs`

**Interfaces:**
- Produces: eight-command clean reproduction plan and `.artifacts/security/phase-2/run-evidence.json`.

- [x] Write a failing test for command ordering and inherited Phase 1 checks.
- [x] Implement clean backend/frontend installs, Phase 1 drift validation, Phase 2 tests/check, doctor, repository quality, and operations guard.
- [x] Hash lockfiles and committed Phase 1/Phase 2 evidence without capturing command output or environment values.
- [x] Add root test/generate/check/reproduce scripts.

### Task 4: CI enforcement and documentation

**Files:**
- Create: `.github/workflows/security-phase-2-threat-model.yml`
- Create: `docs/security/audit/phase-2/README.md`
- Create: `docs/plans/2026-08-21-phase-2-threat-model.md`

**Interfaces:**
- Produces: read-only PR/main/manual CI and `phase-2-threat-model-evidence` artifact.

- [x] Pin the runner line, exact Node version, and all third-party action revisions.
- [x] Run complete Phase 2 reproduction and reject Phase 1 or Phase 2 generated drift.
- [x] Upload the evidence record and authoritative/generated model files even when validation fails.
- [x] Document scope, commands, phase mapping, update procedure, limitations, and the boundary with later vulnerability-validation phases.

## Verification sequence

```bash
node --check scripts/security/lib/threat-model.mjs
node --check scripts/security/lib/phase2-reproduction.mjs
node --check scripts/security/phase2-threat-model.mjs
node --check scripts/security/phase2-reproduce.mjs
npm run security:phase2:test
npm run security:phase2:generate
npm run security:phase2:check
npm run security:phase1:check
npm run doctor
npm run security:phase2:reproduce
```

## Exit criteria

- Authoritative source references are valid and severity calibration covers all four levels.
- Every current Phase 1 runtime surface maps to exactly one model group.
- New or ambiguous runtime surfaces fail closed.
- Generated JSON and Markdown are deterministic and current.
- Audit-only file changes do not cause recursive Phase 1/Phase 2 evidence drift.
- Clean reproduction evidence records the exact commit, runtime, runner, evidence hashes, command outcomes, and durations.
- CI is read-only and uploads evidence on success or failure.
- The phase remains a threat model and does not claim confirmed vulnerabilities or remediation of later-phase findings.
