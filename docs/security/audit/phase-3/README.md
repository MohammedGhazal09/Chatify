# Security Audit Phase 3 — Secrets and Credential Exposure

Phase 3 makes current-tree and complete-history secret scanning a repeatable, fail-closed repository control. Evidence is intentionally sanitized: detected values, source lines, command output, and value hashes are never committed or uploaded.

## Evidence and controls

| Evidence or control | Location | Purpose |
| --- | --- | --- |
| Detector catalog and redaction | `scripts/security/lib/secret-detectors.mjs` | Recognize provider credentials, private keys, authenticated URIs, JWTs, bearer values, and high-entropy secret assignments without retaining values. |
| Repository scanner | `scripts/security/lib/secret-scan.mjs` | Scan the current worktree and every eligible blob in the audited `HEAD` ancestor history, apply exact expiring allowlist entries, review secret-loading behavior, and build deterministic evidence. |
| Regression suite | `scripts/security/__tests__/phase3-secret-scan.test.mjs` | Prove redaction, deleted-history discovery, allowlist validation, self-stability, and exit-gate behavior. |
| Startup validation | `Backend/Chatify/Utils/secretConfiguration.mjs` | Fail before application modules load when required secrets are missing, weak, reused, low-entropy, or inconsistently configured. |
| Machine-readable result | `secret-scan.json` | Sanitized findings, counts, digests, loading review, and exit gates. |
| Reviewer result | `secret-scan.md` | Human-readable sanitized summary. |
| Allowlist | `secret-scan-allowlist.json` | Time-bounded exact candidate suppressions with accountable ownership and rationale. |
| Response procedure | `credential-exposure-response.md` | Provider-safe validation, containment, rotation, session invalidation, cleanup, and closure. |
| Runtime evidence | GitHub Actions artifact `phase-3-secret-exposure-evidence` | Commit-specific commands, toolchain, file hashes, scan counts, and exit-gate state. |

## Commands

```bash
npm run security:phase3:test
npm run security:phase3:generate
npm run security:phase3:check
npm run security:phase3:reproduce
```

`security:phase3:generate` writes sanitized JSON and Markdown before enforcing the exit gate, allowing investigators to inspect candidate IDs without exposing values. `security:phase3:check` rejects stale evidence and any failed exit-gate requirement.

## Phase 3.1 — Current repository tree

The scanner covers every tracked file, untracked nonignored file, and sensitive local file such as `.env`, `.npmrc`, key containers, and private-key formats. Generated Phase 1–4 JSON/Markdown evidence and temporary audit-materialization workflows are excluded from scan inputs to prevent recursive evidence loops. Permanent application, CI, documentation, and committed artifact files remain in scope. Binary and oversized files are counted but not decoded as text. Committed artifacts and test output remain in scope.

## Phase 3.2 — Complete Git history

The workflow fetches repository branches and tags so required ancestor objects are locally available. On a pull request, it additionally fetches only that pull request's head ref; the checked-out merge commit is the audited `HEAD`. The scanner deliberately walks only `HEAD` and its ancestors. Unrelated branch tips and unrelated open pull requests cannot perturb the committed digest or block the audited revision. Within that ancestor graph, the scanner enumerates every object path, batch-checks object type and size, reads eligible unique blobs, and detects credentials that were later deleted. Historical findings include sanitized first- and last-seen commit identifiers without storing the discovered value.

Generated Phase 1–4 JSON and Markdown outputs are excluded from history inputs. Therefore committing inherited audit evidence does not recursively change the Phase 3 result.

## Phase 3.3 — Safe candidate validation

A candidate contains only:

- deterministic location-based candidate ID;
- detector, severity, and confidence;
- scope, path, line, column, and match length;
- entropy band and provider-safe validation instructions;
- sanitized first/last commit metadata for history findings;
- optional allowlist owner, rationale, and expiry.

Candidates are validated through authorized provider inventories and audit logs. CI never replays a candidate. The allowlist rejects wildcard entries, missing owners, vague reasons, duplicate IDs, invalid dates, and expired exceptions.

## Phase 3.4 — Secret-loading behavior

The scanner and backend validation jointly enforce:

- no secret-classified `VITE_*` or frontend runtime references;
- no literal fallback for secret-valued environment variables;
- no direct environment dumps or obvious credential logging;
- startup validation before dynamic application imports;
- distinct JWT, CSRF, and password-reset keys with at least 128 bits of estimated entropy outside tests;
- a dedicated production 2FA encryption key that decodes to 32 bytes and provides at least 128 bits of estimated entropy;
- complete OAuth, web-push, email, and TURN credential groups;
- rejection of placeholder and undersized configured provider credentials;
- production HTTPS frontend origin and nonlocal MongoDB target;
- errors that identify variable names without echoing values.

## Phase 3.5 — Response procedure

The committed response procedure defines containment-first handling, provider-side validation without replay, rotation order, Chatify-specific session invalidation, history and artifact cleanup, verification, and incident closure.

## Exit gate

Phase 3 passes only when:

- current-tree and history scans complete;
- no unsuppressed candidate remains;
- no frontend secret reference, weak secret fallback, environment dump, or credential-log candidate remains;
- fail-closed startup validation is installed before runtime imports;
- cryptographic-purpose keys are distinct and weak low-entropy key material is rejected;
- the credential-exposure response procedure exists.

## Limitations

Static scanning cannot establish whether a candidate is active, determine every proprietary credential format, inspect provider consoles, rotate credentials, or purge external caches. GitHub Actions audits the checked-out branch or pull-request merge revision and every ancestor reachable from that `HEAD`. Unrelated branch-only history, unrelated unmerged pull requests, separately retained workflow logs, release assets, forks, mirrors, backups, and third-party observability systems require separate operator review. Binary and oversized files require a separate content-aware process when their provenance is suspicious.
