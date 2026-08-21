import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import path from 'node:path'

import {
  getSecretDetectorMetadata,
  isSecretMaterialName,
  scanTextForSecrets,
  validateSecretAllowlist,
} from './secret-detectors.mjs'

const GENERATED_JSON = 'docs/security/audit/phase-3/secret-scan.json'
const GENERATED_MARKDOWN = 'docs/security/audit/phase-3/secret-scan.md'
const ALLOWLIST_PATH = 'docs/security/audit/phase-3/secret-scan-allowlist.json'
const RESPONSE_PATH = 'docs/security/audit/phase-3/credential-exposure-response.md'
const PHASE1_INVENTORY_PATH = 'docs/security/audit/phase-1/inventory.json'
const MAX_TEXT_BYTES = 2 * 1024 * 1024
const AUDITED_HISTORY_REF = 'HEAD'
const GENERATED_PATHS = new Set([
  'docs/security/audit/phase-1/inventory.json',
  'docs/security/audit/phase-1/inventory.md',
  'docs/security/audit/phase-2/threat-model.json',
  'docs/security/audit/phase-2/threat-model.md',
  GENERATED_JSON,
  GENERATED_MARKDOWN,
  'docs/security/audit/phase-4/dependency-policy.json',
  'docs/security/audit/phase-4/dependency-policy.md',
])
const EPHEMERAL_WORKFLOW_PATH = /^\.github\/workflows\/security-phase-\d+-(?:verify-ready|materialize|bootstrap|fix-bootstrap|finalizer)[^/]*\.ya?ml$/i
const isExcludedGeneratedPath = (filePath) => GENERATED_PATHS.has(filePath) || EPHEMERAL_WORKFLOW_PATH.test(filePath)
const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'coverage', '.cache', '.npm'])
const SENSITIVE_LOCAL_NAMES = /(?:^|\/)(?:\.env(?:\..+)?|\.npmrc|\.pypirc|credentials|id_rsa|id_dsa|id_ecdsa|id_ed25519|[^/]+\.(?:pem|key|p12|pfx|jks|keystore))$/i
const RUNTIME_SOURCE = /\.(?:[cm]?[jt]sx?|json|ya?ml|toml|properties|conf|config|env|sh|ps1)$/i
const TEST_OR_DOC_PATH = /(?:^|\/)(?:test|tests|__tests__|e2e|docs|\.planning|\.agents)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i

const toPosix = (value) => value.replaceAll(path.sep, '/')
const sortStrings = (values) => [...values].sort((a, b) => a.localeCompare(b))
const stableSortFindings = (findings) => [...findings].sort((a, b) => (
  `${a.scope}:${a.filePath}:${a.line}:${a.column}:${a.detectorId}`
    .localeCompare(`${b.scope}:${b.filePath}:${b.line}:${b.column}:${b.detectorId}`)
))
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const exists = async (filePath) => {
  try {
    await access(filePath, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

const runGit = (root, args, options = {}) => execFileSync('git', args, {
  cwd: root,
  encoding: Object.hasOwn(options, 'encoding') ? options.encoding : 'utf8',
  input: options.input,
  maxBuffer: options.maxBuffer ?? 512 * 1024 * 1024,
  stdio: ['pipe', 'pipe', 'pipe'],
})

const listGitPaths = (root, args) => runGit(root, args)
  .split('\0')
  .filter(Boolean)
  .map(toPosix)

const walkSensitiveLocalFiles = async (root, current = root) => {
  const output = []
  const entries = await readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue
    const absolute = path.join(current, entry.name)
    const relative = toPosix(path.relative(root, absolute))
    if (entry.isDirectory()) {
      output.push(...await walkSensitiveLocalFiles(root, absolute))
    } else if (entry.isFile() && SENSITIVE_LOCAL_NAMES.test(relative)) {
      output.push(relative)
    }
  }
  return output
}

const listCurrentFiles = async (root) => {
  const tracked = listGitPaths(root, ['ls-files', '-z'])
  const untracked = listGitPaths(root, ['ls-files', '--others', '--exclude-standard', '-z'])
  const localSensitive = await walkSensitiveLocalFiles(root)
  return sortStrings(new Set([...tracked, ...untracked, ...localSensitive]))
    .filter((filePath) => !isExcludedGeneratedPath(filePath))
}

const readTextFile = async (root, filePath) => {
  const absolute = path.join(root, filePath)
  let metadata
  try {
    metadata = await stat(absolute)
  } catch {
    return { status: 'missing', size: 0 }
  }
  if (!metadata.isFile()) return { status: 'not-file', size: metadata.size }
  if (metadata.size > MAX_TEXT_BYTES) return { status: 'too-large', size: metadata.size }
  const buffer = await readFile(absolute)
  if (buffer.includes(0)) return { status: 'binary', size: metadata.size }
  return { status: 'ok', size: metadata.size, text: buffer.toString('utf8'), sha256: sha256(buffer) }
}

const applyAllowlist = (findings, allowlist) => findings.map((finding) => {
  const suppression = allowlist.get(finding.candidateId)
  return suppression
    ? { ...finding, suppressed: true, suppression }
    : finding
})

const summarizeFindings = (findings) => ({
  total: findings.length,
  suppressed: findings.filter((finding) => finding.suppressed).length,
  unsuppressed: findings.filter((finding) => !finding.suppressed).length,
})

const scanCurrentTree = async (root, allowlist) => {
  const files = await listCurrentFiles(root)
  const findings = []
  const skipped = { missing: 0, binary: 0, tooLarge: 0, notFile: 0 }
  const digestRecords = []
  let scannedBytes = 0
  let scannedFileCount = 0

  for (const filePath of files) {
    const result = await readTextFile(root, filePath)
    if (result.status !== 'ok') {
      const key = result.status === 'too-large' ? 'tooLarge' : result.status === 'not-file' ? 'notFile' : result.status
      skipped[key] += 1
      continue
    }
    scannedFileCount += 1
    scannedBytes += result.size
    digestRecords.push(`${filePath}\0${result.sha256}`)
    findings.push(...scanTextForSecrets({ text: result.text, filePath, scope: 'current-tree' }))
  }

  const normalized = stableSortFindings(applyAllowlist(findings, allowlist))
  return {
    source: 'git-index-untracked-and-sensitive-local-files',
    scannedFileCount,
    scannedBytes,
    skipped,
    contentSha256: sha256(sortStrings(digestRecords).join('\n')),
    findings: normalized,
    summary: summarizeFindings(normalized),
  }
}

const parseObjectList = (root) => {
  const lines = runGit(root, ['rev-list', '--objects', AUDITED_HISTORY_REF]).split('\n').filter(Boolean)
  const bySha = new Map()
  for (const line of lines) {
    const separator = line.indexOf(' ')
    if (separator === -1) continue
    const objectSha = line.slice(0, separator)
    const objectPath = toPosix(line.slice(separator + 1))
    if (!objectPath || isExcludedGeneratedPath(objectPath)) continue
    const paths = bySha.get(objectSha) ?? new Set()
    paths.add(objectPath)
    bySha.set(objectSha, paths)
  }
  return bySha
}

const batchCheckObjects = (root, shas) => {
  if (shas.length === 0) return new Map()
  const output = runGit(root, ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], {
    input: `${shas.join('\n')}\n`,
  })
  const metadata = new Map()
  for (const line of output.split('\n')) {
    const [objectSha, type, sizeText] = line.trim().split(/\s+/)
    if (objectSha && type) metadata.set(objectSha, { type, size: Number(sizeText) })
  }
  return metadata
}

const readBlobBatch = (root, shas) => {
  if (shas.length === 0) return new Map()
  const output = runGit(root, ['cat-file', '--batch'], {
    input: `${shas.join('\n')}\n`,
    encoding: null,
  })
  const blobs = new Map()
  let offset = 0
  while (offset < output.length) {
    const newline = output.indexOf(10, offset)
    if (newline === -1) break
    const header = output.subarray(offset, newline).toString('utf8')
    offset = newline + 1
    const [objectSha, type, sizeText] = header.split(' ')
    const size = Number(sizeText)
    if (type !== 'blob' || !Number.isFinite(size)) break
    blobs.set(objectSha, output.subarray(offset, offset + size))
    offset += size + 1
  }
  return blobs
}

const commitDetails = (root, commitSha) => {
  if (!commitSha) return null
  try {
    const [timestamp, sha] = runGit(root, ['show', '-s', '--format=%ct %H', commitSha]).trim().split(/\s+/)
    return { sha, timestamp: Number(timestamp) }
  } catch {
    return null
  }
}

const blobHistory = (root, blobSha, filePath) => {
  try {
    const commits = runGit(root, ['log', '--format=%H', `--find-object=${blobSha}`, AUDITED_HISTORY_REF, '--', filePath])
      .split('\n')
      .filter(Boolean)
    return commits.map((commit) => commitDetails(root, commit)).filter(Boolean)
  } catch {
    return []
  }
}

const scanHistory = async (root, allowlist) => {
  const objects = parseObjectList(root)
  const metadata = batchCheckObjects(root, [...objects.keys()])
  const eligible = []
  const skipped = { binary: 0, tooLarge: 0 }
  for (const [objectSha] of objects) {
    const item = metadata.get(objectSha)
    if (!item || item.type !== 'blob') continue
    if (item.size > MAX_TEXT_BYTES) {
      skipped.tooLarge += 1
      continue
    }
    eligible.push(objectSha)
  }

  const blobs = readBlobBatch(root, eligible)
  const aggregate = new Map()
  const digestRecords = []
  let scannedBytes = 0
  let scannedBlobCount = 0
  let scannedPathCount = 0

  for (const objectSha of eligible) {
    const buffer = blobs.get(objectSha)
    if (!buffer) continue
    if (buffer.includes(0)) {
      skipped.binary += 1
      continue
    }
    scannedBlobCount += 1
    scannedBytes += buffer.length
    const filePaths = sortStrings(objects.get(objectSha) ?? [])
    digestRecords.push(`${objectSha}\0${filePaths.join('\0')}`)
    const text = buffer.toString('utf8')
    for (const filePath of filePaths) {
      scannedPathCount += 1
      for (const finding of scanTextForSecrets({ text, filePath, scope: 'history' })) {
        const record = aggregate.get(finding.candidateId) ?? {
          ...finding,
          occurrenceCount: 0,
          firstSeenCommit: null,
          lastSeenCommit: null,
          _commits: new Map(),
        }
        record.occurrenceCount += 1
        for (const detail of blobHistory(root, objectSha, filePath)) record._commits.set(detail.sha, detail)
        aggregate.set(finding.candidateId, record)
      }
    }
  }

  const findings = []
  for (const record of aggregate.values()) {
    const commits = [...record._commits.values()].sort((a, b) => a.timestamp - b.timestamp || a.sha.localeCompare(b.sha))
    const { _commits, ...publicRecord } = record
    publicRecord.firstSeenCommit = commits.at(0)?.sha ?? null
    publicRecord.lastSeenCommit = commits.at(-1)?.sha ?? null
    findings.push(publicRecord)
  }
  const normalized = stableSortFindings(applyAllowlist(findings, allowlist))
  return {
    source: 'audited-head-ancestor-git-blobs',
    scannedBlobCount,
    scannedPathCount,
    scannedBytes,
    skipped,
    contentSha256: sha256(sortStrings(digestRecords).join('\n')),
    findings: normalized,
    summary: summarizeFindings(normalized),
  }
}

const readJson = async (filePath, fallback = null) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT' && fallback !== null) return fallback
    throw error
  }
}

const lineAt = (text, index) => text.slice(0, index).split('\n').length

const runtimeSourceFiles = (files) => files.filter((filePath) => (
  RUNTIME_SOURCE.test(filePath)
  && !TEST_OR_DOC_PATH.test(filePath)
  && !isExcludedGeneratedPath(filePath)
))

const scanSecretLoading = async (root, phase1Inventory, currentFiles) => {
  const variables = phase1Inventory?.sensitiveConfiguration?.variables ?? []
  const sensitiveVariables = variables.filter((variable) => (
    variable.sensitive === true
    || variable.classifications?.some((classification) => /secret|credential|authentication/i.test(classification))
    || isSecretMaterialName(variable.name)
  ))
  const frontendSecretReferences = []
  for (const variable of sensitiveVariables) {
    const references = variable.referencedAt ?? variable.references ?? []
    for (const reference of references) {
      const source = reference.source ?? ''
      if (
        (variable.name?.startsWith('VITE_') || source.startsWith('Frontend/Chatify/'))
        && !TEST_OR_DOC_PATH.test(source)
      ) {
        frontendSecretReferences.push({ name: variable.name, source, line: reference.line ?? null })
      }
    }
  }

  const weakFallbacks = []
  const environmentDumps = []
  const credentialLogging = []
  for (const filePath of runtimeSourceFiles(currentFiles)) {
    const result = await readTextFile(root, filePath)
    if (result.status !== 'ok') continue
    const text = result.text
    const fallbackRegex = /process\.env\.([A-Z][A-Z0-9_]*)\s*(?:\|\||\?\?)\s*(['"`])([^'"`]+)\2/g
    let match
    while ((match = fallbackRegex.exec(text)) !== null) {
      if (!isSecretMaterialName(match[1])) continue
      weakFallbacks.push({ variable: match[1], source: filePath, line: lineAt(text, match.index) })
    }
    const dumpRegex = /(?:console|logger)\.(?:log|info|debug|warn|error)\s*\([^\n]*(?:JSON\.stringify\s*\(\s*process\.env\s*\)|process\.env(?:\s*[,)]|\s*$)|\.\.\.process\.env)/g
    while ((match = dumpRegex.exec(text)) !== null) {
      environmentDumps.push({ source: filePath, line: lineAt(text, match.index) })
    }
    const logRegex = /(?:console|logger)\.(?:log|info|debug|warn|error)\s*\(([^\n]{0,500})\)/g
    while ((match = logRegex.exec(text)) !== null) {
      const expression = match[1].replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '')
      if (/(?:process\.env\.[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE_KEY)|headers?\.authorization|headers?\.cookie|\b(?:accessToken|refreshToken|password|apiKey|privateKey|credentialValue|secretValue)\b)/i.test(expression)) {
        credentialLogging.push({ source: filePath, line: lineAt(text, match.index) })
      }
    }
  }

  const validationPath = 'Backend/Chatify/Utils/secretConfiguration.mjs'
  const serverPath = 'Backend/Chatify/server.mjs'
  const validationExists = await exists(path.join(root, validationPath))
  const server = await readTextFile(root, serverPath)
  const serverText = server.status === 'ok' ? server.text : ''
  const validationCall = serverText.search(/\bvalidateSecretConfiguration\s*\(/)
  const firstRuntimeDynamicImport = serverText.search(/await\s+import\s*\(/)
  const startupValidation = {
    module: validationPath,
    installed: validationExists
      && validationCall >= 0
      && (firstRuntimeDynamicImport === -1 || validationCall < firstRuntimeDynamicImport),
    validationRunsBeforeRuntimeImports: validationCall >= 0
      && (firstRuntimeDynamicImport === -1 || validationCall < firstRuntimeDynamicImport),
  }

  const knownNames = new Set(variables.map((variable) => variable.name))
  const csrfPath = 'Backend/Chatify/Middlewares/csrfProtection.mjs'
  const csrf = await readTextFile(root, csrfPath)
  const csrfText = csrf.status === 'ok' ? csrf.text : ''
  const distinctPurposeKeys = {
    requiredNamesPresent: ['SECRET_JWT_KEY', 'CSRF_SECRET', 'PASSWORD_RESET_SECRET']
      .every((name) => knownNames.has(name)),
    csrfDoesNotFallbackToJwtKey: !/CSRF_SECRET\s*\|\|\s*process\.env\.SECRET_JWT_KEY/.test(csrfText),
  }
  distinctPurposeKeys.enforced = distinctPurposeKeys.requiredNamesPresent && distinctPurposeKeys.csrfDoesNotFallbackToJwtKey

  return {
    sensitiveVariableCount: sensitiveVariables.length,
    frontendSecretReferences: frontendSecretReferences.sort((a, b) => `${a.name}:${a.source}:${a.line}`.localeCompare(`${b.name}:${b.source}:${b.line}`)),
    weakFallbacks: weakFallbacks.sort((a, b) => `${a.variable}:${a.source}:${a.line}`.localeCompare(`${b.variable}:${b.source}:${b.line}`)),
    environmentDumps: environmentDumps.sort((a, b) => `${a.source}:${a.line}`.localeCompare(`${b.source}:${b.line}`)),
    credentialLogging: credentialLogging.sort((a, b) => `${a.source}:${a.line}`.localeCompare(`${b.source}:${b.line}`)),
    startupValidation,
    distinctPurposeKeys,
  }
}

const responseProcedureState = async (root) => {
  const absolute = path.join(root, RESPONSE_PATH)
  if (!await exists(absolute)) return { path: RESPONSE_PATH, documented: false }
  const text = await readFile(absolute, 'utf8')
  return { path: RESPONSE_PATH, documented: text.trim().length >= 20 }
}

export const buildSecretScan = async (root, {
  phase1Inventory = null,
  allowlistPath = ALLOWLIST_PATH,
  now = new Date(),
} = {}) => {
  const resolvedPhase1 = phase1Inventory ?? await readJson(path.join(root, PHASE1_INVENTORY_PATH), {})
  const rawAllowlist = await readJson(path.join(root, allowlistPath), { schemaVersion: 1, entries: [] })
  const allowlist = validateSecretAllowlist(rawAllowlist, { now })
  const currentFiles = await listCurrentFiles(root)
  const [currentTree, history, secretLoading, responseProcedure] = await Promise.all([
    scanCurrentTree(root, allowlist),
    scanHistory(root, allowlist),
    scanSecretLoading(root, resolvedPhase1, currentFiles),
    responseProcedureState(root),
  ])

  const exitGate = {
    currentTreeScanCompleted: currentTree.scannedFileCount > 0,
    historyScanCompleted: history.scannedBlobCount > 0,
    noUnsuppressedFindings: currentTree.summary.unsuppressed === 0 && history.summary.unsuppressed === 0,
    noFrontendSecretReferences: secretLoading.frontendSecretReferences.length === 0,
    noWeakSecretFallbacks: secretLoading.weakFallbacks.length === 0,
    noEnvironmentDumps: secretLoading.environmentDumps.length === 0,
    noCredentialLogging: secretLoading.credentialLogging.length === 0,
    productionValidationInstalled: secretLoading.startupValidation.installed,
    distinctCryptoPurposeKeys: secretLoading.distinctPurposeKeys.enforced,
    responseProcedureDocumented: responseProcedure.documented,
  }

  return {
    schemaVersion: 1,
    phase: 3,
    redactionPolicy: {
      rawValuesStored: false,
      valueHashesStored: false,
      candidateIdsContainSecretMaterial: false,
      logsMayContainSecretValues: false,
    },
    detectors: getSecretDetectorMetadata(),
    allowlist: {
      path: allowlistPath,
      activeEntryCount: allowlist.size,
    },
    currentTree,
    history,
    secretLoading,
    responseProcedure,
    exitGate,
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

const findingRows = (findings) => findings.map((finding) => [
  finding.candidateId,
  finding.detectorId,
  finding.severity,
  finding.confidence,
  `${finding.filePath}:${finding.line}:${finding.column}`,
  finding.suppressed ? 'suppressed' : 'open',
])

export const renderSecretScanMarkdown = (report) => {
  const lines = [
    '# Phase 3 Secret and Credential Exposure',
    '',
    'This evidence is sanitized. It never stores discovered credential values, value hashes, source lines, or command output.',
    '',
    '## Scan summary',
    '',
    markdownTable(
      ['Scope', 'Scanned', 'Bytes', 'Findings', 'Suppressed', 'Unsuppressed', 'Content SHA-256'],
      [
        ['Current tree', report.currentTree.scannedFileCount, report.currentTree.scannedBytes, report.currentTree.summary.total, report.currentTree.summary.suppressed, report.currentTree.summary.unsuppressed, report.currentTree.contentSha256],
        ['Git history', report.history.scannedBlobCount, report.history.scannedBytes, report.history.summary.total, report.history.summary.suppressed, report.history.summary.unsuppressed, report.history.contentSha256],
      ],
    ),
    '',
    '## Current-tree candidates',
    '',
    report.currentTree.findings.length
      ? markdownTable(['Candidate', 'Detector', 'Severity', 'Confidence', 'Location', 'State'], findingRows(report.currentTree.findings))
      : 'No candidates detected.',
    '',
    '## Historical candidates',
    '',
    report.history.findings.length
      ? markdownTable(['Candidate', 'Detector', 'Severity', 'Confidence', 'Location', 'State'], findingRows(report.history.findings))
      : 'No candidates detected.',
    '',
    '## Secret-loading review',
    '',
    markdownTable(['Control', 'Result'], [
      ['Frontend secret references', report.secretLoading.frontendSecretReferences.length],
      ['Weak literal fallbacks', report.secretLoading.weakFallbacks.length],
      ['Environment dumps', report.secretLoading.environmentDumps.length],
      ['Credential logging candidates', report.secretLoading.credentialLogging.length],
      ['Startup validation installed', report.secretLoading.startupValidation.installed],
      ['Distinct cryptographic-purpose keys', report.secretLoading.distinctPurposeKeys.enforced],
      ['Credential response procedure', report.responseProcedure.documented],
    ]),
    '',
    '## Exit gate',
    '',
    markdownTable(['Requirement', 'Passed'], Object.entries(report.exitGate).map(([key, value]) => [key, value])),
    '',
    'Candidates require provider-side ownership verification and rotation. The scanner does not replay credentials or make provider API calls.',
  ]
  return lines.join('\n')
}

const generatedContents = (report) => ({
  [GENERATED_JSON]: `${JSON.stringify(report, null, 2)}\n`,
  [GENERATED_MARKDOWN]: `${renderSecretScanMarkdown(report)}\n`,
})

export const writeGeneratedSecretScan = async (root, report) => {
  const contents = generatedContents(report)
  for (const [relativePath, content] of Object.entries(contents)) {
    const absolute = path.join(root, relativePath)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, content)
  }
  return { files: Object.keys(contents) }
}

export const checkGeneratedSecretScan = async (root, report) => {
  for (const [relativePath, expected] of Object.entries(generatedContents(report))) {
    try {
      if (await readFile(path.join(root, relativePath), 'utf8') !== expected) return false
    } catch {
      return false
    }
  }
  return true
}

export const assertPhase3ExitGate = (report) => {
  const failed = Object.entries(report.exitGate)
    .filter(([, passed]) => !passed)
    .map(([name]) => name)
  if (failed.length > 0) throw new Error(`Phase 3 exit gate failed: ${failed.join(', ')}`)
  return true
}

export const PHASE3_GENERATED_PATHS = [GENERATED_JSON, GENERATED_MARKDOWN]
