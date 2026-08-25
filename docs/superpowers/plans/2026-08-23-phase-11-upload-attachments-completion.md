# Phase 11 Upload and Attachment Security Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete and verify Chatify Phase 11 so upload content, protected delivery, quotas, metadata handling, and GridFS lifecycle controls pass on one immutable branch head.

**Architecture:** Keep the existing private MongoDB GridFS storage design. Validate every accepted upload through extension, declared MIME, detected container/signature, structural content checks, and purpose-specific limits before persistence; deliver stored objects only through authenticated, membership-constrained routes with browser-isolation headers; use durable atomic upload budgets and a bounded orphan-cleanup worker for lifecycle enforcement.

**Tech Stack:** Node.js 24.19.0, npm 11.17.0, Express 5, Multer 2, Mongoose 8, MongoDB GridFS, Vitest 4, React 19, TypeScript, Vite.

**Spec:** `docs/security/audit/phase-11/README.md`

## Global Constraints

- Preserve the existing React/Vite, Express, MongoDB/Mongoose, Socket.IO, TanStack Query, Zustand, Tailwind, and npm package layout.
- Keep uploads in the repository's existing private MongoDB GridFS buckets; do not introduce Cloudinary or another storage migration.
- Do not weaken Phase 10 query-level authorization, strict Mongoose configuration, bounded database behavior, or transaction controls.
- Never commit live credentials, private upload bytes, message content, access tokens, cookies, or unredacted personal data into evidence.
- Keep Phase 11 limited to uploads, attachments, profile images, protected delivery, upload quotas, metadata/privacy handling, and orphan lifecycle.

---

### Task 1: Enforce detected voice-container signatures

**Files:**
- Modify: `Backend/Chatify/Utils/attachmentValidation.mjs`
- Test: `Backend/Chatify/test/security/phase11-media-type-security.test.mjs`
- Test: `Backend/Chatify/test/message/message.voice.test.mjs`

**Interfaces:**
- Consumes: `fileTypeFromBuffer(buffer)` and existing extension/MIME policy.
- Produces: voice uploads are accepted only when their bytes resolve to an allowlisted WebM/Ogg/Opus container; browser WebM detected as `video/webm` remains accepted only when declared as `audio/webm`.

- [ ] **Step 1: Verify the regression test fails for the intended reason**

Run:

```bash
npm --prefix Backend/Chatify test -- --run test/security/phase11-media-type-security.test.mjs
```

Expected: FAIL because arbitrary HTML bytes declared as `audio/webm` return `ok: true`.

- [ ] **Step 2: Implement the minimal container gate**

Require a detected media container for every `voice` attachment. Accept `.webm` only when detection returns `video/webm` and the declared type is allowlisted as audio; accept `.ogg`/`.opus` only when the detected type itself is allowlisted. Reject missing, mismatched, or forged detection with `ATTACHMENT_TYPE_UNSUPPORTED`.

- [ ] **Step 3: Verify the focused media tests pass**

Run:

```bash
npm --prefix Backend/Chatify test -- --run \
  test/security/phase11-media-type-security.test.mjs \
  test/message/message.voice.test.mjs
```

Expected: PASS with the forged payload rejected and the real WebM fixture accepted.

- [ ] **Step 4: Commit**

```bash
git add Backend/Chatify/Utils/attachmentValidation.mjs
git commit -m "fix(security): require detected voice containers"
```

### Task 2: Run the permanent Phase 11 verification gate

**Files:**
- Verify: `.github/workflows/security-phase-11-upload-security.yml`
- Verify: all Phase 11 backend and frontend test files named in the workflow

**Interfaces:**
- Consumes: the final Phase 11 branch tree.
- Produces: immutable CI evidence for syntax, backend regressions, frontend upload rendering, production dependency audit, and patch hygiene.

- [ ] **Step 1: Run the workflow-equivalent backend matrix**

```bash
npm --prefix Backend/Chatify test -- --run \
  test/security/phase11-upload-security.test.mjs \
  test/security/phase11-image-container-security.test.mjs \
  test/security/phase11-media-type-security.test.mjs \
  test/security/phase11-office-container-security.test.mjs \
  test/security/phase11-chat-deletion-lifecycle.test.mjs \
  test/security/phase10-database-security.test.mjs \
  test/message/message.attachments.test.mjs \
  test/message/message.attachment-authorization.test.mjs \
  test/message/message.voice.test.mjs \
  test/user/user.profile-image.test.mjs
```

Expected: all files and tests pass.

- [ ] **Step 2: Run protected frontend rendering tests**

```bash
npm --prefix Frontend/Chatify test -- --run \
  src/pages/chat/components/AttachmentPreviewModal.test.tsx \
  src/pages/chat/components/UserAvatar.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Run syntax, audit, and patch checks**

```bash
node --check Backend/Chatify/Utils/attachmentValidation.mjs
npm --prefix Backend/Chatify audit --omit=dev --audit-level=high
npm --prefix Frontend/Chatify audit --omit=dev --audit-level=high
git diff --check security/phase-10-mongodb-data-integrity...HEAD
```

Expected: every command exits 0.

### Task 3: Validate inherited quality and audit drift

**Files:**
- Verify: `package.json`
- Verify: `Backend/Chatify/package.json`
- Verify: `Frontend/Chatify/package.json`
- Verify: generated Phase 1-5 audit policy files and the Phase 10 contract

**Interfaces:**
- Consumes: inherited quality, inventory, threat-model, secret, supply-chain, authentication, database, and operations gates.
- Produces: evidence that Phase 11 did not regress existing security guarantees.

- [ ] **Step 1: Run the complete repository quality suite**

```bash
npm run quality
```

Expected: backend tests, frontend tests, lint, and production build pass.

- [ ] **Step 2: Run inherited deterministic checks**

```bash
npm run security:phase1:check
npm run security:phase2:check
npm run security:phase3:check
npm run security:phase4:check
npm run security:phase5:check
npm run ops:check
```

Expected: all commands exit 0. If an inventory or generated policy is stale because of Phase 11 source additions, regenerate it using the corresponding committed generator, review the diff for secret/privacy safety, and rerun the check.

- [ ] **Step 3: Inspect every failed GitHub Actions job**

Classify each failure as a Phase 11 defect, inherited deterministic-drift requirement, unrelated known predecessor failure, or flaky test. Fix only Phase 11 defects and required inherited drift updates; do not mask failures with `continue-on-error` or reduced coverage.

### Task 4: Finalize the stacked pull request

**Files:**
- Modify if needed: `docs/security/audit/phase-11/README.md`
- Modify: pull request #11 description/status

**Interfaces:**
- Consumes: final immutable head SHA and successful verification results.
- Produces: one authoritative Phase 11 pull request with exact scope, evidence, residual risks, and predecessor relationship.

- [ ] **Step 1: Review Phase 11 requirement coverage**

Confirm the final diff covers file validation, active-content execution prevention, size/resource controls, authorization/URL design, filename/metadata handling, malware-policy decision, and orphan cleanup without Phase 12 changes.

- [ ] **Step 2: Remove or close duplicate Phase 11 review targets**

Close pull request #10 as superseded only after pull request #11 is verified and its branch is the authoritative implementation.

- [ ] **Step 3: Update pull request #11**

Record the final head SHA, exact passing test counts/commands, dependency audit result, phase boundary, residual infrastructure risks, and stacked base. Mark ready for review only when all required Phase 11 and applicable inherited checks pass on that same head.
