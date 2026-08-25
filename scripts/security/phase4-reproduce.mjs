#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { buildPhase4CommandPlan } from './lib/phase4-reproduction.mjs'

const root = process.cwd()
const outputPath = path.join(root, '.artifacts/security/phase-4/run-evidence.json')

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

const exists = async (filePath) => {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

const sha256File = async (relativePath) => {
  const content = await readFile(path.join(root, relativePath))
  return createHash('sha256').update(content).digest('hex')
}

const readJsonIfPresent = async (relativePath) => {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))
  } catch {
    return null
  }
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
const commandPlan = buildPhase4CommandPlan()
const evidenceFiles = [
  'Backend/Chatify/package.json',
  'Backend/Chatify/package-lock.json',
  'Frontend/Chatify/package.json',
  'Frontend/Chatify/package-lock.json',
  'docs/security/audit/phase-1/inventory.json',
  'docs/security/audit/phase-2/threat-model.json',
  'docs/security/audit/phase-3/secret-scan.json',
  'docs/security/audit/phase-4/dependency-exceptions.json',
  'docs/security/audit/phase-4/install-script-policy.json',
  'docs/security/audit/phase-4/dependency-policy.json',
  'docs/security/audit/phase-4/dependency-policy.md',
]

const evidence = {
  schemaVersion: 1,
  phase: 4,
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
  dependencyPolicy: null,
  liveSupplyChain: {},
  intentionallyNotExecuted: [
    {
      action: 'dependency publisher or maintainer identity investigation',
      reason: 'Registry signature and provenance checks establish integrity metadata; publisher trust and package-code review remain human review responsibilities.',
    },
    {
      action: 'organization or branch-protection configuration changes',
      reason: 'Repository automation has read-only verification permissions and cannot safely mutate administrator-owned GitHub settings.',
    },
    {
      action: 'automatic force upgrades across major versions',
      reason: 'Major dependency upgrades require explicit compatibility review and are never applied with npm audit fix --force.',
    },
  ],
}

let failed = false
for (const relativePath of evidenceFiles) {
  if (!await exists(path.join(root, relativePath))) {
    evidence.evidenceFiles.push({ path: relativePath, missing: true })
    failed = true
    continue
  }
  evidence.evidenceFiles.push({ path: relativePath, sha256: await sha256File(relativePath) })
}

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

evidence.dependencyPolicy = await readJsonIfPresent('docs/security/audit/phase-4/dependency-policy.json')
if (!evidence.dependencyPolicy) failed = true
for (const project of ['backend', 'frontend']) {
  const report = await readJsonIfPresent(`.artifacts/security/phase-4/${project}/live-evidence.json`)
  evidence.liveSupplyChain[project] = report
  if (!report || report.summary?.result !== 'passed') failed = true
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
console.log(`\nPhase 4 reproduction evidence written to ${path.relative(root, outputPath)}.`)
console.log(`Result: ${evidence.summary.result}; ${evidence.summary.passed} passed, ${evidence.summary.failed} failed.`)

if (failed) process.exitCode = 1
