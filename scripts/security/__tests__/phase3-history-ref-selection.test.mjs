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
  const root = await mkdtemp(path.join(os.tmpdir(), 'chatify-phase3-history-refs-'))
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

const createRefOnlyCommit = async (root, {
  branchName,
  refName,
  filePath,
  content,
}) => {
  const baseBranch = git(root, ['branch', '--show-current'])
  git(root, ['checkout', '-qb', branchName])
  await writeFile(path.join(root, filePath), content)
  commitAll(root, `add ${filePath}`)
  const sha = git(root, ['rev-parse', 'HEAD'])
  git(root, ['checkout', '-q', baseBranch])
  git(root, ['branch', '-D', branchName])
  git(root, ['update-ref', refName, sha])
  return sha
}

test('history evidence excludes synthetic PR merge refs while retaining PR heads', async () => {
  const root = await createRepository()
  const headSecret = ['xkeysib-', 'c'.repeat(64)].join('')
  const mergeSecret = ['ghp_', Array.from({ length: 36 }, (_, index) => 'Ab3xYz9Q'[index % 8]).join('')].join('')

  await createRefOnlyCommit(root, {
    branchName: 'fixture-pr-head',
    refName: 'refs/remotes/pull/7/head',
    filePath: 'head-only.env',
    content: `BREVO_API_KEY=${headSecret}\n`,
  })
  await createRefOnlyCommit(root, {
    branchName: 'fixture-pr-merge',
    refName: 'refs/remotes/pull/7/merge',
    filePath: 'merge-only.env',
    content: `GITHUB_TOKEN=${mergeSecret}\n`,
  })

  const withMergeRef = await buildSecretScan(root, {
    phase1Inventory: { sensitiveConfiguration: { variables: [] } },
    now: new Date('2026-08-21T00:00:00Z'),
  })

  assert.equal(withMergeRef.history.findings.some((finding) => (
    finding.filePath === 'head-only.env' && finding.detectorId === 'brevo-api-key'
  )), true)
  assert.equal(withMergeRef.history.findings.some((finding) => (
    finding.filePath === 'merge-only.env' && finding.detectorId === 'github-token'
  )), false)

  git(root, ['update-ref', '-d', 'refs/remotes/pull/7/merge'])
  const withoutMergeRef = await buildSecretScan(root, {
    phase1Inventory: { sensitiveConfiguration: { variables: [] } },
    now: new Date('2026-08-21T00:00:00Z'),
  })

  assert.equal(withMergeRef.history.contentSha256, withoutMergeRef.history.contentSha256)
  assert.deepEqual(withMergeRef.history.findings, withoutMergeRef.history.findings)
})
