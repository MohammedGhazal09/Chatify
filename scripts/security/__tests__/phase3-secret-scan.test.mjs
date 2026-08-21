import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  calculateShannonEntropy,
  isPlaceholderValue,
  scanTextForSecrets,
  validateSecretAllowlist,
} from '../lib/secret-detectors.mjs'
import {
  assertPhase3ExitGate,
  buildSecretScan,
  checkGeneratedSecretScan,
  renderSecretScanMarkdown,
  writeGeneratedSecretScan,
} from '../lib/secret-scan.mjs'

const git = (root, args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim()

const createRepository = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chatify-phase3-test-'))
  git(root, ['init', '-q'])
  git(root, ['config', 'user.name', 'Security Test'])
  git(root, ['config', 'user.email', 'security-test@example.invalid'])
  await writeFile(path.join(root, 'package.json'), '{"name":"fixture","type":"module"}\n')
  await mkdir(path.join(root, 'docs/security/audit/phase-3'), { recursive: true })
  await writeFile(path.join(root, 'docs/security/audit/phase-3/secret-scan-allowlist.json'), '{"schemaVersion":1,"entries":[]}\n')
  await writeFile(path.join(root, 'docs/security/audit/phase-3/credential-exposure-response.md'), '# Credential exposure response\n')
  git(root, ['add', '.'])
  git(root, ['commit', '-qm', 'fixture baseline'])
  return root
}

const commitAll = (root, message) => {
  git(root, ['add', '-A'])
  git(root, ['commit', '-qm', message])
}

const tokenFixture = () => ['ghp_', Array.from({ length: 36 }, (_, index) => 'Ab3xYz9Q'[index % 8]).join('')].join('')
const awsFixture = () => ['AKIA', 'B'.repeat(16)].join('')
const brevoFixture = () => ['xkeysib-', 'c'.repeat(64)].join('')
const privateKeyFixture = () => [
  ['-----BEGIN ', 'PRIVATE KEY-----'].join(''),
  'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC',
  ['-----END ', 'PRIVATE KEY-----'].join(''),
].join('\n')

const safePhase1Inventory = ({ frontendSecret = false } = {}) => ({
  sensitiveConfiguration: {
    variables: [
      {
        name: frontendSecret ? 'VITE_SERVER_SIGNING_SECRET' : 'SECRET_JWT_KEY',
        classifications: ['secret'],
        references: [{ source: frontendSecret ? 'Frontend/Chatify/src/config.ts' : 'Backend/Chatify/server.mjs', line: 1 }],
      },
    ],
  },
})

test('detectors ignore placeholders and return only redacted candidate metadata', () => {
  const token = tokenFixture()
  const findings = scanTextForSecrets({
    text: [
      `GITHUB_TOKEN=${token}`,
      'SECRET_JWT_KEY=replace-with-a-long-random-jwt-secret',
      'GOOGLE_CLIENT_SECRET=your-google-client-secret',
    ].join('\n'),
    filePath: 'config.env',
    scope: 'current-tree',
  })

  assert.equal(findings.length, 1)
  assert.equal(findings[0].detectorId, 'github-token')
  assert.equal(findings[0].filePath, 'config.env')
  assert.equal(findings[0].line, 1)
  assert.match(findings[0].candidateId, /^sec_[a-f0-9]{24}$/)
  assert.equal(Object.hasOwn(findings[0], 'value'), false)
  assert.equal(Object.hasOwn(findings[0], 'secret'), false)
  assert.equal(JSON.stringify(findings).includes(token), false)
  assert.equal(isPlaceholderValue('replace-with-a-long-random-jwt-secret'), true)
  assert.ok(calculateShannonEntropy(token) > 1)
})

test('current-tree scan detects credential classes without retaining raw values', async () => {
  const root = await createRepository()
  const token = tokenFixture()
  const aws = awsFixture()
  const key = privateKeyFixture()
  await writeFile(path.join(root, 'secrets.txt'), [
    `GITHUB_TOKEN=${token}`,
    `AWS_ACCESS_KEY_ID=${aws}`,
    key,
  ].join('\n'))
  commitAll(root, 'add fixture candidates')

  const report = await buildSecretScan(root, {
    phase1Inventory: safePhase1Inventory(),
    now: new Date('2026-08-21T00:00:00Z'),
  })
  const ids = report.currentTree.findings.map((finding) => finding.detectorId)

  assert.deepEqual(ids.sort(), ['aws-access-key-id', 'github-token', 'private-key'].sort())
  const serialized = JSON.stringify(report)
  assert.equal(serialized.includes(token), false)
  assert.equal(serialized.includes(aws), false)
  assert.equal(serialized.includes('MIIEvQIBADANBgkqhkiG9w0BAQEFAASC'), false)
})

test('history scan detects a credential removed from the current tree', async () => {
  const root = await createRepository()
  const secret = brevoFixture()
  await writeFile(path.join(root, 'deleted.env'), `BREVO_API_KEY=${secret}\n`)
  commitAll(root, 'add deleted credential')
  await writeFile(path.join(root, 'deleted.env'), 'BREVO_API_KEY=<redacted>\n')
  commitAll(root, 'remove deleted credential')

  const report = await buildSecretScan(root, {
    phase1Inventory: safePhase1Inventory(),
    now: new Date('2026-08-21T00:00:00Z'),
  })

  assert.equal(report.currentTree.findings.some((finding) => finding.detectorId === 'brevo-api-key'), false)
  const historyFinding = report.history.findings.find((finding) => finding.detectorId === 'brevo-api-key')
  assert.ok(historyFinding)
  assert.equal(historyFinding.filePath, 'deleted.env')
  assert.ok(historyFinding.firstSeenCommit)
  assert.ok(historyFinding.lastSeenCommit)
  assert.equal(JSON.stringify(report).includes(secret), false)
})

test('allowlist requires exact candidate ids, ownership, rationale, and future expiry', () => {
  const [finding] = scanTextForSecrets({
    text: `TOKEN=${tokenFixture()}\n`,
    filePath: 'fixture.env',
    scope: 'current-tree',
  })
  const valid = validateSecretAllowlist({
    schemaVersion: 1,
    entries: [{
      candidateId: finding.candidateId,
      owner: 'security@example.invalid',
      reason: 'Synthetic test fixture only',
      expiresAt: '2026-09-01T00:00:00Z',
    }],
  }, { now: new Date('2026-08-21T00:00:00Z') })

  assert.equal(valid.has(finding.candidateId), true)
  assert.throws(() => validateSecretAllowlist({
    schemaVersion: 1,
    entries: [{ candidateId: finding.candidateId, owner: '', reason: '', expiresAt: '2026-01-01T00:00:00Z' }],
  }, { now: new Date('2026-08-21T00:00:00Z') }), /owner|reason|expired/i)
})

test('generated report is self-stable after its own evidence files are committed', async () => {
  const root = await createRepository()
  const first = await buildSecretScan(root, {
    phase1Inventory: safePhase1Inventory(),
    now: new Date('2026-08-21T00:00:00Z'),
  })
  await writeGeneratedSecretScan(root, first)
  commitAll(root, 'commit generated Phase 3 evidence')
  const second = await buildSecretScan(root, {
    phase1Inventory: safePhase1Inventory(),
    now: new Date('2026-08-21T00:00:00Z'),
  })

  assert.deepEqual(second, first)
  assert.equal(await checkGeneratedSecretScan(root, second), true)
})

test('secret-loading review rejects frontend secrets, weak fallbacks, and missing startup validation', async () => {
  const root = await createRepository()
  await mkdir(path.join(root, 'Backend/Chatify'), { recursive: true })
  await mkdir(path.join(root, 'Frontend/Chatify/src'), { recursive: true })
  await writeFile(path.join(root, 'Backend/Chatify/server.mjs'), "import './app.mjs'\n")
  await writeFile(path.join(root, 'Frontend/Chatify/src/config.ts'), 'export const key = import.meta.env.VITE_SERVER_SIGNING_SECRET\n')
  await writeFile(path.join(root, 'Backend/Chatify/config.mjs'), "const secret = process.env.SECRET_JWT_KEY || 'development-secret'\n")
  commitAll(root, 'unsafe loading fixture')

  const report = await buildSecretScan(root, {
    phase1Inventory: safePhase1Inventory({ frontendSecret: true }),
    now: new Date('2026-08-21T00:00:00Z'),
  })

  assert.equal(report.secretLoading.frontendSecretReferences.length, 1)
  assert.equal(report.secretLoading.weakFallbacks.length, 1)
  assert.equal(report.secretLoading.startupValidation.installed, false)
  assert.throws(() => assertPhase3ExitGate(report), /Phase 3 exit gate failed/)
})

test('generated write and check detect stale sanitized evidence', async () => {
  const root = await createRepository()
  const report = await buildSecretScan(root, {
    phase1Inventory: safePhase1Inventory(),
    now: new Date('2026-08-21T00:00:00Z'),
  })

  await writeGeneratedSecretScan(root, report)
  assert.equal(await checkGeneratedSecretScan(root, report), true)
  await writeFile(path.join(root, 'docs/security/audit/phase-3/secret-scan.md'), 'stale\n')
  assert.equal(await checkGeneratedSecretScan(root, report), false)
  assert.match(renderSecretScanMarkdown(report), /Phase 3 Secret and Credential Exposure/)
})

test('Phase 3 exit gate blocks unsuppressed findings and missing response controls', async () => {
  const root = await createRepository()
  await writeFile(path.join(root, 'candidate.env'), `GITHUB_TOKEN=${tokenFixture()}\n`)
  commitAll(root, 'candidate')
  const report = await buildSecretScan(root, {
    phase1Inventory: safePhase1Inventory(),
    now: new Date('2026-08-21T00:00:00Z'),
  })

  assert.equal(report.exitGate.noUnsuppressedFindings, false)
  assert.throws(() => assertPhase3ExitGate(report), /noUnsuppressedFindings/)
})
