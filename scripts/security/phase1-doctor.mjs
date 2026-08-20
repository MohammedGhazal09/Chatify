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
const normalizeVersion = (value) => String(value ?? '').trim().replace(/^v/, '')
const isExactVersion = (value) => /^\d+\.\d+\.\d+$/.test(value)

let rootManifest = {}
try {
  rootManifest = await readJson('package.json')
} catch (error) {
  add('fail', 'Root manifest metadata', `unable to parse package.json: ${error.message}`)
}

let expectedNodeVersion = null
try {
  expectedNodeVersion = normalizeVersion(await readFile(path.join(root, '.nvmrc'), 'utf8'))
  add(
    isExactVersion(expectedNodeVersion) ? 'pass' : 'fail',
    'Pinned Node.js version',
    isExactVersion(expectedNodeVersion) ? `${expectedNodeVersion} from .nvmrc` : `.nvmrc must contain an exact x.y.z version; received ${expectedNodeVersion || '<empty>'}`,
  )
} catch (error) {
  add('fail', 'Pinned Node.js version', `unable to read .nvmrc: ${error.message}`)
}

if (expectedNodeVersion && isExactVersion(expectedNodeVersion)) {
  add(
    process.versions.node === expectedNodeVersion ? 'pass' : 'fail',
    'Node.js runtime',
    `${process.version}; required v${expectedNodeVersion} from .nvmrc`,
  )
  const declaredNodeVersion = normalizeVersion(rootManifest.engines?.node)
  add(
    declaredNodeVersion === expectedNodeVersion ? 'pass' : 'fail',
    'Node.js engine declaration',
    declaredNodeVersion
      ? `package.json declares ${declaredNodeVersion}; required ${expectedNodeVersion}`
      : `package.json must declare engines.node as ${expectedNodeVersion}`,
  )
} else {
  add('fail', 'Node.js runtime', `${process.version}; no valid pinned version is available`)
}

const packageManagerMatch = /^npm@(\d+\.\d+\.\d+)$/.exec(rootManifest.packageManager ?? '')
const expectedNpmVersion = packageManagerMatch?.[1] ?? null
add(
  expectedNpmVersion ? 'pass' : 'fail',
  'Pinned npm version',
  expectedNpmVersion
    ? `${expectedNpmVersion} from package.json packageManager`
    : 'package.json packageManager must be an exact npm@x.y.z value',
)

if (expectedNpmVersion) {
  const declaredNpmVersion = normalizeVersion(rootManifest.engines?.npm)
  add(
    declaredNpmVersion === expectedNpmVersion ? 'pass' : 'fail',
    'npm engine declaration',
    declaredNpmVersion
      ? `package.json declares ${declaredNpmVersion}; required ${expectedNpmVersion}`
      : `package.json must declare engines.npm as ${expectedNpmVersion}`,
  )
}

try {
  const npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim()
  add(
    expectedNpmVersion && npmVersion === expectedNpmVersion ? 'pass' : 'fail',
    'npm runtime',
    expectedNpmVersion ? `${npmVersion}; required ${expectedNpmVersion}` : `${npmVersion}; no valid pinned version is available`,
  )
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
  '.nvmrc',
  'Backend/Chatify/package-lock.json',
  'Frontend/Chatify/package-lock.json',
  'scripts/security/phase1-inventory.mjs',
  'scripts/security/lib/inventory.mjs',
  'docs/security/audit/phase-1/inventory.json',
  'docs/security/audit/phase-1/inventory.md',
]
for (const requiredFile of requiredFiles) {
  const present = await exists(requiredFile)
  add(present ? 'pass' : 'fail', `Required file ${requiredFile}`, present ? 'present' : 'missing')
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
