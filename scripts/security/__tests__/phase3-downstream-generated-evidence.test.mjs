import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { buildSecretScan } from '../lib/secret-scan.mjs'

const git = (root, args) => execFileSync('git', args, {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim()

const commitAll = (root, message) => {
  git(root, ['add', '-A'])
  git(root, ['commit', '-qm', message])
}

const createRepository = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chatify-phase3-downstream-evidence-'))
  git(root, ['init', '-q'])
  git(root, ['config', 'user.name', 'Security Test'])
  git(root, ['config', 'user.email', 'security-test@example.invalid'])
  await writeFile(path.join(root, 'package.json'), '{"name":"fixture","type":"module"}\n')
  await mkdir(path.join(root, 'docs/security/audit/phase-3'), { recursive: true })
  await writeFile(path.join(root, 'docs/security/audit/phase-3/secret-scan-allowlist.json'), '{"schemaVersion":1,"entries":[]}\n')
  await writeFile(path.join(root, 'docs/security/audit/phase-3/credential-exposure-response.md'), '# Credential exposure response\n')
  commitAll(root, 'fixture baseline')
  return root
}

test('Phase 4 generated evidence is excluded from Phase 3 current and history inputs', async () => {
  const root = await createRepository()
  const options = {
    phase1Inventory: { sensitiveConfiguration: { variables: [] } },
    now: new Date('2026-08-21T00:00:00.000Z'),
  }
  const before = await buildSecretScan(root, options)

  await mkdir(path.join(root, 'docs/security/audit/phase-4'), { recursive: true })
  await writeFile(
    path.join(root, 'docs/security/audit/phase-4/dependency-policy.json'),
    '{"schemaVersion":1,"phase":4,"exitGate":{"passed":true}}\n',
  )
  await writeFile(
    path.join(root, 'docs/security/audit/phase-4/dependency-policy.md'),
    '# Generated Phase 4 dependency policy\n',
  )
  commitAll(root, 'generated Phase 4 evidence')

  const after = await buildSecretScan(root, options)
  assert.equal(after.currentTree.scannedFileCount, before.currentTree.scannedFileCount)
  assert.equal(after.currentTree.contentSha256, before.currentTree.contentSha256)
  assert.deepEqual(after.currentTree.findings, before.currentTree.findings)
  assert.equal(after.history.scannedBlobCount, before.history.scannedBlobCount)
  assert.equal(after.history.contentSha256, before.history.contentSha256)
  assert.deepEqual(after.history.findings, before.history.findings)
})
