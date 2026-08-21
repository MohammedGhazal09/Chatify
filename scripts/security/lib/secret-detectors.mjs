import { createHash } from 'node:crypto'

export const SECRET_NAME_PATTERN = /(?:^|[_-])(?:api[_-]?key|secret|token|password|passwd|pwd|private[_-]?key|client[_-]?secret|credential|auth)(?:$|[_-])/i
const PLACEHOLDER_PATTERNS = [
  /^$/,
  /^(?:null|undefined|none)$/i,
  /^<[^>]+>$/,
  /^\[[^\]]*redacted[^\]]*\]$/i,
  /(?:^|[-_])(?:your|example|sample|dummy|fake|placeholder|replace[-_]?with|change[-_]?me|redacted)(?:[-_]|$)/i,
  /^test(?:[-_]|$)/i,
]

const DETECTORS = [
  {
    id: 'private-key',
    title: 'Private key material',
    severity: 'critical',
    confidence: 'high',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]{1,200000}?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
    validation: 'Confirm key ownership and revoke or rotate the corresponding certificate, SSH key, or signing identity.',
  },
  {
    id: 'github-token',
    title: 'GitHub access token',
    severity: 'critical',
    confidence: 'high',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})\b/g,
    validation: 'Validate only through authorized GitHub token inventory or audit logs; revoke before any active use test.',
  },
  {
    id: 'aws-access-key-id',
    title: 'AWS access key identifier',
    severity: 'high',
    confidence: 'high',
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    validation: 'Locate the key in the authorized AWS account, disable it, and inspect CloudTrail before rotation.',
  },
  {
    id: 'google-api-key',
    title: 'Google API key',
    severity: 'high',
    confidence: 'high',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    validation: 'Check project ownership and API restrictions in Google Cloud without invoking the key against an API.',
  },
  {
    id: 'slack-token',
    title: 'Slack token',
    severity: 'high',
    confidence: 'high',
    pattern: /\bxox(?:a|b|p|r|s)-[0-9A-Za-z-]{10,255}\b/g,
    validation: 'Identify the Slack app or workspace and revoke the token before reviewing access logs.',
  },
  {
    id: 'stripe-secret-key',
    title: 'Stripe secret key',
    severity: 'critical',
    confidence: 'high',
    pattern: /\bsk_(?:live|test)_[0-9A-Za-z]{16,255}\b/g,
    validation: 'Confirm ownership in Stripe, roll the key, and review API request logs; never issue a transaction for validation.',
  },
  {
    id: 'sendgrid-api-key',
    title: 'SendGrid API key',
    severity: 'high',
    confidence: 'high',
    pattern: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
    validation: 'Confirm the key identifier in the provider console, revoke it, and inspect mail activity.',
  },
  {
    id: 'brevo-api-key',
    title: 'Brevo API key',
    severity: 'high',
    confidence: 'high',
    pattern: /\bxkeysib-[A-Za-z0-9_-]{32,255}\b/g,
    validation: 'Confirm the key in the Brevo account, revoke it, rotate dependent deployments, and inspect sending logs.',
  },
  {
    id: 'credentialed-mongodb-uri',
    title: 'MongoDB URI with embedded credentials',
    severity: 'critical',
    confidence: 'high',
    pattern: /\bmongodb(?:\+srv)?:\/\/[^\s/'"<>:@]+:[^\s/'"<>@]+@[^\s'"<>]+/gi,
    validation: 'Rotate the database user and inspect database and network audit logs; do not connect with the discovered credential.',
  },
  {
    id: 'credentialed-url',
    title: 'URL with embedded credentials',
    severity: 'high',
    confidence: 'medium',
    pattern: /\b(?:https?|ftp):\/\/[^\s/'"<>:@]+:[^\s/'"<>@]+@[^\s'"<>]+/gi,
    validation: 'Identify the destination and credential owner, revoke the credential, and review destination logs.',
  },
  {
    id: 'jwt',
    title: 'JSON Web Token',
    severity: 'high',
    confidence: 'medium',
    pattern: /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{8,}\b/g,
    validate: (value) => isJsonWebToken(value),
    validation: 'Decode locally only; identify issuer and session family, then revoke or rotate the signing/session material.',
  },
  {
    id: 'bearer-token',
    title: 'Bearer credential',
    severity: 'high',
    confidence: 'medium',
    pattern: /\bBearer\s+([A-Za-z0-9._~+\/-]{20,}=*)/gi,
    captureGroup: 1,
    validation: 'Identify the issuing system from surrounding metadata and revoke the credential without replaying it.',
  },
]

const GENERIC_QUOTED_ASSIGNMENT_PATTERN = /\b([A-Za-z_][A-Za-z0-9_-]{2,})\s*(?:=|:)\s*(["'`])([^"'`\n]{16,512})\2/g
const GENERIC_LINE_ASSIGNMENT_PATTERN = /^\s*([A-Z][A-Z0-9_-]{2,})\s*(?:=|:)\s*([^\s#,{\[\]"'`]{16,512})\s*$/gm

const normalize = (value) => String(value ?? '').trim()

export const calculateShannonEntropy = (value) => {
  const input = String(value ?? '')
  if (!input) return 0
  const counts = new Map()
  for (const character of input) counts.set(character, (counts.get(character) ?? 0) + 1)
  let entropy = 0
  for (const count of counts.values()) {
    const probability = count / input.length
    entropy -= probability * Math.log2(probability)
  }
  return entropy
}

export const isSecretMaterialName = (name) => SECRET_NAME_PATTERN.test(String(name ?? ''))

export const isPlaceholderValue = (value) => {
  const normalized = normalize(value).replace(/^['"`]|['"`]$/g, '')
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))
}

const lineAndColumnAt = (text, index) => {
  const before = text.slice(0, index)
  const line = before.split('\n').length
  const lastNewline = before.lastIndexOf('\n')
  return { line, column: index - lastNewline }
}

const entropyBand = (value) => {
  const entropy = calculateShannonEntropy(value)
  if (entropy >= 4.5) return 'very-high'
  if (entropy >= 3.5) return 'high'
  if (entropy >= 2.5) return 'medium'
  return 'low'
}

const makeCandidateId = ({ detectorId, scope, filePath, line, column }) => {
  const digest = createHash('sha256')
    .update([detectorId, scope, filePath, line, column].join('\0'))
    .digest('hex')
    .slice(0, 24)
  return `sec_${digest}`
}

const createFinding = ({ detector, value, matchIndex, valueIndex, text, filePath, scope }) => {
  const absoluteIndex = matchIndex + valueIndex
  const { line, column } = lineAndColumnAt(text, absoluteIndex)
  return {
    candidateId: makeCandidateId({ detectorId: detector.id, scope, filePath, line, column }),
    detectorId: detector.id,
    title: detector.title,
    severity: detector.severity,
    confidence: detector.confidence,
    scope,
    filePath,
    line,
    column,
    matchLength: value.length,
    entropyBand: entropyBand(value),
    validation: detector.validation,
    suppressed: false,
  }
}

const overlaps = (left, right) => left.start < right.end && right.start < left.end

const isJsonWebToken = (value) => {
  try {
    const [header, payload, signature, extra] = value.split('.')
    if (!header || !payload || !signature || extra !== undefined) return false
    JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))
    JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return true
  } catch {
    return false
  }
}

const specificMatches = ({ text, filePath, scope }) => {
  const accepted = []
  const spans = []
  for (const detector of DETECTORS) {
    detector.pattern.lastIndex = 0
    let match
    while ((match = detector.pattern.exec(text)) !== null) {
      const value = match[detector.captureGroup ?? 0]
      const valueIndex = detector.captureGroup ? match[0].indexOf(value) : 0
      if (!value || isPlaceholderValue(value) || (detector.validate && !detector.validate(value))) continue
      const span = { start: match.index + valueIndex, end: match.index + valueIndex + value.length }
      if (spans.some((existing) => overlaps(existing, span))) continue
      spans.push(span)
      accepted.push(createFinding({ detector, value, matchIndex: match.index, valueIndex, text, filePath, scope }))
      if (match[0].length === 0) detector.pattern.lastIndex += 1
    }
  }
  return { accepted, spans }
}

const genericMatchesForPattern = ({ text, filePath, scope, occupied, pattern, valueGroup }) => {
  const findings = []
  pattern.lastIndex = 0
  let match
  while ((match = pattern.exec(text)) !== null) {
    const name = match[1]
    const value = match[valueGroup]
    const valueIndex = match[0].lastIndexOf(value)
    const span = { start: match.index + valueIndex, end: match.index + valueIndex + value.length }
    if (!SECRET_NAME_PATTERN.test(name) || isPlaceholderValue(value) || occupied.some((item) => overlaps(item, span))) continue
    if (calculateShannonEntropy(value) < 3 || value.length < 20) continue
    const detector = {
      id: 'generic-secret-assignment',
      title: 'High-entropy secret assignment',
      severity: 'high',
      confidence: 'medium',
      validation: `Confirm whether ${name} is a live credential using the owning provider inventory; do not replay it.`,
    }
    findings.push(createFinding({ detector, value, matchIndex: match.index, valueIndex, text, filePath, scope }))
  }
  return findings
}

const genericMatches = (options) => [
  ...genericMatchesForPattern({ ...options, pattern: GENERIC_QUOTED_ASSIGNMENT_PATTERN, valueGroup: 3 }),
  ...genericMatchesForPattern({ ...options, pattern: GENERIC_LINE_ASSIGNMENT_PATTERN, valueGroup: 2 }),
]


export const scanTextForSecrets = ({ text, filePath, scope }) => {
  if (typeof text !== 'string' || !filePath || !scope) return []
  const { accepted, spans } = specificMatches({ text, filePath, scope })
  const generic = genericMatches({ text, filePath, scope, occupied: spans })
  return [...accepted, ...generic].sort((a, b) => (
    `${a.filePath}:${a.line}:${a.column}:${a.detectorId}`.localeCompare(`${b.filePath}:${b.line}:${b.column}:${b.detectorId}`)
  ))
}

export const validateSecretAllowlist = (allowlist, { now = new Date() } = {}) => {
  if (!allowlist || allowlist.schemaVersion !== 1 || !Array.isArray(allowlist.entries)) {
    throw new Error('Secret allowlist must use schemaVersion 1 with an entries array')
  }
  const validated = new Map()
  for (const [index, entry] of allowlist.entries.entries()) {
    const prefix = `Secret allowlist entry ${index + 1}`
    if (!/^sec_[a-f0-9]{24}$/.test(entry?.candidateId ?? '')) throw new Error(`${prefix} has an invalid candidateId`)
    if (typeof entry.owner !== 'string' || !entry.owner.trim()) throw new Error(`${prefix} requires an owner`)
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 10) throw new Error(`${prefix} requires a specific reason`)
    const expiry = new Date(entry.expiresAt)
    if (!entry.expiresAt || Number.isNaN(expiry.getTime())) throw new Error(`${prefix} requires a valid expiresAt`)
    if (expiry <= now) throw new Error(`${prefix} is expired`)
    if (validated.has(entry.candidateId)) throw new Error(`${prefix} duplicates candidateId ${entry.candidateId}`)
    validated.set(entry.candidateId, {
      candidateId: entry.candidateId,
      owner: entry.owner.trim(),
      reason: entry.reason.trim(),
      expiresAt: expiry.toISOString(),
    })
  }
  return validated
}

export const getSecretDetectorMetadata = () => DETECTORS.map(({ id, title, severity, confidence, validation }) => ({
  id,
  title,
  severity,
  confidence,
  validation,
})).concat({
  id: 'generic-secret-assignment',
  title: 'High-entropy secret assignment',
  severity: 'high',
  confidence: 'medium',
  validation: 'Confirm ownership through the relevant provider inventory; do not replay the value.',
})
