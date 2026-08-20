#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const outputPath = path.join(root, '.artifacts/security/phase-1/run-evidence.json')

const runGit = (args) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
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

const commandPlan = [
  { name: 'clean-install-backend', command: 'npm', args: ['ci'], cwd: 'Backend/Chatify' },
  { name: 'clean-install-frontend', command: 'npm', args: ['ci'], cwd: 'Frontend/Chatify' },
  { name: 'phase1-parser-tests', command: 'npm', args: ['run', 'security:phase1:test'], cwd: '.' },
  { name: 'phase1-inventory-drift-check', command: 'npm', args: ['run', 'security:phase1:check'], cwd: '.' },
  { name: 'phase1-environment-doctor', command: 'npm', args: ['run', 'doctor'], cwd: '.' },
  { name: 'repository-quality-suite', command: 'npm', args: ['run', 'quality'], cwd: '.' },
  { name: 'operations-guard', command: 'npm', args: ['run', 'ops:check'], cwd: '.' },
]

const evidence = {
  schemaVersion: 1,
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
    node: process.version,
    npm: npmVersion,
    platform: process.platform,
    architecture: process.arch,
  },
  lockfiles: [],
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
  ],
}

for (const lockfile of ['Backend/Chatify/package-lock.json', 'Frontend/Chatify/package-lock.json']) {
  evidence.lockfiles.push({ path: lockfile, sha256: await sha256File(lockfile) })
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
  const record = {
    name: item.name,
    cwd: item.cwd,
    command: [item.command, ...item.args].join(' '),
    exitCode,
    signal: result.signal ?? null,
    durationMs: Date.now() - started,
  }
  evidence.commands.push(record)
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
console.log(`\nPhase 1 reproduction evidence written to ${path.relative(root, outputPath)}.`)
console.log(`Result: ${evidence.summary.result}; ${evidence.summary.passed} passed, ${evidence.summary.failed} failed.`)

if (failed) process.exitCode = 1
