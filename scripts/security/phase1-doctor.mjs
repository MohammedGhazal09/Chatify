#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const checks = []

const add = (status, name, detail) => checks.push({ status, name, detail })
const exists = async (relativePath) => {
  try {
    await access(path.join(root, relativePath))
    return true
  } catch {
    return false
  }
}
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0], 10)
add(nodeMajor >= 20 ? 'pass' : 'fail', 'Node.js runtime', `${process.version}; required major >= 20`)

try {
  const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim()
  const npmMajor = Number.parseInt(npmVersion.split('.')[0], 10)
  add(npmMajor >= 10 ? 'pass' : 'warn', 'npm runtime', `${npmVersion}; recommended major >= 10`)
} catch (error) {
  add('fail', 'npm runtime', error.message)
}

try {
  const gitVersion = execFileSync('git', ['--version'], { encoding: 'utf8' }).trim()
  add('pass', 'Git runtime', gitVersion)
} catch (error) {
  add('fail', 'Git runtime', error.message)
}

const packageLocations = ['package.json', 'Backend/Chatify/package.json', 'Frontend/Chatify/package.json']
for (const manifestPath of packageLocations) {
  if (!await exists(manifestPath)) {
    add('fail', `Manifest ${manifestPath}`, 'missing')
    continue
  }

  try {
    const manifest = await readJson(manifestPath)
    add('pass', `Manifest ${manifestPath}`, `${manifest.name ?? '<unnamed>'}@${manifest.version ?? '<unversioned>'}`)

    const directory = path.posix.dirname(manifestPath)
    const lockPath = directory === '.' ? 'package-lock.json' : `${directory}/package-lock.json`
    const hasRuntimeDependencies = Object.keys(manifest.dependencies ?? {}).length > 0 || Object.keys(manifest.devDependencies ?? {}).length > 0
    const hasLock = await exists(lockPath)

    if (hasLock) add('pass', `Lockfile ${lockPath}`, 'present for clean installation')
    else if (hasRuntimeDependencies) add('fail', `Lockfile ${lockPath}`, 'missing while manifest declares dependencies')
    else add('pass', `Lockfile ${lockPath}`, 'not required because this manifest declares no dependencies')
  } catch (error) {
    add('fail', `Manifest ${manifestPath}`, `invalid JSON: ${error.message}`)
  }
}

const rootManifest = await readJson('package.json')
const requiredScripts = [
  'bootstrap:full',
  'doctor',
  'security:phase1:check',
  'security:phase1:generate',
  'security:phase1:reproduce',
  'security:phase1:test',
]
for (const script of requiredScripts) {
  add(rootManifest.scripts?.[script] ? 'pass' : 'fail', `Root script ${script}`, rootManifest.scripts?.[script] ?? 'missing')
}

const requiredFiles = [
  'Backend/Chatify/package-lock.json',
  'Frontend/Chatify/package-lock.json',
  'scripts/security/phase1-inventory.mjs',
  'scripts/security/lib/inventory.mjs',
  'docs/security/audit/phase-1/inventory.json',
  'docs/security/audit/phase-1/inventory.md',
]
for (const requiredFile of requiredFiles) {
  add(await exists(requiredFile) ? 'pass' : 'fail', `Required file ${requiredFile}`, await exists(requiredFile) ? 'present' : 'missing')
}

const environmentTemplates = [
  'Backend/Chatify/.env.example',
  'Frontend/Chatify/.env.example',
  '.env.example',
]
const presentTemplates = []
for (const template of environmentTemplates) {
  if (await exists(template)) presentTemplates.push(template)
}
add(presentTemplates.length > 0 ? 'pass' : 'fail', 'Environment templates', presentTemplates.length ? presentTemplates.join(', ') : 'none found')

try {
  const trackedEnvironmentFiles = execFileSync('git', ['ls-files', '.env', '**/.env'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim().split(/\r?\n/).filter(Boolean)
  add(trackedEnvironmentFiles.length === 0 ? 'pass' : 'warn', 'Tracked live .env files', trackedEnvironmentFiles.length ? trackedEnvironmentFiles.join(', ') : 'none')
} catch {
  add('warn', 'Tracked live .env files', 'unable to query Git index')
}

const summary = {
  pass: checks.filter((check) => check.status === 'pass').length,
  warn: checks.filter((check) => check.status === 'warn').length,
  fail: checks.filter((check) => check.status === 'fail').length,
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify({ checks, summary }, null, 2)}\n`)
} else {
  for (const check of checks) {
    console.log(`[${check.status.toUpperCase()}] ${check.name}: ${check.detail}`)
  }
  console.log(`Doctor summary: ${summary.pass} passed, ${summary.warn} warnings, ${summary.fail} failed.`)
}

if (summary.fail > 0) process.exitCode = 1
