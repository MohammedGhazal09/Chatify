import { createHash } from 'node:crypto'
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import path from 'node:path'

const GENERATED_JSON = 'docs/security/audit/phase-4/dependency-policy.json'
const GENERATED_MARKDOWN = 'docs/security/audit/phase-4/dependency-policy.md'
const EXCEPTIONS_PATH = 'docs/security/audit/phase-4/dependency-exceptions.json'
const INSTALL_SCRIPT_POLICY_PATH = 'docs/security/audit/phase-4/install-script-policy.json'
const DEPENDABOT_PATH = '.github/dependabot.yml'
const WORKFLOWS_PATH = '.github/workflows'
const MAX_EXCEPTION_DAYS = 90

const DEFAULT_PROJECTS = [
  {
    id: 'backend',
    manifestPath: 'Backend/Chatify/package.json',
    lockfilePath: 'Backend/Chatify/package-lock.json',
  },
  {
    id: 'frontend',
    manifestPath: 'Frontend/Chatify/package.json',
    lockfilePath: 'Frontend/Chatify/package-lock.json',
  },
]

const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i
const EXACT_VERSION_PATTERN = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const ADVISORY_ID_PATTERN = /^(?:GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}|CVE-\d{4}-\d{4,})$/i
const INTEGRITY_PATTERN = /^sha(?:1|256|384|512)-[A-Za-z0-9+/=]+$/
const FULL_SHA_PATTERN = /^[a-f0-9]{40}$/i
const REMOTE_ACTION_PATTERN = /^([^@\s]+)@([^@\s]+)$/
const REGISTRY_PREFIX = 'https://registry.npmjs.org/'

const toPosix = (value) => value.replaceAll(path.sep, '/')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const exists = async (filePath) => {
  try {
    await access(filePath, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

const readJson = async (filePath, fallback = undefined) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT' && fallback !== undefined) return fallback
    throw error
  }
}

const exactObjectEqual = (left = {}, right = {}) => (
  JSON.stringify(Object.fromEntries(Object.entries(left).sort(([a], [b]) => a.localeCompare(b))))
  === JSON.stringify(Object.fromEntries(Object.entries(right).sort(([a], [b]) => a.localeCompare(b))))
)

const violation = (code, message, details = {}) => ({ code, message, ...details })
const sortViolations = (items) => [...items].sort((left, right) => (
  `${left.code}:${left.project ?? ''}:${left.path ?? ''}:${left.package ?? ''}:${left.message}`
    .localeCompare(`${right.code}:${right.project ?? ''}:${right.path ?? ''}:${right.package ?? ''}:${right.message}`)
))

const parseDate = (value, message) => {
  const parsed = new Date(value)
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(message)
  return parsed
}

const exceptionKey = ({ project, package: packageName, version, advisoryId }) => (
  [project, packageName, version, advisoryId.toUpperCase()].join('\0')
)

export const validateDependencyExceptions = (raw, {
  now = new Date(),
  maxDays = MAX_EXCEPTION_DAYS,
} = {}) => {
  if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.entries)) {
    throw new Error('Dependency exception policy must use schemaVersion 1 with an entries array')
  }

  const validated = new Map()
  const maxExpiry = now.getTime() + maxDays * 24 * 60 * 60 * 1000

  raw.entries.forEach((entry, index) => {
    const label = `Dependency exception ${index + 1}`
    if (!['backend', 'frontend'].includes(entry?.project)) throw new Error(`${label} requires a known project`)
    if (!PACKAGE_NAME_PATTERN.test(entry?.package ?? '')) throw new Error(`${label} requires an exact package name`)
    if (!EXACT_VERSION_PATTERN.test(entry?.version ?? '')) throw new Error(`${label} requires an exact version`)
    if (!ADVISORY_ID_PATTERN.test(entry?.advisoryId ?? '')) throw new Error(`${label} requires an exact GHSA or CVE advisory id`)
    if (!['low', 'moderate', 'high', 'critical'].includes(entry?.severity)) throw new Error(`${label} has an invalid severity`)
    if (entry.severity === 'critical') throw new Error(`${label} cannot except a critical advisory`)
    if (typeof entry.owner !== 'string' || entry.owner.trim().length < 3) throw new Error(`${label} requires an accountable owner`)
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 20) throw new Error(`${label} requires a specific reason of at least 20 characters`)
    if (!Array.isArray(entry.compensatingControls) || entry.compensatingControls.length === 0) {
      throw new Error(`${label} requires compensating controls`)
    }
    if (entry.compensatingControls.some((control) => typeof control !== 'string' || control.trim().length < 12)) {
      throw new Error(`${label} contains an invalid compensating control`)
    }
    const expiry = parseDate(entry.expiresAt, `${label} requires a valid expiresAt`)
    if (expiry <= now) throw new Error(`${label} is expired`)
    if (expiry.getTime() > maxExpiry) throw new Error(`${label} expires more than ${maxDays} days from review`)

    const normalized = {
      project: entry.project,
      package: entry.package,
      version: entry.version.replace(/^v/, ''),
      advisoryId: entry.advisoryId.toUpperCase(),
      severity: entry.severity,
      owner: entry.owner.trim(),
      reason: entry.reason.trim(),
      compensatingControls: entry.compensatingControls.map((control) => control.trim()),
      expiresAt: expiry.toISOString(),
    }
    const key = exceptionKey(normalized)
    if (validated.has(key)) throw new Error(`${label} duplicates an existing dependency exception`)
    validated.set(key, normalized)
  })

  return validated
}

const installScriptKey = ({ project, package: packageName, version, decision }) => (
  decision === 'allow'
    ? `${project}\0${packageName}\0${version}`
    : `${project}\0${packageName}\0*`
)

export const validateInstallScriptPolicy = (raw) => {
  if (!raw || raw.schemaVersion !== 1 || !Array.isArray(raw.entries)) {
    throw new Error('Install-script policy must use schemaVersion 1 with an entries array')
  }

  const entries = []
  const byKey = new Map()
  raw.entries.forEach((entry, index) => {
    const label = `Install-script policy entry ${index + 1}`
    if (!['backend', 'frontend'].includes(entry?.project)) throw new Error(`${label} requires a known project`)
    if (!PACKAGE_NAME_PATTERN.test(entry?.package ?? '')) throw new Error(`${label} requires an exact package name`)
    if (!['allow', 'deny'].includes(entry?.decision)) throw new Error(`${label} requires allow or deny decision`)
    if (entry.decision === 'allow' && !EXACT_VERSION_PATTERN.test(entry?.version ?? '')) {
      throw new Error(`${label} allow decision requires an exact version`)
    }
    if (entry.decision === 'deny' && entry.version !== undefined) {
      throw new Error(`${label} denial must be name-wide and must not include a version`)
    }
    if (typeof entry.owner !== 'string' || entry.owner.trim().length < 3) throw new Error(`${label} requires an owner`)
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 20) throw new Error(`${label} requires a specific reason`)

    const normalized = {
      project: entry.project,
      package: entry.package,
      ...(entry.decision === 'allow' ? { version: entry.version.replace(/^v/, '') } : {}),
      decision: entry.decision,
      owner: entry.owner.trim(),
      reason: entry.reason.trim(),
    }
    const key = installScriptKey(normalized)
    if (byKey.has(key)) throw new Error(`${label} duplicates an existing install-script decision`)
    byKey.set(key, normalized)
    entries.push(normalized)
  })

  entries.sort((left, right) => (
    `${left.project}:${left.package}:${left.version ?? '*'}:${left.decision}`
      .localeCompare(`${right.project}:${right.package}:${right.version ?? '*'}:${right.decision}`)
  ))
  return { schemaVersion: 1, entries, byKey }
}

const packageNameFromLockPath = (lockPath) => {
  const marker = 'node_modules/'
  const index = lockPath.lastIndexOf(marker)
  if (index === -1) return null
  const remaining = lockPath.slice(index + marker.length)
  if (!remaining) return null
  const segments = remaining.split('/')
  return remaining.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0]
}

const classifyDependencySource = (entry) => {
  if (entry?.inBundle === true || entry?.bundled === true) return 'bundled'
  const version = String(entry?.version ?? '')
  const resolved = String(entry?.resolved ?? '')
  if (entry?.link === true || resolved.startsWith('link:')) return 'link'
  if (resolved.startsWith('file:') || version.startsWith('file:')) return 'local-file'
  if (/^(?:git\+|git:|git@|github:|https?:\/\/github\.com\/[^/]+\/[^/]+\.git)/i.test(resolved || version)) return 'git'
  if (/^http:\/\//i.test(resolved)) return 'insecure-http'
  if (resolved.startsWith(REGISTRY_PREFIX) || resolved === 'registry.npmjs.org') return 'npm-registry'
  if (/^https:\/\//i.test(resolved)) return 'remote-tarball'
  if (!resolved) return 'missing'
  return 'unknown'
}

const selectorSource = (selector) => {
  const value = String(selector ?? '').trim()
  if (/^(?:git\+|git:|git@|github:)/i.test(value)) return 'git'
  if (/^(?:file:|link:)/i.test(value)) return 'local'
  if (/^http:\/\//i.test(value)) return 'insecure-http'
  if (/^https:\/\//i.test(value)) return 'remote'
  if (/^(?:latest|next|beta|canary|\*)$/i.test(value)) return 'mutable-tag'
  return 'semver'
}

const readProject = async (root, project, installPolicy) => {
  const manifestPath = path.join(root, project.manifestPath)
  const lockfilePath = path.join(root, project.lockfilePath)
  const [manifest, lockfile] = await Promise.all([readJson(manifestPath), readJson(lockfilePath)])
  const violations = []

  if (lockfile.lockfileVersion !== 3 || !lockfile.packages || typeof lockfile.packages !== 'object') {
    violations.push(violation('lockfile-version-invalid', 'Lockfile must use lockfileVersion 3 with a packages map.', {
      project: project.id,
      path: project.lockfilePath,
    }))
  }

  const rootPackage = lockfile.packages?.[''] ?? {}
  for (const dependencyType of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    if (!exactObjectEqual(manifest[dependencyType] ?? {}, rootPackage[dependencyType] ?? {})) {
      violations.push(violation('lockfile-root-mismatch', `${dependencyType} in package.json and package-lock root metadata differ.`, {
        project: project.id,
        path: project.lockfilePath,
      }))
    }
  }

  const directTypes = new Map()
  for (const dependencyType of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [packageName, selector] of Object.entries(manifest[dependencyType] ?? {})) {
      directTypes.set(packageName, dependencyType)
      const source = selectorSource(selector)
      if (source !== 'semver') {
        violations.push(violation(`manifest-selector-${source}`, `Direct dependency ${packageName} uses disallowed selector ${selector}.`, {
          project: project.id,
          path: project.manifestPath,
          package: packageName,
        }))
      }
    }
  }

  const packages = []
  const installScripts = []
  const deprecatedDirectPackages = []
  let integrityEligible = 0
  let integrityPresent = 0

  for (const [lockPath, entry] of Object.entries(lockfile.packages ?? {})) {
    if (lockPath === '') continue
    const packageName = packageNameFromLockPath(lockPath)
    const version = String(entry?.version ?? '')
    const sourceType = classifyDependencySource(entry)
    const directType = packageName && lockPath === `node_modules/${packageName}` ? directTypes.get(packageName) ?? null : null
    const record = {
      package: packageName ?? lockPath,
      version,
      lockPath: toPosix(lockPath),
      sourceType,
      directType,
      dev: entry?.dev === true,
      optional: entry?.optional === true,
      peer: entry?.peer === true,
      hasInstallScript: entry?.hasInstallScript === true,
      deprecated: typeof entry?.deprecated === 'string' ? entry.deprecated : null,
      integrityPresent: sourceType === 'bundled' ? null : INTEGRITY_PATTERN.test(entry?.integrity ?? ''),
      integrityInherited: sourceType === 'bundled',
    }
    packages.push(record)

    if (!EXACT_VERSION_PATTERN.test(version)) {
      violations.push(violation('lockfile-version-not-exact', `Lockfile entry ${lockPath} does not use an exact semantic version.`, {
        project: project.id,
        path: project.lockfilePath,
        package: packageName ?? lockPath,
      }))
    }

    const sourceCodes = {
      git: 'dependency-source-git',
      'local-file': 'dependency-source-local-file',
      link: 'dependency-source-link',
      'insecure-http': 'dependency-source-insecure-http',
      'remote-tarball': 'dependency-source-remote-tarball',
      missing: 'dependency-source-missing',
      unknown: 'dependency-source-unknown',
    }
    if (sourceCodes[sourceType]) {
      violations.push(violation(sourceCodes[sourceType], `Lockfile entry ${lockPath} uses disallowed source type ${sourceType}.`, {
        project: project.id,
        path: project.lockfilePath,
        package: packageName ?? lockPath,
      }))
    }

    if (entry?.link !== true && sourceType !== 'bundled') {
      integrityEligible += 1
      if (record.integrityPresent) integrityPresent += 1
      else {
        violations.push(violation('dependency-integrity-missing', `Lockfile entry ${lockPath} is missing valid SRI integrity metadata.`, {
          project: project.id,
          path: project.lockfilePath,
          package: packageName ?? lockPath,
        }))
      }
    }

    if (directType && record.deprecated) {
      deprecatedDirectPackages.push({
        package: packageName,
        version,
        dependencyType: directType,
        notice: record.deprecated,
      })
      violations.push(violation('direct-dependency-deprecated', `Direct dependency ${packageName}@${version} is deprecated.`, {
        project: project.id,
        path: project.manifestPath,
        package: packageName,
      }))
    }

    if (record.hasInstallScript && packageName) {
      const allowKey = `${project.id}\0${packageName}\0${version}`
      const denyKey = `${project.id}\0${packageName}\0*`
      const policyEntry = installPolicy.byKey.get(allowKey) ?? installPolicy.byKey.get(denyKey)
      const decision = policyEntry?.decision ?? 'unreviewed'
      installScripts.push({ package: packageName, version, lockPath: toPosix(lockPath), decision })
      if (!policyEntry) {
        violations.push(violation('install-script-unreviewed', `Install script for ${packageName}@${version} has no reviewed policy decision.`, {
          project: project.id,
          path: project.lockfilePath,
          package: packageName,
        }))
      } else {
        const expectedManifestKey = decision === 'allow' ? `${packageName}@${version}` : packageName
        const expectedManifestValue = decision === 'allow'
        if (manifest.allowScripts?.[expectedManifestKey] !== expectedManifestValue) {
          violations.push(violation('install-script-manifest-mismatch', `package.json allowScripts does not match the reviewed ${decision} decision for ${packageName}@${version}.`, {
            project: project.id,
            path: project.manifestPath,
            package: packageName,
          }))
        }
      }
    }
  }

  const installedScriptKeys = new Set(installScripts.flatMap((item) => [
    `${project.id}\0${item.package}\0${item.version}`,
    `${project.id}\0${item.package}\0*`,
  ]))
  for (const policyEntry of installPolicy.entries.filter((entry) => entry.project === project.id)) {
    const key = installScriptKey(policyEntry)
    if (!installedScriptKeys.has(key)) {
      violations.push(violation('install-script-policy-stale', `Install-script policy entry for ${policyEntry.package}${policyEntry.version ? `@${policyEntry.version}` : ''} matches no lockfile script package.`, {
        project: project.id,
        path: INSTALL_SCRIPT_POLICY_PATH,
        package: policyEntry.package,
      }))
    }
  }

  const reviewedManifestKeys = new Set(installPolicy.entries
    .filter((entry) => entry.project === project.id)
    .map((entry) => entry.decision === 'allow' ? `${entry.package}@${entry.version}` : entry.package))
  for (const [manifestKey] of Object.entries(manifest.allowScripts ?? {})) {
    if (!reviewedManifestKeys.has(manifestKey)) {
      violations.push(violation('install-script-manifest-unreviewed', `package.json allowScripts entry ${manifestKey} lacks a matching reviewed policy record.`, {
        project: project.id,
        path: project.manifestPath,
        package: manifestKey,
      }))
    }
  }

  packages.sort((left, right) => `${left.package}:${left.version}:${left.lockPath}`.localeCompare(`${right.package}:${right.version}:${right.lockPath}`))
  installScripts.sort((left, right) => `${left.package}:${left.version}:${left.lockPath}`.localeCompare(`${right.package}:${right.version}:${right.lockPath}`))
  deprecatedDirectPackages.sort((left, right) => left.package.localeCompare(right.package))

  const directDependencies = [...directTypes.entries()].map(([packageName, dependencyType]) => ({
    package: packageName,
    selector: manifest[dependencyType]?.[packageName] ?? null,
    dependencyType,
    lockedVersion: lockfile.packages?.[`node_modules/${packageName}`]?.version ?? null,
  })).sort((left, right) => left.package.localeCompare(right.package))

  return {
    project: {
      id: project.id,
      manifestPath: project.manifestPath,
      lockfilePath: project.lockfilePath,
      manifest: {
        name: manifest.name ?? null,
        version: manifest.version ?? null,
        dependencyCount: Object.keys(manifest.dependencies ?? {}).length,
        devDependencyCount: Object.keys(manifest.devDependencies ?? {}).length,
        optionalDependencyCount: Object.keys(manifest.optionalDependencies ?? {}).length,
        selectorSha256: sha256(JSON.stringify(directDependencies)),
      },
      lockfile: {
        lockfileVersion: lockfile.lockfileVersion ?? null,
        packageCount: packages.length,
        productionPackageCount: packages.filter((item) => !item.dev).length,
        devPackageCount: packages.filter((item) => item.dev).length,
        optionalPackageCount: packages.filter((item) => item.optional).length,
        integrityCoverage: {
          eligible: integrityEligible,
          present: integrityPresent,
          complete: integrityEligible === integrityPresent,
        },
      },
      directDependencies,
      installScripts,
      deprecatedDirectPackages,
      packages,
    },
    violations,
  }
}

const listFilesRecursively = async (root, relative = '') => {
  const absolute = path.join(root, relative)
  if (!await exists(absolute)) return []
  const metadata = await stat(absolute)
  if (!metadata.isDirectory()) return [toPosix(relative)]
  const output = []
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const child = path.join(relative, entry.name)
    if (entry.isDirectory()) output.push(...await listFilesRecursively(root, child))
    else if (entry.isFile()) output.push(toPosix(child))
  }
  return output
}

const scanWorkflows = async (root) => {
  const workflowFiles = (await listFilesRecursively(root, WORKFLOWS_PATH))
    .filter((file) => /\.ya?ml$/i.test(file))
    .sort()
  const remoteActions = []
  const violations = []

  for (const workflowPath of workflowFiles) {
    const text = await readFile(path.join(root, workflowPath), 'utf8')
    const regex = /^\s*-?\s*uses:\s*["']?([^\s"'#]+)["']?/gm
    let match
    while ((match = regex.exec(text)) !== null) {
      const reference = match[1]
      const line = text.slice(0, match.index).split('\n').length
      if (reference.startsWith('./')) continue
      if (reference.startsWith('docker://')) {
        const pinned = /@sha256:[a-f0-9]{64}$/i.test(reference)
        remoteActions.push({ workflowPath, line, action: reference, ref: null, pinned, type: 'docker' })
        if (!pinned) {
          violations.push(violation('workflow-action-mutable-ref', `Docker action ${reference} is not pinned by digest.`, {
            path: workflowPath,
          }))
        }
        continue
      }
      const parsed = REMOTE_ACTION_PATTERN.exec(reference)
      const action = parsed?.[1] ?? reference
      const actionRef = parsed?.[2] ?? ''
      const pinned = FULL_SHA_PATTERN.test(actionRef)
      remoteActions.push({ workflowPath, line, action, ref: actionRef, pinned, type: 'github' })
      if (!pinned) {
        violations.push(violation('workflow-action-mutable-ref', `Remote action ${reference} is not pinned to a full commit SHA.`, {
          path: workflowPath,
        }))
      }
    }
  }

  remoteActions.sort((left, right) => `${left.workflowPath}:${left.line}:${left.action}`.localeCompare(`${right.workflowPath}:${right.line}:${right.action}`))
  return { workflowFiles, remoteActions, violations }
}

const parseDependabot = async (root) => {
  const absolute = path.join(root, DEPENDABOT_PATH)
  const required = [
    { ecosystem: 'npm', directory: '/Backend/Chatify' },
    { ecosystem: 'npm', directory: '/Frontend/Chatify' },
    { ecosystem: 'github-actions', directory: '/' },
  ]
  if (!await exists(absolute)) {
    return {
      path: DEPENDABOT_PATH,
      entries: [],
      required,
      missing: required,
      complete: false,
      violations: [violation('dependabot-coverage-missing', 'Dependabot configuration is missing.', { path: DEPENDABOT_PATH })],
    }
  }

  const text = await readFile(absolute, 'utf8')
  const entries = []
  let current = null
  for (const line of text.split('\n')) {
    const ecosystemMatch = /^\s*-\s*package-ecosystem:\s*["']?([^"'#]+?)["']?\s*$/.exec(line)
    if (ecosystemMatch) {
      if (current) entries.push(current)
      current = { ecosystem: ecosystemMatch[1].trim(), directory: null }
      continue
    }
    if (!current) continue
    const directoryMatch = /^\s*directory:\s*["']?([^"'#]+?)["']?\s*$/.exec(line)
    if (directoryMatch) current.directory = directoryMatch[1].trim()
  }
  if (current) entries.push(current)
  entries.sort((left, right) => `${left.ecosystem}:${left.directory}`.localeCompare(`${right.ecosystem}:${right.directory}`))
  const missing = required.filter((item) => !entries.some((entry) => (
    entry.ecosystem === item.ecosystem && entry.directory === item.directory
  )))
  return {
    path: DEPENDABOT_PATH,
    entries,
    required,
    missing,
    complete: missing.length === 0,
    violations: missing.length === 0 ? [] : [violation('dependabot-coverage-missing', `Dependabot is missing ${missing.map((item) => `${item.ecosystem}:${item.directory}`).join(', ')}.`, {
      path: DEPENDABOT_PATH,
    })],
  }
}

const serializeExceptions = (exceptions) => [...exceptions.values()].sort((left, right) => (
  exceptionKey(left).localeCompare(exceptionKey(right))
))

export const buildDependencyPolicy = async (root, {
  now = new Date(),
  projects = DEFAULT_PROJECTS,
  exceptionsPath = EXCEPTIONS_PATH,
  installScriptPolicyPath = INSTALL_SCRIPT_POLICY_PATH,
} = {}) => {
  const [rawExceptions, rawInstallPolicy, workflows, dependabot] = await Promise.all([
    readJson(path.join(root, exceptionsPath), { schemaVersion: 1, entries: [] }),
    readJson(path.join(root, installScriptPolicyPath), { schemaVersion: 1, entries: [] }),
    scanWorkflows(root),
    parseDependabot(root),
  ])
  const exceptions = validateDependencyExceptions(rawExceptions, { now })
  const installPolicy = validateInstallScriptPolicy(rawInstallPolicy)

  const projectResults = await Promise.all(projects.map((project) => readProject(root, project, installPolicy)))
  const reportProjects = projectResults.map((result) => result.project)
  const violations = sortViolations([
    ...projectResults.flatMap((result) => result.violations),
    ...workflows.violations,
    ...dependabot.violations,
  ])

  const hasCodes = (...codes) => violations.some((item) => codes.includes(item.code))
  const exitGate = {
    lockfilesUseVersion3: !hasCodes('lockfile-version-invalid'),
    manifestsMatchLockfiles: !hasCodes('lockfile-root-mismatch'),
    dependencyVersionsExact: !hasCodes('lockfile-version-not-exact'),
    dependencySourcesTrusted: !violations.some((item) => item.code.startsWith('dependency-source-') || item.code.startsWith('manifest-selector-')),
    dependencyIntegrityComplete: !hasCodes('dependency-integrity-missing'),
    installScriptsReviewed: !violations.some((item) => item.code.startsWith('install-script-')),
    noDeprecatedDirectDependencies: !hasCodes('direct-dependency-deprecated'),
    remoteActionsPinned: !hasCodes('workflow-action-mutable-ref'),
    dependabotCoverageComplete: dependabot.complete,
    exceptionPolicyValid: true,
  }

  return {
    schemaVersion: 1,
    phase: 4,
    projects: reportProjects,
    installScriptPolicy: {
      path: installScriptPolicyPath,
      entries: installPolicy.entries,
    },
    exceptions: {
      path: exceptionsPath,
      activeCount: exceptions.size,
      entries: serializeExceptions(exceptions),
    },
    workflows: {
      path: WORKFLOWS_PATH,
      workflowFiles: workflows.workflowFiles,
      remoteActions: workflows.remoteActions,
    },
    dependabot: {
      path: dependabot.path,
      entries: dependabot.entries,
      required: dependabot.required,
      missing: dependabot.missing,
      complete: dependabot.complete,
    },
    violations,
    exitGate,
  }
}

const extractAdvisoryId = (advisory) => {
  const source = `${advisory?.url ?? ''} ${advisory?.title ?? ''}`
  return source.match(/GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/i)?.[0]?.toUpperCase()
    ?? source.match(/CVE-\d{4}-\d{4,}/i)?.[0]?.toUpperCase()
    ?? `NPM-${advisory?.source ?? 'UNKNOWN'}`
}

export const evaluateNpmAuditReport = ({ project, audit, lockfile, exceptions = new Map() }) => {
  if (!audit || audit.auditReportVersion !== 2 || !audit.vulnerabilities || typeof audit.vulnerabilities !== 'object') {
    throw new Error('npm audit report must use auditReportVersion 2')
  }
  const findings = []
  const seen = new Set()

  for (const vulnerability of Object.values(audit.vulnerabilities)) {
    for (const advisory of vulnerability.via ?? []) {
      if (!advisory || typeof advisory !== 'object') continue
      const severity = advisory.severity ?? vulnerability.severity
      if (!['high', 'critical'].includes(severity)) continue
      const packageName = advisory.dependency ?? advisory.name ?? vulnerability.name
      const advisoryId = extractAdvisoryId(advisory)
      const nodes = Array.isArray(vulnerability.nodes) && vulnerability.nodes.length > 0
        ? vulnerability.nodes
        : [`node_modules/${packageName}`]
      for (const node of nodes) {
        const version = lockfile?.packages?.[node]?.version
          ?? lockfile?.packages?.[`node_modules/${packageName}`]?.version
          ?? null
        const identity = `${project}:${packageName}:${version ?? 'unknown'}:${advisoryId}:${node}`
        if (seen.has(identity)) continue
        seen.add(identity)
        const key = version ? exceptionKey({ project, package: packageName, version, advisoryId }) : null
        const exception = key ? exceptions.get(key) : null
        const excepted = severity !== 'critical' && Boolean(exception)
        findings.push({
          project,
          package: packageName,
          version,
          advisoryId,
          severity,
          title: advisory.title ?? null,
          url: advisory.url ?? null,
          range: advisory.range ?? vulnerability.range ?? null,
          node,
          direct: vulnerability.isDirect === true,
          fixAvailable: vulnerability.fixAvailable ?? null,
          excepted,
          ...(exception ? {
            exception: {
              owner: exception.owner,
              reason: exception.reason,
              compensatingControls: exception.compensatingControls,
              expiresAt: exception.expiresAt,
            },
          } : {}),
        })
      }
    }
  }

  findings.sort((left, right) => (
    `${left.severity}:${left.package}:${left.version}:${left.advisoryId}:${left.node}`
      .localeCompare(`${right.severity}:${right.package}:${right.version}:${right.advisoryId}:${right.node}`)
  ))
  return {
    schemaVersion: 1,
    project,
    findings,
    summary: {
      total: findings.length,
      excepted: findings.filter((finding) => finding.excepted).length,
      blocking: findings.filter((finding) => !finding.excepted).length,
      high: findings.filter((finding) => finding.severity === 'high').length,
      critical: findings.filter((finding) => finding.severity === 'critical').length,
    },
  }
}

const markdownTable = (headers, rows) => {
  const escape = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>')
  return [
    `| ${headers.map(escape).join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n')
}

export const renderDependencyPolicyMarkdown = (report) => {
  const lines = [
    '# Phase 4 Dependency and Supply-Chain Policy',
    '',
    'This file is generated deterministically from package manifests, lockfiles, workflow references, and committed policy files. Live advisory, registry-signature, and SBOM evidence is stored as workflow artifacts.',
    '',
    '## Project summary',
    '',
    markdownTable(['Project', 'Packages', 'Production', 'Development', 'Optional', 'Integrity', 'Install scripts', 'Deprecated direct'], report.projects.map((project) => [
      project.id,
      project.lockfile.packageCount,
      project.lockfile.productionPackageCount,
      project.lockfile.devPackageCount,
      project.lockfile.optionalPackageCount,
      `${project.lockfile.integrityCoverage.present}/${project.lockfile.integrityCoverage.eligible}`,
      project.installScripts.length,
      project.deprecatedDirectPackages.length,
    ])),
    '',
    '## Reviewed install scripts',
    '',
    report.projects.some((project) => project.installScripts.length > 0)
      ? markdownTable(['Project', 'Package', 'Lock path', 'Decision'], report.projects.flatMap((project) => project.installScripts.map((item) => [
        project.id,
        `${item.package}@${item.version}`,
        item.lockPath,
        item.decision,
      ])))
      : 'No install-time scripts are present in either lockfile.',
    '',
    '## Remote GitHub Actions',
    '',
    report.workflows.remoteActions.length > 0
      ? markdownTable(['Workflow', 'Line', 'Action', 'Reference', 'Pinned'], report.workflows.remoteActions.map((item) => [
        item.workflowPath,
        item.line,
        item.action,
        item.ref,
        item.pinned,
      ]))
      : 'No remote action references detected.',
    '',
    '## Dependabot coverage',
    '',
    markdownTable(['Ecosystem', 'Directory'], report.dependabot.entries.map((item) => [item.ecosystem, item.directory])),
    '',
    '## Active dependency exceptions',
    '',
    report.exceptions.entries.length > 0
      ? markdownTable(['Project', 'Package', 'Advisory', 'Severity', 'Owner', 'Expires'], report.exceptions.entries.map((entry) => [
        entry.project,
        `${entry.package}@${entry.version}`,
        entry.advisoryId,
        entry.severity,
        entry.owner,
        entry.expiresAt,
      ]))
      : 'No dependency exceptions are active.',
    '',
    '## Structural violations',
    '',
    report.violations.length > 0
      ? markdownTable(['Code', 'Project', 'Path', 'Package', 'Message'], report.violations.map((item) => [
        item.code,
        item.project,
        item.path,
        item.package,
        item.message,
      ]))
      : 'No structural dependency or supply-chain violations detected.',
    '',
    '## Exit gate',
    '',
    markdownTable(['Requirement', 'Passed'], Object.entries(report.exitGate).map(([key, value]) => [key, value])),
  ]
  return lines.join('\n')
}

const generatedContents = (report) => ({
  [GENERATED_JSON]: `${JSON.stringify(report, null, 2)}\n`,
  [GENERATED_MARKDOWN]: `${renderDependencyPolicyMarkdown(report)}\n`,
})

export const writeGeneratedDependencyPolicy = async (root, report) => {
  const contents = generatedContents(report)
  for (const [relativePath, content] of Object.entries(contents)) {
    const absolute = path.join(root, relativePath)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, content)
  }
  return { files: Object.keys(contents) }
}

export const checkGeneratedDependencyPolicy = async (root, report) => {
  for (const [relativePath, expected] of Object.entries(generatedContents(report))) {
    try {
      if (await readFile(path.join(root, relativePath), 'utf8') !== expected) return false
    } catch {
      return false
    }
  }
  return true
}

export const assertPhase4ExitGate = (report) => {
  const failed = Object.entries(report.exitGate)
    .filter(([, passed]) => !passed)
    .map(([name]) => name)
  if (failed.length > 0) throw new Error(`Phase 4 exit gate failed: ${failed.join(', ')}`)
  return true
}

export const PHASE4_GENERATED_PATHS = [GENERATED_JSON, GENERATED_MARKDOWN]
