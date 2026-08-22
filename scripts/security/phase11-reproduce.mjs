#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const outputPath = path.join(root, '.artifacts/security/phase-11/run-evidence.json');

const runGit = (args) => {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
};

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const sha256File = async (relativePath) => {
  const content = await readFile(path.join(root, relativePath));
  return createHash('sha256').update(content).digest('hex');
};

const readJsonIfPresent = async (relativePath) => {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
  } catch {
    return null;
  }
};

const npmVersion = (() => {
  try {
    return execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
})();

const rootManifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const expectedNodeVersion = (await readFile(path.join(root, '.nvmrc'), 'utf8')).trim().replace(/^v/, '');
const expectedNpmVersion = /^npm@(\d+\.\d+\.\d+)$/.exec(rootManifest.packageManager ?? '')?.[1] ?? null;

const commandPlan = [
  {
    name: 'clean-install-backend',
    command: 'npm',
    args: ['ci', '--strict-allow-scripts'],
    cwd: 'Backend/Chatify',
  },
  {
    name: 'clean-install-frontend',
    command: 'npm',
    args: ['ci', '--strict-allow-scripts'],
    cwd: 'Frontend/Chatify',
  },
  {
    name: 'phase11-policy-check',
    command: 'node',
    args: ['scripts/security/phase11-upload-policy.mjs', '--check'],
    cwd: '.',
  },
  {
    name: 'phase11-upload-security-regressions',
    command: 'npm',
    args: [
      'test', '--', '--run',
      'test/security/phase11-upload-security.test.mjs',
      'test/message/message.attachments.test.mjs',
      'test/message/message.attachment-authorization.test.mjs',
      'test/message/message.voice.test.mjs',
      'test/user/user.profile-image.test.mjs',
      'test/message/message.mutations.test.mjs',
      'test/privacy/privacy-operations.test.mjs',
    ],
    cwd: 'Backend/Chatify',
  },
  {
    name: 'phase11-frontend-adjacent-regressions',
    command: 'npm',
    args: [
      'test', '--', '--run',
      'src/components/SettingsModal.test.tsx',
      'src/pages/chat/components/MessageComposer.test.tsx',
      'src/pages/chat/components/MessageBubble.test.tsx',
    ],
    cwd: 'Frontend/Chatify',
  },
  {
    name: 'frontend-lint',
    command: 'npm',
    args: ['run', 'lint'],
    cwd: 'Frontend/Chatify',
  },
  {
    name: 'frontend-production-build',
    command: 'npm',
    args: ['run', 'build'],
    cwd: 'Frontend/Chatify',
  },
  {
    name: 'operations-guard',
    command: 'npm',
    args: ['run', 'ops:check'],
    cwd: '.',
  },
  {
    name: 'repository-diff-check',
    command: 'git',
    args: ['diff', '--check'],
    cwd: '.',
  },
];

const evidenceFiles = [
  'Backend/Chatify/package.json',
  'Backend/Chatify/package-lock.json',
  'Frontend/Chatify/package.json',
  'Frontend/Chatify/package-lock.json',
  'Backend/Chatify/test/security/phase11-upload-security.test.mjs',
  'Backend/Chatify/Utils/uploadSecurity.mjs',
  'Backend/Chatify/Utils/attachmentValidation.mjs',
  'Backend/Chatify/Utils/profileImageValidation.mjs',
  'Backend/Chatify/Services/attachmentLifecycleService.mjs',
  'docs/security/audit/phase-11/upload-policy.json',
  'docs/security/audit/phase-11/upload-policy.md',
  'docs/security/audit/phase-11/phase-11-uploads-attachments-spec.md',
];

const evidence = {
  schemaVersion: 1,
  phase: 11,
  startedAt: new Date().toISOString(),
  repository: {
    commit: process.env.GITHUB_SHA || runGit(['rev-parse', 'HEAD']),
    branchOrRef: process.env.GITHUB_REF_NAME || runGit(['branch', '--show-current']),
    workflowRunId: process.env.GITHUB_RUN_ID || null,
    workflowAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    statusBefore: runGit(['status', '--porcelain=v1']),
  },
  runtime: {
    expectedNode: expectedNodeVersion,
    actualNode: process.versions.node,
    expectedNpm: expectedNpmVersion,
    actualNpm: npmVersion,
    platform: process.platform,
    architecture: process.arch,
  },
  runner: {
    os: process.env.RUNNER_OS || null,
    architecture: process.env.RUNNER_ARCH || null,
    environment: process.env.RUNNER_ENVIRONMENT || null,
    imageOs: process.env.ImageOS || null,
    imageVersion: process.env.ImageVersion || null,
  },
  evidenceFiles: [],
  commands: [],
  uploadPolicy: null,
  intentionallyNotExecuted: [
    {
      action: 'third-party antivirus or content-moderation scan',
      reason: 'The repository does not integrate a malware-scanning provider; Phase 11 proves deterministic allowlisting and structure controls without claiming antivirus execution.',
    },
    {
      action: 'Cloudinary configuration or quota test',
      reason: 'The audited upload implementation uses private MongoDB GridFS and contains no active Cloudinary upload path.',
    },
    {
      action: 'production large-file, decompression-bomb, or storage-exhaustion attack',
      reason: 'Resource-boundary tests use synthetic local buffers; destructive provider and production quota testing requires separate authorization.',
    },
  ],
};

let failed = false;
for (const relativePath of evidenceFiles) {
  if (!await exists(path.join(root, relativePath))) {
    evidence.evidenceFiles.push({ path: relativePath, missing: true });
    failed = true;
    continue;
  }
  evidence.evidenceFiles.push({ path: relativePath, sha256: await sha256File(relativePath) });
}

if (process.versions.node !== expectedNodeVersion || npmVersion !== expectedNpmVersion) failed = true;

for (const item of commandPlan) {
  const started = Date.now();
  console.log(`\n==> ${item.name}: (cd ${item.cwd} && ${item.command} ${item.args.join(' ')})`);
  const result = spawnSync(item.command, item.args, {
    cwd: path.resolve(root, item.cwd),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const exitCode = Number.isInteger(result.status) ? result.status : 1;
  evidence.commands.push({
    name: item.name,
    cwd: item.cwd,
    command: [item.command, ...item.args].join(' '),
    exitCode,
    signal: result.signal ?? null,
    durationMs: Date.now() - started,
  });
  if (exitCode !== 0) failed = true;
}

evidence.uploadPolicy = await readJsonIfPresent('docs/security/audit/phase-11/upload-policy.json');
if (
  !evidence.uploadPolicy
  || evidence.uploadPolicy.ok !== true
  || !Object.values(evidence.uploadPolicy.exitGate ?? {}).every(Boolean)
) {
  failed = true;
}

evidence.completedAt = new Date().toISOString();
evidence.repository.statusAfter = runGit(['status', '--porcelain=v1']);
evidence.summary = {
  passed: evidence.commands.filter((command) => command.exitCode === 0).length,
  failed: evidence.commands.filter((command) => command.exitCode !== 0).length,
  result: failed ? 'failed' : 'passed',
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`\nPhase 11 reproduction evidence written to ${path.relative(root, outputPath)}.`);
console.log(`Result: ${evidence.summary.result}; ${evidence.summary.passed} passed, ${evidence.summary.failed} failed.`);

if (failed) process.exitCode = 1;
