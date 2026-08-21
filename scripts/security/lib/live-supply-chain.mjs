import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  evaluateNpmAuditReport,
  validateDependencyExceptions,
} from './dependency-policy.mjs'

const EXCEPTIONS_PATH = 'docs/security/audit/phase-4/dependency-exceptions.json'
const SECRET_FIELD_NAMES = new Set(['auth', 'authorization', 'cookie', 'setcookie'])

const parseJson = (text) => {
  try {
    return { ok: true, value: JSON.parse(String(text ?? '').trim() || 'null') }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

const sanitizeString = (value) => {
  const text = String(value)
  if (!/^https?:\/\//i.test(text)) return text
  try {
    const url = new URL(text)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return text.replace(/:\/\/[^/@\s]+@/g, '://[redacted]@')
  }
}

const shouldRedactField = (key) => {
  const normalized = String(key ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase()
  return SECRET_FIELD_NAMES.has(normalized)
    || /(?:token|password|passwd|pwd|secret|credential)$/.test(normalized)
}

export const sanitizeStructuredEvidence = (value, key = '') => {
  if (shouldRedactField(key)) return '[redacted]'
  if (Array.isArray(value)) return value.map((item) => sanitizeStructuredEvidence(item))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeStructuredEvidence(entryValue, entryKey),
    ]))
  }
  if (typeof value === 'string') return sanitizeString(value)
  return value
}

const packageNameFromLockPath = (lockPath) => {
  const marker = 'node_modules/'
  const index = String(lockPath ?? '').lastIndexOf(marker)
  if (index === -1) return null
  const remaining = String(lockPath).slice(index + marker.length)
  if (!remaining) return null
  const parts = remaining.split('/')
  return remaining.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

export const inspectInstallScriptCoverage = ({ manifest, lockfile }) => {
  const allowScripts = manifest?.allowScripts ?? {}
  const entries = []

  for (const [lockPath, entry] of Object.entries(lockfile?.packages ?? {})) {
    if (!lockPath || entry?.hasInstallScript !== true) continue
    const packageName = packageNameFromLockPath(lockPath)
    const version = String(entry?.version ?? '')
    if (!packageName || !version) continue
    const pinnedKey = `${packageName}@${version}`
    let decision = 'unreviewed'
    if (allowScripts[pinnedKey] === true) decision = 'allow'
    else if (allowScripts[packageName] === false) decision = 'deny'
    entries.push({ package: packageName, version, lockPath, decision })
  }

  entries.sort((left, right) => (
    `${left.package}:${left.version}:${left.lockPath}`
      .localeCompare(`${right.package}:${right.version}:${right.lockPath}`)
  ))
  const pendingPackages = entries
    .filter((entry) => entry.decision === 'unreviewed')
    .map((entry) => `${entry.package}@${entry.version}`)

  return {
    reviewedCount: entries.length - pendingPackages.length,
    pendingCount: pendingPackages.length,
    pendingPackages,
    entries,
  }
}


const defaultRunCommand = ({ command, args, cwd }) => spawnSync(command, args, {
  cwd,
  encoding: 'utf8',
  env: process.env,
  shell: process.platform === 'win32',
  stdio: ['ignore', 'pipe', 'pipe'],
})

const writeJson = async (filePath, value) => {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

const commandResult = ({ name, args, cwd, runCommand }) => {
  const started = Date.now()
  const result = runCommand({ command: 'npm', args, cwd }) ?? {}
  return {
    name,
    command: ['npm', ...args].join(' '),
    exitCode: Number.isInteger(result.status) ? result.status : 1,
    durationMs: Date.now() - started,
    parsed: parseJson(result.stdout),
  }
}

export const collectLiveSupplyChainEvidence = async ({
  root,
  project,
  directory,
  runCommand = defaultRunCommand,
  now = new Date(),
} = {}) => {
  if (!root || !['backend', 'frontend'].includes(project) || !directory) {
    throw new Error('Live supply-chain evidence requires root, backend/frontend project, and directory')
  }

  const projectRoot = path.resolve(root, directory)
  const outputDir = path.join(root, '.artifacts/security/phase-4', project)
  const [manifest, lockfile, rawExceptions] = await Promise.all([
    readFile(path.join(projectRoot, 'package.json'), 'utf8').then(JSON.parse),
    readFile(path.join(projectRoot, 'package-lock.json'), 'utf8').then(JSON.parse),
    readFile(path.join(root, EXCEPTIONS_PATH), 'utf8').then(JSON.parse),
  ])
  const exceptions = validateDependencyExceptions(rawExceptions, { now })

  const commands = [
    commandResult({
      name: 'registry-signatures',
      args: ['audit', 'signatures', '--json'],
      cwd: projectRoot,
      runCommand,
    }),
    commandResult({
      name: 'production-audit',
      args: ['audit', '--omit=dev', '--json'],
      cwd: projectRoot,
      runCommand,
    }),
    commandResult({
      name: 'cyclonedx-sbom',
      args: ['sbom', '--package-lock-only', '--sbom-format=cyclonedx', '--sbom-type=application'],
      cwd: projectRoot,
      runCommand,
    }),
  ]

  const [signatureCommand, auditCommand, sbomCommand] = commands
  const installScripts = inspectInstallScriptCoverage({ manifest, lockfile })

  const signatureValue = signatureCommand.parsed.ok
    ? sanitizeStructuredEvidence(signatureCommand.parsed.value)
    : { error: 'npm audit signatures did not return valid JSON' }
  const signatureState = {
    verified: signatureCommand.exitCode === 0 && signatureCommand.parsed.ok,
    exitCode: signatureCommand.exitCode,
  }

  let auditValue = null
  let auditEvaluation = {
    schemaVersion: 1,
    project,
    findings: [],
    summary: { total: 1, excepted: 0, blocking: 1, high: 0, critical: 0 },
    error: 'npm audit did not return valid auditReportVersion 2 JSON',
  }
  if (auditCommand.parsed.ok) {
    auditValue = sanitizeStructuredEvidence(auditCommand.parsed.value)
    try {
      auditEvaluation = evaluateNpmAuditReport({
        project,
        audit: auditCommand.parsed.value,
        lockfile,
        exceptions,
      })
    } catch (error) {
      auditEvaluation.error = error instanceof Error ? error.message : String(error)
    }
  }

  const sbomValue = sbomCommand.parsed.ok
    ? sanitizeStructuredEvidence(sbomCommand.parsed.value)
    : { error: 'npm sbom did not return valid JSON' }
  const sbomState = {
    generated: sbomCommand.exitCode === 0
      && sbomCommand.parsed.ok
      && sbomCommand.parsed.value?.bomFormat === 'CycloneDX',
    bomFormat: sbomCommand.parsed.value?.bomFormat ?? null,
    componentCount: Array.isArray(sbomCommand.parsed.value?.components)
      ? sbomCommand.parsed.value.components.length
      : 0,
    exitCode: sbomCommand.exitCode,
  }

  const gates = {
    noPendingInstallScripts: installScripts.pendingCount === 0,
    registrySignaturesVerified: signatureState.verified,
    noBlockingAdvisories: auditEvaluation.summary.blocking === 0,
    sbomGenerated: sbomState.generated,
  }
  const failedGates = Object.entries(gates).filter(([, passed]) => !passed).map(([name]) => name)

  const report = {
    schemaVersion: 1,
    phase: 4,
    project,
    generatedAt: now.toISOString(),
    directory,
    commands: commands.map(({ name, command, exitCode, durationMs }) => ({
      name,
      command,
      exitCode,
      durationMs,
    })),
    installScripts,
    signatures: signatureState,
    audit: auditEvaluation,
    sbom: sbomState,
    gates,
    summary: {
      result: failedGates.length === 0 ? 'passed' : 'failed',
      failedGates,
    },
  }

  await Promise.all([
    writeJson(path.join(outputDir, 'install-scripts-pending.json'), sanitizeStructuredEvidence(installScripts)),
    writeJson(path.join(outputDir, 'registry-signatures.json'), signatureValue),
    writeJson(path.join(outputDir, 'npm-audit.json'), auditValue ?? {
      error: 'npm audit did not return valid JSON',
    }),
    writeJson(path.join(outputDir, 'audit-evaluation.json'), auditEvaluation),
    writeJson(path.join(outputDir, 'cyclonedx-sbom.json'), sbomValue),
    writeJson(path.join(outputDir, 'live-evidence.json'), report),
  ])

  return report
}
