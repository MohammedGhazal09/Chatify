#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { buildPhase2CommandPlan } from './lib/phase2-reproduction.mjs'

const root = process.cwd()
const outputPath = path.join(root, '.artifacts/security/phase-2/run-evidence.json')

const runGit = (args) => {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

const sha256File = async (relativePath) => {
  const content = await readFile(path.join(root, relativePath))
  return createHash('sha256').update(content).digest('hex')
}

const npmVersion = (() => {
  try {
    return execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
})()

const rootManifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const expectedNodeVersion = (await readFile(path.join(root, '.nvmrc'), 'utf8')).trim().replace(/^v/, '')
const expectedNpmVersion = /^npm@(\d+\.\d+\.\d+)$/.exec(rootManifest.packageManager ?? '')?.[1] ?? null
const commandPlan = buildPhase2CommandPlan()
const evidenceFiles = [
  'Backend/Chatify/package-lock.json',
  'Frontend/Chatify/package-lock.json',
  'docs/security/audit/phase-1/inventory.json',
  'docs/security/audit/phase-2/threat-model.source.json',
  'docs/security/audit/phase-2/threat-model.json',
  'docs/security/audit/phase-2/threat-model.md',
]

const evidence = {
  schemaVersion: 1,
  phase: 2,
  startedAt: new Date().toISOString(),
  repository: {
    commit: process.env.GITHUB_SHA || runGit(['rev-parse', 'HEAD']),
    branchOrRef: process.env.GITHUB_REF_NAME || runGit(['branch', '--show-current']),
    workflowRunId: process.env.GITHUB_RUN_ID || null,
    workflowAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
    actor: process.env.GITHUB_ACTOR || null,
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
    name: process.env.RUNNER_NAME || null,
    environment: process.env.RUNNER_ENVIRONMENT || null,
    imageOs: process.env.ImageOS || null,
    imageVersion: process.env.ImageVersion || null,
  },
  evidenceFiles: [],
  commands: [],
  intentionallyNotExecuted: [
    {
      command: 'npm run smoke:local',
      reason: 'Requires a live browser/application topology; browser configuration smoke remains in the existing CI workflow.',
    },
    {
      command: 'npm run smoke:prod',
      reason: 'Requires explicitly authorized production URL and credentials; production evidence remains separately gated.',
    },
    {
      command: 'manual source-to-sink vulnerability validation',
      reason: 'Phase 2 defines repository-wide assets, boundaries, invariants, and attacker stories; finding discovery and validation occur in later audit phases.',
    },
  ],
}

for (const relativePath of evidenceFiles) {
  evidence.evidenceFiles.push({ path: relativePath, sha256: await sha256File(relativePath) })
}

let failed = false
for (const item of commandPlan) {
  const started = Date.now()
  console.log(`\n==> ${item.name}: (cd ${item.cwd} && ${item.command} ${item.args.join(' ')})`)
  const result = spawnSync(item.command, item.args, {
    cwd: path.resolve(root, item.cwd),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  const exitCode = Number.isInteger(result.status) ? result.status : 1
  evidence.commands.push({
    name: item.name,
    cwd: item.cwd,
    command: [item.command, ...item.args].join(' '),
    exitCode,
    signal: result.signal ?? null,
    durationMs: Date.now() - started,
  })
  if (exitCode !== 0) failed = true
}

evidence.completedAt = new Date().toISOString()
evidence.repository.statusAfter = runGit(['status', '--porcelain=v1'])
evidence.summary = {
  passed: evidence.commands.filter((command) => command.exitCode === 0).length,
  failed: evidence.commands.filter((command) => command.exitCode !== 0).length,
  result: failed ? 'failed' : 'passed',
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
console.log(`\nPhase 2 reproduction evidence written to ${path.relative(root, outputPath)}.`)
console.log(`Result: ${evidence.summary.result}; ${evidence.summary.passed} passed, ${evidence.summary.failed} failed.`)

if (failed) process.exitCode = 1
