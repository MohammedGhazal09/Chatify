const CORE_SECRET_NAMES = [
  'SECRET_JWT_KEY',
  'CSRF_SECRET',
  'PASSWORD_RESET_SECRET',
]

const OAUTH_PAIRS = [
  ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
  ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET'],
]

const PLACEHOLDER_PATTERN = /(?:replace[-_]?with|change[-_]?me|your[-_]|example|placeholder|dummy|redacted|<[^>]+>)/i
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

export class SecretConfigurationError extends Error {
  constructor(issues) {
    super(`Secret configuration invalid: ${issues.join('; ')}`)
    this.name = 'SecretConfigurationError'
    this.code = 'SECRET_CONFIGURATION_INVALID'
    this.issues = [...issues]
  }
}

const configured = (env, name) => typeof env[name] === 'string' && env[name].trim().length > 0
const valueLength = (env, name) => configured(env, name) ? env[name].trim().length : 0

const calculateEntropyBits = (value) => {
  const input = typeof value === 'string' ? [...value] : [...value].map((byte) => String(byte))
  if (input.length === 0) return 0
  const counts = new Map()
  for (const item of input) counts.set(item, (counts.get(item) ?? 0) + 1)
  let bitsPerSymbol = 0
  for (const count of counts.values()) {
    const probability = count / input.length
    bitsPerSymbol -= probability * Math.log2(probability)
  }
  return bitsPerSymbol * input.length
}

const hasAdequateEntropy = (value, minimumBits = 128) => (
  new Set(typeof value === 'string' ? [...value] : value).size >= 8
  && calculateEntropyBits(value) >= minimumBits
)

const validateSecret = ({ env, name, issues, minimumLength, allowTestPrefix }) => {
  if (!configured(env, name)) {
    issues.push(`${name} is required`)
    return
  }
  const value = env[name].trim()
  if ((!allowTestPrefix || !value.startsWith('test-')) && PLACEHOLDER_PATTERN.test(value)) {
    issues.push(`${name} contains a placeholder value`)
    return
  }
  if (value.length < minimumLength) {
    issues.push(`${name} must be at least ${minimumLength} characters`)
  } else if (!allowTestPrefix && !hasAdequateEntropy(value)) {
    issues.push(`${name} must provide at least 128 bits of estimated entropy`)
  }
}

const validatePair = (env, left, right, issues) => {
  const hasLeft = configured(env, left)
  const hasRight = configured(env, right)
  if (hasLeft && !hasRight) issues.push(`${right} is required when ${left} is configured`)
  if (hasRight && !hasLeft) issues.push(`${left} is required when ${right} is configured`)
  return hasLeft && hasRight
}

const validateConfiguredValue = ({ env, name, issues, minimumLength = 1 }) => {
  if (!configured(env, name)) return false
  const value = env[name].trim()
  if (PLACEHOLDER_PATTERN.test(value)) {
    issues.push(`${name} contains a placeholder value`)
    return false
  }
  if (value.length < minimumLength) {
    issues.push(`${name} must be at least ${minimumLength} characters`)
    return false
  }
  return true
}

const decodeThirtyTwoByteKey = (value) => {
  const input = String(value ?? '').trim()
  if (/^[a-f0-9]{64}$/i.test(input)) return Buffer.from(input, 'hex')
  try {
    const decoded = Buffer.from(input, 'base64')
    return decoded.length === 32 ? decoded : null
  } catch {
    return null
  }
}

const validateTwoFactorKey = (env, issues) => {
  const decoded = decodeThirtyTwoByteKey(env.TWO_FACTOR_ENCRYPTION_KEY)
  if (!decoded) {
    issues.push('TWO_FACTOR_ENCRYPTION_KEY must decode to exactly 32 bytes')
    return false
  }
  if (!hasAdequateEntropy(decoded)) {
    issues.push('TWO_FACTOR_ENCRYPTION_KEY must provide at least 128 bits of estimated entropy')
    return false
  }
  return true
}

const validateDatabase = (env, issues) => {
  if (!configured(env, 'MONGODB_URL')) {
    issues.push('MONGODB_URL is required in production')
    return false
  }
  try {
    const url = new URL(env.MONGODB_URL)
    if (!['mongodb:', 'mongodb+srv:'].includes(url.protocol)) {
      issues.push('MONGODB_URL must use mongodb or mongodb+srv')
      return false
    }
    if (LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
      issues.push('MONGODB_URL must use a nonlocal production host')
      return false
    }
    return true
  } catch {
    issues.push('MONGODB_URL must be a valid database URL')
    return false
  }
}

const validateFrontendOrigin = (env, issues) => {
  if (!configured(env, 'FRONTEND_ORIGIN')) {
    issues.push('FRONTEND_ORIGIN is required in production')
    return false
  }
  try {
    const url = new URL(env.FRONTEND_ORIGIN)
    if (url.protocol !== 'https:') {
      issues.push('FRONTEND_ORIGIN must use HTTPS in production')
      return false
    }
    if (url.username || url.password) {
      issues.push('FRONTEND_ORIGIN must not contain credentials')
      return false
    }
    return true
  } catch {
    issues.push('FRONTEND_ORIGIN must be a valid HTTPS origin')
    return false
  }
}

export const validateSecretConfiguration = (env = process.env) => {
  const mode = env.NODE_ENV || 'development'
  const isTest = mode === 'test'
  const isProduction = mode === 'production'
  const issues = []
  const validatedSecrets = []

  for (const name of CORE_SECRET_NAMES) {
    validateSecret({
      env,
      name,
      issues,
      minimumLength: isTest ? 8 : 32,
      allowTestPrefix: isTest,
    })
    if (configured(env, name)) validatedSecrets.push(name)
  }

  const configuredCore = CORE_SECRET_NAMES.filter((name) => configured(env, name))
  if (configuredCore.length === CORE_SECRET_NAMES.length) {
    const distinctValues = new Set(configuredCore.map((name) => env[name]))
    if (distinctValues.size !== configuredCore.length) {
      issues.push('SECRET_JWT_KEY, CSRF_SECRET, and PASSWORD_RESET_SECRET must be distinct')
    }
  }

  if (isProduction) {
    if (!configured(env, 'TWO_FACTOR_ENCRYPTION_KEY')) {
      issues.push('TWO_FACTOR_ENCRYPTION_KEY is required in production')
    } else if (validateTwoFactorKey(env, issues)) {
      validatedSecrets.push('TWO_FACTOR_ENCRYPTION_KEY')
    }
    validateDatabase(env, issues)
    validateFrontendOrigin(env, issues)
  } else if (configured(env, 'TWO_FACTOR_ENCRYPTION_KEY')) {
    if (validateTwoFactorKey(env, issues)) {
      validatedSecrets.push('TWO_FACTOR_ENCRYPTION_KEY')
    }
  }

  const oauth = {}
  for (const [clientId, clientSecret] of OAUTH_PAIRS) {
    const pairConfigured = validatePair(env, clientId, clientSecret, issues)
    if (pairConfigured) {
      const idValid = validateConfiguredValue({ env, name: clientId, issues, minimumLength: 3 })
      const secretValid = validateConfiguredValue({ env, name: clientSecret, issues, minimumLength: 16 })
      oauth[clientId.replace('_CLIENT_ID', '').toLowerCase()] = idValid && secretValid
    } else {
      oauth[clientId.replace('_CLIENT_ID', '').toLowerCase()] = false
    }
    if (configured(env, clientSecret)) validatedSecrets.push(clientSecret)
  }

  const webPushPairConfigured = validatePair(env, 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', issues)
  const webPushConfigured = webPushPairConfigured
    && validateConfiguredValue({ env, name: 'VAPID_PUBLIC_KEY', issues, minimumLength: 32 })
    && validateConfiguredValue({ env, name: 'VAPID_PRIVATE_KEY', issues, minimumLength: 32 })
  if (webPushPairConfigured) {
    if (isProduction && !configured(env, 'VAPID_SUBJECT')) issues.push('VAPID_SUBJECT is required when web push is configured')
    validatedSecrets.push('VAPID_PRIVATE_KEY')
  }

  const emailRequired = isProduction
    && env.NOTIFICATION_WORKER_ENABLED !== '0'
    && env.CHATIFY_NOTIFICATION_DRY_RUN !== '1'
  if (emailRequired) {
    if (!configured(env, 'BREVO_API_KEY')) issues.push('BREVO_API_KEY is required for production notification delivery')
    if (!configured(env, 'EMAIL_USER_SENDER')) issues.push('EMAIL_USER_SENDER is required for production notification delivery')
  }
  if (configured(env, 'BREVO_API_KEY')) {
    validateConfiguredValue({ env, name: 'BREVO_API_KEY', issues, minimumLength: 20 })
    validatedSecrets.push('BREVO_API_KEY')
  }

  const hasTurnUrl = configured(env, 'CALL_TURN_URLS')
  const hasTurnUsername = configured(env, 'CALL_TURN_USERNAME')
  const hasTurnCredential = configured(env, 'CALL_TURN_CREDENTIAL')
  if (hasTurnUrl && !hasTurnUsername) issues.push('CALL_TURN_USERNAME is required when CALL_TURN_URLS is configured')
  if (hasTurnUrl && !hasTurnCredential) issues.push('CALL_TURN_CREDENTIAL is required when CALL_TURN_URLS is configured')
  if (!hasTurnUrl && (hasTurnUsername || hasTurnCredential)) issues.push('CALL_TURN_URLS is required when TURN credentials are configured')
  if (hasTurnUrl) validateConfiguredValue({ env, name: 'CALL_TURN_URLS', issues, minimumLength: 8 })
  if (hasTurnUsername) validateConfiguredValue({ env, name: 'CALL_TURN_USERNAME', issues, minimumLength: 3 })
  if (hasTurnCredential) {
    validateConfiguredValue({ env, name: 'CALL_TURN_CREDENTIAL', issues, minimumLength: 12 })
    validatedSecrets.push('CALL_TURN_CREDENTIAL')
  }

  for (const name of validatedSecrets) {
    if (valueLength(env, name) === 0) issues.push(`${name} is empty`)
  }

  if (issues.length > 0) throw new SecretConfigurationError(issues)

  return {
    mode,
    validatedSecrets: [...new Set(validatedSecrets)].sort(),
    integrations: {
      oauth,
      webPushConfigured,
      emailDeliveryConfigured: configured(env, 'BREVO_API_KEY') && configured(env, 'EMAIL_USER_SENDER'),
      turnConfigured: hasTurnUrl && hasTurnUsername && hasTurnCredential,
    },
  }
}
