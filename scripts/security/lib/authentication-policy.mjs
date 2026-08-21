import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import path from 'node:path'

const GENERATED_JSON = 'docs/security/audit/phase-5/authentication-policy.json'
const GENERATED_MARKDOWN = 'docs/security/audit/phase-5/authentication-policy.md'

export const PHASE5_GENERATED_PATHS = [GENERATED_JSON, GENERATED_MARKDOWN]

const SOURCE_PATHS = Object.freeze({
  identity: 'Backend/Chatify/Utils/authIdentity.mjs',
  accessVerification: 'Backend/Chatify/Utils/authToken.mjs',
  tokenLifecycle: 'Backend/Chatify/Utils/tokenCookieGenerator.mjs',
  sessionBinding: 'Backend/Chatify/Utils/sessionMetadata.mjs',
  userModel: 'Backend/Chatify/Models/userModel.mjs',
  oauthProvider: 'Backend/Chatify/Config/passport.mjs',
  oauthHandoffModel: 'Backend/Chatify/Models/oauthHandoffModel.mjs',
  authController: 'Backend/Chatify/Controller/authController.mjs',
  mfaChallengeModel: 'Backend/Chatify/Models/twoFactorChallengeModel.mjs',
  mfaController: 'Backend/Chatify/Controller/twoFactorController.mjs',
  authRouter: 'Backend/Chatify/Routes/authRouter.mjs',
  app: 'Backend/Chatify/app.mjs',
})

const exists = async (filePath) => {
  try {
    await access(filePath, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

const readSources = async (root, sourcePaths = SOURCE_PATHS) => {
  const output = {}
  for (const [id, relativePath] of Object.entries(sourcePaths)) {
    const absolute = path.join(root, relativePath)
    output[id] = {
      path: relativePath,
      present: await exists(absolute),
      text: await readFile(absolute, 'utf8').catch(() => ''),
    }
  }
  return output
}

const includesAll = (text, values) => values.every((value) => text.includes(value))
const matches = (text, pattern) => pattern.test(text)

const violation = (code, message, paths) => ({
  code,
  message,
  paths: [...new Set(paths)].sort(),
})

const control = ({ id, title, passed, paths, details = [] }) => ({
  id,
  title,
  passed: Boolean(passed),
  paths: [...new Set(paths)].sort(),
  details: [...details].sort(),
})

const evaluateControls = (sources) => {
  const accessVerification = sources.accessVerification.text
  const tokenLifecycle = sources.tokenLifecycle.text
  const sessionBinding = sources.sessionBinding.text
  const identity = sources.identity.text
  const userModel = sources.userModel.text
  const oauthProvider = sources.oauthProvider.text
  const oauthHandoffModel = sources.oauthHandoffModel.text
  const authController = sources.authController.text
  const mfaChallengeModel = sources.mfaChallengeModel.text
  const mfaController = sources.mfaController.text
  const authRouter = sources.authRouter.text
  const app = sources.app.text

  const accessVerificationComplete = includesAll(accessVerification, [
    "algorithms: ['HS256']",
    'issuer:',
    'audience:',
  ])
  const accessClaimsComplete = includesAll(accessVerification, [
    'decoded.sessionId',
    'decoded.jti',
    'decoded.sub',
    'decoded.userId',
    "decoded.type !== 'access'",
  ]) && includesAll(tokenLifecycle, [
    'sessionId',
    "type: 'access'",
    'jti:',
    "algorithm: 'HS256'",
    'issuer:',
    'audience:',
    'subject:',
  ])
  const sessionlessRejected = includesAll(sessionBinding, [
    '!sessionId',
    '!userId',
    "new CustomError('Session expired",
  ]) && !matches(sessionBinding, /legacy\s*:\s*true|return\s+\{\s*legacy/u)
  const accessCookieAligned = includesAll(tokenLifecycle, [
    'durationToMs(ACCESS_TOKEN_EXPIRES_IN)',
    'ACCESS_TOKEN_MAX_AGE_MS',
    'getCookieOptions(ACCESS_TOKEN_MAX_AGE_MS)',
  ])
  const refreshLifecycle = includesAll(tokenLifecycle, [
    "createHash('sha256')",
    'refreshTokenHash',
    'findOneAndUpdate',
    'familyId',
    'replacedByTokenHash',
    'Refresh token already used',
  ])
  const logoutRevocation = includesAll(authController, [
    'revokeSessionById',
    'revokeRefreshSession',
    'clearSessionCookies',
  ])

  const canonicalIdentity = includesAll(identity, [
    ".normalize('NFKC')",
    '.trim()',
    ".toLocaleLowerCase('en-US')",
  ]) && includesAll(userModel, [
    'set: normalizeEmail',
    'lowercase: true',
  ]) && authController.includes('normalizeEmail(req.body.email)')
  const passwordPolicy = includesAll(identity, [
    'Array.from(password).length',
    'MIN_PASSWORD_CODE_POINTS = 12',
    'MAX_PASSWORD_CODE_POINTS = 128',
    'CONTROL_CHARACTER_PATTERN',
    'password.trim()',
  ]) && userModel.includes('validatePasswordPolicy(value)')
    && !matches(userModel, /password:\s*\{[\s\S]{0,450}?trim:\s*true/u)

  const oauthVerifiedEmail = includesAll(oauthProvider, [
    'providerEmail.verified !== true',
    'normalizeEmail(providerEmail.email)',
    'OAuth account linking requires existing user confirmation',
  ])
  const oauthOpaqueHandoff = includesAll(authController, [
    "const OAUTH_HANDOFF_COOKIE = 'chatify_oauth_handoff'",
    'randomBytes(32)',
    'hashOAuthHandoffToken(handoffToken)',
    'res.cookie(OAUTH_HANDOFF_COOKIE',
    'httpOnly: true',
  ]) && oauthHandoffModel.includes('tokenHash')
    && !authController.includes('req.query.token')
    && !authController.includes("purpose: 'oauth_handoff'")
  const oauthAtomicConsumption = includesAll(authController, [
    'OAuthHandoff.findOneAndUpdate',
    'tokenHash: hashOAuthHandoffToken(handoffToken)',
    'consumedAt: null',
    'expiresAt: { $gt: now }',
  ])
  const oauthStateValidatedBeforePersistence = matches(authController, /const createOAuthCallback[\s\S]+stateCookie[\s\S]+safeHashEqual[\s\S]+passport\.authenticate/u)

  const passwordResetAtomic = includesAll(authController, [
    'PasswordReset.findOneAndDelete',
    'matchedResetToken._id',
    'matchedResetToken.tokenHash',
    'assertPasswordPolicy(newPassword)',
  ])
  const mfaBound = includesAll(mfaController, [
    'buildSessionMetadataFromRequest(req)',
    'challenge.userAgentHash',
    'requestMetadata.userAgentHash',
    'challenge.ipHash',
    'requestMetadata.ipHash',
    'safeMetadataHashEqual',
  ]) && includesAll(mfaChallengeModel, ['userAgentHash', 'ipHash'])
  const mfaSessionContainment = includesAll(mfaController, [
    'revokeOtherSessionsForUser',
    'currentSessionId: req.sessionId',
  ])

  const csrfBoundary = app.includes("app.use('/api/auth', csrfProtection, authRouter)")
    || authRouter.includes('requireValidCsrfToken')
  const requiredRateLimitedRoutes = [
    '/signup',
    '/login',
    '/2fa/challenge',
    '/forgot-password',
    '/verify-reset-code',
    '/reset-password',
    '/refresh-token',
    '/logout',
  ]
  const rateLimitedRoutes = requiredRateLimitedRoutes.every((route) => {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`${escaped}[^\n]{0,120}(?:authLimiter|refreshTokenLimiter|passwordResetLimiter|mfaLimiter)`, 'u').test(authRouter)
  })
  const safeAuthenticationLogging = authController.includes("logger.info('auth.logout_completed'")
    && !matches(authController, /console\.(?:log|info|debug|warn|error)\([^\n]*(?:password|token|cookie|email|code)/iu)

  return [
    control({ id: 'access-verification', title: 'Access token verification pins algorithm, issuer, and audience', passed: accessVerificationComplete, paths: [sources.accessVerification.path] }),
    control({ id: 'access-claims', title: 'Access tokens carry and require subject, type, JWT ID, and session ID', passed: accessClaimsComplete, paths: [sources.accessVerification.path, sources.tokenLifecycle.path] }),
    control({ id: 'session-binding', title: 'Every authenticated access token resolves to an active server-side session', passed: sessionlessRejected, paths: [sources.sessionBinding.path] }),
    control({ id: 'access-cookie-duration', title: 'Access-cookie lifetime derives from the configured access-token duration', passed: accessCookieAligned, paths: [sources.tokenLifecycle.path] }),
    control({ id: 'refresh-lifecycle', title: 'Refresh tokens are opaque, hashed, rotating, and family-reuse aware', passed: refreshLifecycle, paths: [sources.tokenLifecycle.path] }),
    control({ id: 'logout-revocation', title: 'Logout independently revokes access and refresh credentials', passed: logoutRevocation, paths: [sources.authController.path, sources.tokenLifecycle.path] }),
    control({ id: 'canonical-identity', title: 'Email identities share one canonical normalization boundary', passed: canonicalIdentity, paths: [sources.identity.path, sources.userModel.path, sources.authController.path, sources.oauthProvider.path] }),
    control({ id: 'password-policy', title: 'Passwords preserve exact content and enforce a 12-128 code-point policy', passed: passwordPolicy, paths: [sources.identity.path, sources.userModel.path] }),
    control({ id: 'oauth-verified-email', title: 'OAuth requires a provider-verified canonical email and explicit linking', passed: oauthVerifiedEmail, paths: [sources.oauthProvider.path] }),
    control({ id: 'oauth-opaque-handoff', title: 'OAuth uses an opaque, hashed, HttpOnly cookie handoff rather than URL credentials', passed: oauthOpaqueHandoff, paths: [sources.authController.path, sources.oauthHandoffModel.path] }),
    control({ id: 'oauth-atomic-consumption', title: 'OAuth handoffs are state-bound, expiring, and atomically consumed', passed: oauthAtomicConsumption && oauthStateValidatedBeforePersistence, paths: [sources.authController.path, sources.oauthHandoffModel.path] }),
    control({ id: 'password-reset-atomic', title: 'Password reset codes are atomically consumed before mutation', passed: passwordResetAtomic, paths: [sources.authController.path] }),
    control({ id: 'mfa-challenge-binding', title: 'Second-factor challenges are bound to request metadata', passed: mfaBound, paths: [sources.mfaChallengeModel.path, sources.mfaController.path] }),
    control({ id: 'mfa-session-containment', title: 'Second-factor security changes revoke every other active session', passed: mfaSessionContainment, paths: [sources.mfaController.path, sources.tokenLifecycle.path] }),
    control({ id: 'auth-csrf-boundary', title: 'Unsafe authentication mutations remain behind signed CSRF validation', passed: csrfBoundary, paths: [sources.app.path, sources.authRouter.path] }),
    control({ id: 'auth-rate-limits', title: 'Authentication mutation routes have explicit bounded rate limiting', passed: rateLimitedRoutes, paths: [sources.authRouter.path] }),
    control({ id: 'safe-auth-logging', title: 'Authentication events use sanitized structured logging', passed: safeAuthenticationLogging, paths: [sources.authController.path] }),
  ].sort((left, right) => left.id.localeCompare(right.id))
}

const violationForControl = (item) => {
  const byId = {
    'access-verification': ['access-verification-incomplete', 'Access-token verification does not pin algorithm, issuer, and audience.'],
    'access-claims': ['access-claims-incomplete', 'Access-token issuance or verification is missing required identity/session claims.'],
    'session-binding': ['sessionless-access-accepted', 'The active-session boundary still accepts a missing server-side session claim.'],
    'access-cookie-duration': ['access-cookie-duration-diverged', 'Access-cookie lifetime is not derived from the configured token duration.'],
    'refresh-lifecycle': ['refresh-rotation-incomplete', 'Refresh-token hashing, rotation, or reuse-family revocation is incomplete.'],
    'logout-revocation': ['logout-revocation-incomplete', 'Logout does not independently revoke both presented credential types.'],
    'canonical-identity': ['identity-canonicalization-incomplete', 'Authentication flows do not share one canonical email identity boundary.'],
    'password-policy': ['password-policy-incomplete', 'Password storage or validation rewrites values or lacks the Phase 5 bounds.'],
    'oauth-verified-email': ['oauth-provider-email-unverified', 'OAuth can accept a provider email that is not explicitly verified or canonical.'],
    'oauth-opaque-handoff': ['oauth-url-credential', 'OAuth handoff still exposes a bearer credential in a URL or lacks a hashed cookie exchange.'],
    'oauth-atomic-consumption': ['oauth-handoff-not-atomic', 'OAuth state validation or one-time handoff consumption is incomplete.'],
    'password-reset-atomic': ['password-reset-not-atomic', 'Password-reset code consumption is not atomic before password mutation.'],
    'mfa-challenge-binding': ['mfa-challenge-unbound', 'Second-factor challenges are not bound to request device metadata.'],
    'mfa-session-containment': ['mfa-session-containment-missing', 'Second-factor security changes do not revoke other sessions.'],
    'auth-csrf-boundary': ['auth-route-csrf-missing', 'Authentication mutations are not covered by the signed CSRF boundary.'],
    'auth-rate-limits': ['auth-route-rate-limit-missing', 'One or more authentication mutation routes lack explicit bounded rate limiting.'],
    'safe-auth-logging': ['auth-sensitive-logging-risk', 'Authentication events are not constrained to sanitized structured logging.'],
  }
  const [code, message] = byId[item.id]
  return violation(code, message, item.paths)
}

export const buildAuthenticationPolicy = async (root, { sourcePaths = SOURCE_PATHS } = {}) => {
  const sources = await readSources(root, sourcePaths)
  const controls = evaluateControls(sources)
  const missingSources = Object.values(sources).filter((source) => !source.present)
  const violations = [
    ...missingSources.map((source) => violation('authentication-source-missing', `Required authentication source is missing: ${source.path}`, [source.path])),
    ...controls.filter((item) => !item.passed).map(violationForControl),
  ].sort((left, right) => `${left.code}:${left.paths.join(',')}`.localeCompare(`${right.code}:${right.paths.join(',')}`))

  const controlState = Object.fromEntries(controls.map((item) => [item.id, item.passed]))
  const exitGate = {
    requiredSourcesPresent: missingSources.length === 0,
    accessTokensStrictAndSessionBound: controlState['access-verification'] && controlState['access-claims'] && controlState['session-binding'],
    tokenLifecycleControlled: controlState['access-cookie-duration'] && controlState['refresh-lifecycle'] && controlState['logout-revocation'],
    identitiesAndPasswordsCanonical: controlState['canonical-identity'] && controlState['password-policy'],
    oauthExchangeControlled: controlState['oauth-verified-email'] && controlState['oauth-opaque-handoff'] && controlState['oauth-atomic-consumption'],
    recoveryAndMfaControlled: controlState['password-reset-atomic'] && controlState['mfa-challenge-binding'] && controlState['mfa-session-containment'],
    authenticationRoutesProtected: controlState['auth-csrf-boundary'] && controlState['auth-rate-limits'],
    authenticationLoggingSanitized: controlState['safe-auth-logging'],
    noPolicyViolations: violations.length === 0,
  }

  return {
    schemaVersion: 1,
    phase: 5,
    policy: 'authentication-and-session-security',
    sources: Object.values(sources)
      .map(({ path: sourcePath, present }) => ({ path: sourcePath, present }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    controls,
    violations,
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

export const renderAuthenticationPolicyMarkdown = (report) => [
  '# Phase 5 Authentication and Session Policy',
  '',
  'This deterministic evidence records reviewed authentication controls without storing passwords, tokens, reset codes, cookies, OAuth handoffs, email addresses, or runtime command output.',
  '',
  '## Controls',
  '',
  markdownTable(['Control', 'Passed', 'Source'], report.controls.map((item) => [item.title, item.passed, item.paths.join('<br>')])),
  '',
  '## Violations',
  '',
  report.violations.length
    ? markdownTable(['Code', 'Description', 'Source'], report.violations.map((item) => [item.code, item.message, item.paths.join('<br>')]))
    : 'No policy violations.',
  '',
  '## Exit gate',
  '',
  markdownTable(['Requirement', 'Passed'], Object.entries(report.exitGate).map(([key, value]) => [key, value])),
  '',
  'A passing report proves the reviewed source tree contains the required controls. Runtime behavior remains covered by the Phase 5 authentication regression and reproduction suites.',
].join('\n')

const generatedContents = (report) => ({
  [GENERATED_JSON]: `${JSON.stringify(report, null, 2)}\n`,
  [GENERATED_MARKDOWN]: `${renderAuthenticationPolicyMarkdown(report)}\n`,
})

export const writeGeneratedAuthenticationPolicy = async (root, report) => {
  const contents = generatedContents(report)
  for (const [relativePath, content] of Object.entries(contents)) {
    const absolute = path.join(root, relativePath)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, content)
  }
  return { files: Object.keys(contents) }
}

export const checkGeneratedAuthenticationPolicy = async (root, report) => {
  for (const [relativePath, expected] of Object.entries(generatedContents(report))) {
    try {
      if (await readFile(path.join(root, relativePath), 'utf8') !== expected) return false
    } catch {
      return false
    }
  }
  return true
}

export const assertPhase5ExitGate = (report) => {
  const failed = Object.entries(report.exitGate)
    .filter(([, passed]) => !passed)
    .map(([name]) => name)
  if (failed.length > 0) throw new Error(`Phase 5 exit gate failed: ${failed.join(', ')}`)
  return true
}
