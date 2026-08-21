import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  assertPhase5ExitGate,
  buildAuthenticationPolicy,
  checkGeneratedAuthenticationPolicy,
  renderAuthenticationPolicyMarkdown,
  writeGeneratedAuthenticationPolicy,
} from '../lib/authentication-policy.mjs'

const write = async (root, relative, content) => {
  const target = path.join(root, relative)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content)
}

const healthySources = {
  'Backend/Chatify/Utils/authIdentity.mjs': `export const normalizeEmail = value => String(value).normalize('NFKC').trim().toLocaleLowerCase('en-US')
export const validatePasswordPolicy = password => Array.from(password).length >= 12 && Array.from(password).length <= 128 && password.trim() && !/[\\u0000-\\u001f\\u007f-\\u009f]/u.test(password)
`,
  'Backend/Chatify/Utils/authToken.mjs': `jwt.verify(token, key, { algorithms: ['HS256'], issuer: 'chatify-api', audience: 'chatify-web' })
if (!decoded.sessionId || !decoded.jti || decoded.sub !== decoded.userId || decoded.type !== 'access') throw new Error()
`,
  'Backend/Chatify/Utils/tokenCookieGenerator.mjs': `durationToMs(ACCESS_TOKEN_EXPIRES_IN)
jsonwebtoken.sign({ userId, sessionId, type: 'access', jti: randomUUID() }, key, { algorithm: 'HS256', issuer: ACCESS_TOKEN_ISSUER, audience: ACCESS_TOKEN_AUDIENCE, subject: userId })
createHash('sha256').update(refreshToken)
findOneAndUpdate({ refreshTokenHash, revokedAt: null })
revokeSessionById({ sessionId, userId })
revokeOtherSessionsForUser({ userId, currentSessionId })
`,
  'Backend/Chatify/Utils/sessionMetadata.mjs': `if (!sessionId || !userId) throw new CustomError('Session expired', 401)
findActiveSession({ sessionId, userId })
`,
  'Backend/Chatify/Models/userModel.mjs': `email: { set: normalizeEmail, lowercase: true }
password: { validate: { validator(value) { return validatePasswordPolicy(value).ok } }, select: false }
`,
  'Backend/Chatify/Config/passport.mjs': `if (providerEmail.verified !== true) throw new Error('verified email')
const email = normalizeEmail(providerEmail.email)
if (existingEmailUser) throw new Error('confirmation')
`,
  'Backend/Chatify/Models/oauthHandoffModel.mjs': `tokenHash: { type: String, required: true, unique: true }
expiresAt: { type: Date, required: true }
`,
  'Backend/Chatify/Controller/authController.mjs': `const OAUTH_HANDOFF_COOKIE = 'chatify_oauth_handoff'
const handoffToken = randomBytes(32).toString('base64url')
OAuthHandoff.create({ tokenHash: hashOAuthHandoffToken(handoffToken), stateHash: hashOAuthState(state) })
res.cookie(OAUTH_HANDOFF_COOKIE, handoffToken, { httpOnly: true, sameSite: 'lax' })
OAuthHandoff.findOneAndUpdate({ tokenHash: hashOAuthHandoffToken(handoffToken), consumedAt: null, expiresAt: { $gt: now } })
const resetToken = await PasswordReset.findOneAndDelete({ _id: matchedResetToken._id, tokenHash: matchedResetToken.tokenHash })
revokeSessionById({ sessionId: verified.sessionId, userId: verified.userId })
normalizeEmail(req.body.email)
assertPasswordPolicy(newPassword)
logger.info('auth.logout_completed', { userId, accessSessionRevoked, refreshSessionRevoked })
`,
  'Backend/Chatify/Models/twoFactorChallengeModel.mjs': `userAgentHash: { type: String, select: false }
ipHash: { type: String, select: false }
`,
  'Backend/Chatify/Controller/twoFactorController.mjs': `buildSessionMetadataFromRequest(req)
safeMetadataHashEqual(challenge.userAgentHash, requestMetadata.userAgentHash)
safeMetadataHashEqual(challenge.ipHash, requestMetadata.ipHash)
revokeOtherSessionsForUser({ userId: user._id, currentSessionId: req.sessionId })
`,
  'Backend/Chatify/Routes/authRouter.mjs': `router.post('/signup', signupLimiter, requireValidCsrfToken, signup)
router.post('/login', loginLimiter, requireValidCsrfToken, login)
router.post('/logout', authMutationLimiter, requireValidCsrfToken, logout)
router.post('/forgot-password', passwordResetLimiter, requireValidCsrfToken, forgotPassword)
router.post('/reset-password', passwordResetLimiter, requireValidCsrfToken, resetPassword)
router.post('/2fa/challenge', mfaLimiter, requireValidCsrfToken, verifyTwoFactorLogin)
`,
}

const createFixture = async (overrides = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'chatify-phase5-policy-'))
  for (const [relative, content] of Object.entries({ ...healthySources, ...overrides })) {
    await write(root, relative, content)
  }
  return root
}

test('healthy authentication source produces a deterministic passing Phase 5 report', async () => {
  const root = await createFixture()
  const report = await buildAuthenticationPolicy(root)

  assert.equal(report.phase, 5)
  assert.equal(report.violations.length, 0)
  assert.equal(Object.values(report.exitGate).every(Boolean), true)
  assert.doesNotThrow(() => assertPhase5ExitGate(report))
  assert.match(renderAuthenticationPolicyMarkdown(report), /Authentication and Session Policy/)
})

test('sessionless or weakly verified access tokens fail closed', async () => {
  const root = await createFixture({
    'Backend/Chatify/Utils/authToken.mjs': `jwt.verify(token, key, { algorithms: ['HS256'] })
if (!decoded.userId) throw new Error()
`,
    'Backend/Chatify/Utils/sessionMetadata.mjs': `if (!sessionId) return { legacy: true, session: null }
`,
  })
  const report = await buildAuthenticationPolicy(root)
  assert.deepEqual(
    report.violations.map((item) => item.code).filter((code) => code.startsWith('access-') || code.startsWith('session-')),
    ['access-claims-incomplete', 'access-verification-incomplete', 'sessionless-access-accepted'],
  )
  assert.throws(() => assertPhase5ExitGate(report), /Phase 5/)
})

test('URL OAuth credentials and unverified provider email fail closed', async () => {
  const root = await createFixture({
    'Backend/Chatify/Config/passport.mjs': `const email = profile.emails[0].value
User.create({ email, isVerified: false })
`,
    'Backend/Chatify/Controller/authController.mjs': `jsonwebtoken.sign({ purpose: 'oauth_handoff' })
res.redirect(buildOAuthFinalizeUrl(token))
const token = req.query.token
`,
  })
  const report = await buildAuthenticationPolicy(root)
  assert.equal(report.violations.some((item) => item.code === 'oauth-provider-email-unverified'), true)
  assert.equal(report.violations.some((item) => item.code === 'oauth-url-credential'), true)
  assert.equal(report.violations.some((item) => item.code === 'oauth-handoff-not-atomic'), true)
})

test('non-atomic recovery and unbound second-factor challenges fail closed', async () => {
  const root = await createFixture({
    'Backend/Chatify/Controller/authController.mjs': `const resetToken = await PasswordReset.findOne({ email })
user.password = newPassword
await resetToken.deleteOne()
`,
    'Backend/Chatify/Controller/twoFactorController.mjs': `TwoFactorChallenge.create({ userId: user._id })
await issueSessionCookies({ user, res })
`,
  })
  const report = await buildAuthenticationPolicy(root)
  assert.equal(report.violations.some((item) => item.code === 'password-reset-not-atomic'), true)
  assert.equal(report.violations.some((item) => item.code === 'mfa-challenge-unbound'), true)
  assert.equal(report.violations.some((item) => item.code === 'mfa-session-containment-missing'), true)
})

test('unsafe authentication routes require both CSRF and bounded rate limiting', async () => {
  const root = await createFixture({
    'Backend/Chatify/Routes/authRouter.mjs': `router.post('/signup', signup)
router.post('/login', login)
router.post('/reset-password', resetPassword)
`,
  })
  const report = await buildAuthenticationPolicy(root)
  assert.equal(report.violations.some((item) => item.code === 'auth-route-csrf-missing'), true)
  assert.equal(report.violations.some((item) => item.code === 'auth-route-rate-limit-missing'), true)
})

test('generated Phase 5 evidence is stable and stale output is rejected', async () => {
  const root = await createFixture()
  const report = await buildAuthenticationPolicy(root)
  await writeGeneratedAuthenticationPolicy(root, report)
  assert.equal(await checkGeneratedAuthenticationPolicy(root, report), true)

  await write(root, 'docs/security/audit/phase-5/authentication-policy.md', 'stale\n')
  assert.equal(await checkGeneratedAuthenticationPolicy(root, report), false)

  const json = await readFile(path.join(root, 'docs/security/audit/phase-5/authentication-policy.json'), 'utf8')
  assert.equal(json.includes(new Date().toISOString()), false)
})
