import assert from 'node:assert/strict'
import { test } from 'vitest'

import { validateSecretConfiguration } from '../../Utils/secretConfiguration.mjs'

const productionEnv = () => ({
  NODE_ENV: 'production',
  SECRET_JWT_KEY: `jwt-${'A1b2'.repeat(10)}`,
  CSRF_SECRET: `csrf-${'C3d4'.repeat(10)}`,
  PASSWORD_RESET_SECRET: `reset-${'E5f6'.repeat(10)}`,
  TWO_FACTOR_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  MONGODB_URL: ['mongodb+srv://', 'chatify-user', ':', 'database-password', '@cluster.example.com/chatify'].join(''),
  FRONTEND_ORIGIN: 'https://chatify.example.com',
  NOTIFICATION_WORKER_ENABLED: '0',
  CHATIFY_NOTIFICATION_DRY_RUN: '1',
})

test('accepts isolated test credentials without production provider configuration', () => {
  const result = validateSecretConfiguration({
    NODE_ENV: 'test',
    SECRET_JWT_KEY: 'test-jwt-secret',
    CSRF_SECRET: 'test-csrf-secret',
    PASSWORD_RESET_SECRET: 'test-reset-secret',
  })

  assert.equal(result.mode, 'test')
  assert.deepEqual(result.validatedSecrets.sort(), [
    'CSRF_SECRET',
    'PASSWORD_RESET_SECRET',
    'SECRET_JWT_KEY',
  ])
  assert.equal(JSON.stringify(result).includes('test-jwt-secret'), false)
})

test('accepts complete production secret configuration and returns names only', () => {
  const env = productionEnv()
  const result = validateSecretConfiguration(env)

  assert.equal(result.mode, 'production')
  assert.ok(result.validatedSecrets.includes('TWO_FACTOR_ENCRYPTION_KEY'))
  assert.equal(JSON.stringify(result).includes(env.SECRET_JWT_KEY), false)
  assert.equal(JSON.stringify(result).includes('database-password'), false)
})

test('rejects missing, short, placeholder, and reused cryptographic secrets', () => {
  const missing = productionEnv()
  delete missing.CSRF_SECRET
  assert.throws(() => validateSecretConfiguration(missing), /CSRF_SECRET/)

  const weak = productionEnv()
  weak.SECRET_JWT_KEY = 'replace-with-a-secret'
  assert.throws(() => validateSecretConfiguration(weak), /SECRET_JWT_KEY.*placeholder|placeholder.*SECRET_JWT_KEY/i)

  const reused = productionEnv()
  reused.CSRF_SECRET = reused.SECRET_JWT_KEY
  const error = assert.throws(() => validateSecretConfiguration(reused), /distinct/i)
  assert.equal(String(error).includes(reused.SECRET_JWT_KEY), false)
})

test('requires complete OAuth, web-push, email, and TURN credential groups', () => {
  const oauth = productionEnv()
  oauth.GOOGLE_CLIENT_ID = 'client-id'
  assert.throws(() => validateSecretConfiguration(oauth), /GOOGLE_CLIENT_SECRET/)

  const push = productionEnv()
  push.VAPID_PRIVATE_KEY = ['private', 'key', 'material'].join('-')
  assert.throws(() => validateSecretConfiguration(push), /VAPID_PUBLIC_KEY/)

  const email = productionEnv()
  email.NOTIFICATION_WORKER_ENABLED = '1'
  email.CHATIFY_NOTIFICATION_DRY_RUN = '0'
  assert.throws(() => validateSecretConfiguration(email), /BREVO_API_KEY/)

  const turn = productionEnv()
  turn.CALL_TURN_URLS = 'turns:turn.example.com:5349'
  assert.throws(() => validateSecretConfiguration(turn), /CALL_TURN_USERNAME|CALL_TURN_CREDENTIAL/)
})

test('requires production HTTPS origin, usable database URL, and 32-byte 2FA key', () => {
  const origin = productionEnv()
  origin.FRONTEND_ORIGIN = 'http://chatify.example.com'
  assert.throws(() => validateSecretConfiguration(origin), /FRONTEND_ORIGIN.*HTTPS/i)

  const database = productionEnv()
  database.MONGODB_URL = 'mongodb://localhost:27017/chatify'
  assert.throws(() => validateSecretConfiguration(database), /MONGODB_URL.*nonlocal/i)

  const twoFactor = productionEnv()
  twoFactor.TWO_FACTOR_ENCRYPTION_KEY = 'not-32-bytes'
  assert.throws(() => validateSecretConfiguration(twoFactor), /TWO_FACTOR_ENCRYPTION_KEY/)
})

test('validation errors identify variable names without disclosing configured values', () => {
  const env = productionEnv()
  env.GITHUB_CLIENT_ID = 'configured-client-id'
  const error = assert.throws(() => validateSecretConfiguration(env), /GITHUB_CLIENT_SECRET/)
  const message = String(error)

  assert.equal(message.includes('configured-client-id'), false)
  assert.equal(message.includes(env.SECRET_JWT_KEY), false)
  assert.equal(message.includes('database-password'), false)
})

test('rejects placeholder and undersized configured provider credentials', () => {
  const oauth = productionEnv()
  oauth.GOOGLE_CLIENT_ID = 'your-google-client-id'
  oauth.GOOGLE_CLIENT_SECRET = 'your-google-client-secret'
  assert.throws(
    () => validateSecretConfiguration(oauth),
    /GOOGLE_CLIENT_ID.*placeholder|GOOGLE_CLIENT_SECRET.*placeholder|placeholder.*GOOGLE/i
  )

  const push = productionEnv()
  push.VAPID_PUBLIC_KEY = 'your-vapid-public-key'
  push.VAPID_PRIVATE_KEY = 'your-vapid-private-key'
  push.VAPID_SUBJECT = 'mailto:alerts@chatify.invalid'
  assert.throws(
    () => validateSecretConfiguration(push),
    /VAPID_PUBLIC_KEY.*placeholder|VAPID_PRIVATE_KEY.*placeholder|placeholder.*VAPID/i
  )

  const email = productionEnv()
  email.NOTIFICATION_WORKER_ENABLED = '1'
  email.CHATIFY_NOTIFICATION_DRY_RUN = '0'
  email.BREVO_API_KEY = 'your-brevo-api-key'
  email.EMAIL_USER_SENDER = 'alerts@chatify.invalid'
  assert.throws(
    () => validateSecretConfiguration(email),
    /BREVO_API_KEY.*placeholder|placeholder.*BREVO_API_KEY/i
  )

  const turn = productionEnv()
  turn.CALL_TURN_URLS = 'turns:relay.chatify.invalid:5349'
  turn.CALL_TURN_USERNAME = 'turn-user'
  turn.CALL_TURN_CREDENTIAL = 'short'
  assert.throws(
    () => validateSecretConfiguration(turn),
    /CALL_TURN_CREDENTIAL.*at least 12/i
  )
})
